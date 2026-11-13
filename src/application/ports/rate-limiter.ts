export interface RateLimiter {
  tryConsume(tokens?: number): boolean;
}
