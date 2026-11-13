import type { Clock } from "../../application/ports/clock";
import type { RateLimiter } from "../../application/ports/rate-limiter";

export interface TokenBucketOptions {
  readonly capacity: number;
  readonly refillPerSecond: number;
}

/** Token bucket: absorve rajadas até `capacity` e repõe a uma taxa constante. */
export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private lastRefillAt: number;

  constructor(
    private readonly options: TokenBucketOptions,
    private readonly clock: Clock,
  ) {
    this.tokens = options.capacity;
    this.lastRefillAt = clock.now().getTime();
  }

  tryConsume(tokens: number = 1): boolean {
    this.refill();
    if (this.tokens < tokens) return false;
    this.tokens -= tokens;
    return true;
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
