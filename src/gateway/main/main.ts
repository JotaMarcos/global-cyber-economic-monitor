import { createGatewayContainer, TOKENS } from "./composition-root.ts";
import { loadConfig } from "./config.ts";

const config = loadConfig(process.env);
const container = createGatewayContainer(config);
const logger = container.resolve(TOKENS.logger);
const service = container.resolve(TOKENS.service);
const server = container.resolve(TOKENS.server);

server.on("error", (error) => {
  logger.warn("falha ao iniciar o servidor", { error: error.message });
  process.exit(1);
});
service.start();
server.listen(config.port, config.host, () => {
  logger.info("gateway em execução", {
    url: `http://${config.host}:${config.port}`,
    staticDir: config.staticDir,
  });
});

function shutdown(signal: string): void {
  logger.info("encerrando", { signal });
  service.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3_000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
