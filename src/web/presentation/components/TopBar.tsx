import { Activity, ShieldCheck } from "lucide-react";
import type { InfoconLevel } from "../../../contract/threat-snapshot.ts";
import type { ConnectionStatus } from "../../application/threat-feed.ts";
import { useDashboard } from "../context/dashboard-context.tsx";
import { formatClock } from "../format.ts";
import { useObservable } from "../hooks/use-observable.ts";
import { CONNECTION_LABELS, INFOCON_LABELS } from "../labels.ts";
import { Status, type Tone } from "./ui.tsx";

const CONNECTION_TONES: Record<ConnectionStatus, Tone> = {
  CONNECTING: "neutral",
  LIVE: "good",
  RECONNECTING: "warning",
  OFFLINE: "critical",
};

const INFOCON_TONES: Record<InfoconLevel, Tone> = {
  GREEN: "good",
  YELLOW: "warning",
  ORANGE: "serious",
  RED: "critical",
};

function Metric({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] uppercase tracking-wider text-faint">{label}</dt>
      <dd className="text-xs font-medium text-ink">{children}</dd>
    </div>
  );
}

export function TopBar() {
  const { state } = useDashboard();
  const snapshot = useObservable(state.snapshot);
  const connection = useObservable(state.connection);
  const sources = snapshot?.sources ?? [];
  const online = sources.filter((source) => source.health === "ONLINE").length;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-panel">
            <ShieldCheck aria-hidden="true" className="h-5 w-5 text-accent" />
          </span>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-ink">
              Global Cyber & Economic Monitor
            </h1>
            <p className="text-[11px] text-faint">
              Inteligência de ameaças de fontes públicas, consolidada em tempo quase real
            </p>
          </div>
        </div>

        <dl className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <Metric label="Conexão">
            <span role="status">
              <Status
                tone={CONNECTION_TONES[connection.status]}
                pulse={connection.status === "LIVE"}
              >
                {CONNECTION_LABELS[connection.status]}
              </Status>
            </span>
          </Metric>
          <Metric label="Fontes operacionais">
            <span className="inline-flex items-center gap-1.5">
              <Activity aria-hidden="true" className="h-3.5 w-3.5 text-faint" />
              {sources.length > 0 ? `${online} de ${sources.length}` : "—"}
            </span>
          </Metric>
          <Metric label="SANS Infocon">
            {snapshot?.infoconLevel ? (
              <Status tone={INFOCON_TONES[snapshot.infoconLevel]}>
                {INFOCON_LABELS[snapshot.infoconLevel]}
              </Status>
            ) : (
              "—"
            )}
          </Metric>
          <Metric label="Última atualização">
            {snapshot ? formatClock(snapshot.generatedAt) : "—"}
          </Metric>
        </dl>
      </div>
    </header>
  );
}
