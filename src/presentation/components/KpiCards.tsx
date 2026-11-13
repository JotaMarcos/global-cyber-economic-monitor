import {
  AlertTriangle,
  Server,
  ShieldAlert,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { OrganizationKpis } from "../../domain/organization/kpis";
import { formatDecimal, formatInteger } from "../formatters";

interface KpiCardProps {
  readonly title: string;
  readonly value: string;
  readonly caption: string;
  readonly icon: LucideIcon;
  readonly iconClass: string;
  readonly captionClass: string;
  readonly valueClass?: string;
}

function KpiCard({
  title,
  value,
  caption,
  icon: Icon,
  iconClass,
  captionClass,
  valueClass = "text-white",
}: KpiCardProps) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
        <span>{title}</span>
        <Icon className={`w-4 h-4 ${iconClass}`} />
      </div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className={`text-xs mt-1 ${captionClass}`}>{caption}</div>
    </div>
  );
}

interface KpiCardsProps {
  readonly kpis: OrganizationKpis;
}

export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Volume Econômico Monitorado"
        value={`US$ ${formatDecimal(kpis.totalVolumeUsdBi)} Bi`}
        caption={`${kpis.entitiesCount} organizações ativas no recorte`}
        icon={TrendingUp}
        iconClass="text-emerald-400"
        captionClass="text-emerald-400"
      />
      <KpiCard
        title="Ataques Cibernéticos Mitigados (24h)"
        value={formatInteger(kpis.totalAttacksBlocked)}
        caption="Telemetria cruzada SANS DShield & Abuse.ch"
        icon={ShieldAlert}
        iconClass="text-rose-400"
        captionClass="text-rose-300"
      />
      <KpiCard
        title="Infraestruturas em Alerta Crítico"
        value={String(kpis.highRiskCount)}
        caption="Bolsas, Big Techs e Energia sob monitoramento reforçado"
        icon={AlertTriangle}
        iconClass="text-amber-400"
        captionClass="text-amber-300"
      />
      <KpiCard
        title="Disponibilidade & Resiliência SLA"
        value="99.98%"
        caption="Zero indisponibilidade sob estresse de borda"
        icon={Server}
        iconClass="text-cyan-400"
        captionClass="text-slate-400"
        valueClass="text-emerald-400"
      />
    </section>
  );
}
