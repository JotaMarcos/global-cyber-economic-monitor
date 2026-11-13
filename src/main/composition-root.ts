import { DashboardRuntime } from "../application/dashboard-runtime";
import {
  createInitialThreatIntel,
  INITIAL_SECURITY_METRICS,
} from "../application/state/dashboard-state";
import { GetOrganizationOverviewUseCase } from "../application/use-cases/get-organization-overview";
import { InspectTrafficBurstUseCase } from "../application/use-cases/inspect-traffic-burst";
import { RecordTelemetryPointUseCase } from "../application/use-cases/record-telemetry-point";
import { SyncOsintFeedsUseCase } from "../application/use-cases/sync-osint-feeds";
import { ToggleDdosSimulationUseCase } from "../application/use-cases/toggle-ddos-simulation";
import { UpdateOrganizationFilterUseCase } from "../application/use-cases/update-organization-filter";
import { EMPTY_FILTER } from "../domain/organization/organization-filter";
import { WebStorageThreatLogCache } from "../infrastructure/cache/web-storage-threat-log-cache";
import { GEO_HIERARCHY } from "../infrastructure/data/geo-hierarchy.data";
import { INITIAL_TELEMETRY } from "../infrastructure/data/initial-telemetry.data";
import { ORGANIZATIONS } from "../infrastructure/data/organizations.data";
import { OSINT_BASELINE } from "../infrastructure/data/osint-baseline.data";
import { StaticOrganizationRepository } from "../infrastructure/data/static-organization-repository";
import { SansIscOsintGateway } from "../infrastructure/osint/sans-isc-osint-gateway";
import { TimedCircuitBreaker } from "../infrastructure/resilience/timed-circuit-breaker";
import { TokenBucketRateLimiter } from "../infrastructure/resilience/token-bucket-rate-limiter";
import { IntervalScheduler } from "../infrastructure/system/interval-scheduler";
import { MathRandomSource } from "../infrastructure/system/math-random-source";
import { SystemClock } from "../infrastructure/system/system-clock";
import type { DashboardDependencies } from "../presentation/dashboard-dependencies";
import { ObservableState } from "../shared/observable/observable";
import { Container } from "./container";
import { TOKENS } from "./tokens";

const RATE_LIMIT = { capacity: 90, refillPerSecond: 30 };
const CIRCUIT_BREAKER = { failureThreshold: 3, resetTimeoutMs: 15_000 };

/**
 * Raiz de composição: único ponto que conhece as implementações concretas.
 * Registros podem ser substituídos antes da resolução (ex.: dublês em testes).
 */
export function createContainer(): Container {
  const container = new Container();

  container
    .registerSingleton(TOKENS.clock, () => new SystemClock())
    .registerSingleton(TOKENS.random, () => new MathRandomSource())
    .registerSingleton(TOKENS.scheduler, () => new IntervalScheduler())
    .registerSingleton(
      TOKENS.rateLimiter,
      (c) => new TokenBucketRateLimiter(RATE_LIMIT, c.resolve(TOKENS.clock)),
    )
    .registerSingleton(
      TOKENS.circuitBreaker,
      (c) => new TimedCircuitBreaker(CIRCUIT_BREAKER, c.resolve(TOKENS.clock)),
    )
    .registerSingleton(
      TOKENS.osintGateway,
      () => new SansIscOsintGateway((input, init) => fetch(input, init)),
    )
    .registerSingleton(
      TOKENS.threatLogCache,
      () => new WebStorageThreatLogCache(window.localStorage),
    )
    .registerSingleton(
      TOKENS.organizationRepository,
      () => new StaticOrganizationRepository(ORGANIZATIONS),
    )
    .registerSingleton(TOKENS.geoHierarchy, () => GEO_HIERARCHY);

  container
    .registerSingleton(
      TOKENS.threatIntel,
      () => new ObservableState(createInitialThreatIntel(OSINT_BASELINE)),
    )
    .registerSingleton(
      TOKENS.securityMetrics,
      () => new ObservableState(INITIAL_SECURITY_METRICS),
    )
    .registerSingleton(TOKENS.telemetry, () => new ObservableState(INITIAL_TELEMETRY))
    .registerSingleton(TOKENS.filter, () => new ObservableState(EMPTY_FILTER))
    .registerSingleton(TOKENS.ddosSimulation, () => new ObservableState(false));

  container
    .registerSingleton(
      TOKENS.syncOsintFeeds,
      (c) =>
        new SyncOsintFeedsUseCase({
          gateway: c.resolve(TOKENS.osintGateway),
          cache: c.resolve(TOKENS.threatLogCache),
          circuitBreaker: c.resolve(TOKENS.circuitBreaker),
          clock: c.resolve(TOKENS.clock),
          threatIntel: c.resolve(TOKENS.threatIntel),
          securityMetrics: c.resolve(TOKENS.securityMetrics),
        }),
    )
    .registerSingleton(
      TOKENS.inspectTrafficBurst,
      (c) =>
        new InspectTrafficBurstUseCase({
          rateLimiter: c.resolve(TOKENS.rateLimiter),
          random: c.resolve(TOKENS.random),
          ddosSimulation: c.resolve(TOKENS.ddosSimulation),
          securityMetrics: c.resolve(TOKENS.securityMetrics),
        }),
    )
    .registerSingleton(
      TOKENS.recordTelemetryPoint,
      (c) =>
        new RecordTelemetryPointUseCase({
          clock: c.resolve(TOKENS.clock),
          random: c.resolve(TOKENS.random),
          ddosSimulation: c.resolve(TOKENS.ddosSimulation),
          telemetry: c.resolve(TOKENS.telemetry),
        }),
    )
    .registerSingleton(
      TOKENS.updateFilter,
      (c) => new UpdateOrganizationFilterUseCase(c.resolve(TOKENS.filter)),
    )
    .registerSingleton(
      TOKENS.toggleDdosSimulation,
      (c) => new ToggleDdosSimulationUseCase(c.resolve(TOKENS.ddosSimulation)),
    )
    .registerSingleton(
      TOKENS.getOrganizationOverview,
      (c) => new GetOrganizationOverviewUseCase(c.resolve(TOKENS.organizationRepository)),
    )
    .registerSingleton(
      TOKENS.runtime,
      (c) =>
        new DashboardRuntime({
          scheduler: c.resolve(TOKENS.scheduler),
          syncOsintFeeds: c.resolve(TOKENS.syncOsintFeeds),
          inspectTrafficBurst: c.resolve(TOKENS.inspectTrafficBurst),
          recordTelemetryPoint: c.resolve(TOKENS.recordTelemetryPoint),
        }),
    );

  return container;
}

/** Projeta o grafo no contrato estreito que a camada de apresentação declara. */
export function createDashboardDependencies(
  container: Container = createContainer(),
): DashboardDependencies {
  const syncOsintFeeds = container.resolve(TOKENS.syncOsintFeeds);
  const toggleDdosSimulation = container.resolve(TOKENS.toggleDdosSimulation);
  const overview = container.resolve(TOKENS.getOrganizationOverview);

  return {
    state: {
      threatIntel: container.resolve(TOKENS.threatIntel),
      securityMetrics: container.resolve(TOKENS.securityMetrics),
      telemetry: container.resolve(TOKENS.telemetry),
      filter: container.resolve(TOKENS.filter),
      ddosSimulation: container.resolve(TOKENS.ddosSimulation),
    },
    commands: {
      syncOsintFeeds: () => syncOsintFeeds.execute(),
      toggleDdosSimulation: () => toggleDdosSimulation.execute(),
      filter: container.resolve(TOKENS.updateFilter),
    },
    queries: {
      getOrganizationOverview: (filter, ddosActive) =>
        overview.execute(filter, ddosActive),
    },
    geoHierarchy: container.resolve(TOKENS.geoHierarchy),
    runtime: container.resolve(TOKENS.runtime),
  };
}
