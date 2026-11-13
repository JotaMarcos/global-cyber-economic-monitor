import type { SourceId, ThreatSnapshot } from "../../contract/threat-snapshot.ts";
import type { ObservableState } from "../../shared/observable/observable.ts";
import type { DashboardState } from "./dashboard-state.ts";
import type { ThreatFeed, Unsubscribe } from "./threat-feed.ts";

/**
 * Diretório volumoso e de mudança rara, que trafega fora do fluxo contínuo e
 * só é recarregado quando a fonte correspondente registra nova coleta.
 */
class DirectorySync<T> {
  private loadedVersion: string | null = null;
  private readonly sourceId: SourceId;
  private readonly load: () => Promise<T>;
  private readonly target: ObservableState<T>;

  constructor(sourceId: SourceId, load: () => Promise<T>, target: ObservableState<T>) {
    this.sourceId = sourceId;
    this.load = load;
    this.target = target;
  }

  async refresh(snapshot: ThreatSnapshot): Promise<void> {
    const version =
      snapshot.sources.find((source) => source.id === this.sourceId)?.lastSuccessAt ??
      null;
    if (version === null || version === this.loadedVersion) return;

    this.loadedVersion = version;
    try {
      this.target.set(await this.load());
    } catch {
      // Nova tentativa ocorrerá no próximo retrato recebido.
      this.loadedVersion = null;
    }
  }
}

/** Mantém o estado do painel sincronizado com o fluxo do gateway. */
export class MonitorThreatFeedUseCase {
  private readonly feed: ThreatFeed;
  private readonly state: DashboardState;
  private readonly directories: readonly DirectorySync<unknown>[];
  private unsubscribe: Unsubscribe | null = null;

  constructor(feed: ThreatFeed, state: DashboardState) {
    this.feed = feed;
    this.state = state;
    this.directories = [
      new DirectorySync("first-teams", () => feed.loadAgencies(), state.agencies),
      new DirectorySync(
        "ibge-localidades",
        () => feed.loadTerritories(),
        state.territories,
      ),
    ] as DirectorySync<unknown>[];
  }

  start(): void {
    if (this.unsubscribe) return;
    const { connection, snapshot } = this.state;

    connection.update((current) => ({ ...current, status: "CONNECTING" }));
    this.unsubscribe = this.feed.subscribe({
      onSnapshot: (next) => {
        snapshot.set(next);
        this.directories.forEach((directory) => void directory.refresh(next));
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
}
