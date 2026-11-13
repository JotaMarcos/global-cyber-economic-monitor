import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(import.meta.dirname, "../../src");

/** Regra de dependência: cada camada só pode importar das camadas listadas. */
const ALLOWED: Record<string, readonly string[]> = {
  shared: [],
  domain: ["shared"],
  application: ["domain", "shared"],
  infrastructure: ["application", "domain", "shared"],
  presentation: ["application", "domain", "shared"],
  main: ["presentation", "infrastructure", "application", "domain", "shared"],
};

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

function layerOf(path: string): string | undefined {
  return relative(SRC, path).split(sep)[0];
}

function relativeImports(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(/from\s+"(\.[^"]+)"/g)].map((match) =>
    resolve(dirname(file), match[1]!),
  );
}

describe("fronteiras entre camadas", () => {
  const files = listSourceFiles(SRC).filter((file) => layerOf(file)! in ALLOWED);

  it("encontra arquivos em todas as camadas", () => {
    expect(new Set(files.map(layerOf))).toEqual(new Set(Object.keys(ALLOWED)));
  });

  it("respeita a regra de dependência (imports apontam para dentro)", () => {
    const violations = files.flatMap((file) => {
      const layer = layerOf(file)!;
      return relativeImports(file)
        .map((target) => layerOf(target))
        .filter((target): target is string => target !== undefined && target in ALLOWED)
        .filter((target) => target !== layer && !ALLOWED[layer]!.includes(target))
        .map((target) => `${relative(SRC, file)} -> ${target}`);
    });

    expect(violations).toEqual([]);
  });

  it("mantém domínio e aplicação livres de frameworks e de APIs do navegador", () => {
    const forbidden =
      /from\s+"(react|react-dom|recharts|lucide-react)|\b(window|document|localStorage)\.|(^|[\s=(,;])fetch\(/m;
    const offenders = files
      .filter((file) => ["domain", "application", "shared"].includes(layerOf(file)!))
      .filter((file) => forbidden.test(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });
});
