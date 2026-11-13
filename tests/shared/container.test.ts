import { describe, expect, it, vi } from "vitest";
import { Container, createToken } from "../../src/shared/di/container.ts";

describe("Container", () => {
  it("cria a instância sob demanda e a reutiliza (tempo de vida singleton)", () => {
    const token = createToken<object>("Servico");
    const factory = vi.fn(() => ({}));
    const container = new Container().registerSingleton(token, factory);

    expect(factory).not.toHaveBeenCalled();
    expect(container.resolve(token)).toBe(container.resolve(token));
    expect(factory).toHaveBeenCalledOnce();
  });

  it("isola as instâncias entre contêineres distintos", () => {
    const token = createToken<object>("Servico");
    const build = () => new Container().registerSingleton(token, () => ({}));

    expect(build().resolve(token)).not.toBe(build().resolve(token));
  });

  it("injeta dependências já registradas na fábrica", () => {
    const base = createToken<number>("Base");
    const derived = createToken<number>("Derivado");
    const container = new Container()
      .registerSingleton(base, () => 20)
      .registerSingleton(derived, (c) => c.resolve(base) + 1);

    expect(container.resolve(derived)).toBe(21);
  });

  it("permite substituir um registro, descartando a instância anterior", () => {
    const token = createToken<string>("Servico");
    const container = new Container().registerSingleton(token, () => "real");
    container.resolve(token);

    container.registerSingleton(token, () => "dublê");

    expect(container.resolve(token)).toBe("dublê");
  });

  it("acusa dependência não registrada", () => {
    expect(() => new Container().resolve(createToken("Ausente"))).toThrow(
      "Dependência não registrada: Ausente",
    );
  });

  it("acusa dependência circular", () => {
    const a = createToken<unknown>("A");
    const b = createToken<unknown>("B");
    const container = new Container()
      .registerSingleton(a, (c) => c.resolve(b))
      .registerSingleton(b, (c) => c.resolve(a));

    expect(() => container.resolve(a)).toThrow("Dependência circular detectada: A");
  });
});
