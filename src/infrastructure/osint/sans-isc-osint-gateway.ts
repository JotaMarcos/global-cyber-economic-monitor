import type {
  OsintFeedGateway,
  OsintSnapshot,
} from "../../application/ports/osint-feed-gateway";
import type { AttackerRecord } from "../../domain/threat/threat-log";

export type HttpFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface SansIscGatewayOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly topAttackersLimit: number;
}

export const DEFAULT_SANS_ISC_OPTIONS: SansIscGatewayOptions = {
  baseUrl: "https://isc.sans.edu/api",
  timeoutMs: 4_500,
  topAttackersLimit: 6,
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function toAttackerRecord(item: unknown): AttackerRecord {
  const record = isRecord(item) ? item : {};
  return {
    sourceIp: record.source ?? record.ip,
    targetPort: record.targetport,
    eventCount: record.count ?? record.attacks,
  };
}

/**
 * Adaptador da API pública do SANS Internet Storm Center (DShield).
 * Atua como camada anticorrupção: traduz o JSON externo para o contrato da
 * aplicação. O conteúdo permanece não confiável e é sanitizado no domínio.
 */
export class SansIscOsintGateway implements OsintFeedGateway {
  constructor(
    private readonly httpFetch: HttpFetch,
    private readonly options: SansIscGatewayOptions = DEFAULT_SANS_ISC_OPTIONS,
  ) {}

  async fetchSnapshot(): Promise<OsintSnapshot> {
    const { baseUrl, timeoutMs, topAttackersLimit } = this.options;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Os feeds são independentes: a falha de um não invalida o outro.
      const [infocon, topIps] = await Promise.allSettled([
        this.getJson(`${baseUrl}/infocon?json`, controller.signal),
        this.getJson(
          `${baseUrl}/topips/records/${topAttackersLimit}?json`,
          controller.signal,
        ),
      ]);

      return {
        infoconStatus:
          infocon.status === "fulfilled" && isRecord(infocon.value)
            ? infocon.value.status
            : null,
        topAttackers:
          topIps.status === "fulfilled" && Array.isArray(topIps.value)
            ? topIps.value.map(toAttackerRecord)
            : [],
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getJson(url: string, signal: AbortSignal): Promise<unknown> {
    const response = await this.httpFetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Feed OSINT indisponível (HTTP ${response.status}).`);
    }
    return response.json();
  }
}
