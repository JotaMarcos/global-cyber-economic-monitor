import type {
  CircuitBreaker,
  CircuitState,
} from "../../application/ports/circuit-breaker";
import type { Clock } from "../../application/ports/clock";

export interface CircuitBreakerOptions {
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
}

/**
 * Abre o circuito após falhas consecutivas e libera uma requisição de teste
 * (HALF-OPEN) quando o tempo de espera expira.
 */
export class TimedCircuitBreaker implements CircuitBreaker {
  private currentState: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private retryAt = 0;

  constructor(
    private readonly options: CircuitBreakerOptions,
    private readonly clock: Clock,
  ) {}

  get state(): CircuitState {
    return this.currentState;
  }

  canRequest(): boolean {
    if (this.currentState === "CLOSED") return true;
    if (this.currentState === "OPEN" && this.now() >= this.retryAt) {
      this.currentState = "HALF-OPEN";
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.currentState = "CLOSED";
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    const probeFailed = this.currentState === "HALF-OPEN";
    if (probeFailed || this.consecutiveFailures >= this.options.failureThreshold) {
      this.currentState = "OPEN";
      this.retryAt = this.now() + this.options.resetTimeoutMs;
    }
  }

  private now(): number {
    return this.clock.now().getTime();
  }
}
