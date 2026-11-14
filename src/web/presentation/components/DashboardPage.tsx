import { MapPin } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { SourceId, Subdivision } from "../../../contract/threat-snapshot.ts";
import { ALL, type DashboardFilter } from "../../domain/filter.ts";
import {
  buildOverview,
  indexOverviewInput,
  type RankedItem,
} from "../../domain/overview.ts";
import { buildThreatFeed } from "../../domain/threat-feed-items.ts";
import { useDashboard } from "../context/dashboard-context.tsx";
import { countryName, formatUsd, formatUsdCompact } from "../format.ts";
import { useObservable } from "../hooks/use-observable.ts";
import { CONTINENT_LABELS, sectorLabel } from "../labels.ts";
import { AgencyDirectory } from "./AgencyDirectory.tsx";
import { BarList, type BarListItem } from "./charts.tsx";
import { FilterBar } from "./FilterBar.tsx";
import { IncidentTable } from "./IncidentTable.tsx";
import { KpiStrip } from "./KpiStrip.tsx";
import { PressureChart } from "./PressureChart.tsx";
import { SectorExposureChart } from "./SectorExposureChart.tsx";
import { SourceHealthPanel } from "./SourceHealthPanel.tsx";
import { ThreatFeedPanel } from "./ThreatFeedPanel.tsx";
import { TopBar } from "./TopBar.tsx";
import { Panel } from "./ui.tsx";

const RANKING_SIZE = 8;
const RANSOMWARE_SOURCE = "Ransomware.live";
/** Fontes que alimentam o feed OSINT, para sinalizar indisponibilidade. */
const FEED_SOURCES: readonly SourceId[] = [
  "cisa-kev",
  "nist-nvd",
  "abusech-feodo",
  "sans-isc",
];

function toBarItems(
  items: readonly RankedItem[],
  labelOf: (key: string) => string,
): BarListItem[] {
  return items.slice(0, RANKING_SIZE).map((item) => ({
    key: item.key,
    label: labelOf(item.key),
    value: item.incidents,
    detail: `≈ ${formatUsdCompact(item.estimatedLossUsd)}`,
  }));
}

/** Nome legível do recorte subnacional, a partir da divisão territorial oficial. */
function describeSubnational(
  filter: DashboardFilter,
  territories: readonly Subdivision[],
): string {
  const subdivision = territories.find((item) => item.code === filter.state);
  const municipality = subdivision?.municipalities.find(
    (item) => item.id === filter.municipality,
  );
  if (municipality && subdivision) return `${municipality.name} (${subdivision.code})`;
  return subdivision?.name ?? filter.state;
}

function SubnationalNotice({
  filter,
  territories,
}: {
  readonly filter: DashboardFilter;
  readonly territories: readonly Subdivision[];
}) {
  return (
    <p
      aria-live="polite"
      className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-xs text-ink"
    >
      <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <span>
        Recorte selecionado: <strong>{describeSubnational(filter, territories)}</strong>.
        Nenhuma fonte oficial de incidentes cibernéticos informa localização abaixo do
        país; os indicadores a seguir referem-se a {countryName(filter.country)}.
      </span>
    </p>
  );
}

function WaitingForGateway({ offline }: { readonly offline: boolean }) {
  return (
    <div role="status" className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-sm font-medium text-ink">
        {offline ? "Gateway de dados indisponível" : "Conectando ao gateway de dados"}
      </p>
      <p className="mt-2 text-xs text-faint">
        {offline
          ? "Não foi possível estabelecer conexão. Verifique se o serviço do gateway está em execução."
          : "A primeira coleta nas fontes públicas pode levar alguns segundos."}
      </p>
    </div>
  );
}

export function DashboardPage() {
  const { state, filterCommands, monitoring } = useDashboard();
  const snapshot = useObservable(state.snapshot);
  const agencies = useObservable(state.agencies);
  const territories = useObservable(state.territories);
  const connection = useObservable(state.connection);
  const filter = useObservable(state.filter);

  useEffect(() => {
    monitoring.start();
    return () => monitoring.stop();
  }, [monitoring]);

  // O índice de texto completo é refeito só quando chegam novos dados; cada
  // tecla digitada na busca apenas consulta o índice já montado.
  const incidents = snapshot?.incidents;
  const indexes = useMemo(
    () =>
      indexOverviewInput(
        { incidents: incidents ?? [], agencies },
        { sectorLabel, countryName },
      ),
    [incidents, agencies],
  );

  const overview = useMemo(
    () =>
      snapshot &&
      buildOverview(
        {
          incidents: snapshot.incidents,
          agencies,
          c2Servers: snapshot.c2Servers,
          lossReference: snapshot.lossReference,
        },
        filter,
        indexes,
      ),
    [snapshot, agencies, filter, indexes],
  );

  if (!snapshot || !overview) {
    return (
      <div className="min-h-screen font-sans">
        <TopBar />
        <WaitingForGateway offline={connection.status === "OFFLINE"} />
      </div>
    );
  }

  // Servidores de comando e controle seguem o recorte geográfico; os demais
  // indicadores não têm país informado pela fonte.
  const feed = buildThreatFeed({
    knownExploited: snapshot.knownExploited.recent,
    criticalCves: snapshot.criticalCves,
    c2Servers: overview.c2Servers,
    topAttackers: snapshot.topAttackers,
  });
  const unavailableFeedSources = snapshot.sources
    .filter((source) => FEED_SOURCES.includes(source.id) && source.health === "OFFLINE")
    .map((source) => source.name);

  const continentItems: BarListItem[] = overview.byContinent.map((item) => ({
    key: item.key,
    label: CONTINENT_LABELS[item.key],
    value: item.incidents,
    detail: `${item.agencies} equipes`,
  }));

  return (
    <div className="min-h-screen font-sans">
      <TopBar />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {connection.status !== "LIVE" && connection.status !== "CONNECTING" && (
          <p
            role="alert"
            className="rounded-md border border-warning/40 bg-panel px-4 py-2 text-xs text-ink"
          >
            Conexão com o gateway interrompida. Os dados exibidos são os últimos
            recebidos.
          </p>
        )}

        <FilterBar
          countryOptions={overview.countryOptions}
          sectorOptions={overview.sectorOptions}
          territories={territories}
        />
        {overview.subnational && (
          <SubnationalNotice filter={filter} territories={territories} />
        )}
        <KpiStrip kpis={overview.kpis} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <PressureChart
            incidents={overview.incidents}
            criticalCves={snapshot.criticalCves}
            live={connection.status === "LIVE"}
            updatedAt={snapshot.generatedAt}
            className="xl:col-span-2"
          />
          <SectorExposureChart
            sectors={overview.bySector}
            selectedSector={filter.sector}
            onSelect={(key) =>
              filterCommands.selectSector(key === filter.sector ? ALL : key)
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <ThreatFeedPanel
            items={feed}
            unavailableSources={unavailableFeedSources}
            knownExploited={snapshot.knownExploited}
            className="lg:col-span-5"
          />
          <IncidentTable
            incidents={overview.incidents}
            lossReference={snapshot.lossReference}
            orderedByRelevance={overview.searchActive}
            className="lg:col-span-7"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Panel
            title="Ataques por continente"
            source={`${RANSOMWARE_SOURCE} e FIRST`}
            aside="Selecione para filtrar"
          >
            <BarList
              items={continentItems}
              emptyMessage="Sem dados."
              selectedKey={filter.continent}
              onSelect={(key) =>
                filterCommands.selectContinent(
                  key === filter.continent ? ALL : (key as typeof filter.continent),
                )
              }
            />
          </Panel>
          <Panel title="Países mais afetados" source={RANSOMWARE_SOURCE}>
            <BarList
              items={toBarItems(overview.byCountry, countryName)}
              emptyMessage="Sem ocorrências com país informado."
              selectedKey={filter.country}
              onSelect={(key) =>
                filterCommands.selectCountry(key === filter.country ? ALL : key)
              }
            />
          </Panel>
          <Panel title="Grupos de ameaça mais ativos" source={RANSOMWARE_SOURCE}>
            <BarList
              items={toBarItems(overview.byGroup, (key) => key)}
              emptyMessage="Sem ocorrências no recorte."
            />
          </Panel>
        </div>

        <AgencyDirectory agencies={overview.agencies} />

        <SourceHealthPanel
          sources={snapshot.sources}
          invalidMessages={connection.invalidMessages}
        />
      </main>

      <footer className="mx-auto max-w-7xl space-y-1.5 px-4 pb-8 pt-2 text-[11px] leading-relaxed text-faint">
        <p>
          <strong className="font-medium text-muted">Sobre o prejuízo estimado.</strong>{" "}
          As fontes públicas não informam a perda financeira de cada incidente. O valor
          exibido resulta da multiplicação do número de incidentes por um custo médio de
          referência de {formatUsd(snapshot.lossReference.perIncidentUsd)} (
          {snapshot.lossReference.source}
          ). Trata-se de ordem de grandeza, e não de perda apurada de qualquer
          organização.
        </p>
        <p>
          <strong className="font-medium text-muted">
            Sobre as organizações listadas.
          </strong>{" "}
          A relação reproduz alegações publicadas por grupos de ransomware e agregadas
          pelo projeto Ransomware.live. A presença na lista não confirma a ocorrência nem
          a extensão de um ataque.
        </p>
      </footer>
    </div>
  );
}
