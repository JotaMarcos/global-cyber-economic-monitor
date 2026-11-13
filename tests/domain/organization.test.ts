import { describe, expect, it } from "vitest";
import {
  computeKpis,
  DDOS_SIMULATION_EXTRA_BLOCKS,
} from "../../src/domain/organization/kpis";
import {
  ALL,
  EMPTY_FILTER,
  filterOrganizations,
  withCountry,
  withState,
} from "../../src/domain/organization/organization-filter";
import { summarizeBySector } from "../../src/domain/organization/sector-summary";
import { makeOrganization } from "../support/fakes";

const organizations = [
  makeOrganization({
    id: 1,
    name: "B3",
    sector: "TERCIARIO",
    cyberRisk: "ALTO",
    volumeUsdBi: 412.8,
    attacksBlocked24h: 19840,
  }),
  makeOrganization({
    id: 2,
    name: "PIM",
    segment: "Indústria",
    sector: "SECUNDARIO",
    state: "AM",
    city: "Manaus",
    volumeUsdBi: 38.4,
    attacksBlocked24h: 1420,
  }),
  makeOrganization({
    id: 3,
    name: "NASDAQ",
    country: "US",
    state: "NY",
    city: "New York",
    cyberRisk: "ALTO",
    volumeUsdBi: 1240,
    attacksBlocked24h: 53900,
  }),
];

describe("filterOrganizations", () => {
  it("devolve tudo quando nenhum filtro está ativo", () => {
    expect(filterOrganizations(organizations, EMPTY_FILTER)).toHaveLength(3);
  });

  it("combina país, estado, município e setor", () => {
    const result = filterOrganizations(organizations, {
      ...EMPTY_FILTER,
      country: "BR",
      state: "AM",
      city: "Manaus",
      sector: "SECUNDARIO",
    });
    expect(result.map((org) => org.id)).toEqual([2]);
  });

  it("busca por nome, segmento ou município sem diferenciar maiúsculas", () => {
    const search = (searchTerm: string) =>
      filterOrganizations(organizations, { ...EMPTY_FILTER, searchTerm }).map(
        (o) => o.id,
      );

    expect(search("nasdaq")).toEqual([3]);
    expect(search("INDÚSTRIA")).toEqual([2]);
    expect(search("manaus")).toEqual([2]);
  });

  it("sanitiza o termo de busca antes de comparar", () => {
    const result = filterOrganizations(organizations, {
      ...EMPTY_FILTER,
      searchTerm: "<b3>",
    });
    expect(result.map((org) => org.id)).toEqual([1]);
  });

  it("devolve lista vazia quando nada corresponde", () => {
    expect(
      filterOrganizations(organizations, { ...EMPTY_FILTER, country: "JP" }),
    ).toEqual([]);
  });
});

describe("reset em cascata do filtro geográfico", () => {
  const selected = { ...EMPTY_FILTER, country: "BR", state: "SP", city: "Campinas" };

  it("trocar o país limpa estado e município", () => {
    expect(withCountry(selected, "US")).toMatchObject({
      country: "US",
      state: ALL,
      city: ALL,
    });
  });

  it("trocar o estado limpa apenas o município", () => {
    expect(withState(selected, "RJ")).toMatchObject({
      country: "BR",
      state: "RJ",
      city: ALL,
    });
  });
});

describe("summarizeBySector", () => {
  it("soma volume e bloqueios por setor, mantendo setores vazios", () => {
    expect(summarizeBySector(organizations)).toEqual([
      { sector: "PRIMARIO", volumeUsdBi: 0, blockedThousands: 0 },
      { sector: "SECUNDARIO", volumeUsdBi: 38.4, blockedThousands: 1.42 },
      { sector: "TERCIARIO", volumeUsdBi: 1652.8, blockedThousands: 73.74 },
      { sector: "ONG", volumeUsdBi: 0, blockedThousands: 0 },
    ]);
  });
});

describe("computeKpis", () => {
  it("consolida volume, bloqueios, contagem e alto risco", () => {
    expect(computeKpis(organizations, false)).toEqual({
      totalVolumeUsdBi: 412.8 + 38.4 + 1240,
      totalAttacksBlocked: 75160,
      entitiesCount: 3,
      highRiskCount: 2,
    });
  });

  it("acresce os bloqueios da simulação de DDoS", () => {
    expect(computeKpis(organizations, true).totalAttacksBlocked).toBe(
      75160 + DDOS_SIMULATION_EXTRA_BLOCKS,
    );
  });

  it("zera os indicadores para recorte vazio", () => {
    expect(computeKpis([], false)).toEqual({
      totalVolumeUsdBi: 0,
      totalAttacksBlocked: 0,
      entitiesCount: 0,
      highRiskCount: 0,
    });
  });
});
