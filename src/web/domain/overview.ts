import type {
  Agency,
  BlockedAsn,
  C2Server,
  Incident,
  LossReference,
} from "../../contract/threat-snapshot.ts";
import { ALL, isSubnational, type DashboardFilter } from "./filter.ts";
import {
  buildSearchIndex,
  searchIndex,
  type SearchHit,
  type SearchIndex,
} from "./full-text-search.ts";
import { CONTINENT_IDS, continentOf, type ContinentId } from "./geography.ts";

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
  /** Servidores de comando e controle hospedados no recorte geográfico. */
  readonly c2Servers: number;
  readonly c2ServersOnline: number;
}

export interface Overview {
  readonly incidents: readonly Incident[];
  readonly agencies: readonly Agency[];
  readonly c2Servers: readonly C2Server[];
  /** Sistemas autônomos bloqueados registrados no recorte geográfico. */
  readonly blockedAsns: readonly BlockedAsn[];
  readonly kpis: OverviewKpis;
  readonly byContinent: readonly ContinentSummary[];
  readonly byCountry: readonly RankedItem[];
  readonly bySector: readonly RankedItem[];
  readonly byGroup: readonly RankedItem[];
  readonly timeline: readonly DailyCount[];
  readonly countryOptions: readonly string[];
  readonly sectorOptions: readonly string[];
  /** Há termo de busca: incidentes e equipes vêm ordenados por relevância. */
  readonly searchActive: boolean;
  /** Recorte abaixo do país: os dados permanecem no nível do país. */
  readonly subnational: boolean;
}

export interface OverviewInput {
  readonly incidents: readonly Incident[];
  readonly agencies: readonly Agency[];
  readonly c2Servers: readonly C2Server[];
  readonly blockedAsns?: readonly BlockedAsn[];
  readonly lossReference: LossReference;
}

/**
 * Estimativa de prejuízo: quantidade de incidentes multiplicada por um custo
 * médio de referência. Não representa perda apurada de nenhuma organização.
 */
export function estimateLossUsd(incidentCount: number, reference: LossReference): number {
  return incidentCount * reference.perIncidentUsd;
}

/**
 * Descrições legíveis indexadas junto com os códigos, para que a busca
 * encontre "saúde" ou "brasil", e não apenas "Healthcare" ou "BR".
 */
export interface SearchVocabulary {
  sectorLabel(sector: string): string;
  countryName(code: string | null): string;
}

const RAW_VOCABULARY: SearchVocabulary = {
  sectorLabel: (sector) => sector,
  countryName: (code) => code ?? "",
};

export interface OverviewIndexes {
  readonly incidents: SearchIndex;
  readonly agencies: SearchIndex;
}

/** Índices de texto completo. Montados uma vez por conjunto de dados recebido. */
export function indexOverviewInput(
  input: Pick<OverviewInput, "incidents" | "agencies">,
  vocabulary: SearchVocabulary = RAW_VOCABULARY,
): OverviewIndexes {
  return {
    incidents: buildSearchIndex(
      input.incidents.map((incident) => ({
        id: incident.id,
        fields: [
          { text: incident.organization, weight: 3 },
          { text: incident.threatGroup, weight: 2 },
          { text: incident.sector, weight: 1 },
          { text: vocabulary.sectorLabel(incident.sector), weight: 1 },
          { text: vocabulary.countryName(incident.countryCode), weight: 1 },
        ],
      })),
    ),
    agencies: buildSearchIndex(
      input.agencies.map((agency) => ({
        id: agency.id,
        fields: [
          { text: agency.name, weight: 3 },
          { text: agency.host, weight: 1 },
          { text: agency.types.join(" "), weight: 1 },
          { text: vocabulary.countryName(agency.countryCode), weight: 1 },
        ],
      })),
    ),
  };
}

/** Mantém os itens encontrados pela busca, em ordem de relevância. */
function applySearch<T>(
  items: readonly T[],
  hits: readonly SearchHit[] | null,
  idOf: (item: T) => string,
): T[] {
  if (hits === null) return [...items];
  const rankById = new Map(hits.map((hit, rank) => [hit.id, rank]));
  return items
    .filter((item) => rankById.has(idOf(item)))
    .sort((a, b) => rankById.get(idOf(a))! - rankById.get(idOf(b))!);
}

function matchesGeography(countryCode: string | null, filter: DashboardFilter): boolean {
  if (filter.country !== ALL) return countryCode === filter.country;
  if (filter.continent !== ALL) return continentOf(countryCode) === filter.continent;
  return true;
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

/**
 * Monta o recorte do painel. Estado e município não restringem os dados:
 * nenhuma fonte oficial de incidentes informa localização abaixo do país, e o
 * painel não atribui ocorrências a localidades por suposição.
 */
export function buildOverview(
  input: OverviewInput,
  filter: DashboardFilter,
  indexes: OverviewIndexes = indexOverviewInput(input),
): Overview {
  const { lossReference } = input;
  const incidentHits = searchIndex(indexes.incidents, filter.searchTerm);
  const agencyHits = searchIndex(indexes.agencies, filter.searchTerm);

  // O comparativo por continente ignora o recorte geográfico: serve de mapa de
  // navegação e permanece completo mesmo com um continente selecionado.
  const comparable = applySearch(
    input.incidents.filter(
      (incident) => filter.sector === ALL || incident.sector === filter.sector,
    ),
    incidentHits,
    (incident) => incident.id,
  );
  const incidents = comparable.filter((incident) =>
    matchesGeography(incident.countryCode, filter),
  );
  const agencies = applySearch(
    input.agencies.filter((agency) => matchesGeography(agency.countryCode, filter)),
    agencyHits,
    (agency) => agency.id,
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
    blockedAsns: (input.blockedAsns ?? []).filter((entry) =>
      matchesGeography(entry.countryCode, filter),
    ),
    kpis: {
      incidents: incidents.length,
      estimatedLossUsd: estimateLossUsd(incidents.length, lossReference),
      countriesAffected: byCountry.length,
      activeGroups: byGroup.length,
      unlocated: incidents.filter((incident) => incident.countryCode === null).length,
      agencies: agencies.length,
      c2Servers: c2Servers.length,
      c2ServersOnline: c2Servers.filter((server) => server.online).length,
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
    searchActive: incidentHits !== null,
    subnational: isSubnational(filter),
  };
}
