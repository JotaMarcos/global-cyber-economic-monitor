// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchHttpClient } from "../../src/gateway/infrastructure/http/fetch-http-client.ts";
import { ClientRateLimiter } from "../../src/gateway/infrastructure/resilience/client-rate-limiter.ts";
import { TimedCircuitBreaker } from "../../src/gateway/infrastructure/resilience/timed-circuit-breaker.ts";
import { TokenBucketRateLimiter } from "../../src/gateway/infrastructure/resilience/token-bucket-rate-limiter.ts";
import {
  IntervalScheduler,
  JsonLogger,
  SystemClock,
} from "../../src/gateway/infrastructure/system/system.ts";
import { FakeClock } from "../support/fakes.ts";

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

describe("ClientRateLimiter", () => {
  const options = { capacity: 2, refillPerSecond: 1 };

  it("mantém um limite independente por cliente", () => {
    const limiter = new ClientRateLimiter(options, new FakeClock());

    expect([1, 2, 3].map(() => limiter.tryConsume("a"))).toEqual([true, true, false]);
    expect(limiter.tryConsume("b")).toBe(true);
  });

  it("descarta os baldes de clientes ociosos", () => {
    const clock = new FakeClock();
    const limiter = new ClientRateLimiter(options, clock);
    limiter.tryConsume("a");
    limiter.tryConsume("b");
    clock.advance(1_000);
    limiter.tryConsume("b");

    limiter.evictIdle();

    expect(limiter.trackedClients).toBe(1);
  });
});

describe("TimedCircuitBreaker", () => {
  const options = { failureThreshold: 3, resetTimeoutMs: 15_000 };

  function openBreaker(clock: FakeClock): TimedCircuitBreaker {
    const breaker = new TimedCircuitBreaker(options, clock);
    for (let i = 0; i < options.failureThreshold; i += 1) breaker.recordFailure();
    return breaker;
  }

  it("inicia fechado e permanece assim abaixo do limiar de falhas", () => {
    const breaker = new TimedCircuitBreaker(options, new FakeClock());
    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.state).toBe("CLOSED");
    expect(breaker.canRequest()).toBe(true);
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

describe("FetchHttpClient", () => {
  const signal = new AbortController().signal;

  it("devolve o JSON e se identifica sem dados pessoais", async () => {
    const httpFetch = vi.fn(() => Promise.resolve(Response.json({ ok: true })));
    const client = new FetchHttpClient(httpFetch);

    await expect(client.getJson("https://exemplo.test/a", signal)).resolves.toEqual({
      ok: true,
    });
    const [, init] = httpFetch.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["user-agent"]).toMatch(/^global-cyber-economic-monitor/);
    expect(headers["user-agent"]).not.toContain("@");
    expect(init.signal).toBe(signal);
  });

  it("rejeita status de erro informando apenas o host", async () => {
    const client = new FetchHttpClient(() =>
      Promise.resolve(new Response("", { status: 429 })),
    );

    await expect(
      client.getJson("https://exemplo.test/caminho?chave=segredo", signal),
    ).rejects.toThrow("HTTP 429 em exemplo.test");
  });

  it("rejeita corpo que não é JSON", async () => {
    const client = new FetchHttpClient(() => Promise.resolve(new Response("<html>")));

    await expect(client.getJson("https://exemplo.test/a", signal)).rejects.toThrow(
      "JSON inválido em exemplo.test",
    );
  });

  it("rejeita resposta acima do limite de tamanho", async () => {
    const huge = `"${"x".repeat(8 * 1024 * 1024 + 1)}"`;
    const client = new FetchHttpClient(() => Promise.resolve(new Response(huge)));

    await expect(client.getJson("https://exemplo.test/a", signal)).rejects.toThrow(
      "resposta acima do limite",
    );
  });
});

describe("adaptadores de sistema", () => {
  afterEach(() => vi.useRealTimers());

  it("SystemClock devolve o instante atual", () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    expect(new SystemClock().now().getTime()).toBe(1_700_000_000_000);
  });

  it("IntervalScheduler executa periodicamente até ser cancelado", () => {
    vi.useFakeTimers();
    const task = vi.fn();
    const cancel = new IntervalScheduler().every(1_000, task);

    vi.advanceTimersByTime(3_000);
    cancel();
    vi.advanceTimersByTime(3_000);

    expect(task).toHaveBeenCalledTimes(3);
  });

  it("JsonLogger emite uma linha JSON por evento, com horário e contexto", () => {
    const lines: string[] = [];
    const logger = new JsonLogger(new FakeClock(Date.UTC(2026, 0, 1)), (line) =>
      lines.push(line),
    );

    logger.info("início", { porta: 8787 });
    logger.warn("atenção");

    expect(lines.map((line) => JSON.parse(line) as unknown)).toEqual([
      { time: "2026-01-01T00:00:00.000Z", level: "info", message: "início", porta: 8787 },
      { time: "2026-01-01T00:00:00.000Z", level: "warn", message: "atenção" },
    ]);
  });
});
