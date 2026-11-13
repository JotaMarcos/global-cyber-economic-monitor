import { beforeEach, describe, expect, it } from "vitest";
import {
  createInitialThreatIntel,
  INITIAL_SECURITY_METRICS,
  type SecurityMetrics,
  type ThreatIntelState,
} from "../../src/application/state/dashboard-state";
import { SyncOsintFeedsUseCase } from "../../src/application/use-cases/sync-osint-feeds";
import { ObservableState } from "../../src/shared/observable/observable";
import {
  FakeClock,
  InMemoryThreatLogCache,
  makeThreatLog,
  SpyCircuitBreaker,
  StubGateway,
} from "../support/fakes";

const attacker = (sourceIp: string) => ({ sourceIp, targetPort: 22, eventCount: 10 });
const liveSnapshot = {
  infoconStatus: "yellow",
  topAttackers: [attacker("1.1.1.1"), attacker("2.2.2.2")],
};

describe("SyncOsintFeedsUseCase", () => {
  let gateway: StubGateway;
  let cache: InMemoryThreatLogCache;
  let circuitBreaker: SpyCircuitBreaker;
  let threatIntel: ObservableState<ThreatIntelState>;
  let securityMetrics: ObservableState<SecurityMetrics>;

  const baseline = [makeThreatLog({ id: "baseline" })];

  function build(breaker = new SpyCircuitBreaker()): SyncOsintFeedsUseCase {
    circuitBreaker = breaker;
    return new SyncOsintFeedsUseCase({
      gateway,
      cache,
      circuitBreaker,
      clock: new FakeClock(1_000),
      threatIntel,
      securityMetrics,
    });
  }

  beforeEach(() => {
    gateway = new StubGateway(liveSnapshot);
    cache = new InMemoryThreatLogCache();
    threatIntel = new ObservableState(createInitialThreatIntel(baseline));
    securityMetrics = new ObservableState(INITIAL_SECURITY_METRICS);
  });

  it("publica o nível Infocon e os atacantes no topo do feed", async () => {
    await build().execute();

    const state = threatIntel.getValue();
    expect(state.infoconLevel).toBe("YELLOW");
    expect(state.feedStatus).toBe("LIVE");
    expect(state.threatLogs.map((log) => log.ip)).toEqual([
      "1.1.1.1",
      "2.2.2.2",
      "185.220.101.42",
    ]);
    expect(state.threatLogs[0]?.id).toBe("sans-1000-0");
  });

  it("grava em cache o feed consolidado e registra sucesso no circuito", async () => {
    await build().execute();

    expect(cache.stored).toHaveLength(3);
    expect(circuitBreaker.successes).toBe(1);
    expect(circuitBreaker.failures).toBe(0);
  });

  it("processa no máximo seis atacantes por ciclo", async () => {
    gateway.respondWith({
      infoconStatus: null,
      topAttackers: Array.from({ length: 10 }, (_, i) => attacker(`10.0.0.${i}`)),
    });

    await build().execute();

    expect(threatIntel.getValue().threatLogs).toHaveLength(6 + baseline.length);
  });

  it("aceita sucesso parcial quando só o Infocon responde", async () => {
    gateway.respondWith({ infoconStatus: "red", topAttackers: [] });

    await build().execute();

    expect(threatIntel.getValue()).toMatchObject({
      infoconLevel: "RED",
      feedStatus: "LIVE",
      threatLogs: baseline,
    });
    expect(cache.stored).toEqual([]);
  });

  it("recorre ao cache quando o gateway falha", async () => {
    gateway.respondWith(new Error("rede indisponível"));
    cache.stored = [makeThreatLog({ id: "em-cache" })];

    await build().execute();

    expect(threatIntel.getValue()).toMatchObject({
      feedStatus: "CACHE_FALLBACK",
      threatLogs: [{ id: "em-cache" }],
    });
    expect(circuitBreaker.failures).toBe(1);
  });

  it("trata resposta sem dados utilizáveis como falha e preserva o feed atual", async () => {
    gateway.respondWith({ infoconStatus: "invalido", topAttackers: [] });

    await build().execute();

    expect(threatIntel.getValue()).toMatchObject({
      feedStatus: "CACHE_FALLBACK",
      threatLogs: baseline,
    });
    expect(circuitBreaker.failures).toBe(1);
  });

  it("não consulta o gateway com o circuito aberto e publica o estado", async () => {
    await build(new SpyCircuitBreaker("OPEN", false)).execute();

    expect(gateway.calls).toBe(0);
    expect(securityMetrics.getValue().circuitState).toBe("OPEN");
    expect(threatIntel.getValue().feedStatus).toBe("BASELINE");
  });

  it("sinaliza sincronização em andamento e a encerra ao final", async () => {
    const syncingHistory: boolean[] = [];
    threatIntel.subscribe((state) => syncingHistory.push(state.isSyncing));

    await build().execute();

    expect(syncingHistory[0]).toBe(true);
    expect(syncingHistory.at(-1)).toBe(false);
  });
});
