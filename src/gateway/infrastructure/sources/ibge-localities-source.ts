import { z } from "zod";
import type { Subdivision } from "../../../contract/threat-snapshot.ts";
import { cleanText } from "../../../shared/text/clean-text.ts";
import type {
  HttpClient,
  SourceDescriptor,
  SourceReading,
  ThreatSource,
} from "../../application/ports.ts";
import { parseEnvelope, validateRecords } from "./validation.ts";

/** Visão "nivelada": um registro plano por município, em uma única consulta. */
const ENDPOINT =
  "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado";

const envelopeSchema = z.array(z.unknown());
const rawMunicipalitySchema = z.object({
  "municipio-id": z.number().int().min(1_000_000).max(9_999_999),
  "municipio-nome": z.string().min(1),
  "UF-sigla": z.string().regex(/^[A-Z]{2}$/),
  "UF-nome": z.string().min(1),
});

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "pt-BR");

/**
 * Divisão territorial oficial do Brasil (IBGE): unidades da federação e
 * municípios. É dado de referência para os filtros, e não fonte de incidentes.
 */
export class IbgeLocalitiesSource implements ThreatSource<readonly Subdivision[]> {
  readonly descriptor: SourceDescriptor = {
    id: "ibge-localidades",
    name: "IBGE Localidades",
    organization: "Instituto Brasileiro de Geografia e Estatística",
    homeCountry: "BR",
    dataset: "Divisão territorial oficial: unidades da federação e municípios",
    url: ENDPOINT,
    refreshIntervalMs: 24 * 60 * 60_000,
    timeoutMs: 45_000,
  };
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async read(signal: AbortSignal): Promise<SourceReading<readonly Subdivision[]>> {
    const payload = await this.http.getJson(ENDPOINT, signal);
    const records = parseEnvelope(envelopeSchema, payload, this.descriptor.name);
    const { accepted, rejectedCount } = validateRecords(rawMunicipalitySchema, records);

    const subdivisions = new Map<string, Subdivision>();
    for (const raw of accepted) {
      const code = raw["UF-sigla"];
      const subdivision = subdivisions.get(code) ?? {
        code,
        name: cleanText(raw["UF-nome"], 60),
        municipalities: [],
      };
      subdivision.municipalities.push({
        id: String(raw["municipio-id"]),
        name: cleanText(raw["municipio-nome"], 80),
      });
      subdivisions.set(code, subdivision);
    }

    const data = [...subdivisions.values()]
      .map((subdivision) => ({
        ...subdivision,
        municipalities: [...subdivision.municipalities].sort(byName),
      }))
      .sort(byName);

    return { data, recordCount: accepted.length, rejectedCount };
  }
}
