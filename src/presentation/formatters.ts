const LOCALE = "pt-BR";

export function formatInteger(value: number): string {
  return value.toLocaleString(LOCALE);
}

export function formatDecimal(value: number, fractionDigits: number = 1): string {
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
