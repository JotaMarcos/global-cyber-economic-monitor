export type CircuitState = "CLOSED" | "OPEN" | "HALF-OPEN";

export interface CircuitBreaker {
  readonly state: CircuitState;
  canRequest(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
}
