import type { Server } from "node:http";
import { Container, createToken } from "../../shared/di/container.ts";
import type {
  Clock,
  HttpClient,
  Logger,
  Scheduler,
  ThreatSource,
} from "../application/ports.ts";
import { SourceMonitor } from "../application/source-monitor.ts";
import { ThreatIntelService } from "../application/threat-intel-service.ts";
import {
  FetchHttpClient,
  type HttpFetch,
} from "../infrastructure/http/fetch-http-client.ts";
import { createGatewayServer } from "../infrastructure/http/gateway-server.ts";
import { ClientRateLimiter } from "../infrastructure/resilience/client-rate-limiter.ts";
import { TimedCircuitBreaker } from "../infrastructure/resilience/timed-circuit-breaker.ts";
import { CisaKevSource } from "../infrastructure/sources/cisa-kev-source.ts";
import { FeodoTrackerSource } from "../infrastructure/sources/feodo-tracker-source.ts";
import { FirstTeamsSource } from "../infrastructure/sources/first-teams-source.ts";
import { IbgeLocalitiesSource } from "../infrastructure/sources/ibge-localities-source.ts";
import { NistNvdSource } from "../infrastructure/sources/nist-nvd-source.ts";
import { RansomwareLiveSource } from "../infrastructure/sources/ransomware-live-source.ts";
import { SansIscSource } from "../infrastructure/sources/sans-isc-source.ts";
import {
  IntervalScheduler,
  JsonLogger,
  SystemClock,
} from "../infrastructure/system/system.ts";
import type { GatewayConfig } from "./config.ts";

const CIRCUIT_BREAKER = { failureThreshold: 3, resetTimeoutMs: 60_000 };
const INBOUND_RATE_LIMIT = { capacity: 60, refillPerSecond: 10 };
const MAX_STREAM_CLIENTS = 200;
const HEARTBEAT_MS = 25_000;

export const TOKENS = {
  config: createToken<GatewayConfig>("GatewayConfig"),
  clock: createToken<Clock>("Clock"),
  scheduler: createToken<Scheduler>("Scheduler"),
  logger: createToken<Logger>("Logger"),
  httpFetch: createToken<HttpFetch>("HttpFetch"),
  httpClient: createToken<HttpClient>("HttpClient"),
  rateLimiter: createToken<ClientRateLimiter>("ClientRateLimiter"),
  service: createToken<ThreatIntelService>("ThreatIntelService"),
  server: createToken<Server>("GatewayServer"),
} as const;

export interface GatewayHostingOptions {
  /**
   * Cabeçalho confiável com o IP do cliente, quando o gateway roda atrás de
   * um proxy (ex.: `x-nf-client-connection-ip` no Netlify).
   */
  readonly clientIpHeader?: string;
}

/** Raiz de composição do gateway: único ponto que conhece as classes concretas. */
export function createGatewayContainer(
  config: GatewayConfig,
  hosting: GatewayHostingOptions = {},
): Container {
  const container = new Container();

  const monitor = <T>(c: Container, source: ThreatSource<T>, emptyData: T) =>
    new SourceMonitor<T>({
      source,
      emptyData,
      // Um circuito por fonte: a falha de uma agência não afeta as demais.
      circuitBreaker: new TimedCircuitBreaker(CIRCUIT_BREAKER, c.resolve(TOKENS.clock)),
      clock: c.resolve(TOKENS.clock),
      logger: c.resolve(TOKENS.logger),
    });

  return container
    .registerSingleton(TOKENS.config, () => config)
    .registerSingleton(TOKENS.clock, () => new SystemClock())
    .registerSingleton(TOKENS.scheduler, () => new IntervalScheduler())
    .registerSingleton(
      TOKENS.logger,
      (c) =>
        new JsonLogger(c.resolve(TOKENS.clock), (line) =>
          process.stdout.write(`${line}\n`),
        ),
    )
    .registerSingleton(TOKENS.httpFetch, () => (input, init) => fetch(input, init))
    .registerSingleton(
      TOKENS.httpClient,
      (c) => new FetchHttpClient(c.resolve(TOKENS.httpFetch)),
    )
    .registerSingleton(
      TOKENS.rateLimiter,
      (c) => new ClientRateLimiter(INBOUND_RATE_LIMIT, c.resolve(TOKENS.clock)),
    )
    .registerSingleton(TOKENS.service, (c) => {
      const http = c.resolve(TOKENS.httpClient);
      return new ThreatIntelService({
        scheduler: c.resolve(TOKENS.scheduler),
        clock: c.resolve(TOKENS.clock),
        lossReference: c.resolve(TOKENS.config).lossReference,
        monitors: {
          incidents: monitor(c, new RansomwareLiveSource(http), []),
          knownExploited: monitor(c, new CisaKevSource(http), {
            total: 0,
            ransomwareLinked: 0,
            recent: [],
          }),
          criticalCves: monitor(c, new NistNvdSource(http, c.resolve(TOKENS.clock)), []),
          internetStorm: monitor(c, new SansIscSource(http), {
            infoconLevel: null,
            topAttackers: [],
          }),
          c2Servers: monitor(c, new FeodoTrackerSource(http), []),
          agencies: monitor(c, new FirstTeamsSource(http), []),
          territories: monitor(c, new IbgeLocalitiesSource(http), []),
        },
      });
    })
    .registerSingleton(TOKENS.server, (c) => {
      const service = c.resolve(TOKENS.service);
      const { staticDir, allowedOrigin } = c.resolve(TOKENS.config);
      return createGatewayServer({
        snapshot: service.snapshot,
        agencyDirectory: service.agencyDirectory,
        territoryDirectory: service.territoryDirectory,
        rateLimiter: c.resolve(TOKENS.rateLimiter),
        clock: c.resolve(TOKENS.clock),
        logger: c.resolve(TOKENS.logger),
        staticDir,
        allowedOrigin,
        maxStreamClients: MAX_STREAM_CLIENTS,
        heartbeatMs: HEARTBEAT_MS,
        clientIpHeader: hosting.clientIpHeader ?? null,
      });
    });
}
