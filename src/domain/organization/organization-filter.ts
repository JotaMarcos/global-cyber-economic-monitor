import { sanitizeText } from "../security/sanitizer";
import type { Organization } from "./organization";
import type { SectorId } from "./sector";

export const ALL = "ALL";
export type All = typeof ALL;

const MAX_SEARCH_LENGTH = 60;

export interface OrganizationFilter {
  readonly country: string;
  readonly state: string;
  readonly city: string;
  readonly sector: SectorId | All;
  readonly searchTerm: string;
}

export const EMPTY_FILTER: OrganizationFilter = {
  country: ALL,
  state: ALL,
  city: ALL,
  sector: ALL,
  searchTerm: "",
};

/** Trocar o país invalida estado e município selecionados. */
export function withCountry(
  filter: OrganizationFilter,
  country: string,
): OrganizationFilter {
  return { ...filter, country, state: ALL, city: ALL };
}

/** Trocar o estado invalida o município selecionado. */
export function withState(filter: OrganizationFilter, state: string): OrganizationFilter {
  return { ...filter, state, city: ALL };
}

function matchesDimension(selected: string, actual: string): boolean {
  return selected === ALL || selected === actual;
}

function matchesSearch(organization: Organization, query: string): boolean {
  if (!query) return true;
  return [organization.name, organization.segment, organization.city].some((field) =>
    field.toLowerCase().includes(query),
  );
}

export function filterOrganizations(
  organizations: readonly Organization[],
  filter: OrganizationFilter,
): Organization[] {
  const query = sanitizeText(filter.searchTerm, MAX_SEARCH_LENGTH).toLowerCase();

  return organizations.filter(
    (organization) =>
      matchesDimension(filter.country, organization.country) &&
      matchesDimension(filter.state, organization.state) &&
      matchesDimension(filter.city, organization.city) &&
      matchesDimension(filter.sector, organization.sector) &&
      matchesSearch(organization, query),
  );
}
