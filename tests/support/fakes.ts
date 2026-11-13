import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CONTRACT_VERSION,
  type Agency,
  type Incident,
  type SourceStatus,
  type Subdivision,
  type ThreatSnapshot,
} from "../../src/contract/threat-snapshot.ts";
import type {
  CancelSchedule,
  CircuitBreaker,
  Clock,
  HttpClient,
  Logger,
  Scheduler,
} from "../../src/gateway/application/ports.ts";
import type {
  ThreatFeed,
  ThreatFeedHandlers,
} from "../../src/web/application/threat-feed.ts";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

/** Amostras reais das APIs, reduzidas e sem endereços de sites de vazamento. */
export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), "utf8")) as unknown;
}

export const FIXTURE_ROUTES: Record<string, string> = {
  "api.ransomware.live": "ransomware-live.recentvictims.json",
  "www.cisa.gov": "cisa-kev.catalog.json",
  "services.nvd.nist.gov": "nist-nvd.cves.json",
  "isc.sans.edu/api/infocon": "sans-isc.infocon.json",
  "isc.sans.edu/api/topips": "sans-isc.topips.json",
  "feodotracker.abuse.ch": "abusech-feodo.ipblocklist.json",
  "api.first.org": "first.teams.json",
  "servicodados.ibge.gov.br": "ibge.municipios.json",
};

export class FakeClock implements Clock {
  private current: number;

  constructor(start: number = Date.UTC(2026, 10, 13, 12, 0, 0)) {
    this.current = start;
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(milliseconds: number): void {
    this.current += milliseconds;
  }
}

export class ManualScheduler implements Scheduler {
  readonly tasks: { intervalMs: number; task: () => void; cancelled: boolean }[] = [];

  every(intervalMs: number, task: () => void): CancelSchedule {
    const entry = { intervalMs, task, cancelled: false };
    this.tasks.push(entry);
    return () => {
      entry.cancelled = true;
    };
  }

  fireAll(): void {
    this.tasks.filter((entry) => !entry.cancelled).forEach((entry) => entry.task());
  }

  get activeCount(): number {
    return this.tasks.filter((entry) => !entry.cancelled).length;
  }
}

export class MemoryLogger implements Logger {
  readonly entries: { level: string; message: string; context?: unknown }[] = [];

  info(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ level: "info", message, context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ level: "warn", message, context });
  }
}

/** Responde pela primeira rota cujo fragmento aparece na URL. */
export class StubHttpClient implements HttpClient {
  readonly requestedUrls: string[] = [];
  private readonly routes: Record<string, unknown>;

  constructor(routes: Record<string, unknown>) {
    this.routes = routes;
  }

  getJson(url: string): Promise<unknown> {
    this.requestedUrls.push(url);
    const match = Object.keys(this.routes).find((fragment) => url.includes(fragment));
    if (!match) return Promise.reject(new Error(`rota inesperada: ${url}`));
    const payload = this.routes[match];
    return payload instanceof Error ? Promise.reject(payload) : Promise.resolve(payload);
  }
}

export class SpyCircuitBreaker implements CircuitBreaker {
  state: CircuitBreaker["state"] = "CLOSED";
  allow = true;
  successes = 0;
  failures = 0;

  canRequest(): boolean {
    return this.allow;
  }

  recordSuccess(): void {
    this.successes += 1;
  }

  recordFailure(): void {
    this.failures += 1;
  }
}

export function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: "grupo|Empresa|2026-11-12T10:00:00.000Z",
    organization: "Empresa Exemplo",
    countryCode: "BR",
    sector: "Technology",
    threatGroup: "grupo",
    discoveredAt: "2026-11-12T10:00:00.000Z",
    reportedAttackAt: null,
    ...overrides,
  };
}

export function makeAgency(overrides: Partial<Agency> = {}): Agency {
  return {
    id: "cert-br",
    name: "CERT.br",
    host: "NIC.br",
    countryCode: "BR",
    types: ["CSIRT"],
    website: "https://cert.br/",
    ...overrides,
  };
}

export function makeSource(overrides: Partial<SourceStatus> = {}): SourceStatus {
  return {
    id: "ransomware-live",
    name: "Ransomware.live",
    organization: "Ransomware.live",
    homeCountry: "FR",
    dataset: "Vítimas divulgadas",
    url: "https://api.ransomware.live/v2/recentvictims",
    refreshIntervalSeconds: 300,
    health: "ONLINE",
    circuitState: "CLOSED",
    lastAttemptAt: "2026-11-13T12:00:00.000Z",
    lastSuccessAt: "2026-11-13T12:00:00.000Z",
    latencyMs: 120,
    recordCount: 1,
    rejectedCount: 0,
    lastError: null,
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<ThreatSnapshot> = {}): ThreatSnapshot {
  return {
    contractVersion: CONTRACT_VERSION,
    generatedAt: "2026-11-13T12:00:00.000Z",
    sources: [makeSource(), makeSource({ id: "first-teams", name: "FIRST Teams" })],
    infoconLevel: "GREEN",
    incidents: [makeIncident()],
    knownExploited: { total: 0, ransomwareLinked: 0, recent: [] },
    criticalCves: [],
    c2Servers: [],
    topAttackers: [],
    lossReference: { perIncidentUsd: 1_000_000, source: "Referência de teste" },
    ...overrides,
  };
}

/** Feed em memória: o teste decide quando chegam retratos e mudanças de conexão. */
export class FakeThreatFeed implements ThreatFeed {
  handlers: ThreatFeedHandlers | null = null;
  agencies: Agency[] | Error = [];
  agencyLoads = 0;
  unsubscribed = false;

  subscribe(handlers: ThreatFeedHandlers) {
    this.handlers = handlers;
    this.unsubscribed = false;
    return () => {
      this.unsubscribed = true;
    };
  }

  loadAgencies(): Promise<Agency[]> {
    this.agencyLoads += 1;
    return this.agencies instanceof Error
      ? Promise.reject(this.agencies)
      : Promise.resolve(this.agencies);
  }

  territories: Subdivision[] | Error = [];
  territoryLoads = 0;

  loadTerritories(): Promise<Subdivision[]> {
    this.territoryLoads += 1;
    return this.territories instanceof Error
      ? Promise.reject(this.territories)
      : Promise.resolve(this.territories);
  }
}

/** Recorte real e reduzido da divisão territorial do IBGE. */
export function makeSubdivisions(): Subdivision[] {
  return [
    {
      code: "AM",
      name: "Amazonas",
      municipalities: [
        { id: "1301902", name: "Itacoatiara" },
        { id: "1302603", name: "Manaus" },
      ],
    },
    {
      code: "SP",
      name: "São Paulo",
      municipalities: [
        { id: "3509502", name: "Campinas" },
        { id: "3550308", name: "São Paulo" },
      ],
    },
  ];
}
