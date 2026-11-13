import {
  agencyDirectorySchema,
  threatSnapshotSchema,
  type Agency,
} from "../../contract/threat-snapshot.ts";
import type {
  ThreatFeed,
  ThreatFeedHandlers,
  Unsubscribe,
} from "../application/threat-feed.ts";

/** Subconjunto de EventSource usado pelo adaptador, para permitir dublês. */
export interface EventSourceLike {
  readonly readyState: number;
  addEventListener(type: string, listener: (event: Event) => void): void;
  close(): void;
}

export type HttpFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpThreatFeedOptions {
  readonly baseUrl: string;
  readonly httpFetch: HttpFetch;
  readonly createEventSource: (url: string) => EventSourceLike;
}

const EVENT_SOURCE_CLOSED = 2;

/**
 * Adaptador do gateway: fluxo contínuo por Server-Sent Events e consulta HTTP
 * para o diretório de agências. Toda mensagem é validada contra o contrato.
 */
export class HttpThreatFeed implements ThreatFeed {
  private readonly options: HttpThreatFeedOptions;

  constructor(options: HttpThreatFeedOptions) {
    this.options = options;
  }

  subscribe(handlers: ThreatFeedHandlers): Unsubscribe {
    const source = this.options.createEventSource(`${this.options.baseUrl}/stream`);

    source.addEventListener("open", () => handlers.onConnectionChange("LIVE"));
    // O navegador reconecta sozinho, salvo quando encerra a conexão em definitivo.
    source.addEventListener("error", () =>
      handlers.onConnectionChange(
        source.readyState === EVENT_SOURCE_CLOSED ? "OFFLINE" : "RECONNECTING",
      ),
    );
    source.addEventListener("snapshot", (event) => {
      const parsed = parseJson((event as MessageEvent<unknown>).data);
      const result = threatSnapshotSchema.safeParse(parsed);
      if (result.success) handlers.onSnapshot(result.data);
      else handlers.onInvalidMessage();
    });

    return () => source.close();
  }

  async loadAgencies(): Promise<Agency[]> {
    const response = await this.options.httpFetch(`${this.options.baseUrl}/agencies`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Gateway respondeu HTTP ${response.status}.`);
    }
    return agencyDirectorySchema.parse(await response.json()).agencies;
  }
}

function parseJson(text: unknown): unknown {
  if (typeof text !== "string") return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
