import { describe, expect, it, vi } from "vitest";
import { ObservableState } from "../../src/shared/observable/observable";

describe("ObservableState", () => {
  it("expõe o valor inicial", () => {
    expect(new ObservableState(7).getValue()).toBe(7);
  });

  it("notifica todos os observadores a cada novo valor", () => {
    const state = new ObservableState(0);
    const first = vi.fn();
    const second = vi.fn();
    state.subscribe(first);
    state.subscribe(second);

    state.set(1);

    expect(first).toHaveBeenCalledExactlyOnceWith(1);
    expect(second).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("não notifica quando o valor permanece idêntico", () => {
    const state = new ObservableState("a");
    const listener = vi.fn();
    state.subscribe(listener);

    state.set("a");

    expect(listener).not.toHaveBeenCalled();
  });

  it("deixa de notificar após o cancelamento da inscrição", () => {
    const state = new ObservableState(0);
    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);

    unsubscribe();
    state.set(1);

    expect(listener).not.toHaveBeenCalled();
  });

  it("deriva o próximo valor a partir do atual com update", () => {
    const state = new ObservableState(2);
    state.update((value) => value * 5);
    expect(state.getValue()).toBe(10);
  });

  it("tolera cancelamento de inscrição durante a emissão", () => {
    const state = new ObservableState(0);
    const second = vi.fn();
    const unsubscribeFirst = state.subscribe(() => unsubscribeFirst());
    state.subscribe(second);

    state.set(1);
    state.set(2);

    expect(second).toHaveBeenCalledTimes(2);
  });

  it("mantém os métodos de leitura utilizáveis como referência solta", () => {
    const { getValue, subscribe } = new ObservableState(3);
    expect(getValue()).toBe(3);
    expect(() => subscribe(() => undefined)()).not.toThrow();
  });
});
