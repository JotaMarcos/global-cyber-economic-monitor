import type { ObservableState } from "../../shared/observable/observable.ts";
import { EMPTY_FILTER, withContinent, type DashboardFilter } from "../domain/filter.ts";

/** Comandos de filtragem. A regra de reset em cascata reside no domínio. */
export class UpdateFilterUseCase {
  private readonly filter: ObservableState<DashboardFilter>;

  constructor(filter: ObservableState<DashboardFilter>) {
    this.filter = filter;
  }

  selectContinent(continent: DashboardFilter["continent"]): void {
    this.filter.update((current) => withContinent(current, continent));
  }

  selectCountry(country: string): void {
    this.filter.update((current) => ({ ...current, country }));
  }

  selectSector(sector: string): void {
    this.filter.update((current) => ({ ...current, sector }));
  }

  search(searchTerm: string): void {
    this.filter.update((current) => ({ ...current, searchTerm }));
  }

  clear(): void {
    this.filter.set(EMPTY_FILTER);
  }
}
