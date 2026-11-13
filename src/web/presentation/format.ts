const LOCALE = "pt-BR";

const integer = new Intl.NumberFormat(LOCALE);
const compactUsd = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const fullUsd = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const clock = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
});
const shortDay = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});
const regionNames = new Intl.DisplayNames([LOCALE], { type: "region" });

export const formatInteger = (value: number): string => integer.format(value);
export const formatUsdCompact = (value: number): string => compactUsd.format(value);
export const formatUsd = (value: number): string => fullUsd.format(value);

/** Data e hora em UTC, fuso comum a todas as fontes. */
export const formatDateTime = (iso: string): string =>
  `${dateTime.format(new Date(iso))} UTC`;
export const formatClock = (iso: string): string => `${clock.format(new Date(iso))} UTC`;
export const formatDay = (day: string): string =>
  shortDay.format(new Date(`${day}T00:00:00Z`));

export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

export function countryName(code: string | null): string {
  if (!code) return "País não informado";
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
