import {
  Building2,
  CircleDollarSign,
  Globe,
  Server,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { OverviewKpis } from "../../domain/overview.ts";
import { formatInteger, formatUsdCompact } from "../format.ts";
import { Badge } from "./ui.tsx";

interface KpiProps {
  readonly label: string;
  readonly value: string;
  readonly caption: string;
  readonly icon: LucideIcon;
  /** Cor do ícone e da legenda, no padrão visual de cada indicador. */
  readonly toneClass: string;
  readonly badge?: string;
}

function Kpi({ label, value, caption, icon: Icon, toneClass, badge }: KpiProps) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-panel shadow-sm p-4">
      <dt className="mb-2 flex min-h-8 items-start justify-between gap-2 text-xs leading-snug text-muted">
        <span>{label}</span>
        {badge ? (
          <Badge tone="warning">{badge}</Badge>
        ) : (
          <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${toneClass}`} />
        )}
      </dt>
      <dd className="text-2xl font-bold tracking-tight text-ink">{value}</dd>
      <dd className={`mt-1 text-xs leading-snug ${toneClass}`}>{caption}</dd>
    </div>
  );
}

interface KpiStripProps {
  readonly kpis: OverviewKpis;
}

/** Todos os indicadores acompanham o recorte selecionado nos filtros. */
export function KpiStrip({ kpis }: KpiStripProps) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Kpi
        label="Organizações atacadas"
        value={formatInteger(kpis.incidents)}
        caption="Divulgações recentes de ransomware"
        icon={Building2}
        toneClass="text-critical"
      />
      <Kpi
        label="Prejuízo estimado"
        value={formatUsdCompact(kpis.estimatedLossUsd)}
        caption="Incidentes × custo médio de referência"
        icon={CircleDollarSign}
        toneClass="text-warning"
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
        icon={Globe}
        toneClass="text-accent"
      />
      <Kpi
        label="Grupos de ameaça ativos"
        value={formatInteger(kpis.activeGroups)}
        caption="Com divulgações no recorte"
        icon={Users}
        toneClass="text-critical"
      />
      <Kpi
        label="Servidores de botnet (C2)"
        value={formatInteger(kpis.c2Servers)}
        caption={`${formatInteger(kpis.c2ServersOnline)} online no recorte`}
        icon={Server}
        toneClass="text-warning"
      />
      <Kpi
        label="Equipes de resposta"
        value={formatInteger(kpis.agencies)}
        caption="Membros do FIRST no recorte"
        icon={ShieldCheck}
        toneClass="text-good"
      />
    </dl>
  );
}
