import type { SourceHealth, SourceStatus } from "../../contract/threat-snapshot.ts";
import {
  ObservableState,
  type ReadonlyObservable,
} from "../../shared/observable/observable.ts";
import type { CircuitBreaker, Clock, Logger, ThreatSource } from "./ports.ts";

export interface SourceState<T> {
  readonly data: T;
  readonly status: SourceStatus;
}

export interface SourceMonitorOptions<T> {
  readonly source: ThreatSource<T>;
  readonly emptyData: T;
  readonly circuitBreaker: CircuitBreaker;
  readonly clock: Clock;
  readonly logger: Logger;
}

const MAX_ERROR_LENGTH = 200;

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error).slice(0, MAX_ERROR_LENGTH);
  // O fetch do Node relata a causa real (DNS, TLS, conexão) em `cause`.
  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : "";
  return `${error.message}${cause}`.slice(0, MAX_ERROR_LENGTH);
}

/**
 * Acompanha uma fonte: consulta protegida por circuit breaker e tempo limite,
 * preservação do último conjunto válido e publicação do estado de saúde.
 */
export class SourceMonitor<T> {
  readonly state: ReadonlyObservable<SourceState<T>>;
  private readonly mutableState: ObservableState<SourceState<T>>;
  private readonly options: SourceMonitorOptions<T>;
  private refreshing = false;

  constructor(options: SourceMonitorOptions<T>) {
    this.options = options;
    const { descriptor } = options.source;
    this.mutableState = new ObservableState<SourceState<T>>({
      data: options.emptyData,
      status: {
        id: descriptor.id,
        name: descriptor.name,
        organization: descriptor.organization,
        homeCountry: descriptor.homeCountry,
        dataset: descriptor.dataset,
        url: descriptor.url,
        refreshIntervalSeconds: Math.round(descriptor.refreshIntervalMs / 1000),
        health: "PENDING",
        circuitState: options.circuitBreaker.state,
        lastAttemptAt: null,
        lastSuccessAt: null,
        latencyMs: null,
        recordCount: 0,
        rejectedCount: 0,
        lastError: null,
      },
    });
    this.state = this.mutableState;
  }

  get refreshIntervalMs(): number {
    return this.options.source.descriptor.refreshIntervalMs;
  }

  async refresh(): Promise<void> {
    const { circuitBreaker, clock, source, logger } = this.options;
    if (this.refreshing) return;
    if (!circuitBreaker.canRequest()) {
      this.patchStatus({ circuitState: circuitBreaker.state });
      return;
    }

    this.refreshing = true;
    const startedAt = clock.now();
    try {
      const reading = await this.readWithTimeout();
      circuitBreaker.recordSuccess();
      this.mutableState.set({
        data: reading.data,
        status: {
          ...this.mutableState.getValue().status,
          health: "ONLINE",
          circuitState: circuitBreaker.state,
          lastAttemptAt: startedAt.toISOString(),
          lastSuccessAt: clock.now().toISOString(),
          latencyMs: clock.now().getTime() - startedAt.getTime(),
          recordCount: reading.recordCount,
          rejectedCount: reading.rejectedCount,
          lastError: null,
        },
      });
      if (reading.rejectedCount > 0) {
        logger.warn("registros rejeitados na validação", {
          source: source.descriptor.id,
          rejected: reading.rejectedCount,
        });
      }
    } catch (error) {
      circuitBreaker.recordFailure();
      const lastError = describeError(error);
      logger.warn("falha ao consultar fonte", {
        source: source.descriptor.id,
        lastError,
      });
      this.patchStatus({
        health: this.healthAfterFailure(),
        circuitState: circuitBreaker.state,
        lastAttemptAt: startedAt.toISOString(),
        latencyMs: null,
        lastError,
      });
    } finally {
      this.refreshing = false;
    }
  }

  /** Com dados anteriores, a fonte segue servindo o último conjunto válido. */
  private healthAfterFailure(): SourceHealth {
    return this.mutableState.getValue().status.lastSuccessAt ? "STALE" : "OFFLINE";
  }

  private async readWithTimeout() {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error("tempo limite excedido")),
      this.options.source.descriptor.timeoutMs,
    );
    try {
      return await this.options.source.read(controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }

  private patchStatus(patch: Partial<SourceStatus>): void {
    this.mutableState.update((current) => ({
      ...current,
      status: { ...current.status, ...patch },
    }));
  }
}
