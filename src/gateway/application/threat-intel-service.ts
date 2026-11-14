import {
  CONTRACT_VERSION,
  type Agency,
  type AgencyDirectory,
  type Attacker,
  type C2Server,
  type CriticalCve,
  type ExploitedVulnerability,
  type HijackedNetworks,
  type Incident,
  type InfoconLevel,
  type LossReference,
  type Subdivision,
  type TerritoryDirectory,
  type ThreatSnapshot,
} from "../../contract/threat-snapshot.ts";
import {
  ObservableState,
  type ReadonlyObservable,
} from "../../shared/observable/observable.ts";
import type { CancelSchedule, Clock, Scheduler } from "./ports.ts";
import type { SourceMonitor } from "./source-monitor.ts";

export interface KnownExploitedCatalog {
  readonly total: number;
  readonly ransomwareLinked: number;
  readonly recent: readonly ExploitedVulnerability[];
}

export interface InternetStormReading {
  readonly infoconLevel: InfoconLevel | null;
  readonly topAttackers: readonly Attacker[];
}

export interface ThreatIntelMonitors {
  readonly incidents: SourceMonitor<readonly Incident[]>;
  readonly knownExploited: SourceMonitor<KnownExploitedCatalog>;
  readonly criticalCves: SourceMonitor<readonly CriticalCve[]>;
  readonly internetStorm: SourceMonitor<InternetStormReading>;
  readonly c2Servers: SourceMonitor<readonly C2Server[]>;
  readonly hijackedNetworks: SourceMonitor<HijackedNetworks>;
  readonly agencies: SourceMonitor<readonly Agency[]>;
  /** Divisão territorial oficial do Brasil (referência para filtros). */
  readonly territories: SourceMonitor<readonly Subdivision[]>;
}

const TERRITORY_COUNTRY = "BR";
const TERRITORY_AUTHORITY = "IBGE - Instituto Brasileiro de Geografia e Estatística";

export interface ThreatIntelServiceOptions {
  readonly monitors: ThreatIntelMonitors;
  readonly scheduler: Scheduler;
  readonly clock: Clock;
  readonly lossReference: LossReference;
}

/**
 * Agrega as fontes monitoradas em um retrato único e o republica a cada
 * mudança. Também controla o ciclo de coleta periódica.
 */
export class ThreatIntelService {
  readonly snapshot: ReadonlyObservable<ThreatSnapshot>;
  readonly agencyDirectory: ReadonlyObservable<AgencyDirectory>;
  readonly territoryDirectory: ReadonlyObservable<TerritoryDirectory>;
  private readonly mutableSnapshot: ObservableState<ThreatSnapshot>;
  private readonly mutableDirectory: ObservableState<AgencyDirectory>;
  private readonly mutableTerritories: ObservableState<TerritoryDirectory>;
  private readonly options: ThreatIntelServiceOptions;
  private teardown: CancelSchedule[] = [];

  constructor(options: ThreatIntelServiceOptions) {
    this.options = options;
    this.mutableSnapshot = new ObservableState(this.buildSnapshot());
    this.mutableDirectory = new ObservableState(this.buildDirectory());
    this.mutableTerritories = new ObservableState(this.buildTerritoryDirectory());
    this.snapshot = this.mutableSnapshot;
    this.agencyDirectory = this.mutableDirectory;
    this.territoryDirectory = this.mutableTerritories;
  }

  start(): void {
    if (this.teardown.length > 0) return;
    const { monitors, scheduler } = this.options;
    const all = Object.values(monitors) as SourceMonitor<unknown>[];

    this.teardown = all.flatMap((monitor) => [
      monitor.state.subscribe(() => this.mutableSnapshot.set(this.buildSnapshot())),
      scheduler.every(monitor.refreshIntervalMs, () => void monitor.refresh()),
    ]);
    this.teardown.push(
      monitors.agencies.state.subscribe(() =>
        this.mutableDirectory.set(this.buildDirectory()),
      ),
      monitors.territories.state.subscribe(() =>
        this.mutableTerritories.set(this.buildTerritoryDirectory()),
      ),
    );
    all.forEach((monitor) => void monitor.refresh());
  }

  stop(): void {
    this.teardown.forEach((cancel) => cancel());
    this.teardown = [];
  }

  private buildSnapshot(): ThreatSnapshot {
    const { monitors, clock, lossReference } = this.options;
    const stormData = monitors.internetStorm.state.getValue().data;
    const catalog = monitors.knownExploited.state.getValue().data;
    const hijacked = monitors.hijackedNetworks.state.getValue().data;

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: clock.now().toISOString(),
      sources: Object.values(monitors).map(
        (monitor: SourceMonitor<unknown>) => monitor.state.getValue().status,
      ),
      infoconLevel: stormData.infoconLevel,
      incidents: [...monitors.incidents.state.getValue().data],
      knownExploited: { ...catalog, recent: [...catalog.recent] },
      criticalCves: [...monitors.criticalCves.state.getValue().data],
      c2Servers: [...monitors.c2Servers.state.getValue().data],
      topAttackers: [...stormData.topAttackers],
      hijackedNetworks: {
        networkCount: hijacked.networkCount,
        networksByRegistry: [...hijacked.networksByRegistry],
        asns: [...hijacked.asns],
      },
      lossReference,
    };
  }

  private buildDirectory(): AgencyDirectory {
    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: this.options.clock.now().toISOString(),
      agencies: [...this.options.monitors.agencies.state.getValue().data],
    };
  }

  private buildTerritoryDirectory(): TerritoryDirectory {
    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: this.options.clock.now().toISOString(),
      countryCode: TERRITORY_COUNTRY,
      authority: TERRITORY_AUTHORITY,
      subdivisions: this.options.monitors.territories.state
        .getValue()
        .data.map((subdivision) => ({
          ...subdivision,
          municipalities: [...subdivision.municipalities],
        })),
    };
  }
}
