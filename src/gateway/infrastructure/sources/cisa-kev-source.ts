import { z } from "zod";
import type { ExploitedVulnerability } from "../../../contract/threat-snapshot.ts";
import { cleanText } from "../../../shared/text/clean-text.ts";
import type {
  HttpClient,
  SourceDescriptor,
  SourceReading,
  ThreatSource,
} from "../../application/ports.ts";
import type { KnownExploitedCatalog } from "../../application/threat-intel-service.ts";
import { parseEnvelope, validateRecords } from "./validation.ts";

const ENDPOINT =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const RECENT_LIMIT = 25;

const calendarDate = z.iso.date();
const catalogSchema = z.object({ vulnerabilities: z.array(z.unknown()) });
const rawEntrySchema = z.object({
  cveID: z.string().regex(/^CVE-\d{4}-\d{4,}$/),
  vendorProject: z.string(),
  product: z.string(),
  vulnerabilityName: z.string(),
  dateAdded: calendarDate,
  dueDate: calendarDate.nullish().catch(null),
  knownRansomwareCampaignUse: z.string().nullish(),
});

function toVulnerability(raw: z.infer<typeof rawEntrySchema>): ExploitedVulnerability {
  return {
    cveId: raw.cveID,
    vendor: cleanText(raw.vendorProject, 80),
    product: cleanText(raw.product, 80),
    name: cleanText(raw.vulnerabilityName, 200),
    dateAdded: raw.dateAdded,
    dueDate: raw.dueDate ?? null,
    ransomwareUse: raw.knownRansomwareCampaignUse?.toLowerCase() === "known",
  };
}

export class CisaKevSource implements ThreatSource<KnownExploitedCatalog> {
  readonly descriptor: SourceDescriptor = {
    id: "cisa-kev",
    name: "CISA KEV",
    organization: "Cybersecurity and Infrastructure Security Agency",
    homeCountry: "US",
    dataset: "Catálogo de vulnerabilidades exploradas ativamente",
    url: ENDPOINT,
    refreshIntervalMs: 60 * 60_000,
    timeoutMs: 30_000,
  };
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  async read(signal: AbortSignal): Promise<SourceReading<KnownExploitedCatalog>> {
    const payload = await this.http.getJson(ENDPOINT, signal);
    const catalog = parseEnvelope(catalogSchema, payload, this.descriptor.name);
    const { accepted, rejectedCount } = validateRecords(
      rawEntrySchema,
      catalog.vulnerabilities,
    );
    const entries = accepted
      .map(toVulnerability)
      .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));

    return {
      data: {
        total: entries.length,
        ransomwareLinked: entries.filter((entry) => entry.ransomwareUse).length,
        recent: entries.slice(0, RECENT_LIMIT),
      },
      recordCount: entries.length,
      rejectedCount,
    };
  }
}
