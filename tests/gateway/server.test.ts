// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agencyDirectorySchema,
  CONTRACT_VERSION,
  territoryDirectorySchema,
  threatSnapshotSchema,
  type AgencyDirectory,
  type TerritoryDirectory,
  type ThreatSnapshot,
} from "../../src/contract/threat-snapshot.ts";
import { createGatewayServer } from "../../src/gateway/infrastructure/http/gateway-server.ts";
import { ClientRateLimiter } from "../../src/gateway/infrastructure/resilience/client-rate-limiter.ts";
import { ObservableState } from "../../src/shared/observable/observable.ts";
import {
  FakeClock,
  makeAgency,
  makeSnapshot,
  makeSubdivisions,
  MemoryLogger,
} from "../support/fakes.ts";

let staticDir: string;
const servers: Server[] = [];

beforeAll(() => {
  staticDir = mkdtempSync(join(tmpdir(), "gcem-static-"));
  mkdirSync(join(staticDir, "assets"));
  writeFileSync(join(staticDir, "index.html"), "<!doctype html><title>painel</title>");
  writeFileSync(join(staticDir, "assets", "app.js"), "console.log('ok')");
});
afterAll(() => rmSync(staticDir, { recursive: true, force: true }));
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.closeAllConnections();
          server.close(resolve);
        }),
    ),
  );
});

interface StartOptions {
  readonly capacity?: number;
  readonly maxStreamClients?: number;
  readonly allowedOrigin?: string | null;
  readonly withStatic?: boolean;
}

async function start(options: StartOptions = {}) {
  const snapshot = new ObservableState<ThreatSnapshot>(makeSnapshot());
  const agencyDirectory = new ObservableState<AgencyDirectory>({
    contractVersion: CONTRACT_VERSION,
    generatedAt: "2026-11-13T12:00:00.000Z",
    agencies: [makeAgency()],
  });
  const territoryDirectory = new ObservableState<TerritoryDirectory>({
    contractVersion: CONTRACT_VERSION,
    generatedAt: "2026-11-13T12:00:00.000Z",
    countryCode: "BR",
    authority: "IBGE",
    subdivisions: makeSubdivisions(),
  });
  const clock = new FakeClock();
  const server = createGatewayServer({
    snapshot,
    agencyDirectory,
    territoryDirectory,
    clock,
    logger: new MemoryLogger(),
    rateLimiter: new ClientRateLimiter(
      { capacity: options.capacity ?? 100, refillPerSecond: 1 },
      clock,
    ),
    staticDir: options.withStatic === false ? null : staticDir,
    allowedOrigin: options.allowedOrigin ?? null,
    maxStreamClients: options.maxStreamClients ?? 5,
    heartbeatMs: 60_000,
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, snapshot };
}

/** Lê o fluxo SSE até acumular a quantidade pedida de eventos `snapshot`. */
async function readSnapshots(
  response: Response,
  count: number,
): Promise<ThreatSnapshot[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const snapshots: ThreatSnapshot[] = [];

  while (snapshots.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const data = block.split("\n").find((line) => line.startsWith("data: "));
      if (block.includes("event: snapshot") && data) {
        snapshots.push(JSON.parse(data.slice(6)) as ThreatSnapshot);
      }
    }
  }
  await reader.cancel();
  return snapshots;
}

describe("gateway HTTP: API", () => {
  it("serve o retrato em conformidade com o contrato, sem cache", async () => {
    const { base } = await start();

    const response = await fetch(`${base}/api/v1/snapshot`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(threatSnapshotSchema.safeParse(await response.json()).success).toBe(true);
  });

  it("serve o diretório de agências em conformidade com o contrato", async () => {
    const { base } = await start();

    const body: unknown = await (await fetch(`${base}/api/v1/agencies`)).json();

    expect(agencyDirectorySchema.parse(body).agencies).toHaveLength(1);
  });

  it("serve a divisão territorial oficial em conformidade com o contrato", async () => {
    const { base } = await start();

    const body: unknown = await (await fetch(`${base}/api/v1/territories`)).json();
    const directory = territoryDirectorySchema.parse(body);

    expect(directory.countryCode).toBe("BR");
    expect(directory.subdivisions.map((subdivision) => subdivision.code)).toEqual([
      "AM",
      "SP",
    ]);
  });

  it("resume a saúde do serviço", async () => {
    const { base, snapshot } = await start();

    expect(await (await fetch(`${base}/api/v1/health`)).json()).toMatchObject({
      status: "ok",
      sourcesOnline: 2,
      sourcesTotal: 2,
    });

    const current = snapshot.getValue();
    snapshot.set({
      ...current,
      sources: current.sources.map((source, index) =>
        index === 0 ? { ...source, health: "OFFLINE" as const } : source,
      ),
    });
    expect(await (await fetch(`${base}/api/v1/health`)).json()).toMatchObject({
      status: "degraded",
      sourcesOnline: 1,
    });
  });

  it("responde 404 para rota de API inexistente", async () => {
    const { base } = await start();

    const response = await fetch(`${base}/api/v1/inexistente`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { status: 404, message: "Rota inexistente." },
    });
  });

  it.each(["POST", "PUT", "DELETE", "PATCH"])("recusa o método %s", async (method) => {
    const { base } = await start();

    const response = await fetch(`${base}/api/v1/snapshot`, { method });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });

  it("limita a taxa de requisições por cliente", async () => {
    const { base } = await start({ capacity: 2 });

    const statuses = [];
    for (let i = 0; i < 3; i += 1) {
      statuses.push((await fetch(`${base}/api/v1/health`)).status);
    }

    expect(statuses).toEqual([200, 200, 429]);
  });

  it("envia cabeçalhos de segurança em todas as respostas", async () => {
    const { base } = await start();

    for (const path of ["/api/v1/snapshot", "/", "/api/v1/inexistente"]) {
      const { headers } = await fetch(`${base}${path}`);
      expect(headers.get("content-security-policy"), path).toContain(
        "default-src 'self'",
      );
      expect(headers.get("x-content-type-options"), path).toBe("nosniff");
      expect(headers.get("x-frame-options"), path).toBe("DENY");
      expect(headers.get("referrer-policy"), path).toBe("no-referrer");
    }
  });

  it("só libera outra origem quando configurada", async () => {
    const closed = await start();
    const open = await start({ allowedOrigin: "https://painel.exemplo.org" });

    expect(
      (await fetch(`${closed.base}/api/v1/health`)).headers.get(
        "access-control-allow-origin",
      ),
    ).toBeNull();
    expect(
      (await fetch(`${open.base}/api/v1/health`)).headers.get(
        "access-control-allow-origin",
      ),
    ).toBe("https://painel.exemplo.org");
  });
});

describe("gateway HTTP: fluxo contínuo (SSE)", () => {
  it("entrega o retrato atual ao conectar e cada atualização posterior", async () => {
    const { base, snapshot } = await start();
    const response = await fetch(`${base}/api/v1/stream`);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const pending = readSnapshots(response, 2);
    setTimeout(() => snapshot.set(makeSnapshot({ infoconLevel: "RED" })), 20);
    const received = await pending;

    expect(received.map((item) => item.infoconLevel)).toEqual(["GREEN", "RED"]);
    expect(threatSnapshotSchema.safeParse(received[1]).success).toBe(true);
  });

  it("recusa novas conexões acima do limite e libera a vaga ao desconectar", async () => {
    const { base } = await start({ maxStreamClients: 1 });
    const controller = new AbortController();
    const first = await fetch(`${base}/api/v1/stream`, { signal: controller.signal });

    const refused = await fetch(`${base}/api/v1/stream`);
    expect(first.status).toBe(200);
    expect(refused.status).toBe(503);
    expect(refused.headers.get("retry-after")).toBe("30");

    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const controllerAfter = new AbortController();
    const accepted = await fetch(`${base}/api/v1/stream`, {
      signal: controllerAfter.signal,
    });
    expect(accepted.status).toBe(200);
    controllerAfter.abort();
  });
});

describe("gateway HTTP: arquivos estáticos", () => {
  it("serve o index na raiz e em rotas da aplicação", async () => {
    const { base } = await start();

    for (const path of ["/", "/qualquer/rota"]) {
      const response = await fetch(`${base}${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(response.headers.get("cache-control")).toBe("no-cache");
      expect(await response.text()).toContain("painel");
    }
  });

  it("serve os assets com cache de longa duração", async () => {
    const { base } = await start();

    const response = await fetch(`${base}/assets/app.js`);

    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(response.headers.get("cache-control")).toContain("immutable");
  });

  it("responde HEAD sem corpo", async () => {
    const { base } = await start();

    const response = await fetch(`${base}/`, { method: "HEAD" });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it.each(["/assets/inexistente.js", "/%E0%A4%A", "/..%2f..%2fetc%2fpasswd.txt"])(
    "responde 404 para %s, sem sair do diretório público",
    async (path) => {
      const { base } = await start();

      expect((await fetch(`${base}${path}`)).status).toBe(404);
    },
  );

  it("responde 404 quando não há diretório estático configurado", async () => {
    const { base } = await start({ withStatic: false });

    expect((await fetch(`${base}/`)).status).toBe(404);
  });
});
