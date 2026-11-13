const DEFAULT_MAX_LENGTH = 110;
const FORBIDDEN_CHARACTERS = /[<>"'`;]/g;
const INJECTION_PATTERNS =
  /(javascript:|onerror=|onload=|eval\(|union\s+select|drop\s+table)/gi;
const IPV4_PATTERN =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
const IPV6_PATTERN = /^[0-9a-fA-F:]{3,39}$/;

export const BLOCKED_MARKER = "[BLOCKED]";
export const INVALID_IP_MARKER = "INVALID_IP_DROPPED";
const FALLBACK_IP = "0.0.0.0";

/** Neutraliza XSS, injeção de HTML e SQLi em textos vindos de fontes externas. */
export function sanitizeText(
  input: unknown,
  maxLength: number = DEFAULT_MAX_LENGTH,
): string {
  if (typeof input !== "string") return "";
  return input
    .replace(FORBIDDEN_CHARACTERS, "")
    .replace(INJECTION_PATTERNS, BLOCKED_MARKER)
    .trim()
    .slice(0, maxLength);
}

/** Aceita apenas IPv4/IPv6 bem formados; qualquer outro valor é descartado. */
export function sanitizeIp(input: unknown): string {
  if (typeof input !== "string") return FALLBACK_IP;
  const candidate = input.trim();
  const isValid = IPV4_PATTERN.test(candidate) || IPV6_PATTERN.test(candidate);
  return isValid ? candidate : INVALID_IP_MARKER;
}

/** Indica se a sanitização alterou o conteúdo, isto é, se havia carga maliciosa. */
export function isMaliciousPayload(input: string): boolean {
  return sanitizeText(input, input.length) !== input.trim();
}
