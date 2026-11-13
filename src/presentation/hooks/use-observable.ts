import { useSyncExternalStore } from "react";
import type { ReadonlyObservable } from "../../shared/observable/observable";

/** Inscreve o componente em um observável e o renderiza a cada emissão. */
export function useObservable<T>(observable: ReadonlyObservable<T>): T {
  return useSyncExternalStore(observable.subscribe, observable.getValue);
}
