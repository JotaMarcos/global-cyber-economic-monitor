/**
 * Ponto de entrada do gateway no Netlify Server.
 *
 * O Netlify serve o dashboard (publicado em `dist/`) e encaminha para este
 * processo apenas as rotas `/api/*`. O servidor HTTP é exportado (sem
 * `listen`): a plataforma cuida da porta e do ciclo de vida.
 */
import {
  createGatewayContainer,
  TOKENS,
} from "../../src/gateway/main/composition-root.ts";
import { loadConfig } from "../../src/gateway/main/config.ts";

const gatewayConfig = loadConfig({
  ...process.env,
  // Porta e arquivos estáticos são responsabilidade da plataforma.
  PORT: undefined,
  GCEM_STATIC_DIR: undefined,
});
const container = createGatewayContainer(gatewayConfig, {
  // Atrás do proxy do Netlify o endereço do socket é o do proxy; o IP real
  // do cliente chega neste cabeçalho, definido pela própria plataforma.
  clientIpHeader: "x-nf-client-connection-ip",
});
const logger = container.resolve(TOKENS.logger);
const service = container.resolve(TOKENS.service);
const server = container.resolve(TOKENS.server);

service.start();
logger.info("gateway em execução no Netlify Server");
process.on("SIGTERM", () => service.stop());

export const config = { path: "/api/*" };

export default server;
