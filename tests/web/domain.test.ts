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
import { buildFindings } from "../../src/web/domain/findings.ts";
import { OBSERVATORIES } from "../../src/web/domain/observatories.ts";
import { buildPosture } from "../../src/web/domain/posture.ts";
import { buildThreatFeed } from "../../src/web/domain/threat-feed-items.ts";
import { makeAgency, makeIncident, makeSource } from "../support/fakes.ts";

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

describe("buildPosture", () => {
  const evaluatedAt = "2026-11-13T12:00:00.000Z";

  it("aprova os quatro controles de uma fonte operacional e atualizada", () => {
    const posture = buildPosture([makeSource()], evaluatedAt);

    expect(posture).toMatchObject({ score: 100, passed: 4, total: 4 });
    expect(posture.groups[0]!.controls.map((control) => control.id)).toEqual([
      "1.1",
      "1.2",
      "1.3",
      "1.4",
    ]);
  });

  it("reprova cada controle pelo critério correspondente", () => {
    const failed = (overrides: Parameters<typeof makeSource>[0]) =>
      buildPosture([makeSource(overrides)], evaluatedAt)
        .groups[0]!.controls.filter((control) => !control.passed)
        .map((control) => control.rule);

    expect(failed({ health: "STALE" })).toEqual(["COLLECTION"]);
    expect(failed({ circuitState: "OPEN" })).toEqual(["CIRCUIT"]);
    expect(failed({ lastSuccessAt: null })).toEqual(["FRESHNESS"]);
    expect(failed({ rejectedCount: 2 })).toEqual(["VALIDATION"]);
  });

  it("tolera dois ciclos de coleta antes de considerar o dado desatualizado", () => {
    const controlFor = (lastSuccessAt: string) =>
      buildPosture(
        [makeSource({ refreshIntervalSeconds: 300, lastSuccessAt })],
        evaluatedAt,
      ).groups[0]!.controls.find((control) => control.rule === "FRESHNESS")!.passed;

    expect(controlFor("2026-11-13T11:50:00.000Z")).toBe(true);
    expect(controlFor("2026-11-13T11:49:59.000Z")).toBe(false);
  });

  it("calcula o índice e a distribuição por severidade no conjunto das fontes", () => {
    const posture = buildPosture(
      [
        makeSource(),
        makeSource({ id: "nist-nvd", health: "OFFLINE", lastSuccessAt: null }),
      ],
      evaluatedAt,
    );

    expect(posture).toMatchObject({ score: 75, passed: 6, total: 8 });
    expect(posture.bySeverity).toEqual([
      { severity: "CRITICAL", passed: 1, total: 2 },
      { severity: "HIGH", passed: 2, total: 2 },
      { severity: "MEDIUM", passed: 1, total: 2 },
      { severity: "LOW", passed: 2, total: 2 },
    ]);
    expect(posture.groups.map((group) => group.passed)).toEqual([4, 2]);
  });

  it("não atribui índice quando não há fonte avaliada", () => {
    expect(buildPosture([], evaluatedAt)).toMatchObject({ score: null, total: 0 });
  });
});

describe("buildFindings", () => {
  const input = {
    incidents: 3,
    c2ServersOnline: 0,
    blockedAsns: 5,
    criticalCves: [
      {
        cveId: "CVE-2026-0001",
        publishedAt: "2026-11-12T00:00:00Z",
        score: 9.8,
        summary: "",
      },
      {
        cveId: "CVE-2026-0002",
        publishedAt: "2026-11-12T00:00:00Z",
        score: 8.1,
        summary: "",
      },
    ],
    ransomwareLinkedVulnerabilities: 361,
    hijackedNetworks: { networkCount: 1759 },
    sources: [
      makeSource(),
      makeSource({ id: "nist-nvd" as const, health: "OFFLINE" as const }),
    ],
  };

  it("ordena por severidade e, dentro dela, por quantidade", () => {
    expect(buildFindings(input).map(({ kind, count }) => [kind, count])).toEqual([
      ["RANSOMWARE_DISCLOSURES", 3],
      ["CRITICAL_CVES", 1],
      ["HIJACKED_NETWORKS", 1759],
      ["RANSOMWARE_VULNERABILITIES", 361],
      ["BLOCKED_ASNS", 5],
      ["OFFLINE_SOURCES", 1],
    ]);
  });

  it("omite achados sem registros e indica os que seguem o recorte", () => {
    const findings = buildFindings({ ...input, incidents: 0, c2ServersOnline: 2 });

    expect(findings.map((finding) => finding.kind)).not.toContain(
      "RANSOMWARE_DISCLOSURES",
    );
    expect(findings.filter((finding) => finding.scoped).map(({ kind }) => kind)).toEqual([
      "ONLINE_C2",
      "BLOCKED_ASNS",
    ]);
  });
});

describe("catálogo de plataformas de monitoramento", () => {
  it("referencia apenas endereços https, sem parâmetros de rastreamento", () => {
    for (const { url } of OBSERVATORIES) {
      const parsed = new URL(url);
      expect(parsed.protocol).toBe("https:");
      expect(parsed.search).toBe("");
    }
  });

  it("vincula fontes do gateway somente a plataformas com dados integrados", () => {
    for (const observatory of OBSERVATORIES) {
      expect(observatory.integratedSources.length > 0).toBe(
        observatory.access !== "EXTERNAL",
      );
    }
    expect(new Set(OBSERVATORIES.map(({ id }) => id)).size).toBe(OBSERVATORIES.length);
  });
});

describe("redes bloqueadas no recorte e no feed", () => {
  const blockedAsns = [
    {
      asn: 64500,
      name: "REDE-BR",
      domain: "exemplo.br",
      countryCode: "BR",
      registry: "lacnic" as const,
    },
    { asn: 64501, name: "", domain: "", countryCode: null, registry: null },
  ];

  it("restringe os sistemas autônomos ao recorte geográfico", () => {
    const overview = buildOverview(
      {
        incidents: [],
        agencies: [],
        c2Servers: [],
        blockedAsns,
        lossReference: { perIncidentUsd: 1, source: "x" },
      },
      { ...EMPTY_FILTER, country: "BR" },
    );

    expect(overview.blockedAsns.map((entry) => entry.asn)).toEqual([64500]);
  });

  it("inclui os sistemas autônomos no feed com severidade alta", () => {
    const feed = buildThreatFeed({
      knownExploited: [],
      criticalCves: [],
      c2Servers: [],
      topAttackers: [],
      blockedAsns,
    });

    expect(feed).toEqual([
      expect.objectContaining({
        indicator: "AS64500",
        category: "BLOCKED_NETWORK",
        severity: "HIGH",
        title: "REDE-BR",
        detail: "exemplo.br · BR",
      }),
      expect.objectContaining({
        indicator: "AS64501",
        title: "Sistema autônomo sem nome informado",
        detail: "",
      }),
    ]);
  });
});
