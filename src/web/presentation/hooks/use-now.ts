import { useEffect, useState } from "react";

/**
 * Relógio da interface: devolve o instante atual, renovado a cada intervalo,
 * para que janelas de tempo deslizantes avancem mesmo sem dados novos.
 */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
