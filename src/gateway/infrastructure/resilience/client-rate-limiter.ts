import type { Clock } from "../../application/ports.ts";
import {
  TokenBucketRateLimiter,
  type TokenBucketOptions,
} from "./token-bucket-rate-limiter.ts";

const MAX_TRACKED_CLIENTS = 10_000;

/** Um token bucket por cliente, com descarte dos baldes ociosos. */
export class ClientRateLimiter {
  private readonly buckets = new Map<string, TokenBucketRateLimiter>();
  private readonly options: TokenBucketOptions;
  private readonly clock: Clock;

  constructor(options: TokenBucketOptions, clock: Clock) {
    this.options = options;
    this.clock = clock;
  }

  tryConsume(clientId: string): boolean {
    let bucket = this.buckets.get(clientId);
    if (!bucket) {
      if (this.buckets.size >= MAX_TRACKED_CLIENTS) this.evictIdle();
      bucket = new TokenBucketRateLimiter(this.options, this.clock);
      this.buckets.set(clientId, bucket);
    }
    return bucket.tryConsume();
  }

  get trackedClients(): number {
    return this.buckets.size;
  }

  evictIdle(): void {
    for (const [clientId, bucket] of this.buckets) {
      if (bucket.isFull()) this.buckets.delete(clientId);
    }
  }
}
