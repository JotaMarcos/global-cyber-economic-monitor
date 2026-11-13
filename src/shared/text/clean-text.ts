/* eslint-disable no-control-regex -- remover caracteres de controle é o propósito da expressão */
const CONTROL_CHARACTERS =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\ufeff]/g;
/* eslint-enable no-control-regex */
const ANGLE_BRACKETS = /[<>]/g;
const WHITESPACE_RUN = /\s+/g;
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const IPV6 = /^(?=.*:)[0-9a-fA-F:]{3,39}$/;

/**
 * Normaliza texto vindo de fonte externa: remove caracteres de controle e
 * marcadores de direção, elimina delimitadores de marcação e limita o tamanho.
 * É uma defesa complementar; a proteção primária contra XSS é o escape feito
 * pela camada de apresentação.
 */
export function cleanText(input: unknown, maxLength: number = 160): string {
  if (typeof input !== "string") return "";
  return input
    .replace(CONTROL_CHARACTERS, " ")
    .replace(ANGLE_BRACKETS, "")
    .replace(WHITESPACE_RUN, " ")
    .trim()
    .slice(0, maxLength);
}

export function isIpAddress(input: unknown): input is string {
  return typeof input === "string" && (IPV4.test(input) || IPV6.test(input));
}

/** Aceita apenas URLs http(s) absolutas; qualquer outro esquema é descartado. */
export function toHttpUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  try {
    const url = new URL(input.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
