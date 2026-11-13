import { Container, createToken } from "../../shared/di/container.ts";
import {
  createDashboardState,
  type DashboardState,
} from "../application/dashboard-state.ts";
import { MonitorThreatFeedUseCase } from "../application/monitor-threat-feed.ts";
import type { ThreatFeed } from "../application/threat-feed.ts";
import { UpdateFilterUseCase } from "../application/update-filter.ts";
import { HttpThreatFeed } from "../infrastructure/http-threat-feed.ts";
import type { DashboardDependencies } from "../presentation/dashboard-dependencies.ts";

export const GATEWAY_BASE_URL = "/api/v1";

export const TOKENS = {
  state: createToken<DashboardState>("DashboardState"),
  threatFeed: createToken<ThreatFeed>("ThreatFeed"),
  monitorThreatFeed: createToken<MonitorThreatFeedUseCase>("MonitorThreatFeed"),
  updateFilter: createToken<UpdateFilterUseCase>("UpdateFilter"),
} as const;

/**
 * Raiz de composição do dashboard. Registros podem ser substituídos antes da
 * resolução (ex.: dublê do feed em testes).
 */
export function createContainer(): Container {
  return new Container()
    .registerSingleton(TOKENS.state, () => createDashboardState())
    .registerSingleton(
      TOKENS.threatFeed,
      () =>
        new HttpThreatFeed({
          baseUrl: GATEWAY_BASE_URL,
          httpFetch: (input, init) => fetch(input, init),
          createEventSource: (url) => new EventSource(url),
        }),
    )
    .registerSingleton(
      TOKENS.monitorThreatFeed,
      (c) =>
        new MonitorThreatFeedUseCase(
          c.resolve(TOKENS.threatFeed),
          c.resolve(TOKENS.state),
        ),
    )
    .registerSingleton(
      TOKENS.updateFilter,
      (c) => new UpdateFilterUseCase(c.resolve(TOKENS.state).filter),
    );
}

export function createDashboardDependencies(
  container: Container = createContainer(),
): DashboardDependencies {
  return {
    state: container.resolve(TOKENS.state),
    filterCommands: container.resolve(TOKENS.updateFilter),
    monitoring: container.resolve(TOKENS.monitorThreatFeed),
  };
}
