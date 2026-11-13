import { Activity, CodeXml, Cpu, Database, Globe, Radio, Shield } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import type { InfoconLevel } from "../../../contract/threat-snapshot.ts";
import type { ConnectionStatus } from "../../application/threat-feed.ts";
import { useDashboard } from "../context/dashboard-context.tsx";
import { formatClock, formatInteger } from "../format.ts";
import { useObservable } from "../hooks/use-observable.ts";
import { CONNECTION_LABELS, INFOCON_LABELS } from "../labels.ts";
import { ApiDocsModal } from "./ApiDocsModal.tsx";
import { Status, type Tone } from "./ui.tsx";

const CONNECTION_TONES: Record<ConnectionStatus, Tone> = {
  CONNECTING: "neutral",
  LIVE: "good",
  RECONNECTING: "warning",
  OFFLINE: "critical",
};

const INFOCON_CLASSES: Record<InfoconLevel, string> = {
  GREEN: "bg-good/20 text-good",
  YELLOW: "bg-warning/20 text-warning",
  ORANGE: "bg-serious/20 text-serious",
  RED: "bg-critical/20 text-critical",
};

function StripItem({
  icon,
  label,
  children,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      {icon}
      <dt className="text-muted">{label}:</dt>
      <dd className="font-semibold text-ink">{children}</dd>
    </div>
  );
}

function HeaderBadge({
  icon,
  label,
  children,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs">
      {icon}
      <dt className="text-muted">{label}:</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}

/**
 * Barra de telemetria do gateway e cabeçalho do painel. Todos os indicadores
 * vêm do retrato recebido: saúde das fontes, circuitos, validação e Infocon.
 */
export function TopBar() {
  const { state } = useDashboard();
  const snapshot = useObservable(state.snapshot);
  const connection = useObservable(state.connection);
  const [apiDocsOpen, setApiDocsOpen] = useState(false);
  const closeApiDocs = useCallback(() => setApiDocsOpen(false), []);

  const sources = snapshot?.sources ?? [];
  const online = sources.filter((source) => source.health === "ONLINE").length;
  const closedCircuits = sources.filter(
    (source) => source.circuitState === "CLOSED",
  ).length;
  const rejected = sources.reduce((sum, source) => sum + source.rejectedCount, 0);
  const allCircuitsClosed = sources.length > 0 && closedCircuits === sources.length;

  return (
    <>
      <div className="border-b border-line bg-panel/95 px-4 py-2.5 text-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <dl className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <StripItem
              icon={<Radio aria-hidden="true" className="h-3.5 w-3.5 text-accent" />}
              label="Conexão"
            >
              <span role="status">
                <Status
                  tone={CONNECTION_TONES[connection.status]}
                  pulse={connection.status === "LIVE"}
                >
                  {CONNECTION_LABELS[connection.status]}
                </Status>
              </span>
            </StripItem>
            <StripItem
              icon={<Cpu aria-hidden="true" className="h-3.5 w-3.5 text-accent" />}
              label="Circuit breakers fechados"
            >
              <span className={allCircuitsClosed ? "text-good" : "text-warning"}>
                {sources.length > 0 ? `${closedCircuits}/${sources.length}` : "—"}
              </span>
            </StripItem>
            <StripItem
              icon={<Activity aria-hidden="true" className="h-3.5 w-3.5 text-accent" />}
              label="Fontes operacionais"
            >
              {sources.length > 0 ? `${online} de ${sources.length}` : "—"}
            </StripItem>
            <StripItem
              icon={<Database aria-hidden="true" className="h-3.5 w-3.5 text-accent" />}
              label="Registros rejeitados na validação"
            >
              <span className={rejected > 0 ? "text-warning" : undefined}>
                {formatInteger(rejected)}
              </span>
            </StripItem>
          </dl>

          <button
            type="button"
            onClick={() => setApiDocsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1 font-semibold text-accent hover:bg-accent/20"
          >
            <CodeXml aria-hidden="true" className="h-3.5 w-3.5" />
            API e arquitetura
          </button>
        </div>
      </div>

      <header className="border-b border-line/80 bg-panel/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg border border-accent/30 bg-accent/10 p-2">
              <Globe aria-hidden="true" className="h-6 w-6 text-accent" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">
                Global Cyber & Economic Monitor
              </h1>
              <p className="text-xs text-muted md:text-sm">
                Inteligência de ameaças de instituições oficiais de monitoramento,
                consolidada em tempo quase real
              </p>
            </div>
          </div>

          <dl className="flex flex-wrap items-center gap-3">
            <HeaderBadge
              icon={<Shield aria-hidden="true" className="h-3.5 w-3.5 text-accent" />}
              label="SANS Infocon"
            >
              {snapshot?.infoconLevel ? (
                <span
                  className={`rounded px-1.5 py-0.5 font-bold ${INFOCON_CLASSES[snapshot.infoconLevel]}`}
                >
                  {INFOCON_LABELS[snapshot.infoconLevel]}
                </span>
              ) : (
                "—"
              )}
            </HeaderBadge>
            <HeaderBadge
              icon={<Activity aria-hidden="true" className="h-3.5 w-3.5 text-accent" />}
              label="Última atualização"
            >
              {snapshot ? formatClock(snapshot.generatedAt) : "—"}
            </HeaderBadge>
          </dl>
        </div>
      </header>

      {apiDocsOpen && <ApiDocsModal onClose={closeApiDocs} />}
    </>
  );
}
