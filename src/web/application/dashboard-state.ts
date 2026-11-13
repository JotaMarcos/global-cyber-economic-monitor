import type {
  Agency,
  Subdivision,
  ThreatSnapshot,
} from "../../contract/threat-snapshot.ts";
import { ObservableState } from "../../shared/observable/observable.ts";
import { EMPTY_FILTER, type DashboardFilter } from "../domain/filter.ts";
import type { ConnectionStatus } from "./threat-feed.ts";

export interface ConnectionState {
  readonly status: ConnectionStatus;
  /** Mensagens descartadas por violarem o contrato desde o início da sessão. */
  readonly invalidMessages: number;
}

export interface DashboardState {
  readonly snapshot: ObservableState<ThreatSnapshot | null>;
  readonly agencies: ObservableState<readonly Agency[]>;
  readonly territories: ObservableState<readonly Subdivision[]>;
  readonly connection: ObservableState<ConnectionState>;
  readonly filter: ObservableState<DashboardFilter>;
}

export function createDashboardState(): DashboardState {
  return {
    snapshot: new ObservableState<ThreatSnapshot | null>(null),
    agencies: new ObservableState<readonly Agency[]>([]),
    territories: new ObservableState<readonly Subdivision[]>([]),
    connection: new ObservableState<ConnectionState>({
      status: "CONNECTING",
      invalidMessages: 0,
    }),
    filter: new ObservableState(EMPTY_FILTER),
  };
}
