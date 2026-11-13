import type { ThreatSnapshot } from "../../../contract/threat-snapshot.ts";
import type { OverviewKpis } from "../../domain/overview.ts";
import { formatInteger, formatUsdCompact } from "../format.ts";
import { Badge } from "./ui.tsx";

interface KpiProps {
  readonly label: string;
  readonly value: string;
  readonly caption: string;
  readonly badge?: string;
}

function Kpi({ label, value, caption, badge }: KpiProps) {
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-3">
      <dt className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span className="truncate">{label}</span>
        {badge && <Badge tone="warning">{badge}</Badge>}
      </dt>
      <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{value}</dd>
      <dd className="mt-0.5 truncate text-[11px] text-faint">{caption}</dd>
    </div>
  );
}

interface KpiStripProps {
  readonly kpis: OverviewKpis;
  readonly snapshot: ThreatSnapshot;
}

export function KpiStrip({ kpis, snapshot }: KpiStripProps) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi
        label="Organizações atacadas"
        value={formatInteger(kpis.incidents)}
        caption="Divulgações recentes de ransomware"
      />
      <Kpi
        label="Prejuízo estimado"
        value={formatUsdCompact(kpis.estimatedLossUsd)}
        caption="Incidentes × custo médio de referência"
        badge="Estimativa"
      />
      <Kpi
        label="Países afetados"
        value={formatInteger(kpis.countriesAffected)}
        caption={
          kpis.unlocated > 0
            ? `${formatInteger(kpis.unlocated)} sem país informado`
            : "Todos com país informado"
        }
      />
      <Kpi
        label="Grupos de ameaça ativos"
        value={formatInteger(kpis.activeGroups)}
        caption="Com divulgações no recorte"
      />
      <Kpi
        label="Vulnerabilidades exploradas"
        value={formatInteger(snapshot.knownExploited.total)}
        caption={`${formatInteger(snapshot.knownExploited.ransomwareLinked)} usadas em ransomware`}
      />
      <Kpi
        label="Equipes de resposta"
        value={formatInteger(kpis.agencies)}
        caption="Membros do FIRST no recorte"
      />
    </dl>
  );
}
