import type { ContinentId } from "./geography.ts";

export const ALL = "ALL";
export type All = typeof ALL;

export interface DashboardFilter {
  readonly continent: ContinentId | All;
  readonly country: string;
  /** Sigla da unidade subnacional (no Brasil, a UF), segundo a divisão oficial. */
  readonly state: string;
  /** Código oficial do município (no Brasil, o código IBGE de 7 dígitos). */
  readonly municipality: string;
  readonly sector: string;
  readonly searchTerm: string;
}

export const EMPTY_FILTER: DashboardFilter = {
  continent: ALL,
  country: ALL,
  state: ALL,
  municipality: ALL,
  sector: ALL,
  searchTerm: "",
};

/** Trocar o continente invalida país, estado e município selecionados. */
export function withContinent(
  filter: DashboardFilter,
  continent: DashboardFilter["continent"],
): DashboardFilter {
  return { ...filter, continent, country: ALL, state: ALL, municipality: ALL };
}

/** Trocar o país invalida estado e município selecionados. */
export function withCountry(filter: DashboardFilter, country: string): DashboardFilter {
  return { ...filter, country, state: ALL, municipality: ALL };
}

/** Trocar o estado invalida o município selecionado. */
export function withState(filter: DashboardFilter, state: string): DashboardFilter {
  return { ...filter, state, municipality: ALL };
}

/** Há recorte abaixo do país, nível que nenhuma fonte de incidentes informa. */
export function isSubnational(filter: DashboardFilter): boolean {
  return filter.state !== ALL || filter.municipality !== ALL;
}

export function isFilterActive(filter: DashboardFilter): boolean {
  return (
    filter.continent !== ALL ||
    filter.country !== ALL ||
    isSubnational(filter) ||
    filter.sector !== ALL ||
    filter.searchTerm.trim() !== ""
  );
}
