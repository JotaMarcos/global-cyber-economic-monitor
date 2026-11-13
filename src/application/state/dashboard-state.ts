import type { InfoconLevel } from "../../domain/threat/infocon-level";
import type { ThreatLog } from "../../domain/threat/threat-log";
import type { CircuitState } from "../ports/circuit-breaker";

export type FeedStatus = "BASELINE" | "LIVE" | "CACHE_FALLBACK";

export interface ThreatIntelState {
  readonly infoconLevel: InfoconLevel;
  readonly threatLogs: readonly ThreatLog[];
  readonly feedStatus: FeedStatus;
  readonly isSyncing: boolean;
}

export interface SecurityMetrics {
  readonly circuitState: CircuitState;
  readonly requestsAccepted: number;
  readonly requestsDropped: number;
  readonly xssBlocked: number;
  readonly currentRps: number;
}

export const INITIAL_SECURITY_METRICS: SecurityMetrics = {
  circuitState: "CLOSED",
  requestsAccepted: 1420,
  requestsDropped: 18,
  xssBlocked: 4,
  currentRps: 38,
};

export function createInitialThreatIntel(
  baseline: readonly ThreatLog[],
): ThreatIntelState {
  return {
    infoconLevel: "GREEN",
    threatLogs: baseline,
    feedStatus: "BASELINE",
    isSyncing: false,
  };
}
