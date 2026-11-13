import { afterEach, describe, expect, it, vi } from "vitest";
import {
  THREAT_LOG_CACHE_KEY,
  WebStorageThreatLogCache,
} from "../../src/infrastructure/cache/web-storage-threat-log-cache";
import { ORGANIZATIONS } from "../../src/infrastructure/data/organizations.data";
import { StaticOrganizationRepository } from "../../src/infrastructure/data/static-organization-repository";
import {
  SansIscOsintGateway,
  type HttpFetch,
} from "../../src/infrastructure/osint/sans-isc-osint-gateway";
import { IntervalScheduler } from "../../src/infrastructure/system/interval-scheduler";
import { MathRandomSource } from "../../src/infrastructure/system/math-random-source";
import { SystemClock } from "../../src/infrastructure/system/system-clock";
import { makeThreatLog } from "../support/fakes";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

function routedFetch(routes: Record<string, () => Promise<Response>>): HttpFetch {
  return (url) => {
    const match = Object.keys(routes).find((fragment) => url.includes(fragment));
    return match
      ? routes[match]!()
      : Promise.reject(new Error(`rota inesperada: ${url}`));
  };
}

describe("SansIscOsintGateway", () => {
  it("traduz as respostas da API para o contrato da aplicação", async () => {
    const gateway = new SansIscOsintGateway(
      routedFetch({
        "/infocon": () => Promise.resolve(json({ status: "green" })),
        "/topips": () =>
          Promise.resolve(
            json([
              { source: "1.1.1.1", targetport: 22, count: 9 },
              { ip: "2.2.2.2", attacks: 4 },
              "lixo",
            ]),
          ),
      }),
    );

    await expect(gateway.fetchSnapshot()).resolves.toEqual({
      infoconStatus: "green",
      topAttackers: [
        { sourceIp: "1.1.1.1", targetPort: 22, eventCount: 9 },
        { sourceIp: "2.2.2.2", targetPort: undefined, eventCount: 4 },
        { sourceIp: undefined, targetPort: undefined, eventCount: undefined },
      ],
    });
  });

  it("consulta os endpoints configurados com sinal de cancelamento", async () => {
    const httpFetch = vi.fn<HttpFetch>(() => Promise.resolve(json({})));
    const gateway = new SansIscOsintGateway(httpFetch, {
      baseUrl: "https://exemplo.test/api",
      timeoutMs: 1_000,
      topAttackersLimit: 3,
    });

    await gateway.fetchSnapshot();

    const urls = httpFetch.mock.calls.map(([url]) => url);
    expect(urls).toEqual([
      "https://exemplo.test/api/infocon?json",
      "https://exemplo.test/api/topips/records/3?json",
    ]);
    expect(httpFetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("isola a falha de um feed sem invalidar o outro", async () => {
    const gateway = new SansIscOsintGateway(
      routedFetch({
        "/infocon": () => Promise.resolve(json({}, 503)),
        "/topips": () => Promise.resolve(json([{ source: "1.1.1.1" }])),
      }),
    );

    const snapshot = await gateway.fetchSnapshot();

    expect(snapshot.infoconStatus).toBeNull();
    expect(snapshot.topAttackers).toHaveLength(1);
  });

  it("devolve snapshot vazio quando a rede falha ou o formato é inesperado", async () => {
    const gateway = new SansIscOsintGateway(
      routedFetch({
        "/infocon": () => Promise.reject(new TypeError("Failed to fetch")),
        "/topips": () => Promise.resolve(json({ erro: "formato inesperado" })),
      }),
    );

    await expect(gateway.fetchSnapshot()).resolves.toEqual({
      infoconStatus: null,
      topAttackers: [],
    });
  });

  describe("tempo limite", () => {
    afterEach(() => vi.useRealTimers());

    it("aborta as requisições pendentes ao expirar", async () => {
      vi.useFakeTimers();
      const hangingFetch: HttpFetch = (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("abortado")));
        });
      const gateway = new SansIscOsintGateway(hangingFetch, {
        baseUrl: "https://exemplo.test",
        timeoutMs: 4_500,
        topAttackersLimit: 6,
      });

      const pending = gateway.fetchSnapshot();
      await vi.advanceTimersByTimeAsync(4_500);

      await expect(pending).resolves.toEqual({ infoconStatus: null, topAttackers: [] });
    });
  });
});

describe("WebStorageThreatLogCache", () => {
  afterEach(() => window.localStorage.clear());

  it("persiste e recupera os registros", () => {
    const cache = new WebStorageThreatLogCache(window.localStorage);
    const logs = [makeThreatLog({ id: "a" }), makeThreatLog({ id: "b" })];

    cache.save(logs);

    expect(cache.load()).toEqual(logs);
    expect(window.localStorage.getItem(THREAT_LOG_CACHE_KEY)).not.toBeNull();
  });

  it("devolve vazio quando não há cache", () => {
    expect(new WebStorageThreatLogCache(window.localStorage).load()).toEqual([]);
  });

  it.each(["{json inválido", '{"nao":"lista"}'])(
    "devolve vazio para conteúdo corrompido %s",
    (raw) => {
      window.localStorage.setItem(THREAT_LOG_CACHE_KEY, raw);
      expect(new WebStorageThreatLogCache(window.localStorage).load()).toEqual([]);
    },
  );

  it("descarta registros adulterados no armazenamento", () => {
    window.localStorage.setItem(
      THREAT_LOG_CACHE_KEY,
      JSON.stringify([makeThreatLog({ id: "ok" }), { id: "x", ip: "<script>" }]),
    );

    expect(new WebStorageThreatLogCache(window.localStorage).load()).toEqual([
      makeThreatLog({ id: "ok" }),
    ]);
  });

  it("absorve falhas do storage na leitura e na escrita", () => {
    const failingStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const cache = new WebStorageThreatLogCache(failingStorage);

    expect(() => cache.save([makeThreatLog()])).not.toThrow();
    expect(cache.load()).toEqual([]);
  });
});

describe("adaptadores de sistema e dados", () => {
  afterEach(() => vi.useRealTimers());

  it("SystemClock devolve o instante atual", () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    expect(new SystemClock().now().getTime()).toBe(1_700_000_000_000);
  });

  it("MathRandomSource devolve valores em [0, 1)", () => {
    const value = new MathRandomSource().next();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it("IntervalScheduler executa periodicamente até ser cancelado", () => {
    vi.useFakeTimers();
    const task = vi.fn();
    const cancel = new IntervalScheduler().every(1_000, task);

    vi.advanceTimersByTime(3_000);
    cancel();
    vi.advanceTimersByTime(3_000);

    expect(task).toHaveBeenCalledTimes(3);
  });

  it("StaticOrganizationRepository devolve o cadastro com identificadores únicos", () => {
    const all = new StaticOrganizationRepository(ORGANIZATIONS).findAll();

    expect(all).toHaveLength(14);
    expect(new Set(all.map((org) => org.id)).size).toBe(all.length);
  });
});
