import { describe, expect, it } from "vitest";
import { TimedCircuitBreaker } from "../../src/infrastructure/resilience/timed-circuit-breaker";
import { TokenBucketRateLimiter } from "../../src/infrastructure/resilience/token-bucket-rate-limiter";
import { FakeClock } from "../support/fakes";

describe("TokenBucketRateLimiter", () => {
  const options = { capacity: 3, refillPerSecond: 2 };

  it("permite rajada até a capacidade e recusa o excedente", () => {
    const limiter = new TokenBucketRateLimiter(options, new FakeClock());

    expect([1, 2, 3, 4].map(() => limiter.tryConsume())).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("repõe tokens proporcionalmente ao tempo decorrido", () => {
    const clock = new FakeClock();
    const limiter = new TokenBucketRateLimiter(options, clock);
    limiter.tryConsume(3);

    clock.advance(500);

    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
  });

  it("nunca acumula além da capacidade", () => {
    const clock = new FakeClock();
    const limiter = new TokenBucketRateLimiter(options, clock);

    clock.advance(60_000);

    expect(limiter.tryConsume(3)).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
  });

  it("recusa consumo maior que o saldo sem debitar", () => {
    const limiter = new TokenBucketRateLimiter(options, new FakeClock());

    expect(limiter.tryConsume(4)).toBe(false);
    expect(limiter.tryConsume(3)).toBe(true);
  });
});

describe("TimedCircuitBreaker", () => {
  const options = { failureThreshold: 3, resetTimeoutMs: 15_000 };

  function openBreaker(clock: FakeClock): TimedCircuitBreaker {
    const breaker = new TimedCircuitBreaker(options, clock);
    for (let i = 0; i < options.failureThreshold; i += 1) breaker.recordFailure();
    return breaker;
  }

  it("inicia fechado e permite requisições", () => {
    const breaker = new TimedCircuitBreaker(options, new FakeClock());

    expect(breaker.state).toBe("CLOSED");
    expect(breaker.canRequest()).toBe(true);
  });

  it("permanece fechado abaixo do limiar de falhas", () => {
    const breaker = new TimedCircuitBreaker(options, new FakeClock());
    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.state).toBe("CLOSED");
  });

  it("abre ao atingir o limiar e bloqueia requisições", () => {
    const breaker = openBreaker(new FakeClock());

    expect(breaker.state).toBe("OPEN");
    expect(breaker.canRequest()).toBe(false);
  });

  it("zera a contagem de falhas após um sucesso", () => {
    const breaker = new TimedCircuitBreaker(options, new FakeClock());
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();

    expect(breaker.state).toBe("CLOSED");
  });

  it("libera uma única requisição de teste após o tempo de espera", () => {
    const clock = new FakeClock();
    const breaker = openBreaker(clock);

    clock.advance(options.resetTimeoutMs);

    expect(breaker.canRequest()).toBe(true);
    expect(breaker.state).toBe("HALF-OPEN");
    expect(breaker.canRequest()).toBe(false);
  });

  it("fecha quando a requisição de teste tem sucesso", () => {
    const clock = new FakeClock();
    const breaker = openBreaker(clock);
    clock.advance(options.resetTimeoutMs);
    breaker.canRequest();

    breaker.recordSuccess();

    expect(breaker.state).toBe("CLOSED");
  });

  it("reabre e reinicia a espera quando a requisição de teste falha", () => {
    const clock = new FakeClock();
    const breaker = openBreaker(clock);
    clock.advance(options.resetTimeoutMs);
    breaker.canRequest();

    breaker.recordFailure();
    clock.advance(options.resetTimeoutMs - 1);

    expect(breaker.state).toBe("OPEN");
    expect(breaker.canRequest()).toBe(false);
  });
});
