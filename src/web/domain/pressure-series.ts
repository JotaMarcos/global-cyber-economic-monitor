import type { CriticalCve, Incident } from "../../contract/threat-snapshot.ts";

const HOUR_MS = 3_600_000;
export const DEFAULT_WINDOW_HOURS = 72;

export interface PressurePoint {
  /** Início da hora em UTC (ISO 8601). */
  readonly hourStart: string;
  /** Organizações divulgadas por grupos de ransomware na hora. */
  readonly incidents: number;
  /** CVEs de severidade crítica publicadas pelo NIST na hora. */
  readonly criticalCves: number;
}

/**
 * Série horária de pressão de ataques em janela deslizante que termina na
 * hora corrente. Cada ponto conta eventos reais pela data de publicação na
 * fonte; horas sem evento entram com zero para não distorcer a escala.
 */
export function buildPressureSeries(
  incidents: readonly Incident[],
  criticalCves: readonly CriticalCve[],
  now: Date,
  windowHours: number = DEFAULT_WINDOW_HOURS,
): PressurePoint[] {
  const lastHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const firstHour = lastHour - (windowHours - 1) * HOUR_MS;

  const bucketOf = (timestamp: string): number | null => {
    const time = Date.parse(timestamp);
    if (Number.isNaN(time) || time < firstHour || time >= lastHour + HOUR_MS) {
      return null;
    }
    return Math.floor((time - firstHour) / HOUR_MS);
  };

  const incidentCounts = new Array<number>(windowHours).fill(0);
  const cveCounts = new Array<number>(windowHours).fill(0);
  for (const incident of incidents) {
    const bucket = bucketOf(incident.discoveredAt);
    if (bucket !== null) incidentCounts[bucket]! += 1;
  }
  for (const cve of criticalCves) {
    const bucket = bucketOf(cve.publishedAt);
    if (bucket !== null) cveCounts[bucket]! += 1;
  }

  return incidentCounts.map((count, bucket) => ({
    hourStart: new Date(firstHour + bucket * HOUR_MS).toISOString(),
    incidents: count,
    criticalCves: cveCounts[bucket]!,
  }));
}
