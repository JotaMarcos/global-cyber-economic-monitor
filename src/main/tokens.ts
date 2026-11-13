import type { DashboardRuntime } from "../application/dashboard-runtime";
import type { CircuitBreaker } from "../application/ports/circuit-breaker";
import type { Clock } from "../application/ports/clock";
import type { OrganizationRepository } from "../application/ports/organization-repository";
import type { OsintFeedGateway } from "../application/ports/osint-feed-gateway";
import type { RandomSource } from "../application/ports/random-source";
import type { RateLimiter } from "../application/ports/rate-limiter";
import type { Scheduler } from "../application/ports/scheduler";
import type { ThreatLogCache } from "../application/ports/threat-log-cache";
import type {
  SecurityMetrics,
  ThreatIntelState,
} from "../application/state/dashboard-state";
import type { GetOrganizationOverviewUseCase } from "../application/use-cases/get-organization-overview";
import type { InspectTrafficBurstUseCase } from "../application/use-cases/inspect-traffic-burst";
import type { RecordTelemetryPointUseCase } from "../application/use-cases/record-telemetry-point";
import type { SyncOsintFeedsUseCase } from "../application/use-cases/sync-osint-feeds";
import type { ToggleDdosSimulationUseCase } from "../application/use-cases/toggle-ddos-simulation";
import type { UpdateOrganizationFilterUseCase } from "../application/use-cases/update-organization-filter";
import type { GeoHierarchy } from "../domain/geography/geo-hierarchy";
import type { OrganizationFilter } from "../domain/organization/organization-filter";
import type { TelemetryPoint } from "../domain/telemetry/telemetry-point";
import type { ObservableState } from "../shared/observable/observable";
import { createToken } from "./container";

export const TOKENS = {
  // Portas de infraestrutura
  clock: createToken<Clock>("Clock"),
  random: createToken<RandomSource>("RandomSource"),
  scheduler: createToken<Scheduler>("Scheduler"),
  rateLimiter: createToken<RateLimiter>("RateLimiter"),
  circuitBreaker: createToken<CircuitBreaker>("CircuitBreaker"),
  osintGateway: createToken<OsintFeedGateway>("OsintFeedGateway"),
  threatLogCache: createToken<ThreatLogCache>("ThreatLogCache"),
  organizationRepository: createToken<OrganizationRepository>("OrganizationRepository"),
  geoHierarchy: createToken<GeoHierarchy>("GeoHierarchy"),

  // Estado observável
  threatIntel: createToken<ObservableState<ThreatIntelState>>("ThreatIntelState"),
  securityMetrics: createToken<ObservableState<SecurityMetrics>>("SecurityMetrics"),
  telemetry: createToken<ObservableState<readonly TelemetryPoint[]>>("Telemetry"),
  filter: createToken<ObservableState<OrganizationFilter>>("OrganizationFilter"),
  ddosSimulation: createToken<ObservableState<boolean>>("DdosSimulation"),

  // Casos de uso
  syncOsintFeeds: createToken<SyncOsintFeedsUseCase>("SyncOsintFeeds"),
  inspectTrafficBurst: createToken<InspectTrafficBurstUseCase>("InspectTrafficBurst"),
  recordTelemetryPoint: createToken<RecordTelemetryPointUseCase>("RecordTelemetryPoint"),
  updateFilter: createToken<UpdateOrganizationFilterUseCase>("UpdateOrganizationFilter"),
  toggleDdosSimulation: createToken<ToggleDdosSimulationUseCase>("ToggleDdosSimulation"),
  getOrganizationOverview: createToken<GetOrganizationOverviewUseCase>(
    "GetOrganizationOverview",
  ),
  runtime: createToken<DashboardRuntime>("DashboardRuntime"),
} as const;
