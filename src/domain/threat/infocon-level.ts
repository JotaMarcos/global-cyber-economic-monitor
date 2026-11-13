export const INFOCON_LEVELS = ["GREEN", "YELLOW", "ORANGE", "RED"] as const;

export type InfoconLevel = (typeof INFOCON_LEVELS)[number];

/** Converte o status bruto do SANS ISC; devolve `null` se não for reconhecido. */
export function parseInfoconLevel(raw: unknown): InfoconLevel | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toUpperCase();
  return (INFOCON_LEVELS as readonly string[]).includes(normalized)
    ? (normalized as InfoconLevel)
    : null;
}
