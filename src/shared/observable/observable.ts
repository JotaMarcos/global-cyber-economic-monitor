export type Listener<T> = (value: T) => void;
export type Unsubscribe = () => void;

/** Contrato somente leitura: quem observa não consegue alterar o estado. */
export interface ReadonlyObservable<T> {
  getValue(): T;
  subscribe(listener: Listener<T>): Unsubscribe;
}

/**
 * Sujeito observável que retém o último valor emitido (padrão Observer).
 * Os métodos de leitura são propriedades com `this` fixo para permitir o
 * repasse direto como referência (ex.: `useSyncExternalStore`).
 */
export class ObservableState<T> implements ReadonlyObservable<T> {
  private readonly listeners = new Set<Listener<T>>();
  private value: T;

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  readonly getValue = (): T => this.value;

  readonly subscribe = (listener: Listener<T>): Unsubscribe => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  set(nextValue: T): void {
    if (Object.is(nextValue, this.value)) return;
    this.value = nextValue;
    this.notify();
  }

  update(reducer: (current: T) => T): void {
    this.set(reducer(this.value));
  }

  private notify(): void {
    // Cópia defensiva: um observador pode cancelar a inscrição durante a emissão.
    for (const listener of [...this.listeners]) {
      listener(this.value);
    }
  }
}
