/**
 * Busca de texto completo (full-text search) em memória.
 *
 * Técnica: índice invertido (termo -> documentos) construído uma única vez por
 * conjunto de dados e consultado a cada tecla. A consulta passa pela mesma
 * análise léxica dos documentos (minúsculas, remoção de acentos, separação em
 * termos e descarte de palavras vazias), aceita prefixo (busca enquanto se
 * digita) e frase exata entre aspas, e ordena os resultados por relevância
 * com a função de pontuação BM25 (Robertson e Zaragoza, 2009), ponderada pelo
 * peso de cada campo.
 */

/** Palavras sem valor de discriminação, em português e inglês. */
const STOP_WORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "na",
  "no",
  "nas",
  "nos",
  "para",
  "por",
  "com",
  "um",
  "uma",
  "the",
  "of",
  "and",
  "for",
  "in",
  "on",
  "at",
  "to",
]);

/** Parâmetros usuais do BM25. */
const K1 = 1.2;
const B = 0.75;
/** Correspondência por prefixo pesa menos que a correspondência exata. */
const PREFIX_FACTOR = 0.7;
/** Prefixos muito curtos casariam com quase tudo. */
const MIN_PREFIX_LENGTH = 2;
export const MAX_QUERY_LENGTH = 80;

export interface SearchField {
  readonly text: string;
  /** Importância relativa do campo na pontuação (ex.: nome pesa mais que setor). */
  readonly weight: number;
}

export interface SearchDocument {
  readonly id: string;
  readonly fields: readonly SearchField[];
}

export interface SearchIndex {
  readonly ids: readonly string[];
  /** Termo -> (posição do documento -> frequência ponderada). */
  readonly postings: ReadonlyMap<string, ReadonlyMap<number, number>>;
  /** Vocabulário em ordem, para localizar prefixos por busca binária. */
  readonly vocabulary: readonly string[];
  /** Texto normalizado de cada documento, para a busca por frase exata. */
  readonly texts: readonly string[];
  readonly lengths: readonly number[];
  readonly averageLength: number;
}

export interface SearchHit {
  readonly id: string;
  readonly score: number;
}

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Análise léxica comum a documentos e consultas. */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term !== "" && !STOP_WORDS.has(term));
}

export function buildSearchIndex(documents: readonly SearchDocument[]): SearchIndex {
  const postings = new Map<string, Map<number, number>>();
  const lengths: number[] = [];
  const texts: string[] = [];

  documents.forEach((entry, position) => {
    let length = 0;
    for (const field of entry.fields) {
      for (const term of tokenize(field.text)) {
        const documentsWithTerm = postings.get(term) ?? new Map<number, number>();
        documentsWithTerm.set(
          position,
          (documentsWithTerm.get(position) ?? 0) + field.weight,
        );
        postings.set(term, documentsWithTerm);
        length += field.weight;
      }
    }
    lengths.push(length);
    texts.push(tokenize(entry.fields.map((field) => field.text).join(" ")).join(" "));
  });

  const total = lengths.reduce((sum, length) => sum + length, 0);
  return {
    ids: documents.map((entry) => entry.id),
    postings,
    vocabulary: [...postings.keys()].sort(),
    texts,
    lengths,
    averageLength: documents.length > 0 ? total / documents.length : 0,
  };
}

interface ParsedQuery {
  readonly terms: readonly string[];
  readonly phrases: readonly string[];
}

/** Trechos entre aspas viram frases exatas; o restante, termos independentes. */
export function parseQuery(query: string): ParsedQuery {
  const limited = query.slice(0, MAX_QUERY_LENGTH);
  const phrases = [...limited.matchAll(/"([^"]+)"/g)]
    .map((match) => tokenize(match[1]!).join(" "))
    .filter((phrase) => phrase !== "");
  // Aspas sem fechamento são ignoradas e o conteúdo vale como termos comuns.
  const terms = tokenize(limited.replace(/"[^"]+"/g, " "));
  const phraseTerms = phrases.flatMap((phrase) => phrase.split(" "));
  return { terms: [...new Set([...terms, ...phraseTerms])], phrases };
}

/** Primeira posição do vocabulário ordenado que não precede `prefix`. */
function lowerBound(vocabulary: readonly string[], prefix: string): number {
  let low = 0;
  let high = vocabulary.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (vocabulary[middle]! < prefix) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Termos do índice que correspondem ao termo da consulta, com seu fator. */
function expand(index: SearchIndex, queryTerm: string): Map<string, number> {
  const matches = new Map<string, number>();
  if (index.postings.has(queryTerm)) matches.set(queryTerm, 1);
  if (queryTerm.length < MIN_PREFIX_LENGTH) return matches;

  for (
    let position = lowerBound(index.vocabulary, queryTerm);
    position < index.vocabulary.length &&
    index.vocabulary[position]!.startsWith(queryTerm);
    position += 1
  ) {
    const term = index.vocabulary[position]!;
    if (!matches.has(term)) matches.set(term, PREFIX_FACTOR);
  }
  return matches;
}

function bm25(
  index: SearchIndex,
  frequency: number,
  position: number,
  documentFrequency: number,
): number {
  const total = index.ids.length;
  const idf = Math.log(1 + (total - documentFrequency + 0.5) / (documentFrequency + 0.5));
  const lengthRatio =
    index.averageLength > 0 ? index.lengths[position]! / index.averageLength : 1;
  return (idf * frequency * (K1 + 1)) / (frequency + K1 * (1 - B + B * lengthRatio));
}

/**
 * Executa a consulta. Todos os termos precisam ocorrer no documento (semântica
 * E), cada um por igualdade ou prefixo, e todas as frases entre aspas precisam
 * aparecer na ordem. Devolve `null` quando a consulta não tem termos, o que
 * significa "sem filtro de busca".
 */
export function searchIndex(index: SearchIndex, query: string): SearchHit[] | null {
  const { terms, phrases } = parseQuery(query);
  if (terms.length === 0) return null;

  let scores: Map<number, number> | null = null;
  for (const queryTerm of terms) {
    const termScores = new Map<number, number>();
    for (const [term, factor] of expand(index, queryTerm)) {
      const documentsWithTerm = index.postings.get(term)!;
      for (const [position, frequency] of documentsWithTerm) {
        const score = factor * bm25(index, frequency, position, documentsWithTerm.size);
        termScores.set(position, Math.max(termScores.get(position) ?? 0, score));
      }
    }

    const previous: Map<number, number> | null = scores;
    scores = new Map<number, number>();
    for (const [position, score] of termScores) {
      if (previous === null) scores.set(position, score);
      else if (previous.has(position))
        scores.set(position, previous.get(position)! + score);
    }
    if (scores.size === 0) return [];
  }

  return [...scores!]
    .filter(([position]) =>
      phrases.every((phrase) => ` ${index.texts[position]!} `.includes(` ${phrase}`)),
    )
    .map(([position, score]) => ({ id: index.ids[position]!, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
