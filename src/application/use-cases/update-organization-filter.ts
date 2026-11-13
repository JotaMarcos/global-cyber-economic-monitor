import type { ObservableState } from "../../shared/observable/observable";
import {
  withCountry,
  withState,
  type OrganizationFilter,
} from "../../domain/organization/organization-filter";

/** Comandos de filtragem. As regras de reset em cascata residem no domínio. */
export class UpdateOrganizationFilterUseCase {
  constructor(private readonly filter: ObservableState<OrganizationFilter>) {}

  selectCountry(country: string): void {
    this.filter.update((current) => withCountry(current, country));
  }

  selectState(state: string): void {
    this.filter.update((current) => withState(current, state));
  }

  selectCity(city: string): void {
    this.filter.update((current) => ({ ...current, city }));
  }

  selectSector(sector: OrganizationFilter["sector"]): void {
    this.filter.update((current) => ({ ...current, sector }));
  }

  search(searchTerm: string): void {
    this.filter.update((current) => ({ ...current, searchTerm }));
  }
}
