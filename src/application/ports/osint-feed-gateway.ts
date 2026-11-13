import type { AttackerRecord } from "../../domain/threat/threat-log";

/** Dados brutos de um ciclo de coleta. Cada parte pode falhar isoladamente. */
export interface OsintSnapshot {
  readonly infoconStatus: unknown;
  readonly topAttackers: readonly AttackerRecord[];
}

export interface OsintFeedGateway {
  fetchSnapshot(): Promise<OsintSnapshot>;
}
