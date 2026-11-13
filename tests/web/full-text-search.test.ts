import { describe, expect, it } from "vitest";
import {
  buildSearchIndex,
  MAX_QUERY_LENGTH,
  parseQuery,
  searchIndex,
  tokenize,
  type SearchDocument,
} from "../../src/web/domain/full-text-search.ts";

const documents: SearchDocument[] = [
  {
    id: "hospital",
    fields: [
      { text: "Hospital São José", weight: 3 },
      { text: "akira", weight: 2 },
      { text: "Saúde", weight: 1 },
    ],
  },
  {
    id: "prefeitura",
    fields: [
      { text: "Prefeitura Municipal de Manaus", weight: 3 },
      { text: "lockbit", weight: 2 },
      { text: "Governo e defesa", weight: 1 },
    ],
  },
  {
    id: "clinica",
    fields: [
      { text: "Clínica Médica", weight: 3 },
      { text: "akira", weight: 2 },
      { text: "Saúde", weight: 1 },
    ],
  },
  {
    id: "banco",
    fields: [
      { text: "Banco Regional", weight: 3 },
      { text: "play", weight: 2 },
      { text: "Serviços financeiros: saúde financeira", weight: 1 },
    ],
  },
];

const index = buildSearchIndex(documents);
const ids = (query: string) => searchIndex(index, query)?.map((hit) => hit.id) ?? null;

describe("análise léxica", () => {
  it("ignora caixa, acentos, pontuação e palavras vazias", () => {
    expect(tokenize("Prefeitura MUNICIPAL de São-José, Saúde!")).toEqual([
      "prefeitura",
      "municipal",
      "sao",
      "jose",
      "saude",
    ]);
  });

  it("separa frases entre aspas dos termos avulsos", () => {
    expect(parseQuery('akira "São José"')).toEqual({
      terms: ["akira", "sao", "jose"],
      phrases: ["sao jose"],
    });
  });

  it("trata aspas sem fechamento como termos comuns", () => {
    expect(parseQuery('"hospital sao')).toEqual({
      terms: ["hospital", "sao"],
      phrases: [],
    });
  });
});

describe("busca de texto completo", () => {
  it("devolve nulo quando a consulta não tem termos", () => {
    expect(searchIndex(index, "")).toBeNull();
    expect(searchIndex(index, "  de  ")).toBeNull();
  });

  it("encontra sem depender de acentos ou maiúsculas", () => {
    expect(ids("SAO JOSÉ")).toEqual(["hospital"]);
    expect(ids("clinica")).toEqual(["clinica"]);
  });

  it("aceita prefixo para buscar enquanto se digita", () => {
    expect(ids("prefei")).toEqual(["prefeitura"]);
    expect(ids("lock")).toEqual(["prefeitura"]);
  });

  it("não expande prefixo de um único caractere", () => {
    expect(ids("p")).toEqual([]);
  });

  it("exige todos os termos da consulta", () => {
    expect(ids("akira hospital")).toEqual(["hospital"]);
    expect(ids("akira manaus")).toEqual([]);
  });

  it("restringe por frase exata entre aspas", () => {
    expect(ids('"saude financeira"')).toEqual(["banco"]);
    expect(ids('"financeira saude"')).toEqual([]);
  });

  it("ordena por relevância, priorizando campos de maior peso", () => {
    const weighted = buildSearchIndex([
      {
        id: "no-setor",
        fields: [
          { text: "Clínica Central", weight: 3 },
          { text: "Saúde", weight: 1 },
        ],
      },
      {
        id: "no-nome",
        fields: [
          { text: "Saúde Central", weight: 3 },
          { text: "Clínica", weight: 1 },
        ],
      },
    ]);

    expect(searchIndex(weighted, "saude")!.map((hit) => hit.id)).toEqual([
      "no-nome",
      "no-setor",
    ]);
  });

  it("favorece o documento mais curto quando a ocorrência é equivalente", () => {
    // "akira" tem o mesmo peso na clínica e no hospital; a clínica é mais curta.
    expect(ids("akira")).toEqual(["clinica", "hospital"]);
  });

  it("pontua correspondência exata acima de correspondência por prefixo", () => {
    const prefixIndex = buildSearchIndex([
      { id: "exato", fields: [{ text: "play", weight: 1 }] },
      { id: "prefixo", fields: [{ text: "playground", weight: 1 }] },
    ]);

    expect(searchIndex(prefixIndex, "play")!.map((hit) => hit.id)).toEqual([
      "exato",
      "prefixo",
    ]);
  });

  it("limita o tamanho da consulta", () => {
    const long = `${"a".repeat(MAX_QUERY_LENGTH)} hospital`;
    expect(parseQuery(long).terms).not.toContain("hospital");
  });

  it("funciona com índice vazio", () => {
    expect(searchIndex(buildSearchIndex([]), "qualquer")).toEqual([]);
  });
});
