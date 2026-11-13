import type {
  CircuitBreaker,
  CircuitState,
} from "../../src/application/ports/circuit-breaker";
import type { Clock } from "../../src/application/ports/clock";
import type {
  OsintFeedGateway,
  OsintSnapshot,
} from "../../src/application/ports/osint-feed-gateway";
import type { RandomSource } from "../../src/application/ports/random-source";
import type { CancelSchedule, Scheduler } from "../../src/application/ports/scheduler";
import type { ThreatLogCache } from "../../src/application/ports/threat-log-cache";
import type { Organization } from "../../src/domain/organization/organization";
import type { ThreatLog } from "../../src/domain/threat/threat-log";

export class FakeClock implements Clock {
  constructor(private current: number = Date.UTC(2026, 0, 1, 12, 0, 0)) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(milliseconds: number): void {
    this.current += milliseconds;
  }
}

/** Devolve a sequência informada em ciclo, tornando o acaso determinístico. */
export class FixedRandom implements RandomSource {
  private index = 0;

  constructor(private readonly values: readonly number[] = [0.5]) {}

  next(): number {
    const value = this.values[this.index % this.values.length]!;
    this.index += 1;
    return value;
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

  fire(intervalMs: number): void {
    this.tasks
      .filter((entry) => entry.intervalMs === intervalMs && !entry.cancelled)
      .forEach((entry) => entry.task());
  }

  get activeCount(): number {
    return this.tasks.filter((entry) => !entry.cancelled).length;
  }
}

export class StubGateway implements OsintFeedGateway {
  calls = 0;

  constructor(private result: OsintSnapshot | Error) {}

  respondWith(result: OsintSnapshot | Error): void {
    this.result = result;
  }

  fetchSnapshot(): Promise<OsintSnapshot> {
    this.calls += 1;
    return this.result instanceof Error
      ? Promise.reject(this.result)
      : Promise.resolve(this.result);
  }
}

export class InMemoryThreatLogCache implements ThreatLogCache {
  constructor(public stored: ThreatLog[] = []) {}

  load(): ThreatLog[] {
    return [...this.stored];
  }

  save(logs: readonly ThreatLog[]): void {
    this.stored = [...logs];
  }
}

export class SpyCircuitBreaker implements CircuitBreaker {
  successes = 0;
  failures = 0;

  constructor(
    public state: CircuitState = "CLOSED",
    private readonly allow: boolean = true,
  ) {}

  canRequest(): boolean {
    return this.allow;
  }

  recordSuccess(): void {
    this.successes += 1;
    this.state = "CLOSED";
  }

  recordFailure(): void {
    this.failures += 1;
  }
}

export function makeOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 1,
    name: "Organização Exemplo",
    segment: "Segmento",
    sector: "TERCIARIO",
    country: "BR",
    state: "SP",
    city: "São Paulo",
    volumeUsdBi: 10,
    cyberRisk: "BAIXO",
    attacksBlocked24h: 1000,
    sla: "99.9%",
    ...overrides,
  };
}

export function makeThreatLog(overrides: Partial<ThreatLog> = {}): ThreatLog {
  return {
    id: "log-1",
    agency: "SANS ISC / DShield",
    ip: "185.220.101.42",
    port: 443,
    threatType: "Scanner",
    targetSector: "TERCIARIO",
    severity: "ALTA",
    status: "MITIGADO",
    ...overrides,
  };
}
