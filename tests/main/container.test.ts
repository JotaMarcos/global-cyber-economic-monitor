import { describe, expect, it, vi } from "vitest";
import {
  createContainer,
  createDashboardDependencies,
} from "../../src/main/composition-root";
import { Container, createToken } from "../../src/main/container";
import { TOKENS } from "../../src/main/tokens";
import { FakeClock } from "../support/fakes";

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

describe("raiz de composição", () => {
  it("resolve todos os tokens registrados", () => {
    const container = createContainer();

    for (const [name, token] of Object.entries(TOKENS)) {
      expect(container.resolve(token as never), name).toBeDefined();
    }
  });

  it("compartilha o mesmo estado entre casos de uso e apresentação", () => {
    const container = createContainer();
    const dependencies = createDashboardDependencies(container);

    dependencies.commands.toggleDdosSimulation();
    dependencies.commands.filter.selectCountry("BR");

    expect(container.resolve(TOKENS.ddosSimulation).getValue()).toBe(true);
    expect(dependencies.state.filter.getValue().country).toBe("BR");
    expect(
      dependencies.queries.getOrganizationOverview(
        dependencies.state.filter.getValue(),
        false,
      ).kpis.entitiesCount,
    ).toBe(8);
  });

  it("aceita dublês registrados antes da resolução", () => {
    const clock = new FakeClock();
    const container = createContainer().registerSingleton(TOKENS.clock, () => clock);

    container.resolve(TOKENS.rateLimiter);

    expect(container.resolve(TOKENS.clock)).toBe(clock);
  });
});
