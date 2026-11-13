import { z } from "zod";
import type { Incident } from "../../../contract/threat-snapshot.ts";
import { cleanText } from "../../../shared/text/clean-text.ts";
import type {
  HttpClient,
  SourceDescriptor,
  SourceReading,
  ThreatSource,
} from "../../application/ports.ts";
import { parseEnvelope, toCountryCode, validateRecords } from "./validation.ts";

const ENDPOINT = "https://api.ransomware.live/v2/recentvictims";
const UNKNOWN_SECTORS = new Set(["", "not found", "unknown"]);
export const UNCLASSIFIED_SECTOR = "Unclassified";

const timestamp = z.iso.datetime({ offset: true });
const rawVictimSchema = z.object({
  victim: z.string().trim().min(1),
  group: z.string().trim().min(1),
  discovered: timestamp,
  attackdate: timestamp.nullish(),
  country: z.string().nullish(),
  activity: z.string().nullish(),
});
type RawVictim = z.infer<typeof rawVictimSchema>;

function toSector(activity: string | null | undefined): string {
  const sector = cleanText(activity, 60);
  return UNKNOWN_SECTORS.has(sector.toLowerCase()) ? UNCLASSIFIED_SECTOR : sector;
}

/**
 * Os campos `claim_url` (endereço do site de vazamento), `screenshot` e
 * `description` são deliberadamente ignorados: o painel informa a ocorrência
 * e não encaminha o usuário ao material exfiltrado.
 */
function toIncident(raw: RawVictim): Incident {
  const organization = cleanText(raw.victim, 120);
  const threatGroup = cleanText(raw.group, 60);
  return {
    id: `${threatGroup}|${organization}|${raw.discovered}`,
    organization,
    countryCode: toCountryCode(raw.country),
    sector: toSector(raw.activity),
    threatGroup,
    discoveredAt: new Date(raw.discovered).toISOString(),
    reportedAttackAt: raw.attackdate ? new Date(raw.attackdate).toISOString() : null,
  };
}

export class RansomwareLiveSource implements ThreatSource<readonly Incident[]> {
  readonly descriptor: SourceDescriptor = {
    id: "ransomware-live",
    name: "Ransomware.live",
    organization: "Ransomware.live (projeto comunitário)",
    homeCountry: "FR",
    dataset: "Vítimas divulgadas por grupos de ransomware",
    url: ENDPOINT,
    refreshIntervalMs: 5 * 60_000,
    timeoutMs: 20_000,
  };
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async read(signal: AbortSignal): Promise<SourceReading<readonly Incident[]>> {
    const payload = await this.http.getJson(ENDPOINT, signal);
    const rows = parseEnvelope(z.array(z.unknown()), payload, this.descriptor.name);
    const { accepted, rejectedCount } = validateRecords(rawVictimSchema, rows);
    const incidents = accepted
      .map(toIncident)
      .filter((incident) => incident.organization && incident.threatGroup)
      .sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));

    return {
      data: incidents,
      recordCount: incidents.length,
      rejectedCount: rejectedCount + (accepted.length - incidents.length),
    };
  }
}
