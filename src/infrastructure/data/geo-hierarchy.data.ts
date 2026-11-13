import type { GeoHierarchy } from "../../domain/geography/geo-hierarchy";

export const GEO_HIERARCHY: GeoHierarchy = {
  ALL: { label: "Visão Global (Todos os Países)", states: {} },
  BR: {
    label: "Brasil",
    states: {
      AM: { label: "Amazonas", cities: ["Manaus", "Itacoatiara"] },
      SP: { label: "São Paulo", cities: ["São Paulo", "Campinas"] },
      MT: { label: "Mato Grosso", cities: ["Sorriso", "Cuiabá"] },
      RJ: { label: "Rio de Janeiro", cities: ["Rio de Janeiro", "Macaé"] },
    },
  },
  US: {
    label: "Estados Unidos",
    states: {
      CA: { label: "Califórnia", cities: ["San Francisco", "San Jose"] },
      NY: { label: "Nova York", cities: ["New York"] },
    },
  },
  DE: {
    label: "Alemanha",
    states: {
      HE: { label: "Hesse", cities: ["Frankfurt"] },
    },
  },
  CN: {
    label: "China",
    states: {
      GD: { label: "Guangdong", cities: ["Shenzhen"] },
    },
  },
  JP: {
    label: "Japão",
    states: {
      TK: { label: "Tóquio", cities: ["Tóquio"] },
    },
  },
};
