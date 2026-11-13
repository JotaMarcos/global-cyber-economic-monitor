import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createContainer,
  createDashboardDependencies,
} from "../../src/main/composition-root";
import type { Container } from "../../src/main/container";
import { TOKENS } from "../../src/main/tokens";
import { DashboardPage } from "../../src/presentation/components/DashboardPage";
import {
  DashboardProvider,
  useDashboard,
} from "../../src/presentation/context/dashboard-context";
import { TELEMETRY_TICK_INTERVAL_MS } from "../../src/application/dashboard-runtime";
import {
  FakeClock,
  FixedRandom,
  InMemoryThreatLogCache,
  ManualScheduler,
  StubGateway,
} from "../support/fakes";

/** Grafo real da aplicação, com dublês apenas nas bordas (rede, tempo, acaso). */
function buildTestContainer(gateway: StubGateway, scheduler: ManualScheduler): Container {
  return createContainer()
    .registerSingleton(TOKENS.osintGateway, () => gateway)
    .registerSingleton(TOKENS.scheduler, () => scheduler)
    .registerSingleton(TOKENS.threatLogCache, () => new InMemoryThreatLogCache())
    .registerSingleton(TOKENS.clock, () => new FakeClock())
    .registerSingleton(TOKENS.random, () => new FixedRandom());
}

describe("DashboardPage", () => {
  let gateway: StubGateway;
  let scheduler: ManualScheduler;

  async function renderDashboard() {
    const container = buildTestContainer(gateway, scheduler);
    const view = render(
      <DashboardProvider dependencies={createDashboardDependencies(container)}>
        <DashboardPage />
      </DashboardProvider>,
    );
    await screen.findByText(/SANS ISC DShield \(Tempo Real\)|Cache SWR/);
    return view;
  }

  beforeEach(() => {
    scheduler = new ManualScheduler();
    gateway = new StubGateway({
      infoconStatus: "yellow",
      topAttackers: [{ sourceIp: "9.9.9.9", targetPort: 22, eventCount: 77 }],
    });
  });

  it("exibe os dados sincronizados do feed OSINT", async () => {
    await renderDashboard();

    expect(screen.getByText("YELLOW")).toBeInTheDocument();
    expect(screen.getByText("9.9.9.9")).toBeInTheDocument();
    expect(screen.getByText("DShield Top Attacker (77 eventos)")).toBeInTheDocument();
  });

  it("indica o uso de cache quando o feed está indisponível", async () => {
    gateway.respondWith(new Error("offline"));

    await renderDashboard();

    expect(screen.getByText("Cache SWR + Base OSINT Validada")).toBeInTheDocument();
    expect(screen.getByText("185.220.101.42")).toBeInTheDocument();
  });

  it("lista todas as organizações e os indicadores globais", async () => {
    await renderDashboard();

    expect(screen.getByText("14 registros")).toBeInTheDocument();
    expect(screen.getByText("US$ 4.574,6 Bi")).toBeInTheDocument();
    expect(screen.getByText("14 organizações ativas no recorte")).toBeInTheDocument();
  });

  it("aplica o drill-down geográfico com reset em cascata", async () => {
    const user = userEvent.setup();
    await renderDashboard();
    const state = screen.getByLabelText("Estado / Província");
    const city = screen.getByLabelText("Município");

    expect(state).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("País / Região"), "BR");
    await user.selectOptions(state, "AM");
    await user.selectOptions(city, "Manaus");
    expect(screen.getByText("2 registros")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("País / Região"), "US");
    expect(state).toHaveValue("ALL");
    expect(city).toBeDisabled();
    expect(screen.getByText("2 registros")).toBeInTheDocument();
    expect(screen.getByText("NASDAQ Stock Market")).toBeInTheDocument();
  });

  it("filtra por setor e por termo de busca", async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await user.selectOptions(screen.getByLabelText("Setor Econômico"), "ONG");
    expect(screen.getByText("2 registros")).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Buscar Organização / Segmento"),
      "inexistente",
    );
    expect(
      screen.getByText("Nenhuma organização encontrada para os filtros selecionados."),
    ).toBeInTheDocument();
  });

  it("alterna a simulação de DDoS e reflete o tráfego mitigado", async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(screen.getByRole("button", { name: "Simular Ataque DDoS" }));
    act(() => scheduler.fire(TELEMETRY_TICK_INTERVAL_MS));

    expect(screen.getByRole("button", { name: /Parar Ataque DDoS/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("950 req/s")).toBeInTheDocument();
    expect(screen.getByText("253.110")).toBeInTheDocument();
  });

  it("sincroniza novamente ao acionar a atualização manual", async () => {
    const user = userEvent.setup();
    await renderDashboard();
    const callsBefore = gateway.calls;

    await user.click(screen.getByRole("button", { name: "Atualizar Feeds" }));

    expect(gateway.calls).toBe(callsBefore + 1);
  });

  it("abre a documentação de API e a fecha pelo botão ou pela tecla Esc", async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(screen.getByRole("button", { name: /API & Arquitetura/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Gateway Proxy Resiliente/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Fechar Documentação" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /API & Arquitetura/ }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("encerra os processos periódicos ao desmontar", async () => {
    const { unmount } = await renderDashboard();

    unmount();

    expect(scheduler.activeCount).toBe(0);
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
