import type { ObservableState } from "../../shared/observable/observable";
import { parseInfoconLevel } from "../../domain/threat/infocon-level";
import {
  createThreatLogFromAttacker,
  mergeThreatLogs,
  MAX_THREAT_LOGS,
  type ThreatLog,
} from "../../domain/threat/threat-log";
import type { CircuitBreaker } from "../ports/circuit-breaker";
import type { Clock } from "../ports/clock";
import type { OsintFeedGateway, OsintSnapshot } from "../ports/osint-feed-gateway";
import type { ThreatLogCache } from "../ports/threat-log-cache";
import type { SecurityMetrics, ThreatIntelState } from "../state/dashboard-state";

const MAX_ATTACKERS_PER_SYNC = 6;

export interface SyncOsintFeedsDependencies {
  readonly gateway: OsintFeedGateway;
  readonly cache: ThreatLogCache;
  readonly circuitBreaker: CircuitBreaker;
  readonly clock: Clock;
  readonly threatIntel: ObservableState<ThreatIntelState>;
  readonly securityMetrics: ObservableState<SecurityMetrics>;
}

/**
 * Sincroniza os feeds OSINT protegido por circuit breaker. Em caso de falha,
 * recorre ao último conjunto válido em cache (stale-while-revalidate).
 */
export class SyncOsintFeedsUseCase {
  constructor(private readonly deps: SyncOsintFeedsDependencies) {}

  async execute(): Promise<void> {
    const { circuitBreaker, threatIntel } = this.deps;

    if (!circuitBreaker.canRequest()) {
      this.publishCircuitState();
      return;
    }

    threatIntel.update((state) => ({ ...state, isSyncing: true }));
    try {
      const snapshot = await this.deps.gateway.fetchSnapshot();
      if (!this.applySnapshot(snapshot)) {
        throw new Error("Nenhum feed OSINT retornou dados utilizáveis.");
      }
      circuitBreaker.recordSuccess();
    } catch {
      circuitBreaker.recordFailure();
      this.fallBackToCache();
    } finally {
      threatIntel.update((state) => ({ ...state, isSyncing: false }));
      this.publishCircuitState();
    }
  }

  /** Devolve `true` se ao menos um feed trouxe dados válidos. */
  private applySnapshot(snapshot: OsintSnapshot): boolean {
    const { threatIntel, cache } = this.deps;
    const infoconLevel = parseInfoconLevel(snapshot.infoconStatus);
    const incoming = this.toThreatLogs(snapshot);

    if (!infoconLevel && incoming.length === 0) return false;

    const current = threatIntel.getValue();
    const threatLogs =
      incoming.length > 0
        ? mergeThreatLogs(incoming, current.threatLogs)
        : current.threatLogs;

    threatIntel.set({
      ...current,
      infoconLevel: infoconLevel ?? current.infoconLevel,
      threatLogs,
      feedStatus: "LIVE",
    });
    if (incoming.length > 0) cache.save(threatLogs);
    return true;
  }

  private toThreatLogs(snapshot: OsintSnapshot): ThreatLog[] {
    const batchId = String(this.deps.clock.now().getTime());
    return snapshot.topAttackers
      .slice(0, MAX_ATTACKERS_PER_SYNC)
      .map((record, rank) => createThreatLogFromAttacker(record, rank, batchId));
  }

  private fallBackToCache(): void {
    const cached = this.deps.cache.load().slice(0, MAX_THREAT_LOGS);
    this.deps.threatIntel.update((state) => ({
      ...state,
      feedStatus: "CACHE_FALLBACK",
      threatLogs: cached.length > 0 ? cached : state.threatLogs,
    }));
  }

  private publishCircuitState(): void {
    const circuitState = this.deps.circuitBreaker.state;
    this.deps.securityMetrics.update((metrics) =>
      metrics.circuitState === circuitState ? metrics : { ...metrics, circuitState },
    );
  }
}
