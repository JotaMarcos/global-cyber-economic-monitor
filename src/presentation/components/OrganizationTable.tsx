import { Building2 } from "lucide-react";
import type { CyberRisk, Organization } from "../../domain/organization/organization";

const RISK_CLASSES: Record<CyberRisk, string> = {
  ALTO: "bg-rose-500/20 text-rose-300",
  MÉDIO: "bg-amber-500/20 text-amber-300",
  BAIXO: "bg-emerald-500/20 text-emerald-300",
};

function OrganizationRow({ organization }: { readonly organization: Organization }) {
  return (
    <tr className="hover:bg-slate-800/40 transition">
      <td className="py-2.5 px-2">
        <div className="font-semibold text-slate-100">{organization.name}</div>
        <div className="text-[11px] text-slate-400">{organization.segment}</div>
      </td>
      <td className="py-2.5 px-2 text-slate-300">
        {organization.city}, {organization.state} ({organization.country})
      </td>
      <td className="py-2.5 px-2">
        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium">
          {organization.sector}
        </span>
      </td>
      <td className="py-2.5 px-2 text-right font-mono text-emerald-300 font-semibold">
        ${organization.volumeUsdBi.toFixed(1)}B
      </td>
      <td className="py-2.5 px-2 text-center">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold ${RISK_CLASSES[organization.cyberRisk]}`}
        >
          {organization.cyberRisk}
        </span>
      </td>
      <td className="py-2.5 px-2 text-right font-mono text-slate-300">
        {organization.sla}
      </td>
    </tr>
  );
}

interface OrganizationTableProps {
  readonly organizations: readonly Organization[];
}

export function OrganizationTable({ organizations }: OrganizationTableProps) {
  return (
    <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">
            Entidades Monitoradas (Empresas, Bancos, Bolsas, Big Techs & ONGs)
          </h2>
        </div>
        <span className="text-xs text-slate-400">{organizations.length} registros</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
              <th className="py-2.5 px-2">Organização / Segmento</th>
              <th className="py-2.5 px-2">Localização</th>
              <th className="py-2.5 px-2">Setor</th>
              <th className="py-2.5 px-2 text-right">Volume (US$)</th>
              <th className="py-2.5 px-2 text-center">Risco Cyber</th>
              <th className="py-2.5 px-2 text-right">SLA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  Nenhuma organização encontrada para os filtros selecionados.
                </td>
              </tr>
            ) : (
              organizations.map((organization) => (
                <OrganizationRow key={organization.id} organization={organization} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
