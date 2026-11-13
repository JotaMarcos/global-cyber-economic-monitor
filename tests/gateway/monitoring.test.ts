// @vitest-environment node
import { describe, expect, it } from "vitest";
import { threatSnapshotSchema } from "../../src/contract/threat-snapshot.ts";
import type { SourceReading, ThreatSource } from "../../src/gateway/application/ports.ts";
import { SourceMonitor } from "../../src/gateway/application/source-monitor.ts";
import {
  createGatewayContainer,
  TOKENS,
} from "../../src/gateway/main/composition-root.ts";
import { DEFAULT_LOSS_REFERENCE, loadConfig } from "../../src/gateway/main/config.ts";
import {
  FakeClock,
  fixture,
  FIXTURE_ROUTES,
  ManualScheduler,
  MemoryLogger,
  SpyCircuitBreaker,
} from "../support/fakes.ts";

type Reader = (signal: AbortSignal) => Promise<SourceReading<string[]>>;

function buildMonitor(reader: Reader, timeoutMs = 1_000) {
  const clock = new FakeClock();
  const circuitBreaker = new SpyCircuitBreaker();
  const logger = new MemoryLogger();
  const source: ThreatSource<string[]> = {
    descriptor: {
      id: "cisa-kev",
      name: "Fonte de teste",
      organization: "Organização",
      homeCountry: "US",
      dataset: "Conjunto",
      url: "https://exemplo.test/feed",
      refreshIntervalMs: 60_000,
      timeoutMs,
    },
    read: reader,
  };
  const monitor = new SourceMonitor({
    source,
    emptyData: [],
    circuitBreaker,
    clock,
    logger,
  });
  return { monitor, clock, circuitBreaker, logger };
}

const ok = (data: string[], rejectedCount = 0): SourceReading<string[]> => ({
  data,
  recordCount: data.length,
  rejectedCount,
});

describe("SourceMonitor", () => {
  it("inicia aguardando, sem dados", () => {
    const { monitor } = buildMonitor(() => Promise.resolve(ok([])));

    expect(monitor.state.getValue()).toMatchObject({
      data: [],
      status: { health: "PENDING", lastSuccessAt: null, refreshIntervalSeconds: 60 },
    });
  });

  it("publica dados, contagens e latência após coleta bem-sucedida", async () => {
    const { monitor, clock, circuitBreaker } = buildMonitor(() => {
      clock.advance(250);
      return Promise.resolve(ok(["a", "b"], 1));
    });

    await monitor.refresh();

    expect(monitor.state.getValue()).toMatchObject({
      data: ["a", "b"],
      status: {
        health: "ONLINE",
        recordCount: 2,
        rejectedCount: 1,
        latencyMs: 250,
        lastError: null,
      },
    });
    expect(circuitBreaker.successes).toBe(1);
  });

  it("registra em log os registros rejeitados na validação", async () => {
    const { monitor, logger } = buildMonitor(() => Promise.resolve(ok(["a"], 3)));

    await monitor.refresh();

    expect(logger.entries).toContainEqual(
      expect.objectContaining({
        level: "warn",
        message: "registros rejeitados na validação",
      }),
    );
  });

  it("fica indisponível quando a primeira coleta falha", async () => {
    const { monitor, circuitBreaker } = buildMonitor(() =>
      Promise.reject(new Error("fetch failed", { cause: new Error("ECONNREFUSED") })),
    );

    await monitor.refresh();

    expect(monitor.state.getValue().status).toMatchObject({
      health: "OFFLINE",
      lastError: "fetch failed (ECONNREFUSED)",
    });
    expect(circuitBreaker.failures).toBe(1);
  });

  it("preserva o último conjunto válido quando uma coleta posterior falha", async () => {
    let fail = false;
    const { monitor } = buildMonitor(() =>
      fail ? Promise.reject(new Error("HTTP 503")) : Promise.resolve(ok(["a"])),
    );
    await monitor.refresh();
    fail = true;

    await monitor.refresh();

    expect(monitor.state.getValue()).toMatchObject({
      data: ["a"],
      status: { health: "STALE", recordCount: 1, lastError: "HTTP 503" },
    });
  });

  it("não consulta a fonte com o circuito aberto", async () => {
    let calls = 0;
    const { monitor, circuitBreaker } = buildMonitor(() => {
      calls += 1;
      return Promise.resolve(ok([]));
    });
    circuitBreaker.allow = false;
    circuitBreaker.state = "OPEN";

    await monitor.refresh();

    expect(calls).toBe(0);
    expect(monitor.state.getValue().status.circuitState).toBe("OPEN");
  });

  it("aborta a coleta que excede o tempo limite", async () => {
    const { monitor } = buildMonitor(
      (signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason as Error)),
        ),
      20,
    );

    await monitor.refresh();

    expect(monitor.state.getValue().status).toMatchObject({
      health: "OFFLINE",
      lastError: "tempo limite excedido",
    });
  });

  it("ignora nova coleta enquanto outra está em andamento", async () => {
    let calls = 0;
    let release: (value: SourceReading<string[]>) => void = () => undefined;
    const { monitor } = buildMonitor(() => {
      calls += 1;
      return new Promise((resolve) => (release = resolve));
    });

    const first = monitor.refresh();
    await monitor.refresh();
    release(ok(["a"]));
    await first;

    expect(calls).toBe(1);
  });
});

describe("gateway composto com as fontes reais (rede substituída por amostras)", () => {
  function build(failingHost?: string) {
    const scheduler = new ManualScheduler();
    const container = createGatewayContainer(loadConfig({}))
      .registerSingleton(TOKENS.scheduler, () => scheduler)
      .registerSingleton(TOKENS.clock, () => new FakeClock())
      .registerSingleton(TOKENS.logger, () => new MemoryLogger())
      .registerSingleton(TOKENS.httpFetch, () => (url: string) => {
        if (failingHost && url.includes(failingHost)) {
          return Promise.resolve(new Response("indisponível", { status: 503 }));
        }
        const match = Object.keys(FIXTURE_ROUTES).find((fragment) =>
          url.includes(fragment),
        );
        return match
          ? Promise.resolve(Response.json(fixture(FIXTURE_ROUTES[match]!)))
          : Promise.reject(new Error(`rota inesperada: ${url}`));
      });
    return { service: container.resolve(TOKENS.service), scheduler };
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

  it("publica um retrato válido pelo contrato com todas as fontes operacionais", async () => {
    const { service } = build();

    service.start();
    await settle();
    const snapshot = service.snapshot.getValue();

    expect(threatSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.sources.map((source) => source.health)).toEqual(
      Array(7).fill("ONLINE"),
    );
    expect(snapshot.incidents.length).toBeGreaterThan(0);
    expect(snapshot.infoconLevel).toBe("GREEN");
    expect(snapshot.lossReference).toEqual(DEFAULT_LOSS_REFERENCE);
    expect(service.agencyDirectory.getValue().agencies.length).toBeGreaterThan(0);
    expect(
      service.territoryDirectory
        .getValue()
        .subdivisions.map((subdivision) => subdivision.code),
    ).toEqual(["AM", "DF", "SP"]);
    service.stop();
  });

  it("isola a falha de uma fonte sem afetar as demais", async () => {
    const { service } = build("api.ransomware.live");

    service.start();
    await settle();
    const { sources, incidents, knownExploited } = service.snapshot.getValue();

    expect(sources.find((source) => source.id === "ransomware-live")).toMatchObject({
      health: "OFFLINE",
      lastError: "HTTP 503 em api.ransomware.live",
    });
    expect(sources.filter((source) => source.health === "ONLINE")).toHaveLength(6);
    expect(incidents).toEqual([]);
    expect(knownExploited.total).toBeGreaterThan(0);
    service.stop();
  });

  it("agenda uma coleta periódica por fonte e as cancela ao parar", () => {
    const { service, scheduler } = build();

    service.start();
    service.start();
    expect(scheduler.activeCount).toBe(7);

    service.stop();
    expect(scheduler.activeCount).toBe(0);
  });

  it("republica o retrato a cada nova coleta", async () => {
    const { service, scheduler } = build();
    service.start();
    await settle();
    let emissions = 0;
    service.snapshot.subscribe(() => (emissions += 1));

    scheduler.fireAll();
    await settle();

    expect(emissions).toBeGreaterThanOrEqual(6);
    service.stop();
  });
});

describe("loadConfig", () => {
  it("aplica os valores padrão", () => {
    expect(loadConfig({})).toEqual({
      host: "127.0.0.1",
      port: 8787,
      staticDir: null,
      allowedOrigin: null,
      lossReference: DEFAULT_LOSS_REFERENCE,
    });
  });

  it("lê as variáveis de ambiente", () => {
    const config = loadConfig({
      HOST: "0.0.0.0",
      PORT: "9000",
      GCEM_STATIC_DIR: "dist",
      GCEM_ALLOWED_ORIGIN: "https://painel.exemplo.org",
      GCEM_LOSS_PER_INCIDENT_USD: "2500000",
      GCEM_LOSS_SOURCE: "Estudo interno",
    });

    expect(config).toMatchObject({
      host: "0.0.0.0",
      port: 9000,
      staticDir: "dist",
      allowedOrigin: "https://painel.exemplo.org",
      lossReference: { perIncidentUsd: 2_500_000, source: "Estudo interno" },
    });
  });

  it("identifica como parâmetro do operador o custo sem fonte declarada", () => {
    expect(loadConfig({ GCEM_LOSS_PER_INCIDENT_USD: "10" }).lossReference.source).toBe(
      "Parâmetro definido pelo operador",
    );
  });

  it.each([
    [{ PORT: "abc" }, "PORT"],
    [{ PORT: "70000" }, "PORT"],
    [{ PORT: "80.5" }, "PORT"],
    [{ GCEM_LOSS_PER_INCIDENT_USD: "-1" }, "GCEM_LOSS_PER_INCIDENT_USD"],
  ])("recusa configuração inválida %o", (env, name) => {
    expect(() => loadConfig(env)).toThrow(name);
  });
});
