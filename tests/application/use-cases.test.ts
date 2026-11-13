import { describe, expect, it } from "vitest";
import {
  DashboardRuntime,
  OSINT_SYNC_INTERVAL_MS,
  TELEMETRY_TICK_INTERVAL_MS,
} from "../../src/application/dashboard-runtime";
import { INITIAL_SECURITY_METRICS } from "../../src/application/state/dashboard-state";
import { GetOrganizationOverviewUseCase } from "../../src/application/use-cases/get-organization-overview";
import { InspectTrafficBurstUseCase } from "../../src/application/use-cases/inspect-traffic-burst";
import { RecordTelemetryPointUseCase } from "../../src/application/use-cases/record-telemetry-point";
import type { SyncOsintFeedsUseCase } from "../../src/application/use-cases/sync-osint-feeds";
import { ToggleDdosSimulationUseCase } from "../../src/application/use-cases/toggle-ddos-simulation";
import { UpdateOrganizationFilterUseCase } from "../../src/application/use-cases/update-organization-filter";
import { EMPTY_FILTER } from "../../src/domain/organization/organization-filter";
import type { TelemetryPoint } from "../../src/domain/telemetry/telemetry-point";
import { ObservableState } from "../../src/shared/observable/observable";
import {
  FakeClock,
  FixedRandom,
  makeOrganization,
  ManualScheduler,
} from "../support/fakes";

describe("InspectTrafficBurstUseCase", () => {
  it("acumula métricas da rajada sobre os totais anteriores", () => {
    const securityMetrics = new ObservableState(INITIAL_SECURITY_METRICS);
    let budget = 20;
    const useCase = new InspectTrafficBurstUseCase({
      rateLimiter: { tryConsume: () => budget-- > 0 },
      random: new FixedRandom([0]),
      ddosSimulation: new ObservableState(false),
      securityMetrics,
    });

    useCase.execute();

    expect(securityMetrics.getValue()).toEqual({
      ...INITIAL_SECURITY_METRICS,
      requestsAccepted: INITIAL_SECURITY_METRICS.requestsAccepted + 20,
      requestsDropped: INITIAL_SECURITY_METRICS.requestsDropped + 5,
      currentRps: 25,
    });
  });

  it("contabiliza cargas maliciosas bloqueadas sob DDoS", () => {
    const securityMetrics = new ObservableState(INITIAL_SECURITY_METRICS);
    const useCase = new InspectTrafficBurstUseCase({
      rateLimiter: { tryConsume: () => false },
      random: new FixedRandom(),
      ddosSimulation: new ObservableState(true),
      securityMetrics,
    });

    useCase.execute();

    expect(securityMetrics.getValue()).toMatchObject({
      currentRps: 950,
      requestsDropped: INITIAL_SECURITY_METRICS.requestsDropped + 950,
      xssBlocked: INITIAL_SECURITY_METRICS.xssBlocked + 14,
    });
  });
});

describe("RecordTelemetryPointUseCase", () => {
  it("acrescenta um ponto rotulado com o horário do relógio", () => {
    const clock = new FakeClock();
    const telemetry = new ObservableState<readonly TelemetryPoint[]>([]);
    const useCase = new RecordTelemetryPointUseCase({
      clock,
      random: new FixedRandom([0.46, 0]),
      ddosSimulation: new ObservableState(false),
      telemetry,
    });

    useCase.execute();

    expect(telemetry.getValue()).toEqual([
      {
        time: clock.now().toTimeString().slice(0, 8),
        economicIndex: 106,
        cyberAttacksPerMin: 310,
        mitigatedRate: 99.89,
      },
    ]);
  });
});

describe("UpdateOrganizationFilterUseCase", () => {
  it("aplica cada comando e o reset em cascata", () => {
    const filter = new ObservableState(EMPTY_FILTER);
    const useCase = new UpdateOrganizationFilterUseCase(filter);

    useCase.selectCountry("BR");
    useCase.selectState("SP");
    useCase.selectCity("Campinas");
    useCase.selectSector("ONG");
    useCase.search("b3");
    expect(filter.getValue()).toEqual({
      country: "BR",
      state: "SP",
      city: "Campinas",
      sector: "ONG",
      searchTerm: "b3",
    });

    useCase.selectCountry("US");
    expect(filter.getValue()).toMatchObject({ country: "US", state: "ALL", city: "ALL" });
  });
});

describe("ToggleDdosSimulationUseCase", () => {
  it("alterna o estado da simulação", () => {
    const ddosSimulation = new ObservableState(false);
    const useCase = new ToggleDdosSimulationUseCase(ddosSimulation);

    useCase.execute();
    expect(ddosSimulation.getValue()).toBe(true);
    useCase.execute();
    expect(ddosSimulation.getValue()).toBe(false);
  });
});

describe("GetOrganizationOverviewUseCase", () => {
  it("devolve o recorte filtrado com os agregados correspondentes", () => {
    const useCase = new GetOrganizationOverviewUseCase({
      findAll: () => [
        makeOrganization({ id: 1, country: "BR" }),
        makeOrganization({ id: 2, country: "US" }),
      ],
    });

    const overview = useCase.execute({ ...EMPTY_FILTER, country: "US" }, false);

    expect(overview.organizations.map((org) => org.id)).toEqual([2]);
    expect(overview.kpis.entitiesCount).toBe(1);
    expect(overview.sectorSummary).toHaveLength(4);
  });
});

describe("DashboardRuntime", () => {
  function build() {
    const calls = { sync: 0, inspect: 0, record: 0 };
    const scheduler = new ManualScheduler();
    const runtime = new DashboardRuntime({
      scheduler,
      syncOsintFeeds: {
        execute: () => {
          calls.sync += 1;
          return Promise.resolve();
        },
      } as unknown as SyncOsintFeedsUseCase,
      inspectTrafficBurst: { execute: () => void (calls.inspect += 1) } as never,
      recordTelemetryPoint: { execute: () => void (calls.record += 1) } as never,
    });
    return { runtime, scheduler, calls };
  }

  it("sincroniza de imediato e agenda polling e streaming", () => {
    const { runtime, scheduler, calls } = build();

    runtime.start();
    scheduler.fire(OSINT_SYNC_INTERVAL_MS);
    scheduler.fire(TELEMETRY_TICK_INTERVAL_MS);

    expect(calls).toEqual({ sync: 2, inspect: 1, record: 1 });
  });

  it("ignora um segundo start sem duplicar agendamentos", () => {
    const { runtime, scheduler } = build();

    runtime.start();
    runtime.start();

    expect(scheduler.activeCount).toBe(2);
  });

  it("cancela os agendamentos no stop e permite reiniciar", () => {
    const { runtime, scheduler } = build();

    runtime.start();
    runtime.stop();
    expect(scheduler.activeCount).toBe(0);

    runtime.start();
    expect(scheduler.activeCount).toBe(2);
  });
});
