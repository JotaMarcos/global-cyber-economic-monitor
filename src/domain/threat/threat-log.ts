import { SECTOR_IDS, type SectorId } from "../organization/sector";
import { sanitizeIp, sanitizeText } from "../security/sanitizer";

export type ThreatSeverity = "MÉDIA" | "ALTA" | "CRÍTICA";
export type ThreatStatus = "MITIGADO" | "BLOQUEADO";

export interface ThreatLog {
  readonly id: string;
  readonly agency: string;
  readonly ip: string;
  readonly port: number;
  readonly threatType: string;
  readonly targetSector: SectorId;
  readonly severity: ThreatSeverity;
  readonly status: ThreatStatus;
}

/** Registro bruto e não confiável de um atacante reportado por um feed externo. */
export interface AttackerRecord {
  readonly sourceIp: unknown;
  readonly targetPort: unknown;
  readonly eventCount: unknown;
}

export const MAX_THREAT_LOGS = 25;

const LIVE_AGENCY = "SANS ISC / DShield (Live)";
const DEFAULT_PORT = 443;
const CRITICAL_RANK_LIMIT = 2;
const SECTOR_ROTATION: readonly SectorId[] = [
  "TERCIARIO",
  "SECUNDARIO",
  "PRIMARIO",
  "ONG",
];

function toPort(raw: unknown): number {
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : DEFAULT_PORT;
}

function toEventCount(raw: unknown): string {
  const count = Number(raw);
  return Number.isFinite(count) && count > 0 ? String(count) : "N/D";
}

/**
 * Constrói um registro confiável a partir de dados externos. A posição no
 * ranking define a severidade e o setor-alvo atribuído.
 */
export function createThreatLogFromAttacker(
  record: AttackerRecord,
  rank: number,
  batchId: string,
): ThreatLog {
  return {
    id: `sans-${batchId}-${rank}`,
    agency: LIVE_AGENCY,
    ip: sanitizeIp(record.sourceIp),
    port: toPort(record.targetPort),
    threatType: sanitizeText(
      `DShield Top Attacker (${toEventCount(record.eventCount)} eventos)`,
    ),
    targetSector: SECTOR_ROTATION[rank % SECTOR_ROTATION.length]!,
    severity: rank < CRITICAL_RANK_LIMIT ? "CRÍTICA" : "ALTA",
    status: "BLOQUEADO",
  };
}

/** Registros novos entram no topo; o excedente mais antigo é descartado. */
export function mergeThreatLogs(
  incoming: readonly ThreatLog[],
  current: readonly ThreatLog[],
): ThreatLog[] {
  return [...incoming, ...current].slice(0, MAX_THREAT_LOGS);
}

const SEVERITIES: readonly string[] = ["MÉDIA", "ALTA", "CRÍTICA"];
const STATUSES: readonly string[] = ["MITIGADO", "BLOQUEADO"];

/** Valida dados reidratados de armazenamento local, que também não são confiáveis. */
export function isThreatLog(value: unknown): value is ThreatLog {
  if (typeof value !== "object" || value === null) return false;
  const log = value as Record<string, unknown>;
  return (
    typeof log.id === "string" &&
    typeof log.agency === "string" &&
    typeof log.ip === "string" &&
    typeof log.port === "number" &&
    typeof log.threatType === "string" &&
    (SECTOR_IDS as readonly string[]).includes(log.targetSector as string) &&
    SEVERITIES.includes(log.severity as string) &&
    STATUSES.includes(log.status as string)
  );
}
