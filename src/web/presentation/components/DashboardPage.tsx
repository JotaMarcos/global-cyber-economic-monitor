import { useEffect, useMemo } from "react";
import { ALL } from "../../domain/filter.ts";
import { buildOverview, type RankedItem } from "../../domain/overview.ts";
import { useDashboard } from "../context/dashboard-context.tsx";
import { countryName, formatUsd, formatUsdCompact } from "../format.ts";
import { useObservable } from "../hooks/use-observable.ts";
import { CONTINENT_LABELS, emptyMessage, sectorLabel } from "../labels.ts";
import { AgencyDirectory } from "./AgencyDirectory.tsx";
import { BarList, ColumnChart, type BarListItem } from "./charts.tsx";
import { FilterBar } from "./FilterBar.tsx";
import { IncidentTable } from "./IncidentTable.tsx";
import { InfrastructurePanel } from "./InfrastructurePanel.tsx";
import { KpiStrip } from "./KpiStrip.tsx";
import { SourceHealthPanel } from "./SourceHealthPanel.tsx";
import { TopBar } from "./TopBar.tsx";
import { Panel } from "./ui.tsx";
import { CriticalCvePanel, KnownExploitedPanel } from "./VulnerabilityPanels.tsx";

const RANKING_SIZE = 8;
const RANSOMWARE_SOURCE = "Ransomware.live";

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
  const connection = useObservable(state.connection);
  const filter = useObservable(state.filter);

  useEffect(() => {
    monitoring.start();
    return () => monitoring.stop();
  }, [monitoring]);

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
      ),
    [snapshot, agencies, filter],
  );

  if (!snapshot || !overview) {
    return (
      <div className="min-h-screen font-sans">
        <TopBar />
        <WaitingForGateway offline={connection.status === "OFFLINE"} />
      </div>
    );
  }

  const continentItems: BarListItem[] = overview.byContinent.map((item) => ({
    key: item.key,
    label: CONTINENT_LABELS[item.key],
    value: item.incidents,
    detail: `${item.agencies} equipes`,
  }));

  return (
    <div className="min-h-screen font-sans">
      <TopBar />

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 lg:px-6">
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
        />
        <KpiStrip kpis={overview.kpis} snapshot={snapshot} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel
            title="Divulgações de ataques por dia"
            source={RANSOMWARE_SOURCE}
            aside="Dias em UTC"
            className="xl:col-span-2"
          >
            <ColumnChart
              data={overview.timeline}
              emptyMessage="Sem divulgações no recorte selecionado."
            />
          </Panel>
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
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          <Panel title="Setores mais afetados" source={RANSOMWARE_SOURCE}>
            <BarList
              items={toBarItems(overview.bySector, sectorLabel)}
              emptyMessage="Sem ocorrências no recorte."
              selectedKey={filter.sector}
              onSelect={(key) =>
                filterCommands.selectSector(key === filter.sector ? ALL : key)
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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <IncidentTable
            incidents={overview.incidents}
            lossReference={snapshot.lossReference}
            className="xl:col-span-2"
          />
          <KnownExploitedPanel
            total={snapshot.knownExploited.total}
            recent={snapshot.knownExploited.recent}
            emptyMessage={emptyMessage(snapshot, "cisa-kev", "Catálogo sem entradas.")}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <CriticalCvePanel
            cves={snapshot.criticalCves}
            emptyMessage={emptyMessage(
              snapshot,
              "nist-nvd",
              "Nenhuma CVE crítica publicada no período.",
            )}
          />
          <InfrastructurePanel
            c2Servers={overview.c2Servers}
            topAttackers={snapshot.topAttackers}
            c2EmptyMessage={emptyMessage(
              snapshot,
              "abusech-feodo",
              "Nenhum servidor listado para o recorte.",
            )}
            attackersEmptyMessage={emptyMessage(
              snapshot,
              "sans-isc",
              "Nenhuma origem listada.",
            )}
          />
          <AgencyDirectory agencies={overview.agencies} />
        </div>

        <SourceHealthPanel
          sources={snapshot.sources}
          invalidMessages={connection.invalidMessages}
        />
      </main>

      <footer className="mx-auto max-w-[1600px] space-y-1.5 px-4 pb-8 pt-2 text-[11px] leading-relaxed text-faint lg:px-6">
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
