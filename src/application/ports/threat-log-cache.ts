import type { ThreatLog } from "../../domain/threat/threat-log";

export interface ThreatLogCache {
  /** Devolve lista vazia quando não há cache válido. Nunca lança exceção. */
  load(): ThreatLog[];
  save(logs: readonly ThreatLog[]): void;
}
