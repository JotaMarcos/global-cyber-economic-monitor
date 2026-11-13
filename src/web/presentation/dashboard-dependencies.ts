import type {
  Agency,
  Subdivision,
  ThreatSnapshot,
} from "../../contract/threat-snapshot.ts";
import type { ReadonlyObservable } from "../../shared/observable/observable.ts";
import type { ConnectionState } from "../application/dashboard-state.ts";
import type { DashboardFilter } from "../domain/filter.ts";

export interface FilterCommands {
  selectContinent(continent: DashboardFilter["continent"]): void;
  selectCountry(country: string): void;
  selectState(state: string): void;
  selectMunicipality(municipality: string): void;
  selectSector(sector: string): void;
  search(searchTerm: string): void;
  clear(): void;
}

/**
 * Tudo o que a interface precisa do restante do sistema. A apresentação
 * declara o contrato (somente leitura sobre o estado) e a raiz de composição
 * o satisfaz.
 */
export interface DashboardDependencies {
  readonly state: {
    readonly snapshot: ReadonlyObservable<ThreatSnapshot | null>;
    readonly agencies: ReadonlyObservable<readonly Agency[]>;
    readonly territories: ReadonlyObservable<readonly Subdivision[]>;
    readonly connection: ReadonlyObservable<ConnectionState>;
    readonly filter: ReadonlyObservable<DashboardFilter>;
  };
  readonly filterCommands: FilterCommands;
  readonly monitoring: { start(): void; stop(): void };
}
