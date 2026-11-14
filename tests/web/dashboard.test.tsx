import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { ThreatSnapshot } from "../../src/contract/threat-snapshot.ts";
import {
  createContainer,
  createDashboardDependencies,
  TOKENS,
} from "../../src/web/main/composition-root.ts";
import { DashboardPage } from "../../src/web/presentation/components/DashboardPage.tsx";
import {
  DashboardProvider,
  useDashboard,
} from "../../src/web/presentation/context/dashboard-context.tsx";
import {
  FakeThreatFeed,
  makeAgency,
  makeIncident,
  makeSnapshot,
  makeSource,
  makeSubdivisions,
} from "../support/fakes.ts";

const snapshot: ThreatSnapshot = makeSnapshot({
  sources: [
    makeSource({ recordCount: 3, rejectedCount: 1 }),
    makeSource({ id: "first-teams", name: "FIRST Teams" }),
    makeSource({ id: "cisa-kev", name: "CISA KEV" }),
    makeSource({
      id: "nist-nvd",
      name: "NIST NVD",
      health: "OFFLINE",
      lastSuccessAt: null,
      latencyMs: null,
      lastError: "tempo limite excedido",
    }),
    makeSource({ id: "sans-isc", name: "SANS ISC / DShield" }),
    makeSource({ id: "abusech-feodo", name: "abuse.ch Feodo Tracker" }),
  ],
  infoconLevel: "YELLOW",
  incidents: [
    makeIncident({
      id: "1",
      organization: "Hospital Central",
      countryCode: "BR",
      sector: "Healthcare",
      threatGroup: "akira",
      discoveredAt: "2026-11-12T10:00:00.000Z",
    }),
    makeIncident({
      id: "2",
      organization: "Acme Corp",
      countryCode: "US",
      sector: "Technology",
      threatGroup: "play",
      discoveredAt: "2026-11-11T10:00:00.000Z",
    }),
    makeIncident({
      id: "3",
      organization: "Origem Oculta",
      countryCode: null,
      sector: "Unclassified",
      threatGroup: "play",
      discoveredAt: "2026-11-11T09:00:00.000Z",
    }),
  ],
  knownExploited: {
    total: 1779,
    ransomwareLinked: 361,
    recent: [
      {
        cveId: "CVE-2026-1000",
        vendor: "Fabricante",
        product: "Produto",
        name: "Falha de autenticação",
        dateAdded: "2026-11-10",
        dueDate: null,
        ransomwareUse: true,
      },
    ],
  },
  c2Servers: [
    {
      ip: "50.16.16.211",
      port: 443,
      online: true,
      countryCode: "US",
      malware: "QakBot",
      network: "AS",
      lastOnline: null,
    },
  ],
  topAttackers: [{ rank: 1, ip: "13.94.254.200", reports: 319_739, targets: 1 }],
  hijackedNetworks: {
    networkCount: 1759,
    networksByRegistry: [
      { registry: "arin", networks: 714 },
      { registry: "lacnic", networks: 49 },
    ],
    asns: [
      {
        asn: 64500,
        name: "REDE-EXEMPLO",
        domain: "exemplo.br",
        countryCode: "BR",
        registry: "lacnic",
      },
    ],
  },
  lossReference: { perIncidentUsd: 4_440_000, source: "Relatório de referência" },
});

describe("DashboardPage", () => {
  let feed: FakeThreatFeed;

  function renderDashboard() {
    const container = createContainer().registerSingleton(TOKENS.threatFeed, () => feed);
    return render(
      <DashboardProvider dependencies={createDashboardDependencies(container)}>
        <DashboardPage />
      </DashboardProvider>,
    );
  }

  /** Simula a chegada de um retrato pelo fluxo do gateway. */
  async function receive(next: ThreatSnapshot = snapshot) {
    await act(async () => {
      feed.handlers?.onConnectionChange("LIVE");
      feed.handlers?.onSnapshot(next);
      await Promise.resolve();
    });
  }

  const panel = (name: string) => within(screen.getByRole("region", { name }));

  beforeEach(() => {
    feed = new FakeThreatFeed();
    feed.agencies = [
      makeAgency({ id: "cert-br", name: "CERT.br", countryCode: "BR" }),
      makeAgency({ id: "cisa", name: "CISA Central", countryCode: "US", website: null }),
    ];
    feed.territories = makeSubdivisions();
  });

  it("informa que está conectando antes do primeiro retrato", () => {
    renderDashboard();

    expect(screen.getByText("Conectando ao gateway de dados")).toBeInTheDocument();
  });

  it("informa a indisponibilidade quando a conexão é encerrada sem dados", () => {
    renderDashboard();
    act(() => feed.handlers?.onConnectionChange("OFFLINE"));

    expect(screen.getByText("Gateway de dados indisponível")).toBeInTheDocument();
  });

  it("exibe os indicadores consolidados, com o prejuízo marcado como estimativa", async () => {
    renderDashboard();
    await receive();

    expect(screen.getByRole("status")).toHaveTextContent("Ao vivo");
    expect(screen.getByText("5 de 6")).toBeInTheDocument();
    expect(screen.getByText("Amarelo")).toBeInTheDocument();
    expect(screen.getByText("US$ 13,3 mi")).toBeInTheDocument();
    expect(screen.getByText("Estimativa")).toBeInTheDocument();
    expect(screen.getByText("1 sem país informado")).toBeInTheDocument();
    expect(screen.getByText("1 online no recorte")).toBeInTheDocument();
    expect(screen.getByText(/361 usadas em ransomware/)).toBeInTheDocument();
  });

  it("lista as organizações com a ressalva de alegação não confirmada", async () => {
    renderDashboard();
    await receive();
    const table = panel("Organizações atacadas");

    expect(table.getByText(/não confirmadas/)).toBeInTheDocument();
    expect(
      table.getByRole("rowheader", { name: "Hospital Central" }),
    ).toBeInTheDocument();
    expect(table.getByText("País não informado")).toBeInTheDocument();
    expect(table.getAllByText("≈ US$ 4,4 mi")).toHaveLength(3);
  });

  it("explica a metodologia da estimativa e cita a referência", async () => {
    renderDashboard();
    await receive();

    expect(screen.getByText(/não de perda apurada/)).toBeInTheDocument();
    expect(screen.getByText(/Relatório de referência/)).toBeInTheDocument();
  });

  it("filtra por continente e país, com reset em cascata", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await receive();
    const country = screen.getByLabelText("País");

    await user.selectOptions(screen.getByLabelText("Continente"), "SOUTH_AMERICA");
    expect(panel("Organizações atacadas").getByText("1 registros")).toBeInTheDocument();
    expect(within(country).queryByRole("option", { name: "Estados Unidos" })).toBeNull();

    await user.selectOptions(country, "BR");
    expect(country).toHaveValue("BR");

    await user.selectOptions(screen.getByLabelText("Continente"), "NORTH_AMERICA");
    expect(country).toHaveValue("ALL");
    expect(
      panel("Organizações atacadas").getByRole("rowheader", { name: "Acme Corp" }),
    ).toBeInTheDocument();
    expect(
      panel("Equipes de resposta a incidentes").getByText("CISA Central"),
    ).toBeInTheDocument();
    expect(panel("Equipes de resposta a incidentes").queryByText("CERT.br")).toBeNull();
  });

  it("filtra ao selecionar um continente no gráfico e desfaz no segundo clique", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await receive();
    const chart = panel("Ataques por continente");

    await user.click(chart.getByRole("button", { name: /América do Sul/ }));
    expect(screen.getByLabelText("Continente")).toHaveValue("SOUTH_AMERICA");
    expect(chart.getByRole("button", { name: /América do Sul/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(chart.getByRole("button", { name: /América do Sul/ }));
    expect(screen.getByLabelText("Continente")).toHaveValue("ALL");
  });

  it("filtra por setor e por busca, e limpa os filtros", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await receive();
    const clear = screen.getByRole("button", { name: "Limpar filtros" });
    expect(clear).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Setor econômico"), "Healthcare");
    expect(panel("Organizações atacadas").getByText("1 registros")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Busca"), "inexistente");
    expect(
      screen.getByText("Nenhuma organização encontrada para os filtros selecionados."),
    ).toBeInTheDocument();

    await user.click(clear);
    expect(panel("Organizações atacadas").getByText("3 registros")).toBeInTheDocument();
  });

  /** Retrato com a fonte territorial oficial já coletada. */
  const withTerritories: ThreatSnapshot = {
    ...snapshot,
    sources: [
      ...snapshot.sources,
      makeSource({ id: "ibge-localidades", name: "IBGE Localidades" }),
    ],
  };

  it("oferece estado e município do Brasil pela divisão territorial oficial", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await receive(withTerritories);
    const state = screen.getByLabelText("Estado");
    const municipality = screen.getByLabelText("Município");

    expect(state).toBeDisabled();
    expect(screen.getByText(/divisão territorial oficial do IBGE/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("País"), "BR");
    expect(state).toBeEnabled();
    expect(municipality).toBeDisabled();

    await user.selectOptions(state, "AM");
    expect(
      within(municipality)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Todos os municípios", "Itacoatiara", "Manaus"]);

    await user.selectOptions(municipality, "1302603");
    expect(screen.getByText("Manaus (AM)")).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma fonte oficial de incidentes cibernéticos/),
    ).toBeInTheDocument();
    // Os dados permanecem no nível do país: o incidente brasileiro segue listado.
    expect(
      panel("Organizações atacadas").getByRole("rowheader", { name: "Hospital Central" }),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("País"), "US");
    expect(state).toHaveValue("ALL");
    expect(municipality).toHaveValue("ALL");
    expect(state).toBeDisabled();
  });

  it("busca em texto completo por prefixo, sem acentos e pelo nome do setor", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await receive();
    const search = screen.getByLabelText("Busca");

    await user.type(search, "hosp");
    expect(panel("Organizações atacadas").getByText("1 registros")).toBeInTheDocument();
    expect(screen.getByText("Ordenados por relevância")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "SAUDE");
    expect(
      panel("Organizações atacadas").getByRole("rowheader", { name: "Hospital Central" }),
    ).toBeInTheDocument();
    expect(panel("Organizações atacadas").getByText("1 registros")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "cert");
    expect(
      panel("Equipes de resposta a incidentes").getByText("CERT.br"),
    ).toBeInTheDocument();
    expect(
      panel("Equipes de resposta a incidentes").queryByText("CISA Central"),
    ).toBeNull();
  });

  it("abre e fecha a documentação da API do gateway", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await receive();

    await user.click(screen.getByRole("button", { name: "API e arquitetura" }));
    const dialog = screen.getByRole("dialog", { name: "API e arquitetura do gateway" });
    expect(within(dialog).getByText("GET /api/v1/territories")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "API e arquitetura" }));
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("resume circuitos e validação na barra de telemetria do gateway", async () => {
    renderDashboard();
    await receive();

    expect(screen.getByText("6/6")).toBeInTheDocument();
    expect(screen.getByText("1", { selector: "span.text-warning" })).toBeInTheDocument();
  });

  it("exibe vulnerabilidades, infraestrutura maliciosa e equipes", async () => {
    renderDashboard();
    await receive();

    const feed = panel("Feed OSINT tratado e sanitizado");
    expect(feed.getByText("CVE-2026-1000")).toBeInTheDocument();
    expect(feed.getByText(/usada em ransomware/)).toBeInTheDocument();
    expect(feed.getByText("50.16.16.211:443")).toBeInTheDocument();
    expect(feed.getByText("Ativo")).toBeInTheDocument();
    expect(feed.getByText("319.739 registros contra 1 alvos")).toBeInTheDocument();

    await userEvent
      .setup()
      .click(feed.getByRole("button", { name: "Comando e controle" }));
    expect(feed.queryByText("CVE-2026-1000")).toBeNull();
    expect(feed.getByText("1 indicadores.")).toBeInTheDocument();

    expect(
      panel("Equipes de resposta a incidentes").getByRole("link", {
        name: "Site de CERT.br",
      }),
    ).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("distingue fonte indisponível de ausência de registros", async () => {
    renderDashboard();
    await receive();

    expect(
      panel("Feed OSINT tratado e sanitizado").getByText(
        "NIST NVD: fonte indisponível no momento.",
      ),
    ).toBeInTheDocument();
  });

  it("apresenta a saúde de cada integração e a qualidade dos dados", async () => {
    renderDashboard();
    await receive();
    const health = panel("Integrações e qualidade dos dados");
    const nvdRow = within(
      health.getByRole("rowheader", { name: /NIST NVD/ }).closest("tr")!,
    );

    expect(health.getAllByRole("row")).toHaveLength(7);
    expect(nvdRow.getByText("Indisponível")).toBeInTheDocument();
    expect(nvdRow.getByText("tempo limite excedido")).toBeInTheDocument();
    expect(health.getAllByText("Operacional")).toHaveLength(5);
  });

  it("apresenta o índice de postura e os controles por severidade", async () => {
    renderDashboard();
    await receive();
    const score = panel("Índice de postura do monitoramento");

    // 6 fontes × 4 controles; reprovados: coleta e atualização da NVD, validação.
    expect(score.getByText("87,5%")).toBeInTheDocument();
    expect(score.getByText("21 de 24 controles aprovados")).toBeInTheDocument();
    expect(score.getByText("2 reprovados")).toBeInTheDocument();
    // Uma reprovação nos níveis crítico (coleta), médio (atualização) e baixo (validação).
    expect(
      panel("Controles por severidade").getAllByText(/5 de 6 controles/),
    ).toHaveLength(3);
  });

  it("lista os achados em aberto e os recalcula conforme o recorte", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await receive();
    const findings = panel("Principais achados em aberto");
    const countOf = (title: RegExp) =>
      within(findings.getByRole("rowheader", { name: title }).closest("tr")!);

    expect(countOf(/Organizações divulgadas/).getByText("3")).toBeInTheDocument();
    expect(countOf(/Redes sequestradas/).getByText("1.759")).toBeInTheDocument();
    expect(countOf(/Fontes de dados sem resposta/).getByText("1")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("País"), "US");
    expect(countOf(/Organizações divulgadas/).getByText("1")).toBeInTheDocument();
    expect(findings.queryByRole("rowheader", { name: /Sistemas autônomos/ })).toBeNull();
  });

  it("detalha os controles por fonte, abrindo os grupos com reprovação", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await receive();
    const controls = panel("Controles de monitoramento por fonte");
    const nvd = controls.getByRole("button", { name: /NIST NVD/ });

    expect(nvd).toHaveAttribute("aria-expanded", "true");
    expect(nvd).toHaveTextContent("2 de 4 aprovados");
    expect(controls.getAllByText("Reprovado")).toHaveLength(3);

    const kev = controls.getByRole("button", { name: /CISA KEV/ });
    expect(kev).toHaveAttribute("aria-expanded", "false");
    await user.click(kev);
    expect(kev).toHaveAttribute("aria-expanded", "true");
    expect(controls.getAllByText("Aprovado").length).toBeGreaterThan(4);
  });

  it("exibe as redes bloqueadas do Spamhaus no feed e por registro regional", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await receive();
    const feed = panel("Feed OSINT tratado e sanitizado");

    await user.click(feed.getByRole("button", { name: "Redes bloqueadas" }));
    expect(feed.getByText("AS64500")).toBeInTheDocument();
    expect(feed.getByText("REDE-EXEMPLO")).toBeInTheDocument();

    const registries = panel("Redes sequestradas por registro regional");
    expect(registries.getByText("1.759 redes")).toBeInTheDocument();
    expect(registries.getByText("LACNIC (América Latina e Caribe)")).toBeInTheDocument();
  });

  it("cataloga as plataformas de monitoramento com a forma de acesso", async () => {
    renderDashboard();
    await receive();
    const catalog = panel("Plataformas de monitoramento de ameaças");

    expect(catalog.getAllByRole("listitem")).toHaveLength(8);
    expect(catalog.getByText("Parcialmente integrada")).toBeInTheDocument();
    expect(catalog.getByText("abuse.ch Feodo Tracker: operacional")).toBeInTheDocument();
    expect(
      catalog.getByRole("link", { name: /Abrir Kaspersky Cyberthreat/ }),
    ).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("contabiliza mensagens descartadas por violarem o contrato", async () => {
    renderDashboard();
    await receive();
    act(() => feed.handlers?.onInvalidMessage());

    expect(
      screen.getByText("1 mensagens fora do contrato nesta sessão"),
    ).toBeInTheDocument();
  });

  it("avisa quando a conexão cai e mantém os últimos dados", async () => {
    renderDashboard();
    await receive();
    act(() => feed.handlers?.onConnectionChange("RECONNECTING"));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Conexão com o gateway interrompida",
    );
    expect(screen.getByText("Hospital Central")).toBeInTheDocument();
  });

  it("atualiza a tela a cada novo retrato do fluxo", async () => {
    renderDashboard();
    await receive();

    await receive({
      ...snapshot,
      incidents: [
        makeIncident({
          id: "9",
          organization: "Nova Vítima",
          discoveredAt: "2026-11-13T01:00:00.000Z",
        }),
        ...snapshot.incidents,
      ],
    });

    expect(screen.getByText("Nova Vítima")).toBeInTheDocument();
    expect(panel("Organizações atacadas").getByText("4 registros")).toBeInTheDocument();
  });

  it("encerra a inscrição no fluxo ao desmontar", async () => {
    const { unmount } = renderDashboard();
    await receive();

    unmount();

    expect(feed.unsubscribed).toBe(true);
  });
});

describe("useDashboard", () => {
  it("exige o provedor de dependências", () => {
    const Orphan = () => {
      useDashboard();
      return null;
    };

    expect(() => render(<Orphan />)).toThrow(/DashboardProvider/);
  });
});
