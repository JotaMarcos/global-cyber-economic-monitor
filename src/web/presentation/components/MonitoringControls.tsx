import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import type { Posture, PostureGroup } from "../../domain/posture.ts";
import { CONTROL_RULE_LABELS } from "../labels.ts";
import { Panel, SeverityBadge } from "./ui.tsx";

function GroupRows({ group }: { readonly group: PostureGroup }) {
  const failing = group.passed < group.controls.length;
  // Grupos com reprovação abrem expandidos: é onde está o que exige ação.
  const [expanded, setExpanded] = useState(failing);
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <tbody className="border-t border-line/70">
      <tr className="bg-canvas">
        <th scope="rowgroup" colSpan={4} className="px-4 py-2 text-left font-normal">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
            className="flex w-full items-center gap-2 text-left"
          >
            <Chevron aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" />
            <span className="font-semibold text-ink">{group.sourceName}</span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                failing
                  ? "border-critical/40 bg-critical/10 text-critical"
                  : "border-good/40 bg-good/10 text-good"
              }`}
            >
              {group.passed} de {group.controls.length} aprovados
            </span>
          </button>
        </th>
      </tr>
      {expanded &&
        group.controls.map((control) => (
          <tr key={control.id} className="border-t border-line/50">
            <td className="py-2 pl-10 pr-3 font-mono text-[11px] text-muted">
              {control.id}
            </td>
            <td className="px-3 py-2">
              <SeverityBadge severity={control.severity} />
            </td>
            <td className="px-3 py-2 text-ink">{CONTROL_RULE_LABELS[control.rule]}</td>
            <td className="px-4 py-2">
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  control.passed ? "text-good" : "text-critical"
                }`}
              >
                {control.passed ? (
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                )}
                {control.passed ? "Aprovado" : "Reprovado"}
              </span>
            </td>
          </tr>
        ))}
    </tbody>
  );
}

/** Controles que compõem o índice de postura, agrupados por fonte de dados. */
export function MonitoringControls({ posture }: { readonly posture: Posture }) {
  return (
    <Panel
      title="Controles de monitoramento por fonte"
      source="Avaliação do painel sobre a telemetria do gateway de ingestão"
      aside={`${posture.total} controles em ${posture.groups.length} fontes`}
    >
      <div className="scroll-thin -mx-4 -my-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-faint">
            <tr>
              <th scope="col" className="py-2 pl-10 pr-3 font-medium">
                Controle
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Severidade
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Regra
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Resultado
              </th>
            </tr>
          </thead>
          {posture.groups.map((group) => (
            <GroupRows key={group.sourceId} group={group} />
          ))}
        </table>
      </div>
    </Panel>
  );
}
