import type { z } from "zod";

export interface ValidatedRecords<T> {
  readonly accepted: T[];
  readonly rejectedCount: number;
}

/**
 * Valida registro a registro: um item malformado é descartado e contabilizado,
 * sem invalidar o restante da resposta.
 */
export function validateRecords<S extends z.ZodType>(
  schema: S,
  rawRecords: readonly unknown[],
): ValidatedRecords<z.infer<S>> {
  const accepted: z.infer<S>[] = [];
  let rejectedCount = 0;

  for (const raw of rawRecords) {
    const result = schema.safeParse(raw);
    if (result.success) accepted.push(result.data);
    else rejectedCount += 1;
  }
  return { accepted, rejectedCount };
}

/** Envelope fora do formato esperado é falha da fonte, não registro rejeitado. */
export function parseEnvelope<S extends z.ZodType>(
  schema: S,
  payload: unknown,
  sourceName: string,
): z.infer<S> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(`${sourceName}: resposta fora do formato esperado`);
  }
  return result.data;
}

export function toCountryCode(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z]{2}$/.test(raw.trim())
    ? raw.trim().toUpperCase()
    : null;
}
