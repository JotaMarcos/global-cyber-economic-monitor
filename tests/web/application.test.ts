import { describe, expect, it, vi } from "vitest";
import { createDashboardState } from "../../src/web/application/dashboard-state.ts";
import { MonitorThreatFeedUseCase } from "../../src/web/application/monitor-threat-feed.ts";
import { UpdateFilterUseCase } from "../../src/web/application/update-filter.ts";
import { EMPTY_FILTER } from "../../src/web/domain/filter.ts";
import {
  HttpThreatFeed,
  type EventSourceLike,
} from "../../src/web/infrastructure/http-threat-feed.ts";
import { ObservableState } from "../../src/shared/observable/observable.ts";
import {
  FakeThreatFeed,
  makeAgency,
  makeSnapshot,
  makeSource,
} from "../support/fakes.ts";
import { CONTRACT_VERSION } from "../../src/contract/threat-snapshot.ts";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("MonitorThreatFeedUseCase", () => {
  function build() {
    const feed = new FakeThreatFeed();
    const state = createDashboardState();
    const useCase = new MonitorThreatFeedUseCase(feed, state);
    return { feed, state, useCase };
  }

  it("publica cada retrato recebido e o estado da conexão", () => {
    const { feed, state, useCase } = build();
    useCase.start();

    feed.handlers?.onConnectionChange("LIVE");
    feed.handlers?.onSnapshot(makeSnapshot({ infoconLevel: "YELLOW" }));

    expect(state.connection.getValue().status).toBe("LIVE");
    expect(state.snapshot.getValue()?.infoconLevel).toBe("YELLOW");
  });

  it("carrega o diretório de agências uma vez por coleta da fonte", async () => {
    const { feed, state, useCase } = build();
    feed.agencies = [makeAgency()];
    useCase.start();

    feed.handlers?.onSnapshot(makeSnapshot());
    feed.handlers?.onSnapshot(makeSnapshot());
    await flush();

    expect(feed.agencyLoads).toBe(1);
    expect(state.agencies.getValue()).toEqual([makeAgency()]);
  });

  it("recarrega as agências quando a fonte registra nova coleta", async () => {
    const { feed, useCase } = build();
    useCase.start();
    const withAgenciesAt = (lastSuccessAt: string) =>
      makeSnapshot({ sources: [makeSource({ id: "first-teams", lastSuccessAt })] });

    feed.handlers?.onSnapshot(withAgenciesAt("2026-11-13T12:00:00.000Z"));
    await flush();
    feed.handlers?.onSnapshot(withAgenciesAt("2026-11-14T00:00:00.000Z"));
    await flush();

    expect(feed.agencyLoads).toBe(2);
  });

  it("não busca agências enquanto a fonte ainda não coletou", async () => {
    const { feed, useCase } = build();
    useCase.start();

    feed.handlers?.onSnapshot(
      makeSnapshot({ sources: [makeSource({ id: "first-teams", lastSuccessAt: null })] }),
    );
    await flush();

    expect(feed.agencyLoads).toBe(0);
  });

  it("tenta de novo no retrato seguinte se a carga das agências falhar", async () => {
    const { feed, state, useCase } = build();
    feed.agencies = new Error("HTTP 503");
    useCase.start();

    feed.handlers?.onSnapshot(makeSnapshot());
    await flush();
    feed.agencies = [makeAgency()];
    feed.handlers?.onSnapshot(makeSnapshot());
    await flush();

    expect(feed.agencyLoads).toBe(2);
    expect(state.agencies.getValue()).toHaveLength(1);
  });

  it("contabiliza mensagens fora do contrato sem alterar o retrato", () => {
    const { feed, state, useCase } = build();
    useCase.start();

    feed.handlers?.onInvalidMessage();
    feed.handlers?.onInvalidMessage();

    expect(state.connection.getValue().invalidMessages).toBe(2);
    expect(state.snapshot.getValue()).toBeNull();
  });

  it("não duplica a inscrição e a encerra no stop", () => {
    const { feed, useCase } = build();
    const subscribe = vi.spyOn(feed, "subscribe");

    useCase.start();
    useCase.start();
    useCase.stop();

    expect(subscribe).toHaveBeenCalledOnce();
    expect(feed.unsubscribed).toBe(true);
  });
});

describe("UpdateFilterUseCase", () => {
  it("aplica cada comando, o reset em cascata e a limpeza", () => {
    const filter = new ObservableState(EMPTY_FILTER);
    const useCase = new UpdateFilterUseCase(filter);

    useCase.selectContinent("EUROPE");
    useCase.selectCountry("DE");
    useCase.selectSector("Healthcare");
    useCase.search("hospital");
    expect(filter.getValue()).toEqual({
      continent: "EUROPE",
      country: "DE",
      state: "ALL",
      municipality: "ALL",
      sector: "Healthcare",
      searchTerm: "hospital",
    });

    useCase.selectCountry("BR");
    useCase.selectState("AM");
    useCase.selectMunicipality("1302603");
    expect(filter.getValue()).toMatchObject({ state: "AM", municipality: "1302603" });

    useCase.selectState("SP");
    expect(filter.getValue()).toMatchObject({ state: "SP", municipality: "ALL" });

    useCase.selectMunicipality("3550308");
    useCase.selectCountry("AR");
    expect(filter.getValue()).toMatchObject({
      country: "AR",
      state: "ALL",
      municipality: "ALL",
    });

    useCase.selectContinent("ASIA");
    expect(filter.getValue()).toMatchObject({ continent: "ASIA", country: "ALL" });

    useCase.clear();
    expect(filter.getValue()).toEqual(EMPTY_FILTER);
  });
});

class FakeEventSource implements EventSourceLike {
  readyState = 0;
  closed = false;
  private readonly listeners = new Map<string, ((event: Event) => void)[]>();

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string, data?: unknown): void {
    const event = { data } as unknown as Event;
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  close(): void {
    this.closed = true;
  }
}

describe("HttpThreatFeed", () => {
  function build(response: Response = Response.json({})) {
    const source = new FakeEventSource();
    const createEventSource = vi.fn(() => source);
    const httpFetch = vi.fn(() => Promise.resolve(response));
    const feed = new HttpThreatFeed({ baseUrl: "/api/v1", httpFetch, createEventSource });
    const handlers = {
      onSnapshot: vi.fn(),
      onConnectionChange: vi.fn(),
      onInvalidMessage: vi.fn(),
    };
    return { feed, source, handlers, createEventSource, httpFetch };
  }

  it("abre o fluxo no endpoint de streaming e entrega retratos válidos", () => {
    const { feed, source, handlers, createEventSource } = build();
    feed.subscribe(handlers);

    source.emit("open");
    source.emit("snapshot", JSON.stringify(makeSnapshot()));

    expect(createEventSource).toHaveBeenCalledWith("/api/v1/stream");
    expect(handlers.onConnectionChange).toHaveBeenCalledWith("LIVE");
    expect(handlers.onSnapshot).toHaveBeenCalledWith(makeSnapshot());
  });

  it.each([
    ["JSON inválido", "{não é json"],
    ["contrato violado", JSON.stringify({ ...makeSnapshot(), incidents: [{ id: 1 }] })],
    ["versão divergente", JSON.stringify({ ...makeSnapshot(), contractVersion: "99" })],
    ["carga não textual", 42],
  ])("descarta mensagem com %s", (_caso, payload) => {
    const { feed, source, handlers } = build();
    feed.subscribe(handlers);

    source.emit("snapshot", payload);

    expect(handlers.onSnapshot).not.toHaveBeenCalled();
    expect(handlers.onInvalidMessage).toHaveBeenCalledOnce();
  });

  it("distingue reconexão automática de encerramento definitivo", () => {
    const { feed, source, handlers } = build();
    feed.subscribe(handlers);

    source.emit("error");
    source.readyState = 2;
    source.emit("error");

    expect(handlers.onConnectionChange.mock.calls).toEqual([
      ["RECONNECTING"],
      ["OFFLINE"],
    ]);
  });

  it("fecha a conexão ao cancelar a inscrição", () => {
    const { feed, source, handlers } = build();

    feed.subscribe(handlers)();

    expect(source.closed).toBe(true);
  });

  it("carrega e valida o diretório de agências", async () => {
    const { feed, httpFetch } = build(
      Response.json({
        contractVersion: CONTRACT_VERSION,
        generatedAt: "2026-11-13T12:00:00.000Z",
        agencies: [makeAgency()],
      }),
    );

    await expect(feed.loadAgencies()).resolves.toEqual([makeAgency()]);
    expect(httpFetch).toHaveBeenCalledWith("/api/v1/agencies", expect.anything());
  });

  it("rejeita diretório fora do contrato ou resposta de erro", async () => {
    await expect(
      build(Response.json({ agencies: "x" })).feed.loadAgencies(),
    ).rejects.toThrow();
    await expect(
      build(new Response("", { status: 503 })).feed.loadAgencies(),
    ).rejects.toThrow("Gateway respondeu HTTP 503.");
  });
});
