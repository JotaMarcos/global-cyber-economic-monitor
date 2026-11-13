import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export interface DocsFile {
  readonly body: Buffer | string;
  readonly contentType: string;
}

export const DOCS_PATH = "/api/docs";
export const OPENAPI_PATH = "/api/v1/openapi.json";

/** Arquivos do pacote swagger-ui-dist publicados sob `/api/docs/`. */
const PACKAGE_FILES: Record<string, string> = {
  "swagger-ui.css": "text/css; charset=utf-8",
  "swagger-ui-bundle.js": "text/javascript; charset=utf-8",
  "favicon-32x32.png": "image/png",
};

// Página e inicializador próprios, sem script embutido: a política de
// segurança de conteúdo do gateway só admite scripts da mesma origem.
const PAGE = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API do gateway · Swagger UI</title>
    <link rel="icon" type="image/png" href="${DOCS_PATH}/favicon-32x32.png" />
    <link rel="stylesheet" href="${DOCS_PATH}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${DOCS_PATH}/swagger-ui-bundle.js"></script>
    <script src="${DOCS_PATH}/swagger-initializer.js"></script>
  </body>
</html>
`;

const INITIALIZER = `window.ui = SwaggerUIBundle({
  url: "${OPENAPI_PATH}",
  dom_id: "#swagger-ui",
  deepLinking: true,
  validatorUrl: null,
});
`;

const packageDir = dirname(
  createRequire(import.meta.url).resolve("swagger-ui-dist/package.json"),
);
const cache = new Map<string, Buffer>();

/** Resolve um caminho da documentação interativa; `null` quando não existe. */
export async function resolveDocsFile(pathname: string): Promise<DocsFile | null> {
  if (pathname === DOCS_PATH || pathname === `${DOCS_PATH}/`) {
    return { body: PAGE, contentType: "text/html; charset=utf-8" };
  }
  if (!pathname.startsWith(`${DOCS_PATH}/`)) return null;

  const name = pathname.slice(DOCS_PATH.length + 1);
  if (name === "swagger-initializer.js") {
    return { body: INITIALIZER, contentType: "text/javascript; charset=utf-8" };
  }
  // Só nomes da lista são lidos do disco; o caminho pedido nunca compõe o acesso.
  const contentType = Object.hasOwn(PACKAGE_FILES, name) ? PACKAGE_FILES[name] : null;
  if (!contentType) return null;

  let body = cache.get(name);
  if (!body) {
    body = await readFile(join(packageDir, name));
    cache.set(name, body);
  }
  return { body, contentType };
}
