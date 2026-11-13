import type { ThreatSnapshot } from "../../contract/threat-snapshot.ts";
import type { DashboardState } from "./dashboard-state.ts";
import type { ThreatFeed, Unsubscribe } from "./threat-feed.ts";

const AGENCY_SOURCE_ID = "first-teams";

/**
 * Mantém o estado do painel sincronizado com o fluxo do gateway. O diretório
 * de agências trafega fora do fluxo, por ser volumoso e mudar raramente: é
 * recarregado apenas quando a fonte correspondente registra nova coleta.
 */
export class MonitorThreatFeedUseCase {
  private readonly feed: ThreatFeed;
  private readonly state: DashboardState;
  private unsubscribe: Unsubscribe | null = null;
  private loadedAgencyVersion: string | null = null;

  constructor(feed: ThreatFeed, state: DashboardState) {
    this.feed = feed;
    this.state = state;
  }

  start(): void {
    if (this.unsubscribe) return;
    const { connection, snapshot } = this.state;

    connection.update((current) => ({ ...current, status: "CONNECTING" }));
    this.unsubscribe = this.feed.subscribe({
      onSnapshot: (next) => {
        snapshot.set(next);
        void this.refreshAgencies(next);
      },
      onConnectionChange: (status) =>
        connection.update((current) => ({ ...current, status })),
      onInvalidMessage: () =>
        connection.update((current) => ({
          ...current,
          invalidMessages: current.invalidMessages + 1,
        })),
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async refreshAgencies(snapshot: ThreatSnapshot): Promise<void> {
    const version =
      snapshot.sources.find((source) => source.id === AGENCY_SOURCE_ID)?.lastSuccessAt ??
      null;
    if (version === null || version === this.loadedAgencyVersion) return;

    this.loadedAgencyVersion = version;
    try {
      this.state.agencies.set(await this.feed.loadAgencies());
    } catch {
      // Nova tentativa ocorrerá no próximo retrato recebido.
      this.loadedAgencyVersion = null;
    }
  }
}
