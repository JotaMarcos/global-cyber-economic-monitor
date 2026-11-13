import type { ThreatLogCache } from "../../application/ports/threat-log-cache";
import { isThreatLog, type ThreatLog } from "../../domain/threat/threat-log";

export const THREAT_LOG_CACHE_KEY = "gcem_osint_swr_cache_v1";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/** Cache sobre Web Storage. Falhas de quota ou de leitura não se propagam. */
export class WebStorageThreatLogCache implements ThreatLogCache {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string = THREAT_LOG_CACHE_KEY,
  ) {}

  load(): ThreatLog[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(this.key) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter(isThreatLog) : [];
    } catch {
      return [];
    }
  }

  save(logs: readonly ThreatLog[]): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(logs));
    } catch {
      // Cache é otimização: quota excedida ou storage bloqueado não é erro fatal.
    }
  }
}
