import type { SourceHealth, SourceStatus } from "../../../contract/threat-snapshot.ts";
import { countryName, formatDateTime, formatDuration, formatInteger } from "../format.ts";
import { HEALTH_LABELS } from "../labels.ts";
import { Panel, Status, type Tone } from "./ui.tsx";

const HEALTH_TONES: Record<SourceHealth, Tone> = {
  PENDING: "neutral",
  ONLINE: "good",
  STALE: "warning",
  OFFLINE: "critical",
};

interface SourceHealthPanelProps {
  readonly sources: readonly SourceStatus[];
  readonly invalidMessages: number;
}

export function SourceHealthPanel({ sources, invalidMessages }: SourceHealthPanelProps) {
  return (
    <Panel
      title="Integrações e qualidade dos dados"
      source="Gateway de ingestão (validação por esquema em cada coleta)"
      aside={`${formatInteger(invalidMessages)} mensagens fora do contrato nesta sessão`}
    >
      <div className="scroll-thin -mx-4 -mb-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-faint">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">
                Fonte
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Conjunto de dados
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Situação
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Última coleta
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Latência
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Válidos
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Rejeitados
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Ciclo
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Circuito
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {sources.map((source) => (
              <tr key={source.id}>
                <th scope="row" className="px-4 py-2.5 font-normal">
                  <span className="block font-medium text-ink">{source.name}</span>
                  <span className="block text-faint">
                    {source.organization} · {countryName(source.homeCountry)}
                  </span>
                </th>
                <td className="px-3 py-2.5 text-muted">{source.dataset}</td>
                <td className="px-3 py-2.5 text-ink">
                  <Status tone={HEALTH_TONES[source.health]}>
                    {HEALTH_LABELS[source.health]}
                  </Status>
                  {source.lastError && (
                    <span
                      className="block max-w-56 truncate text-faint"
                      title={source.lastError}
                    >
                      {source.lastError}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted">
                  {source.lastSuccessAt ? formatDateTime(source.lastSuccessAt) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                  {source.latencyMs === null
                    ? "—"
                    : `${formatInteger(source.latencyMs)} ms`}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                  {formatInteger(source.recordCount)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                  {formatInteger(source.rejectedCount)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                  {formatDuration(source.refreshIntervalSeconds)}
                </td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-muted">
                  {source.circuitState}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
