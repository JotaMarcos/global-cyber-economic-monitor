import { z } from "zod";
import { infoconLevelSchema, type Attacker } from "../../../contract/threat-snapshot.ts";
import { isIpAddress } from "../../../shared/text/clean-text.ts";
import type {
  HttpClient,
  SourceDescriptor,
  SourceReading,
  ThreatSource,
} from "../../application/ports.ts";
import type { InternetStormReading } from "../../application/threat-intel-service.ts";
import { validateRecords } from "./validation.ts";

const BASE_URL = "https://isc.sans.edu/api";
const TOP_ATTACKERS = 10;

const infoconSchema = z.object({
  status: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(infoconLevelSchema),
});
const rawAttackerSchema = z.object({
  rank: z.coerce.number().int().positive(),
  source: z.string().refine(isIpAddress),
  reports: z.coerce.number().int().nonnegative(),
  targets: z.coerce.number().int().nonnegative(),
});

function toAttacker(raw: z.infer<typeof rawAttackerSchema>): Attacker {
  return { rank: raw.rank, ip: raw.source, reports: raw.reports, targets: raw.targets };
}

export class SansIscSource implements ThreatSource<InternetStormReading> {
  readonly descriptor: SourceDescriptor = {
    id: "sans-isc",
    name: "SANS ISC / DShield",
    organization: "SANS Internet Storm Center",
    homeCountry: "US",
    dataset: "Nível Infocon e principais origens de ataque",
    url: BASE_URL,
    refreshIntervalMs: 5 * 60_000,
    timeoutMs: 20_000,
  };
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /** Os dois conjuntos são independentes: basta um responder para haver leitura. */
  async read(signal: AbortSignal): Promise<SourceReading<InternetStormReading>> {
    const [infocon, topIps] = await Promise.allSettled([
      this.http.getJson(`${BASE_URL}/infocon?json`, signal),
      this.http.getJson(`${BASE_URL}/topips/records/${TOP_ATTACKERS}?json`, signal),
    ]);
    if (infocon.status === "rejected" && topIps.status === "rejected") {
      throw infocon.reason instanceof Error
        ? infocon.reason
        : new Error("SANS ISC indisponível");
    }

    const level =
      infocon.status === "fulfilled" ? infoconSchema.safeParse(infocon.value) : null;
    const rows =
      topIps.status === "fulfilled" && Array.isArray(topIps.value) ? topIps.value : [];
    const { accepted, rejectedCount } = validateRecords(rawAttackerSchema, rows);
    const topAttackers = accepted.map(toAttacker).sort((a, b) => a.rank - b.rank);

    if (!level?.success && topAttackers.length === 0) {
      throw new Error(`${this.descriptor.name}: resposta fora do formato esperado`);
    }
    return {
      data: { infoconLevel: level?.success ? level.data.status : null, topAttackers },
      recordCount: topAttackers.length + (level?.success ? 1 : 0),
      rejectedCount,
    };
  }
}
