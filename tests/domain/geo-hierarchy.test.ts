import { describe, expect, it } from "vitest";
import {
  listCities,
  listCountries,
  listStates,
  type GeoHierarchy,
} from "../../src/domain/geography/geo-hierarchy";

const hierarchy: GeoHierarchy = {
  ALL: { label: "Global", states: {} },
  BR: { label: "Brasil", states: { AM: { label: "Amazonas", cities: ["Manaus"] } } },
};

describe("hierarquia geográfica", () => {
  it("lista os países na ordem cadastrada", () => {
    expect(listCountries(hierarchy)).toEqual([
      { code: "ALL", label: "Global" },
      { code: "BR", label: "Brasil" },
    ]);
  });

  it("lista os estados do país selecionado", () => {
    expect(listStates(hierarchy, "BR")).toEqual([{ code: "AM", label: "Amazonas" }]);
  });

  it("devolve vazio para país sem estados ou inexistente", () => {
    expect(listStates(hierarchy, "ALL")).toEqual([]);
    expect(listStates(hierarchy, "XX")).toEqual([]);
  });

  it("lista os municípios do estado e devolve vazio fora da hierarquia", () => {
    expect(listCities(hierarchy, "BR", "AM")).toEqual(["Manaus"]);
    expect(listCities(hierarchy, "BR", "ALL")).toEqual([]);
    expect(listCities(hierarchy, "XX", "AM")).toEqual([]);
  });
});
