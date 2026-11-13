import type {
  SecurityMetrics,
  ThreatIntelState,
} from "../application/state/dashboard-state";
import type { OrganizationOverview } from "../application/use-cases/get-organization-overview";
import type { GeoHierarchy } from "../domain/geography/geo-hierarchy";
import type { OrganizationFilter } from "../domain/organization/organization-filter";
import type { TelemetryPoint } from "../domain/telemetry/telemetry-point";
import type { ReadonlyObservable } from "../shared/observable/observable";

export interface FilterCommands {
  selectCountry(country: string): void;
  selectState(state: string): void;
  selectCity(city: string): void;
  selectSector(sector: OrganizationFilter["sector"]): void;
  search(searchTerm: string): void;
}

/**
 * Tudo o que a interface precisa do restante do sistema. A apresentação
 * declara o contrato (somente leitura sobre o estado) e a raiz de composição
 * o satisfaz, mantendo a UI independente de implementações concretas.
 */
export interface DashboardDependencies {
  readonly state: {
    readonly threatIntel: ReadonlyObservable<ThreatIntelState>;
    readonly securityMetrics: ReadonlyObservable<SecurityMetrics>;
    readonly telemetry: ReadonlyObservable<readonly TelemetryPoint[]>;
    readonly filter: ReadonlyObservable<OrganizationFilter>;
    readonly ddosSimulation: ReadonlyObservable<boolean>;
  };
  readonly commands: {
    syncOsintFeeds(): Promise<void>;
    toggleDdosSimulation(): void;
    readonly filter: FilterCommands;
  };
  readonly queries: {
    getOrganizationOverview(
      filter: OrganizationFilter,
      ddosSimulationActive: boolean,
    ): OrganizationOverview;
  };
  readonly geoHierarchy: GeoHierarchy;
  readonly runtime: { start(): void; stop(): void };
}
