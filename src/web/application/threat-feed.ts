import type { Agency, ThreatSnapshot } from "../../contract/threat-snapshot.ts";

export type ConnectionStatus = "CONNECTING" | "LIVE" | "RECONNECTING" | "OFFLINE";

export type Unsubscribe = () => void;

export interface ThreatFeedHandlers {
  onSnapshot(snapshot: ThreatSnapshot): void;
  onConnectionChange(status: ConnectionStatus): void;
  /** Mensagem recebida que não atende ao contrato; é descartada. */
  onInvalidMessage(): void;
}

/** Porta de entrada de dados do dashboard. A implementação fala com o gateway. */
export interface ThreatFeed {
  subscribe(handlers: ThreatFeedHandlers): Unsubscribe;
  loadAgencies(): Promise<Agency[]>;
}
