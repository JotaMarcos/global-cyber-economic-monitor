import { z } from "zod";
import type { CriticalCve } from "../../../contract/threat-snapshot.ts";
import { cleanText } from "../../../shared/text/clean-text.ts";
import type {
  Clock,
  HttpClient,
  SourceDescriptor,
  SourceReading,
  ThreatSource,
} from "../../application/ports.ts";
import { parseEnvelope, validateRecords } from "./validation.ts";

const BASE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const WINDOW_DAYS = 7;
const PAGE_SIZE = 50;
const RESULT_LIMIT = 20;
const DAY_MS = 86_400_000;

const cvssMetric = z.object({ cvssData: z.object({ baseScore: z.number() }) });
const envelopeSchema = z.object({ vulnerabilities: z.array(z.unknown()) });
const rawItemSchema = z.object({
  cve: z.object({
    id: z.string().regex(/^CVE-\d{4}-\d{4,}$/),
    // A NVD publica horário UTC sem designador de fuso.
    published: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/),
    descriptions: z.array(z.object({ lang: z.string(), value: z.string() })).default([]),
    metrics: z
      .object({
        cvssMetricV40: z.array(cvssMetric).optional(),
        cvssMetricV31: z.array(cvssMetric).optional(),
        cvssMetricV30: z.array(cvssMetric).optional(),
      })
      .default({}),
  }),
});
type RawItem = z.infer<typeof rawItemSchema>;

function highestScore(metrics: RawItem["cve"]["metrics"]): number {
  const all = [
    ...(metrics.cvssMetricV40 ?? []),
    ...(metrics.cvssMetricV31 ?? []),
    ...(metrics.cvssMetricV30 ?? []),
  ];
  return Math.max(0, ...all.map((metric) => metric.cvssData.baseScore));
}

function toCriticalCve({ cve }: RawItem): CriticalCve {
  const english = cve.descriptions.find((item) => item.lang === "en");
  return {
    cveId: cve.id,
    publishedAt: new Date(`${cve.published}Z`).toISOString(),
    score: highestScore(cve.metrics),
    summary: cleanText(english?.value ?? cve.descriptions[0]?.value ?? "", 240),
  };
}

export class NistNvdSource implements ThreatSource<readonly CriticalCve[]> {
  readonly descriptor: SourceDescriptor = {
    id: "nist-nvd",
    name: "NIST NVD",
    organization: "National Institute of Standards and Technology",
    homeCountry: "US",
    dataset: `CVEs de severidade crítica publicadas nos últimos ${WINDOW_DAYS} dias`,
    url: BASE_URL,
    refreshIntervalMs: 15 * 60_000,
    timeoutMs: 45_000,
  };
  private readonly http: HttpClient;
  private readonly clock: Clock;

  constructor(http: HttpClient, clock: Clock) {
    this.http = http;
    this.clock = clock;
  }

  async read(signal: AbortSignal): Promise<SourceReading<readonly CriticalCve[]>> {
    const payload = await this.http.getJson(this.buildUrl(), signal);
    const envelope = parseEnvelope(envelopeSchema, payload, this.descriptor.name);
    const { accepted, rejectedCount } = validateRecords(
      rawItemSchema,
      envelope.vulnerabilities,
    );
    const cves = accepted
      .map(toCriticalCve)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

    return {
      data: cves.slice(0, RESULT_LIMIT),
      recordCount: cves.length,
      rejectedCount,
    };
  }

  private buildUrl(): string {
    const end = this.clock.now();
    const start = new Date(end.getTime() - WINDOW_DAYS * DAY_MS);
    const query = new URLSearchParams({
      cvssV3Severity: "CRITICAL",
      resultsPerPage: String(PAGE_SIZE),
      pubStartDate: start.toISOString(),
      pubEndDate: end.toISOString(),
    });
    return `${BASE_URL}?${query.toString()}`;
  }
}
