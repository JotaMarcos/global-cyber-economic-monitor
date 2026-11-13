import { describe, expect, it } from "vitest";
import {
  ALL,
  EMPTY_FILTER,
  isFilterActive,
  isSubnational,
  withContinent,
  withCountry,
  withState,
} from "../../src/web/domain/filter.ts";
import {
  CONTINENT_IDS,
  continentOf,
  countriesOf,
} from "../../src/web/domain/geography.ts";
import {
  buildOverview,
  estimateLossUsd,
  indexOverviewInput,
} from "../../src/web/domain/overview.ts";
import { makeAgency, makeIncident } from "../support/fakes.ts";

describe("geografia", () => {
  it.each([
    ["BR", "SOUTH_AMERICA"],
    ["MX", "CENTRAL_AMERICA"],
    ["CU", "CENTRAL_AMERICA"],
    ["US", "NORTH_AMERICA"],
    ["CA", "NORTH_AMERICA"],
    ["DE", "EUROPE"],
    ["JP", "ASIA"],
    ["SA", "ASIA"],
    ["AU", "OCEANIA"],
    ["ZA", "AFRICA"],
  ])("classifica %s em %s", (code, continent) => {
    expect(continentOf(code)).toBe(continent);
  });

  it("devolve nulo para país ausente ou fora da tabela", () => {
    expect(continentOf(null)).toBeNull();
    expect(continentOf("AQ")).toBeNull();
  });

  it("não atribui um mesmo país a dois continentes", () => {
    const all = CONTINENT_IDS.flatMap(countriesOf);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("filtro", () => {
  const full = {
    continent: "SOUTH_AMERICA",
    country: "BR",
    state: "AM",
    municipality: "1302603",
    sector: "Healthcare",
    searchTerm: "x",
  } as const;

  it("trocar o continente limpa país, estado e município e preserva os demais critérios", () => {
    expect(withContinent(full, "ASIA")).toEqual({
      continent: "ASIA",
      country: ALL,
      state: ALL,
      municipality: ALL,
      sector: "Healthcare",
      searchTerm: "x",
    });
  });

  it("trocar o país limpa estado e município", () => {
    expect(withCountry(full, "AR")).toEqual({
      ...full,
      country: "AR",
      state: ALL,
      municipality: ALL,
    });
  });

  it("trocar o estado limpa apenas o município", () => {
    expect(withState(full, "SP")).toEqual({ ...full, state: "SP", municipality: ALL });
  });

  it("identifica recorte abaixo do país", () => {
    expect(isSubnational(EMPTY_FILTER)).toBe(false);
    expect(isSubnational({ ...EMPTY_FILTER, state: "AM" })).toBe(true);
    expect(isSubnational({ ...EMPTY_FILTER, municipality: "1302603" })).toBe(true);
  });

  it("indica se há algum critério ativo", () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTER, searchTerm: "   " })).toBe(false);
    expect(isFilterActive({ ...EMPTY_FILTER, country: "BR" })).toBe(true);
    expect(isFilterActive({ ...EMPTY_FILTER, state: "AM" })).toBe(true);
    expect(isFilterActive({ ...EMPTY_FILTER, searchTerm: "acme" })).toBe(true);
  });
});

describe("estimateLossUsd", () => {
  it("multiplica a quantidade de incidentes pelo custo de referência", () => {
    expect(estimateLossUsd(3, { perIncidentUsd: 4_440_000, source: "ref" })).toBe(
      13_320_000,
    );
    expect(estimateLossUsd(0, { perIncidentUsd: 4_440_000, source: "ref" })).toBe(0);
  });
});

describe("buildOverview", () => {
  const lossReference = { perIncidentUsd: 1_000_000, source: "ref" };
  const incidents = [
    makeIncident({
      id: "1",
      organization: "Clínica São João",
      countryCode: "BR",
      sector: "Healthcare",
      threatGroup: "akira",
      discoveredAt: "2026-11-12T10:00:00.000Z",
    }),
    makeIncident({
      id: "2",
      organization: "Banco Sul",
      countryCode: "BR",
      sector: "Financial Services",
      threatGroup: "play",
      discoveredAt: "2026-11-12T08:00:00.000Z",
    }),
    makeIncident({
      id: "3",
      organization: "Acme Corp",
      countryCode: "US",
      sector: "Healthcare",
      threatGroup: "akira",
      discoveredAt: "2026-11-10T08:00:00.000Z",
    }),
    makeIncident({
      id: "4",
      organization: "Desconhecida",
      countryCode: null,
      sector: "Unclassified",
      threatGroup: "play",
      discoveredAt: "2026-11-10T09:00:00.000Z",
    }),
  ];
  const agencies = [
    makeAgency({ id: "cert-br", name: "CERT.br", countryCode: "BR" }),
    makeAgency({ id: "us-cert", name: "CISA", host: "DHS", countryCode: "US" }),
    makeAgency({ id: "jpcert", name: "JPCERT/CC", host: "JPCERT", countryCode: "JP" }),
  ];
  const c2Servers = [
    {
      ip: "1.1.1.1",
      port: 443,
      online: true,
      countryCode: "US",
      malware: "QakBot",
      network: "AS",
      lastOnline: null,
    },
    {
      ip: "2.2.2.2",
      port: 443,
      online: false,
      countryCode: null,
      malware: "Emotet",
      network: "AS",
      lastOnline: null,
    },
  ];
  const input = { incidents, agencies, c2Servers, lossReference };
  const overview = (patch = {}) => buildOverview(input, { ...EMPTY_FILTER, ...patch });

  it("consolida os indicadores do recorte global", () => {
    expect(overview().kpis).toEqual({
      incidents: 4,
      estimatedLossUsd: 4_000_000,
      countriesAffected: 2,
      activeGroups: 2,
      unlocated: 1,
      agencies: 3,
      c2Servers: 2,
      c2ServersOnline: 1,
    });
  });

  it("recalcula os servidores de comando e controle conforme o país", () => {
    expect(overview({ country: "US" }).kpis).toMatchObject({
      c2Servers: 1,
      c2ServersOnline: 1,
    });
    expect(overview({ country: "BR" }).kpis).toMatchObject({
      c2Servers: 0,
      c2ServersOnline: 0,
    });
  });

  it("ordena os rankings por quantidade e, no empate, por nome", () => {
    const { byCountry, bySector, byGroup } = overview();

    expect(byCountry).toEqual([
      { key: "BR", incidents: 2, estimatedLossUsd: 2_000_000 },
      { key: "US", incidents: 1, estimatedLossUsd: 1_000_000 },
    ]);
    expect(bySector.map((item) => item.key)).toEqual([
      "Healthcare",
      "Financial Services",
      "Unclassified",
    ]);
    expect(byGroup.map((item) => [item.key, item.incidents])).toEqual([
      ["akira", 2],
      ["play", 2],
    ]);
  });

  it("resume os sete continentes, com incidentes e equipes", () => {
    const { byContinent } = overview();

    expect(byContinent.map((item) => item.key)).toEqual([...CONTINENT_IDS]);
    expect(byContinent.find((item) => item.key === "SOUTH_AMERICA")).toMatchObject({
      incidents: 2,
      agencies: 1,
      estimatedLossUsd: 2_000_000,
    });
    expect(byContinent.find((item) => item.key === "OCEANIA")).toMatchObject({
      incidents: 0,
      agencies: 0,
    });
  });

  it("monta a série diária em UTC preenchendo dias sem ocorrência", () => {
    expect(overview().timeline).toEqual([
      { day: "2026-11-10", incidents: 2 },
      { day: "2026-11-11", incidents: 0 },
      { day: "2026-11-12", incidents: 2 },
    ]);
  });

  it("limita a série aos sessenta dias mais recentes", () => {
    const old = makeIncident({ id: "antigo", discoveredAt: "2025-01-01T00:00:00.000Z" });
    const { timeline } = buildOverview(
      { ...input, incidents: [...incidents, old] },
      EMPTY_FILTER,
    );

    expect(timeline).toHaveLength(60);
    expect(timeline.at(-1)?.day).toBe("2026-11-12");
  });

  it("filtra por continente incidentes, equipes e infraestrutura", () => {
    const result = overview({ continent: "NORTH_AMERICA" });

    expect(result.incidents.map((incident) => incident.id)).toEqual(["3"]);
    expect(result.agencies.map((agency) => agency.id)).toEqual(["us-cert"]);
    expect(result.c2Servers.map((server) => server.ip)).toEqual(["1.1.1.1"]);
    expect(result.countryOptions).toEqual(["US"]);
  });

  it("mantém o comparativo de continentes completo mesmo com recorte geográfico", () => {
    const { byContinent } = overview({ continent: "NORTH_AMERICA", country: "US" });

    expect(byContinent.find((item) => item.key === "SOUTH_AMERICA")?.incidents).toBe(2);
  });

  it("filtra por país", () => {
    const result = overview({ country: "BR" });

    expect(result.incidents.map((incident) => incident.id)).toEqual(["1", "2"]);
    expect(result.kpis.unlocated).toBe(0);
  });

  it("filtra por setor, refletindo no comparativo de continentes", () => {
    const result = overview({ sector: "Healthcare" });

    expect(result.incidents.map((incident) => incident.id)).toEqual(["1", "3"]);
    expect(
      result.byContinent.find((item) => item.key === "SOUTH_AMERICA")?.incidents,
    ).toBe(1);
  });

  it("busca sem diferenciar maiúsculas nem acentos, em organização, grupo e equipe", () => {
    expect(overview({ searchTerm: "SAO JOAO" }).incidents.map((i) => i.id)).toEqual([
      "1",
    ]);
    // Com busca ativa, a ordem é de relevância: o registro mais curto vem antes.
    expect(overview({ searchTerm: "akira" }).incidents.map((i) => i.id)).toEqual([
      "3",
      "1",
    ]);
    expect(overview({ searchTerm: "jpcert" }).agencies.map((a) => a.id)).toEqual([
      "jpcert",
    ]);
    expect(overview({ searchTerm: "akira" }).searchActive).toBe(true);
    expect(overview().searchActive).toBe(false);
  });

  it("busca por prefixo e combina termos de campos diferentes", () => {
    expect(overview({ searchTerm: "clin akira" }).incidents.map((i) => i.id)).toEqual([
      "1",
    ]);
    expect(overview({ searchTerm: "ban pl" }).incidents.map((i) => i.id)).toEqual(["2"]);
  });

  it("encontra pelo nome legível de setor e país quando o vocabulário é informado", () => {
    const indexes = indexOverviewInput(input, {
      sectorLabel: (sector) => (sector === "Healthcare" ? "Saúde" : sector),
      countryName: (code) => (code === "BR" ? "Brasil" : (code ?? "")),
    });
    const search = (searchTerm: string) =>
      buildOverview(input, { ...EMPTY_FILTER, searchTerm }, indexes).incidents.map(
        (i) => i.id,
      );

    expect(search("saude brasil")).toEqual(["1"]);
  });

  it("mantém os dados no nível do país quando há estado ou município selecionado", () => {
    const national = overview({ country: "BR" });
    const subnational = overview({
      country: "BR",
      state: "AM",
      municipality: "1302603",
    });

    expect(subnational.subnational).toBe(true);
    expect(national.subnational).toBe(false);
    expect(subnational.incidents).toEqual(national.incidents);
  });

  it("oferece como opções os países e setores presentes nos dados", () => {
    const { countryOptions, sectorOptions } = overview();

    expect(countryOptions).toEqual(["BR", "JP", "US"]);
    expect(sectorOptions).toEqual(["Financial Services", "Healthcare", "Unclassified"]);
  });

  it("devolve estrutura vazia e consistente quando não há dados", () => {
    const empty = buildOverview(
      { incidents: [], agencies: [], c2Servers: [], lossReference },
      EMPTY_FILTER,
    );

    expect(empty.kpis.estimatedLossUsd).toBe(0);
    expect(empty.timeline).toEqual([]);
    expect(empty.byContinent).toHaveLength(7);
  });
});
