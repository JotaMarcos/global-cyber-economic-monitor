import { z } from "zod";
import {
  REGISTRY_IDS,
  registrySchema,
  type BlockedAsn,
  type HijackedNetworks,
} from "../../../contract/threat-snapshot.ts";
import { cleanText } from "../../../shared/text/clean-text.ts";
import type {
  HttpClient,
  SourceDescriptor,
  SourceReading,
  ThreatSource,
} from "../../application/ports.ts";
import { toCountryCode, validateRecords } from "./validation.ts";

const BASE_URL = "https://www.spamhaus.org/drop";
const NETWORKS_URL = `${BASE_URL}/drop_v4.json`;
const ASNS_URL = `${BASE_URL}/asndrop.json`;

const rawNetworkSchema = z.object({
  cidr: z.string().regex(/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/),
  sblid: z.string(),
  // A fonte publica redes sem registro regional atribuído.
  rir: registrySchema.nullable(),
});
const rawAsnSchema = z.object({
  asn: z.number().int().positive(),
  rir: registrySchema.nullable(),
  domain: z.string().nullish(),
  cc: z.string().nullish(),
  asname: z.string().nullish(),
});

/**
 * As listas são publicadas como JSON delimitado por linha (um objeto por
 * linha), encerradas por uma linha de metadados que não é registro.
 */
function parseLines(body: string, sourceName: string): unknown[] {
  const records: unknown[] = [];
  for (const line of body.split("\n")) {
    if (line.trim() === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`${sourceName}: resposta fora do formato esperado`);
    }
    const isMetadata =
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { type?: unknown }).type === "metadata";
    if (!isMetadata) records.push(parsed);
  }
  return records;
}

function toBlockedAsn(raw: z.infer<typeof rawAsnSchema>): BlockedAsn {
  return {
    asn: raw.asn,
    name: cleanText(raw.asname, 60),
    domain: cleanText(raw.domain, 80),
    countryCode: toCountryCode(raw.cc),
    registry: raw.rir,
  };
}

export class SpamhausDropSource implements ThreatSource<HijackedNetworks> {
  readonly descriptor: SourceDescriptor = {
    id: "spamhaus-drop",
    name: "Spamhaus DROP",
    organization: "The Spamhaus Project",
    homeCountry: "AD",
    dataset: "Redes e sistemas autônomos sequestrados ou cedidos a operações maliciosas",
    url: NETWORKS_URL,
    // A fonte pede no máximo uma consulta por hora.
    refreshIntervalMs: 60 * 60_000,
    timeoutMs: 30_000,
  };
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** As duas listas são independentes: basta uma responder para haver leitura. */
  async read(signal: AbortSignal): Promise<SourceReading<HijackedNetworks>> {
    const [networksBody, asnsBody] = await Promise.allSettled([
      this.http.getText(NETWORKS_URL, signal),
      this.http.getText(ASNS_URL, signal),
    ]);
    if (networksBody.status === "rejected" && asnsBody.status === "rejected") {
      throw networksBody.reason instanceof Error
        ? networksBody.reason
        : new Error(`${this.descriptor.name} indisponível`);
    }

    const { name } = this.descriptor;
    const networks = validateRecords(
      rawNetworkSchema,
      networksBody.status === "fulfilled" ? parseLines(networksBody.value, name) : [],
    );
    const asns = validateRecords(
      rawAsnSchema,
      asnsBody.status === "fulfilled" ? parseLines(asnsBody.value, name) : [],
    );

    return {
      data: {
        networkCount: networks.accepted.length,
        networksByRegistry: REGISTRY_IDS.map((registry) => ({
          registry,
          networks: networks.accepted.filter((network) => network.rir === registry)
            .length,
        })).filter((entry) => entry.networks > 0),
        asns: asns.accepted.map(toBlockedAsn).sort((a, b) => a.asn - b.asn),
      },
      recordCount: networks.accepted.length + asns.accepted.length,
      rejectedCount: networks.rejectedCount + asns.rejectedCount,
    };
  }
}
