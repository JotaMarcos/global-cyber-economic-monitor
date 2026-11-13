import { z } from "zod";
import type { C2Server } from "../../../contract/threat-snapshot.ts";
import { cleanText, isIpAddress } from "../../../shared/text/clean-text.ts";
import type {
  HttpClient,
  SourceDescriptor,
  SourceReading,
  ThreatSource,
} from "../../application/ports.ts";
import { parseEnvelope, toCountryCode, validateRecords } from "./validation.ts";

const ENDPOINT = "https://feodotracker.abuse.ch/downloads/ipblocklist.json";
const RESULT_LIMIT = 50;

const rawServerSchema = z.object({
  ip_address: z.string().refine(isIpAddress),
  port: z.coerce.number().int().min(1).max(65_535),
  status: z.string(),
  country: z.string().nullish(),
  malware: z.string().nullish(),
  as_name: z.string().nullish(),
  last_online: z.iso.date().nullish().catch(null),
});

function toC2Server(raw: z.infer<typeof rawServerSchema>): C2Server {
  return {
    ip: raw.ip_address,
    port: raw.port,
    online: raw.status.toLowerCase() === "online",
    countryCode: toCountryCode(raw.country),
    malware: cleanText(raw.malware, 40) || "Desconhecido",
    network: cleanText(raw.as_name, 60),
    lastOnline: raw.last_online ?? null,
  };
}

export class FeodoTrackerSource implements ThreatSource<readonly C2Server[]> {
  readonly descriptor: SourceDescriptor = {
    id: "abusech-feodo",
    name: "abuse.ch Feodo Tracker",
    organization: "abuse.ch / Universidade de Ciências Aplicadas de Berna",
    homeCountry: "CH",
    dataset: "Servidores de comando e controle de botnets",
    url: ENDPOINT,
    refreshIntervalMs: 10 * 60_000,
    timeoutMs: 20_000,
  };
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async read(signal: AbortSignal): Promise<SourceReading<readonly C2Server[]>> {
    const payload = await this.http.getJson(ENDPOINT, signal);
    const rows = parseEnvelope(z.array(z.unknown()), payload, this.descriptor.name);
    const { accepted, rejectedCount } = validateRecords(rawServerSchema, rows);
    const servers = accepted
      .map(toC2Server)
      .sort((a, b) => Number(b.online) - Number(a.online));

    return {
      data: servers.slice(0, RESULT_LIMIT),
      recordCount: servers.length,
      rejectedCount,
    };
  }
}
