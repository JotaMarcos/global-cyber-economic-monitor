import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(import.meta.dirname, "../../src");

/**
 * Regra de dependência. Cada módulo (contexto/camada) só pode importar dos
 * módulos listados. Gateway e dashboard não se importam: comunicam-se apenas
 * pelo contrato publicado.
 */
const ALLOWED: Record<string, readonly string[]> = {
  shared: [],
  contract: [],
  "gateway/application": ["contract", "shared"],
  "gateway/infrastructure": ["gateway/application", "contract", "shared"],
  "gateway/main": ["gateway/infrastructure", "gateway/application", "contract", "shared"],
  "web/domain": ["contract", "shared"],
  "web/application": ["web/domain", "contract", "shared"],
  "web/infrastructure": ["web/application", "web/domain", "contract", "shared"],
  "web/presentation": ["web/application", "web/domain", "contract", "shared"],
  "web/main": [
    "web/presentation",
    "web/infrastructure",
    "web/application",
    "web/domain",
    "contract",
    "shared",
  ],
};
const MODULES = Object.keys(ALLOWED);

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry) && !entry.endsWith(".d.ts") ? [path] : [];
  });
}

function moduleOf(path: string): string | undefined {
  const [first, second] = relative(SRC, path).split(sep);
  return first === "shared" || first === "contract" ? first : `${first}/${second}`;
}

function relativeImports(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(/from\s+"(\.[^"]+)"/g)].map((match) =>
    resolve(dirname(file), match[1]!),
  );
}

describe("fronteiras entre módulos", () => {
  const files = listSourceFiles(SRC);

  it("classifica todo arquivo em um módulo conhecido", () => {
    const unknown = files.filter((file) => !MODULES.includes(moduleOf(file)!));
    expect(unknown.map((file) => relative(SRC, file))).toEqual([]);
    expect(new Set(files.map(moduleOf))).toEqual(new Set(MODULES));
  });

  it("respeita a regra de dependência", () => {
    const violations = files.flatMap((file) => {
      const origin = moduleOf(file)!;
      return relativeImports(file)
        .map((target) => moduleOf(target)!)
        .filter((target) => target !== origin && !ALLOWED[origin]!.includes(target))
        .map((target) => `${relative(SRC, file)} -> ${target}`);
    });

    expect(violations).toEqual([]);
  });

  it("mantém o gateway e o dashboard sem importações diretas entre si", () => {
    const crossing = files.filter((file) => {
      const side = moduleOf(file)!.split("/")[0];
      const other = side === "gateway" ? "web" : side === "web" ? "gateway" : null;
      return (
        other !== null &&
        relativeImports(file).some((target) => moduleOf(target)!.startsWith(`${other}/`))
      );
    });

    expect(crossing.map((file) => relative(SRC, file))).toEqual([]);
  });

  it("mantém regras de negócio livres de frameworks de interface e de APIs do navegador", () => {
    const core = [
      "shared",
      "contract",
      "web/domain",
      "web/application",
      "gateway/application",
    ];
    const forbidden =
      /from\s+"(react|react-dom|lucide-react|node:)|\b(window|document|localStorage)\.|(^|[\s=(,;])fetch\(/m;
    const offenders = files
      .filter((file) => core.includes(moduleOf(file)!))
      .filter((file) => forbidden.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });

  it("usa apenas sintaxe TypeScript removível, exigida pela execução direta no Node", () => {
    const nonErasable =
      /constructor\([^)]*\b(private|public|protected|readonly)\s|\benum\s+\w+\s*\{|\bnamespace\s+\w+/;
    const offenders = files
      .filter((file) => nonErasable.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });
});
