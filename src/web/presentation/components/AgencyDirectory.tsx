import { ExternalLink } from "lucide-react";
import type { Agency } from "../../../contract/threat-snapshot.ts";
import { countryName, formatInteger } from "../format.ts";
import { CountryChip, EmptyState, Panel } from "./ui.tsx";

const VISIBLE_ROWS = 80;

export function AgencyDirectory({ agencies }: { readonly agencies: readonly Agency[] }) {
  const visible = agencies.slice(0, VISIBLE_ROWS);

  return (
    <Panel
      title="Equipes de resposta a incidentes"
      source="FIRST, Forum of Incident Response and Security Teams"
      aside={`${formatInteger(agencies.length)} equipes`}
    >
      {agencies.length === 0 ? (
        <EmptyState>Nenhuma equipe encontrada para os filtros selecionados.</EmptyState>
      ) : (
        <>
          <ul className="scroll-thin -mr-2 max-h-80 space-y-2.5 overflow-auto pr-2">
            {visible.map((agency) => (
              <li key={agency.id} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5">
                  <CountryChip code={agency.countryCode} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-ink">{agency.name}</span>
                    {agency.website && (
                      <a
                        href={agency.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Site de ${agency.name}`}
                        className="shrink-0 text-faint hover:text-ink"
                      >
                        <ExternalLink aria-hidden="true" className="h-3 w-3" />
                      </a>
                    )}
                  </span>
                  <span className="block truncate text-faint">
                    {[
                      countryName(agency.countryCode),
                      agency.types.join(", "),
                      agency.host,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {agencies.length > visible.length && (
            <p className="mt-3 text-[11px] text-faint">
              Exibindo {VISIBLE_ROWS} de {formatInteger(agencies.length)}. Refine pelos
              filtros.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
