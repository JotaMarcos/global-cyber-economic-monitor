import type { CircuitState, SourceId } from "../../contract/threat-snapshot.ts";

export interface Clock {
  now(): Date;
}

export type CancelSchedule = () => void;

export interface Scheduler {
  every(intervalMs: number, task: () => void): CancelSchedule;
}

export interface CircuitBreaker {
  readonly state: CircuitState;
  canRequest(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
}

export interface RateLimiter {
  tryConsume(tokens?: number): boolean;
}

/** Cliente HTTP de saída. Rejeita em status diferente de 2xx. */
export interface HttpClient {
  getJson(url: string, signal: AbortSignal): Promise<unknown>;
  /** Corpo como texto, para formatos que não são um documento JSON único. */
  getText(url: string, signal: AbortSignal): Promise<string>;
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}

export interface SourceDescriptor {
  readonly id: SourceId;
  readonly name: string;
  readonly organization: string;
  readonly homeCountry: string;
  readonly dataset: string;
  readonly url: string;
  readonly refreshIntervalMs: number;
  /** Tempo limite da coleta; algumas fontes respondem lentamente. */
  readonly timeoutMs: number;
}

export interface SourceReading<T> {
  readonly data: T;
  /** Registros aceitos após validação por esquema. */
  readonly recordCount: number;
  /** Registros descartados por não atenderem ao esquema. */
  readonly rejectedCount: number;
}

/** Fonte externa de inteligência. Cada adaptador traduz e valida o próprio formato. */
export interface ThreatSource<T> {
  readonly descriptor: SourceDescriptor;
  read(signal: AbortSignal): Promise<SourceReading<T>>;
}
