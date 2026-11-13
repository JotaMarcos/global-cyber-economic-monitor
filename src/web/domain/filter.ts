import type { ContinentId } from "./geography.ts";

export const ALL = "ALL";
export type All = typeof ALL;

export interface DashboardFilter {
  readonly continent: ContinentId | All;
  readonly country: string;
  readonly sector: string;
  readonly searchTerm: string;
}

export const EMPTY_FILTER: DashboardFilter = {
  continent: ALL,
  country: ALL,
  sector: ALL,
  searchTerm: "",
};

/** Trocar o continente invalida o país selecionado. */
export function withContinent(
  filter: DashboardFilter,
  continent: DashboardFilter["continent"],
): DashboardFilter {
  return { ...filter, continent, country: ALL };
}

export function isFilterActive(filter: DashboardFilter): boolean {
  return (
    filter.continent !== ALL ||
    filter.country !== ALL ||
    filter.sector !== ALL ||
    filter.searchTerm.trim() !== ""
  );
}
