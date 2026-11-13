import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

export interface StaticFile {
  readonly body: Buffer;
  readonly contentType: string;
  readonly immutable: boolean;
}

/**
 * Resolve um caminho de URL para um arquivo dentro de `rootDir`. Caminhos que
 * escapam do diretório são recusados; rotas sem extensão recebem o index.html
 * (aplicação de página única).
 */
export async function resolveStaticFile(
  rootDir: string,
  urlPath: string,
): Promise<StaticFile | null> {
  const root = resolve(rootDir);
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;

  const candidate = resolve(join(root, normalize(decoded)));
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;

  const isAsset = extname(candidate) !== "";
  const filePath = isAsset ? candidate : join(root, "index.html");
  try {
    if (!(await stat(filePath)).isFile()) return null;
    return {
      body: await readFile(filePath),
      contentType: CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
      immutable: filePath.includes(`${sep}assets${sep}`),
    };
  } catch {
    return null;
  }
}
