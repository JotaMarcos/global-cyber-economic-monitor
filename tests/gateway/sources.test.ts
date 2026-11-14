// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  agencySchema,
  c2ServerSchema,
  criticalCveSchema,
  exploitedVulnerabilitySchema,
  hijackedNetworksSchema,
  incidentSchema,
  subdivisionSchema,
} from "../../src/contract/threat-snapshot.ts";
import { CisaKevSource } from "../../src/gateway/infrastructure/sources/cisa-kev-source.ts";
import { FeodoTrackerSource } from "../../src/gateway/infrastructure/sources/feodo-tracker-source.ts";
import { FirstTeamsSource } from "../../src/gateway/infrastructure/sources/first-teams-source.ts";
import { IbgeLocalitiesSource } from "../../src/gateway/infrastructure/sources/ibge-localities-source.ts";
import { NistNvdSource } from "../../src/gateway/infrastructure/sources/nist-nvd-source.ts";
import {
  RansomwareLiveSource,
  UNCLASSIFIED_SECTOR,
} from "../../src/gateway/infrastructure/sources/ransomware-live-source.ts";
import { SansIscSource } from "../../src/gateway/infrastructure/sources/sans-isc-source.ts";
import { SpamhausDropSource } from "../../src/gateway/infrastructure/sources/spamhaus-drop-source.ts";
import { FakeClock, fixture, fixtureText, StubHttpClient } from "../support/fakes.ts";

const signal = new AbortController().signal;
const stub = (routes: Record<string, unknown>) => new StubHttpClient(routes);

describe("RansomwareLiveSource", () => {
  const victims = fixture("ransomware-live.recentvictims.json") as unknown[];

  it("traduz a amostra real para incidentes válidos pelo contrato", async () => {
    const reading = await new RansomwareLiveSource(stub({ ransomware: victims })).read(
      signal,
    );

    expect(reading.recordCount).toBe(victims.length);
    expect(reading.rejectedCount).toBe(0);
    for (const incident of reading.data) {
      expect(incidentSchema.safeParse(incident).success).toBe(true);
    }
  });

  it("ordena do mais recente para o mais antigo", async () => {
    const { data } = await new RansomwareLiveSource(stub({ ransomware: victims })).read(
      signal,
    );
    const dates = data.map((incident) => incident.discoveredAt);

    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("trata país vazio como não informado e setor desconhecido como não classificado", async () => {
    const { data } = await new RansomwareLiveSource(
      stub({
        ransomware: [
          {
            victim: "Acme",
            group: "grupo",
            discovered: "2026-11-12T10:00:00+00:00",
            country: "",
            activity: "Not Found",
          },
        ],
      }),
    ).read(signal);

    expect(data[0]).toMatchObject({ countryCode: null, sector: UNCLASSIFIED_SECTOR });
  });

  it("não propaga o endereço do site de vazamento nem a captura de tela", async () => {
    const { data } = await new RansomwareLiveSource(stub({ ransomware: victims })).read(
      signal,
    );

    expect(JSON.stringify(data)).not.toMatch(/onion|claim_url|screenshot/);
  });

  it("descarta e contabiliza registros malformados, mantendo os válidos", async () => {
    const reading = await new RansomwareLiveSource(
      stub({
        ransomware: [
          victims[0],
          { victim: "Sem data", group: "g" },
          { victim: "", group: "g", discovered: "2026-11-12T10:00:00+00:00" },
          "texto solto",
          { victim: "<>", group: "g", discovered: "2026-11-12T10:00:00+00:00" },
        ],
      }),
    ).read(signal);

    expect(reading.recordCount).toBe(1);
    expect(reading.rejectedCount).toBe(4);
  });

  it("falha quando o envelope não é uma lista", async () => {
    await expect(
      new RansomwareLiveSource(stub({ ransomware: { erro: "manutenção" } })).read(signal),
    ).rejects.toThrow("resposta fora do formato esperado");
  });
});

describe("CisaKevSource", () => {
  const catalog = fixture("cisa-kev.catalog.json") as { vulnerabilities: unknown[] };

  it("resume o catálogo real e destaca o vínculo com ransomware", async () => {
    const { data, recordCount } = await new CisaKevSource(stub({ cisa: catalog })).read(
      signal,
    );

    expect(recordCount).toBe(catalog.vulnerabilities.length);
    expect(data.total).toBe(catalog.vulnerabilities.length);
    expect(data.ransomwareLinked).toBe(2);
    for (const entry of data.recent) {
      expect(exploitedVulnerabilitySchema.safeParse(entry).success).toBe(true);
    }
  });

  it("lista primeiro as inclusões mais recentes", async () => {
    const { data } = await new CisaKevSource(stub({ cisa: catalog })).read(signal);
    const dates = data.recent.map((entry) => entry.dateAdded);

    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("rejeita entradas sem identificador CVE válido", async () => {
    const reading = await new CisaKevSource(
      stub({ cisa: { vulnerabilities: [...catalog.vulnerabilities, { cveID: "X-1" }] } }),
    ).read(signal);

    expect(reading.rejectedCount).toBe(1);
  });

  it("falha quando o catálogo não traz a lista de vulnerabilidades", async () => {
    await expect(new CisaKevSource(stub({ cisa: {} })).read(signal)).rejects.toThrow(
      "CISA KEV",
    );
  });
});

describe("NistNvdSource", () => {
  const payload = fixture("nist-nvd.cves.json");

  it("traduz a amostra real, com data em UTC e maior pontuação CVSS", async () => {
    const { data } = await new NistNvdSource(
      stub({ nvd: payload }),
      new FakeClock(),
    ).read(signal);

    expect(data.length).toBeGreaterThan(0);
    for (const cve of data) {
      expect(criticalCveSchema.safeParse(cve).success).toBe(true);
      expect(cve.score).toBeGreaterThanOrEqual(9);
    }
  });

  it("consulta apenas severidade crítica na janela de sete dias", async () => {
    const http = stub({ nvd: payload });
    await new NistNvdSource(http, new FakeClock(Date.UTC(2026, 10, 13))).read(signal);
    const url = new URL(http.requestedUrls[0]!);

    expect(url.searchParams.get("cvssV3Severity")).toBe("CRITICAL");
    expect(url.searchParams.get("pubStartDate")).toBe("2026-11-06T00:00:00.000Z");
    expect(url.searchParams.get("pubEndDate")).toBe("2026-11-13T00:00:00.000Z");
  });

  it("atribui pontuação zero quando não há métrica e rejeita item sem CVE", async () => {
    const reading = await new NistNvdSource(
      stub({
        nvd: {
          vulnerabilities: [
            { cve: { id: "CVE-2026-0001", published: "2026-11-12T01:00:00.000" } },
            { cve: { id: "invalido" } },
          ],
        },
      }),
      new FakeClock(),
    ).read(signal);

    expect(reading.data[0]).toMatchObject({
      cveId: "CVE-2026-0001",
      score: 0,
      summary: "",
    });
    expect(reading.rejectedCount).toBe(1);
  });
});

describe("SansIscSource", () => {
  const routes = {
    infocon: fixture("sans-isc.infocon.json"),
    topips: fixture("sans-isc.topips.json"),
  };

  it("combina nível Infocon e origens de ataque da amostra real", async () => {
    const { data, recordCount } = await new SansIscSource(stub(routes)).read(signal);

    expect(data.infoconLevel).toBe("GREEN");
    expect(data.topAttackers.map((attacker) => attacker.rank)).toEqual([1, 2, 3]);
    expect(recordCount).toBe(4);
  });

  it("segue com um conjunto quando o outro falha", async () => {
    const { data } = await new SansIscSource(
      stub({ ...routes, infocon: new Error("HTTP 503") }),
    ).read(signal);

    expect(data.infoconLevel).toBeNull();
    expect(data.topAttackers).toHaveLength(3);
  });

  it("descarta origem com endereço IP inválido", async () => {
    const reading = await new SansIscSource(
      stub({
        ...routes,
        topips: [{ rank: 1, source: "<script>", reports: 1, targets: 1 }],
      }),
    ).read(signal);

    expect(reading.data.topAttackers).toEqual([]);
    expect(reading.rejectedCount).toBe(1);
  });

  it("falha quando os dois conjuntos falham ou nada é aproveitável", async () => {
    const offline = { infocon: new Error("HTTP 503"), topips: new Error("HTTP 503") };
    await expect(new SansIscSource(stub(offline)).read(signal)).rejects.toThrow(
      "HTTP 503",
    );
    await expect(
      new SansIscSource(stub({ infocon: { status: "purple" }, topips: {} })).read(signal),
    ).rejects.toThrow("resposta fora do formato esperado");
  });
});

describe("FeodoTrackerSource", () => {
  const blocklist = fixture("abusech-feodo.ipblocklist.json") as unknown[];

  it("traduz a amostra real e lista primeiro os servidores ativos", async () => {
    const { data } = await new FeodoTrackerSource(stub({ feodo: blocklist })).read(
      signal,
    );

    expect(data).toHaveLength(blocklist.length);
    expect(data[0]?.online).toBe(true);
    for (const server of data) {
      expect(c2ServerSchema.safeParse(server).success).toBe(true);
    }
  });

  it("rejeita IP ou porta inválidos", async () => {
    const reading = await new FeodoTrackerSource(
      stub({
        feodo: [
          { ip_address: "999.1.1.1", port: 443, status: "online" },
          { ip_address: "1.1.1.1", port: 70000, status: "online" },
        ],
      }),
    ).read(signal);

    expect(reading).toMatchObject({ recordCount: 0, rejectedCount: 2 });
  });
});

describe("FirstTeamsSource", () => {
  const teams = fixture("first.teams.json") as { data: unknown[] };

  it("traduz a amostra real para agências válidas, em ordem alfabética", async () => {
    const { data } = await new FirstTeamsSource(stub({ first: teams })).read(signal);

    expect(data).toHaveLength(teams.data.length);
    expect(data.find((agency) => agency.id === "cert-br")).toMatchObject({
      name: "CERT.br",
      countryCode: "BR",
      types: ["CSIRT"],
      website: "https://cert.br/",
    });
    for (const agency of data) {
      expect(agencySchema.safeParse(agency).success).toBe(true);
    }
  });

  it("separa tipos múltiplos e descarta site com esquema inseguro", async () => {
    const { data } = await new FirstTeamsSource(
      stub({
        first: {
          data: [
            {
              id: "x",
              team: "Equipe X",
              country: "pt",
              "team-type": "CSIRT, SOC",
              website: ["javascript:alert(1)"],
            },
          ],
        },
      }),
    ).read(signal);

    expect(data[0]).toMatchObject({
      countryCode: "PT",
      types: ["CSIRT", "SOC"],
      website: null,
    });
  });

  it("rejeita equipe sem país", async () => {
    const reading = await new FirstTeamsSource(
      stub({ first: { data: [{ id: "x", team: "Equipe X" }] } }),
    ).read(signal);

    expect(reading).toMatchObject({ recordCount: 0, rejectedCount: 1 });
  });
});

describe("IbgeLocalitiesSource", () => {
  const municipalities = fixture("ibge.municipios.json") as unknown[];

  it("agrupa a amostra real por unidade da federação, em ordem alfabética", async () => {
    const reading = await new IbgeLocalitiesSource(stub({ ibge: municipalities })).read(
      signal,
    );

    expect(reading).toMatchObject({ recordCount: 5, rejectedCount: 0 });
    expect(reading.data.every((item) => subdivisionSchema.safeParse(item).success)).toBe(
      true,
    );
    expect(reading.data.map((subdivision) => subdivision.code)).toEqual([
      "AM",
      "DF",
      "SP",
    ]);
    expect(reading.data[0]).toEqual({
      code: "AM",
      name: "Amazonas",
      municipalities: [
        { id: "1301902", name: "Itacoatiara" },
        { id: "1302603", name: "Manaus" },
      ],
    });
  });

  it("descarta município com código fora do padrão oficial e mantém os demais", async () => {
    const reading = await new IbgeLocalitiesSource(
      stub({
        ibge: [
          ...municipalities,
          { "municipio-id": 12, "municipio-nome": "X", "UF-sigla": "AM", "UF-nome": "A" },
        ],
      }),
    ).read(signal);

    expect(reading).toMatchObject({ recordCount: 5, rejectedCount: 1 });
  });

  it("trata envelope fora do formato como falha da fonte", async () => {
    await expect(
      new IbgeLocalitiesSource(stub({ ibge: { erro: true } })).read(signal),
    ).rejects.toThrow(/fora do formato esperado/);
  });
});

describe("SpamhausDropSource", () => {
  const networks = fixtureText("spamhaus.drop_v4.ndjson");
  const asns = fixtureText("spamhaus.asndrop.ndjson");
  const routes = (overrides: Record<string, unknown> = {}) =>
    stub({ drop_v4: networks, asndrop: asns, ...overrides });

  it("traduz as amostras reais, ignorando a linha de metadados", async () => {
    const reading = await new SpamhausDropSource(routes()).read(signal);

    expect(reading).toMatchObject({ recordCount: 31, rejectedCount: 0 });
    expect(hijackedNetworksSchema.safeParse(reading.data).success).toBe(true);
    expect(reading.data.networkCount).toBe(16);
    expect(reading.data.asns).toHaveLength(15);
  });

  it("totaliza as redes por registro regional e ordena os sistemas autônomos", async () => {
    const { data } = await new SpamhausDropSource(routes()).read(signal);
    const numbers = data.asns.map((entry) => entry.asn);

    // Uma rede da amostra real vem sem registro regional: conta no total apenas.
    expect(data.networksByRegistry).toEqual(
      ["afrinic", "apnic", "arin", "lacnic", "ripencc"].map((registry) => ({
        registry,
        networks: 3,
      })),
    );
    expect(data.networkCount).toBe(16);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(data.asns[0]).toEqual({
      asn: 245,
      name: "PRC-AS",
      domain: "planningresearchcorp.com",
      countryCode: "US",
      registry: "arin",
    });
  });

  it("descarta e contabiliza registros malformados, mantendo os válidos", async () => {
    const reading = await new SpamhausDropSource(
      routes({
        drop_v4: `{"cidr":"não é rede","sblid":"SBL1","rir":"arin"}\n\n${networks}`,
        asndrop: `{"asn":64500,"rir":"lacnic"}\n{"asn":"x","rir":"arin"}\n`,
      }),
    ).read(signal);

    expect(reading).toMatchObject({ recordCount: 17, rejectedCount: 2 });
    expect(reading.data.asns).toEqual([
      { asn: 64500, name: "", domain: "", countryCode: null, registry: "lacnic" },
    ]);
  });

  it("mantém a leitura quando apenas uma das listas responde", async () => {
    const reading = await new SpamhausDropSource(
      routes({ asndrop: new Error("HTTP 503 em www.spamhaus.org") }),
    ).read(signal);

    expect(reading.data.networkCount).toBe(16);
    expect(reading.data.asns).toEqual([]);
  });

  it("falha quando nenhuma das listas responde", async () => {
    const failure = new Error("HTTP 503 em www.spamhaus.org");

    await expect(
      new SpamhausDropSource(routes({ drop_v4: failure, asndrop: failure })).read(signal),
    ).rejects.toThrow("HTTP 503 em www.spamhaus.org");
  });

  it("trata linha que não é JSON como falha da fonte", async () => {
    await expect(
      new SpamhausDropSource(routes({ drop_v4: "<html>" })).read(signal),
    ).rejects.toThrow(/fora do formato esperado/);
  });
});
