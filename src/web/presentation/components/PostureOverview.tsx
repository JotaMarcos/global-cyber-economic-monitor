import { ShieldCheck } from "lucide-react";
import type { Finding, FindingSeverity } from "../../domain/findings.ts";
import type { ControlSeverity, Posture } from "../../domain/posture.ts";
import { formatInteger, formatPercent } from "../format.ts";
import { FINDING_LABELS, SEVERITY_LABELS } from "../labels.ts";
import { EmptyState, Panel, SeverityBadge } from "./ui.tsx";

/** Faixas do índice: a cor acompanha sempre o valor em texto. */
const GOOD_SCORE = 90;
const WARNING_SCORE = 70;

const FINDING_MARKERS: Record<FindingSeverity, string> = {
  CRITICAL: "bg-critical",
  HIGH: "bg-serious",
  MEDIUM: "bg-warning",
};

const SEVERITY_BARS: Record<ControlSeverity, string> = {
  CRITICAL: "bg-critical",
  HIGH: "bg-serious",
  MEDIUM: "bg-warning",
  LOW: "bg-faint",
};

function scoreClass(score: number): string {
  if (score >= GOOD_SCORE) return "text-good";
  return score >= WARNING_SCORE ? "text-warning" : "text-critical";
}

function ScoreCard({ posture }: { readonly posture: Posture }) {
  const { score, passed, total } = posture;
  const failing = posture.groups.filter((group) => group.passed < group.controls.length);
  return (
    <Panel
      title="Índice de postura do monitoramento"
      source="Controles operacionais avaliados em cada fonte"
      className="lg:col-span-3"
    >
      {score === null ? (
        <EmptyState>Aguardando a primeira coleta.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2">
            <ShieldCheck
              aria-hidden="true"
              className={`h-7 w-7 shrink-0 ${scoreClass(score)}`}
            />
            <span
              className={`text-5xl font-bold tracking-tight tabular-nums ${scoreClass(score)}`}
            >
              {formatPercent(score)}
            </span>
          </p>
          <div>
            <div
              role="img"
              aria-label={`${formatPercent(score)} dos controles aprovados`}
              className="h-2 overflow-hidden rounded-full bg-raised"
            >
              <div
                className="h-full rounded-full bg-good"
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {formatInteger(passed)} de {formatInteger(total)} controles aprovados
            </p>
            <p className="mt-1 text-[11px] leading-snug text-faint">
              Mede a confiabilidade da coleta de dados. Não representa o nível de ameaça.
            </p>
          </div>
          <div className="border-t border-line/70 pt-3 text-xs">
            <p className="font-medium text-ink">Fontes com controles reprovados</p>
            {failing.length === 0 ? (
              <p className="mt-1 text-muted">Nenhuma.</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-muted">
                {failing.map((group) => (
                  <li key={group.sourceId} className="flex justify-between gap-2">
                    <span className="truncate">{group.sourceName}</span>
                    <span className="shrink-0 tabular-nums">
                      {group.controls.length - group.passed} reprovados
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function FindingsCard({ findings }: { readonly findings: readonly Finding[] }) {
  return (
    <Panel
      title="Principais achados em aberto"
      source="Contagem direta de registros das fontes integradas"
      className="lg:col-span-5"
    >
      {findings.length === 0 ? (
        <EmptyState>Nenhum achado no recorte selecionado.</EmptyState>
      ) : (
        <div className="scroll-thin -mx-4 -my-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-faint">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Achado
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Registros
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Severidade
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {findings.map((finding) => (
                <tr key={finding.kind}>
                  <th scope="row" className="px-4 py-2 font-normal">
                    <span className="flex items-stretch gap-2">
                      <span
                        aria-hidden="true"
                        className={`w-0.5 shrink-0 rounded ${FINDING_MARKERS[finding.severity]}`}
                      />
                      <span>
                        <span className="block text-ink">
                          {FINDING_LABELS[finding.kind].title}
                        </span>
                        <span className="block text-[11px] text-faint">
                          {FINDING_LABELS[finding.kind].source}
                          {finding.scoped ? " · segue o recorte" : " · escopo global"}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">
                    {formatInteger(finding.count)}
                  </td>
                  <td className="px-4 py-2">
                    <SeverityBadge severity={finding.severity} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function SeverityCard({ posture }: { readonly posture: Posture }) {
  return (
    <Panel
      title="Controles por severidade"
      source="Proporção de controles aprovados em cada nível"
      className="lg:col-span-4"
    >
      <ul className="space-y-3">
        {posture.bySeverity.map(({ severity, passed, total }) => {
          const share = total === 0 ? 0 : (passed / total) * 100;
          return (
            <li key={severity} className="text-xs">
              <div className="flex items-center justify-between gap-3">
                <SeverityBadge severity={severity} />
                <span className="tabular-nums text-muted">
                  <strong className="font-semibold text-ink">
                    {total === 0 ? "—" : formatPercent(share)}
                  </strong>{" "}
                  · {formatInteger(passed)} de {formatInteger(total)} controles
                </span>
              </div>
              <div
                aria-hidden="true"
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised"
              >
                <div
                  className={`h-full rounded-full ${SEVERITY_BARS[severity]}`}
                  style={{ width: `${share}%` }}
                />
              </div>
              <span className="sr-only">
                Severidade {SEVERITY_LABELS[severity]}: {formatInteger(passed)} aprovados.
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

interface PostureOverviewProps {
  readonly posture: Posture;
  readonly findings: readonly Finding[];
}

/** Visão executiva: postura da coleta, achados em aberto e controles por severidade. */
export function PostureOverview({ posture, findings }: PostureOverviewProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <ScoreCard posture={posture} />
      <FindingsCard findings={findings} />
      <SeverityCard posture={posture} />
    </div>
  );
}
