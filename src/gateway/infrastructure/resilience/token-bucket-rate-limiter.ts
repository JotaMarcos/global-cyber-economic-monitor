import type { Clock, RateLimiter } from "../../application/ports.ts";

export interface TokenBucketOptions {
  readonly capacity: number;
  readonly refillPerSecond: number;
}

/** Token bucket: absorve rajadas até `capacity` e repõe a uma taxa constante. */
export class TokenBucketRateLimiter implements RateLimiter {
  private readonly options: TokenBucketOptions;
  private readonly clock: Clock;
  private tokens: number;
  private lastRefillAt: number;

  constructor(options: TokenBucketOptions, clock: Clock) {
    this.options = options;
    this.clock = clock;
    this.tokens = options.capacity;
    this.lastRefillAt = clock.now().getTime();
  }

  tryConsume(tokens: number = 1): boolean {
    this.refill();
    if (this.tokens < tokens) return false;
    this.tokens -= tokens;
    return true;
  }

  /** Verdadeiro quando o balde voltou ao teto, isto é, o cliente está ocioso. */
  isFull(): boolean {
    this.refill();
    return this.tokens >= this.options.capacity;
  }

  private refill(): void {
    const now = this.clock.now().getTime();
    const elapsedSeconds = (now - this.lastRefillAt) / 1000;
    if (elapsedSeconds <= 0) return;

    this.tokens = Math.min(
      this.options.capacity,
      this.tokens + elapsedSeconds * this.options.refillPerSecond,
    );
    this.lastRefillAt = now;
  }
}
