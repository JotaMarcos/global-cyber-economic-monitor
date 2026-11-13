export interface GeoState {
  readonly label: string;
  readonly cities: readonly string[];
}

export interface GeoCountry {
  readonly label: string;
  readonly states: Readonly<Record<string, GeoState>>;
}

/** País -> Estado -> Município. A chave `ALL` representa a visão global. */
export type GeoHierarchy = Readonly<Record<string, GeoCountry>>;

export interface GeoOption {
  readonly code: string;
  readonly label: string;
}

export function listCountries(hierarchy: GeoHierarchy): GeoOption[] {
  return Object.entries(hierarchy).map(([code, { label }]) => ({ code, label }));
}

export function listStates(hierarchy: GeoHierarchy, country: string): GeoOption[] {
  const states = hierarchy[country]?.states ?? {};
  return Object.entries(states).map(([code, { label }]) => ({ code, label }));
}

export function listCities(
  hierarchy: GeoHierarchy,
  country: string,
  state: string,
): readonly string[] {
  return hierarchy[country]?.states[state]?.cities ?? [];
}
