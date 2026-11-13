import type {
  Agency,
  C2Server,
  Incident,
  LossReference,
} from "../../contract/threat-snapshot.ts";
import { ALL, type DashboardFilter } from "./filter.ts";
import { CONTINENT_IDS, continentOf, type ContinentId } from "./geography.ts";

const MAX_SEARCH_LENGTH = 80;
const DAY_MS = 86_400_000;
const MAX_TIMELINE_DAYS = 60;

export interface RankedItem {
  readonly key: string;
  readonly incidents: number;
  readonly estimatedLossUsd: number;
}

export interface ContinentSummary extends RankedItem {
  readonly key: ContinentId;
  readonly agencies: number;
}

export interface DailyCount {
  /** Dia em UTC, no formato AAAA-MM-DD. */
  readonly day: string;
  readonly incidents: number;
}

export interface OverviewKpis {
  readonly incidents: number;
  readonly estimatedLossUsd: number;
  readonly countriesAffected: number;
  readonly activeGroups: number;
  /** Incidentes cuja fonte não informou o país. */
  readonly unlocated: number;
  readonly agencies: number;
}

export interface Overview {
  readonly incidents: readonly Incident[];
  readonly agencies: readonly Agency[];
  readonly c2Servers: readonly C2Server[];
  readonly kpis: OverviewKpis;
  readonly byContinent: readonly ContinentSummary[];
  readonly byCountry: readonly RankedItem[];
  readonly bySector: readonly RankedItem[];
  readonly byGroup: readonly RankedItem[];
  readonly timeline: readonly DailyCount[];
  readonly countryOptions: readonly string[];
  readonly sectorOptions: readonly string[];
}

export interface OverviewInput {
  readonly incidents: readonly Incident[];
  readonly agencies: readonly Agency[];
  readonly c2Servers: readonly C2Server[];
  readonly lossReference: LossReference;
}

/**
 * Estimativa de prejuízo: quantidade de incidentes multiplicada por um custo
 * médio de referência. Não representa perda apurada de nenhuma organização.
 */
export function estimateLossUsd(incidentCount: number, reference: LossReference): number {
  return incidentCount * reference.perIncidentUsd;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesGeography(countryCode: string | null, filter: DashboardFilter): boolean {
  if (filter.country !== ALL) return countryCode === filter.country;
  if (filter.continent !== ALL) return continentOf(countryCode) === filter.continent;
  return true;
}

function matchesSearch(query: string, ...fields: string[]): boolean {
  return query === "" || fields.some((field) => normalize(field).includes(query));
}

function rank(
  incidents: readonly Incident[],
  keyOf: (incident: Incident) => string | null,
  reference: LossReference,
): RankedItem[] {
  const counts = new Map<string, number>();
  for (const incident of incidents) {
    const key = keyOf(incident);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([key, count]) => ({
      key,
      incidents: count,
      estimatedLossUsd: estimateLossUsd(count, reference),
    }))
    .sort((a, b) => b.incidents - a.incidents || a.key.localeCompare(b.key));
}

function buildTimeline(incidents: readonly Incident[]): DailyCount[] {
  if (incidents.length === 0) return [];
  const counts = new Map<string, number>();
  for (const { discoveredAt } of incidents) {
    const day = discoveredAt.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const days = [...counts.keys()].sort();
  const last = Date.parse(`${days.at(-1)}T00:00:00Z`);
  const first = Math.max(
    Date.parse(`${days[0]}T00:00:00Z`),
    last - (MAX_TIMELINE_DAYS - 1) * DAY_MS,
  );

  // Dias sem ocorrência entram com zero para não distorcer a escala de tempo.
  const timeline: DailyCount[] = [];
  for (let time = first; time <= last; time += DAY_MS) {
    const day = new Date(time).toISOString().slice(0, 10);
    timeline.push({ day, incidents: counts.get(day) ?? 0 });
  }
  return timeline;
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function buildOverview(input: OverviewInput, filter: DashboardFilter): Overview {
  const { lossReference } = input;
  const query = normalize(filter.searchTerm.slice(0, MAX_SEARCH_LENGTH));

  const matchesNonGeo = (incident: Incident) =>
    (filter.sector === ALL || incident.sector === filter.sector) &&
    matchesSearch(query, incident.organization, incident.threatGroup, incident.sector);

  // O comparativo por continente ignora o recorte geográfico: serve de mapa de
  // navegação e permanece completo mesmo com um continente selecionado.
  const comparable = input.incidents.filter(matchesNonGeo);
  const incidents = comparable.filter((incident) =>
    matchesGeography(incident.countryCode, filter),
  );
  const agencies = input.agencies.filter(
    (agency) =>
      matchesGeography(agency.countryCode, filter) &&
      matchesSearch(query, agency.name, agency.host),
  );
  const c2Servers = input.c2Servers.filter((server) =>
    matchesGeography(server.countryCode, filter),
  );

  const byCountry = rank(incidents, (incident) => incident.countryCode, lossReference);
  const byGroup = rank(incidents, (incident) => incident.threatGroup, lossReference);

  const inScope = (code: string | null) =>
    filter.continent === ALL || continentOf(code) === filter.continent;

  return {
    incidents,
    agencies,
    c2Servers,
    kpis: {
      incidents: incidents.length,
      estimatedLossUsd: estimateLossUsd(incidents.length, lossReference),
      countriesAffected: byCountry.length,
      activeGroups: byGroup.length,
      unlocated: incidents.filter((incident) => incident.countryCode === null).length,
      agencies: agencies.length,
    },
    byContinent: CONTINENT_IDS.map((continent) => {
      const count = comparable.filter(
        (incident) => continentOf(incident.countryCode) === continent,
      ).length;
      return {
        key: continent,
        incidents: count,
        estimatedLossUsd: estimateLossUsd(count, lossReference),
        agencies: input.agencies.filter(
          (agency) => continentOf(agency.countryCode) === continent,
        ).length,
      };
    }),
    byCountry,
    bySector: rank(incidents, (incident) => incident.sector, lossReference),
    byGroup,
    timeline: buildTimeline(incidents),
    countryOptions: unique(
      [
        ...input.incidents.map((incident) => incident.countryCode),
        ...input.agencies.map((agency) => agency.countryCode),
      ].filter((code): code is string => code !== null && inScope(code)),
    ),
    sectorOptions: unique(input.incidents.map((incident) => incident.sector)),
  };
}
