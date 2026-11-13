import type { Incident, LossReference } from "../../../contract/threat-snapshot.ts";
import {
  countryName,
  formatDateTime,
  formatInteger,
  formatUsdCompact,
} from "../format.ts";
import { sectorLabel } from "../labels.ts";
import { CountryChip, EmptyState, Panel } from "./ui.tsx";

const VISIBLE_ROWS = 60;

interface IncidentTableProps {
  readonly incidents: readonly Incident[];
  readonly lossReference: LossReference;
  readonly className?: string;
}

export function IncidentTable({
  incidents,
  lossReference,
  className,
}: IncidentTableProps) {
  const visible = incidents.slice(0, VISIBLE_ROWS);

  return (
    <Panel
      title="Organizações atacadas"
      source="Ransomware.live (alegações de grupos criminosos, não confirmadas)"
      aside={`${formatInteger(incidents.length)} registros`}
      className={className}
    >
      {incidents.length === 0 ? (
        <EmptyState>
          Nenhuma organização encontrada para os filtros selecionados.
        </EmptyState>
      ) : (
        <div className="scroll-thin -mx-4 -mb-4 max-h-[26rem] overflow-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-panel text-[10px] uppercase tracking-wider text-faint">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Organização
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  País
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Setor
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Grupo
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Divulgado em
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Prejuízo estimado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {visible.map((incident) => (
                <tr key={incident.id} className="hover:bg-raised/60">
                  <th
                    scope="row"
                    className="max-w-56 truncate px-4 py-2 font-medium text-ink"
                  >
                    {incident.organization}
                  </th>
                  <td className="px-3 py-2 text-muted">
                    <span className="flex items-center gap-2">
                      <CountryChip code={incident.countryCode} />
                      <span className="truncate">
                        {countryName(incident.countryCode)}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">{sectorLabel(incident.sector)}</td>
                  <td className="px-3 py-2 text-muted">{incident.threatGroup}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted">
                    {formatDateTime(incident.discoveredAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-muted">
                    ≈ {formatUsdCompact(lossReference.perIncidentUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {incidents.length > visible.length && (
            <p className="border-t border-line px-4 py-2 text-[11px] text-faint">
              Exibindo os {VISIBLE_ROWS} registros mais recentes de{" "}
              {formatInteger(incidents.length)}.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
