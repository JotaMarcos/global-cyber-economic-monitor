import { z } from "zod";
import type { Agency } from "../../../contract/threat-snapshot.ts";
import { cleanText, toHttpUrl } from "../../../shared/text/clean-text.ts";
import type {
  HttpClient,
  SourceDescriptor,
  SourceReading,
  ThreatSource,
} from "../../application/ports.ts";
import { parseEnvelope, validateRecords } from "./validation.ts";

const FIELDS = "id,team,host,country,team-type,website";
const ENDPOINT = `https://api.first.org/data/v1/teams?limit=2000&fields=${FIELDS}`;

const envelopeSchema = z.object({ data: z.array(z.unknown()) });
const rawTeamSchema = z.object({
  id: z.string().trim().min(1),
  team: z.string().trim().min(1),
  country: z.string().regex(/^[A-Za-z]{2}$/),
  host: z.string().nullish(),
  "team-type": z.string().nullish(),
  website: z.array(z.string()).nullish(),
});

function toAgency(raw: z.infer<typeof rawTeamSchema>): Agency {
  return {
    id: cleanText(raw.id, 80),
    name: cleanText(raw.team, 100),
    host: cleanText(raw.host, 140),
    countryCode: raw.country.toUpperCase(),
    types: (raw["team-type"] ?? "")
      .split(",")
      .map((type) => cleanText(type, 20))
      .filter(Boolean),
    website: toHttpUrl(raw.website?.[0]),
  };
}

export class FirstTeamsSource implements ThreatSource<readonly Agency[]> {
  readonly descriptor: SourceDescriptor = {
    id: "first-teams",
    name: "FIRST Teams",
    organization: "Forum of Incident Response and Security Teams",
    homeCountry: "US",
    dataset: "Diretório mundial de equipes de resposta a incidentes",
    url: ENDPOINT,
    refreshIntervalMs: 12 * 60 * 60_000,
    timeoutMs: 30_000,
  };
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async read(signal: AbortSignal): Promise<SourceReading<readonly Agency[]>> {
    const payload = await this.http.getJson(ENDPOINT, signal);
    const envelope = parseEnvelope(envelopeSchema, payload, this.descriptor.name);
    const { accepted, rejectedCount } = validateRecords(rawTeamSchema, envelope.data);
    const agencies = accepted
      .map(toAgency)
      .sort((a, b) => a.name.localeCompare(b.name, "en"));

    return { data: agencies, recordCount: agencies.length, rejectedCount };
  }
}
