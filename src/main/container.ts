/** Identificador tipado de uma dependência registrada no contêiner. */
export interface Token<T> {
  readonly key: symbol;
  /** Campo fantasma: existe apenas para carregar o tipo `T`. */
  readonly __type?: T;
}

export function createToken<T>(description: string): Token<T> {
  return { key: Symbol(description) };
}

type Factory<T> = (container: Container) => T;

/**
 * Contêiner de injeção de dependências com tempo de vida singleton.
 *
 * A unicidade da instância é responsabilidade do contêiner, e não da classe:
 * nenhuma classe expõe `getInstance()` nem guarda estado estático. Cada
 * contêiner mantém o próprio grafo, de modo que testes e instâncias paralelas
 * da aplicação permanecem isolados.
 */
export class Container {
  private readonly factories = new Map<symbol, Factory<unknown>>();
  private readonly instances = new Map<symbol, unknown>();
  private readonly resolving = new Set<symbol>();

  registerSingleton<T>(token: Token<T>, factory: Factory<T>): this {
    this.factories.set(token.key, factory);
    this.instances.delete(token.key);
    return this;
  }

  resolve<T>(token: Token<T>): T {
    const { key } = token;
    if (this.instances.has(key)) return this.instances.get(key) as T;

    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Dependência não registrada: ${String(key.description)}`);
    }
    if (this.resolving.has(key)) {
      throw new Error(`Dependência circular detectada: ${String(key.description)}`);
    }

    this.resolving.add(key);
    try {
      const instance = factory(this) as T;
      this.instances.set(key, instance);
      return instance;
    } finally {
      this.resolving.delete(key);
    }
  }
}
