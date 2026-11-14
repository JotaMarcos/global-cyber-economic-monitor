import type { HttpClient } from "../../application/ports.ts";

export type HttpFetch = (input: string, init?: RequestInit) => Promise<Response>;

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

/** Identificação genérica do cliente, sem dados pessoais. */
export const USER_AGENT = "global-cyber-economic-monitor/2.0 (+gateway OSINT)";

export class FetchHttpClient implements HttpClient {
  private readonly httpFetch: HttpFetch;

  constructor(httpFetch: HttpFetch) {
    this.httpFetch = httpFetch;
  }

  async getText(url: string, signal: AbortSignal): Promise<string> {
    const response = await this.httpFetch(url, {
      signal,
      redirect: "follow",
      headers: { accept: "application/json", "user-agent": USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} em ${new URL(url).host}`);
    }

    const body = await response.text();
    if (body.length > MAX_RESPONSE_BYTES) {
      throw new Error(`resposta acima do limite em ${new URL(url).host}`);
    }
    return body;
  }

  async getJson(url: string, signal: AbortSignal): Promise<unknown> {
    const body = await this.getText(url, signal);
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new Error(`JSON inválido em ${new URL(url).host}`);
    }
  }
}
