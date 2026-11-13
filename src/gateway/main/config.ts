import type { LossReference } from "../../contract/threat-snapshot.ts";

export interface GatewayConfig {
  readonly host: string;
  readonly port: number;
  readonly staticDir: string | null;
  readonly allowedOrigin: string | null;
  readonly lossReference: LossReference;
}

/**
 * Custo médio global de uma violação de dados segundo o relatório Cost of a
 * Data Breach 2025 (IBM Security / Ponemon Institute). É um parâmetro de
 * estimativa, ajustável por GCEM_LOSS_PER_INCIDENT_USD.
 */
export const DEFAULT_LOSS_REFERENCE: LossReference = {
  perIncidentUsd: 4_440_000,
  source: "IBM Cost of a Data Breach Report 2025 (custo médio global por violação)",
};

type Env = Record<string, string | undefined>;

function positiveNumber(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Variável ${name} inválida: "${raw}".`);
  }
  return value;
}

export function loadConfig(env: Env): GatewayConfig {
  const port = positiveNumber(env.PORT, 8787, "PORT");
  if (!Number.isInteger(port) || port > 65_535) {
    throw new Error(`Variável PORT inválida: "${env.PORT}".`);
  }
  const customLoss = env.GCEM_LOSS_PER_INCIDENT_USD;

  return {
    host: env.HOST?.trim() || "127.0.0.1",
    port,
    staticDir: env.GCEM_STATIC_DIR?.trim() || null,
    allowedOrigin: env.GCEM_ALLOWED_ORIGIN?.trim() || null,
    lossReference: customLoss?.trim()
      ? {
          perIncidentUsd: positiveNumber(
            customLoss,
            DEFAULT_LOSS_REFERENCE.perIncidentUsd,
            "GCEM_LOSS_PER_INCIDENT_USD",
          ),
          source: env.GCEM_LOSS_SOURCE?.trim() || "Parâmetro definido pelo operador",
        }
      : DEFAULT_LOSS_REFERENCE,
  };
}
