import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type {
  AgencyDirectory,
  ThreatSnapshot,
} from "../../../contract/threat-snapshot.ts";
import type { ReadonlyObservable } from "../../../shared/observable/observable.ts";
import type { Clock, Logger } from "../../application/ports.ts";
import type { ClientRateLimiter } from "../resilience/client-rate-limiter.ts";
import { resolveStaticFile } from "./static-files.ts";

export interface GatewayServerOptions {
  readonly snapshot: ReadonlyObservable<ThreatSnapshot>;
  readonly agencyDirectory: ReadonlyObservable<AgencyDirectory>;
  readonly rateLimiter: ClientRateLimiter;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly staticDir: string | null;
  readonly allowedOrigin: string | null;
  readonly maxStreamClients: number;
  readonly heartbeatMs: number;
}

const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "geolocation=(), camera=(), microphone=()",
};

type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void | Promise<void>;

/**
 * Adaptador HTTP de entrada. Expõe o retrato consolidado por consulta
 * (`/snapshot`) e por fluxo contínuo (`/stream`, Server-Sent Events), além de
 * servir os arquivos estáticos do dashboard.
 */
export function createGatewayServer(options: GatewayServerOptions): Server {
  const { snapshot, agencyDirectory, clock, logger } = options;
  const startedAt = clock.now().getTime();
  const streamClients = new Set<ServerResponse>();

  const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
    response.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify(body));
  };

  const sendError = (response: ServerResponse, status: number, message: string): void =>
    sendJson(response, status, { error: { status, message } });

  const health: Handler = (_request, response) => {
    const { sources } = snapshot.getValue();
    const online = sources.filter((source) => source.health === "ONLINE").length;
    sendJson(response, 200, {
      status: online === sources.length ? "ok" : online > 0 ? "degraded" : "starting",
      uptimeSeconds: Math.round((clock.now().getTime() - startedAt) / 1000),
      sourcesOnline: online,
      sourcesTotal: sources.length,
      streamClients: streamClients.size,
    });
  };

  const stream: Handler = (request, response) => {
    if (streamClients.size >= options.maxStreamClients) {
      response.setHeader("retry-after", "30");
      return sendError(response, 503, "Limite de conexões de streaming atingido.");
    }
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    const publish = (value: ThreatSnapshot): void => {
      response.write(`event: snapshot\ndata: ${JSON.stringify(value)}\n\n`);
    };
    response.write("retry: 5000\n\n");
    publish(snapshot.getValue());

    const unsubscribe = snapshot.subscribe(publish);
    const heartbeat = setInterval(
      () => response.write(": ping\n\n"),
      options.heartbeatMs,
    );
    streamClients.add(response);
    request.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      streamClients.delete(response);
    });
  };

  const routes: Record<string, Handler> = {
    "/api/v1/health": health,
    "/api/v1/snapshot": (_request, response) =>
      sendJson(response, 200, snapshot.getValue()),
    "/api/v1/agencies": (_request, response) =>
      sendJson(response, 200, agencyDirectory.getValue()),
    "/api/v1/stream": stream,
  };

  const serveStatic: Handler = async (request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://gateway.local");
    const file = options.staticDir
      ? await resolveStaticFile(options.staticDir, pathname)
      : null;
    if (!file) return sendError(response, 404, "Recurso não encontrado.");

    response.writeHead(200, {
      "content-type": file.contentType,
      "cache-control": file.immutable
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
    response.end(request.method === "HEAD" ? undefined : file.body);
  };

  const handle: Handler = async (request, response) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      response.setHeader(name, value);
    }
    if (options.allowedOrigin) {
      response.setHeader("access-control-allow-origin", options.allowedOrigin);
      response.setHeader("vary", "origin");
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.setHeader("allow", "GET, HEAD");
      return sendError(response, 405, "Método não permitido.");
    }

    const { pathname } = new URL(request.url ?? "/", "http://gateway.local");
    if (!pathname.startsWith("/api/")) return serveStatic(request, response);

    const clientId = request.socket.remoteAddress ?? "desconhecido";
    if (!options.rateLimiter.tryConsume(clientId)) {
      response.setHeader("retry-after", "1");
      return sendError(response, 429, "Limite de requisições excedido.");
    }
    const route = routes[pathname];
    if (!route) return sendError(response, 404, "Rota inexistente.");
    return route(request, response);
  };

  const server = createServer((request, response) => {
    Promise.resolve(handle(request, response)).catch((error: unknown) => {
      logger.warn("erro ao atender requisição", { error: String(error) });
      if (!response.headersSent) sendError(response, 500, "Erro interno.");
      else response.end();
    });
  });

  server.on("close", () => streamClients.forEach((client) => client.end()));
  return server;
}
