import type { Attacker, C2Server } from "../../../contract/threat-snapshot.ts";
import { formatInteger } from "../format.ts";
import { CountryChip, EmptyState, Panel, Status } from "./ui.tsx";

interface InfrastructurePanelProps {
  readonly c2Servers: readonly C2Server[];
  readonly topAttackers: readonly Attacker[];
  readonly c2EmptyMessage: string;
  readonly attackersEmptyMessage: string;
}

export function InfrastructurePanel({
  c2Servers,
  topAttackers,
  c2EmptyMessage,
  attackersEmptyMessage,
}: InfrastructurePanelProps) {
  return (
    <Panel
      title="Infraestrutura maliciosa"
      source="abuse.ch Feodo Tracker (Suíça) e SANS ISC / DShield (EUA)"
    >
      <div className="scroll-thin -mr-2 max-h-80 space-y-5 overflow-auto pr-2">
        <div>
          <h3 className="mb-2 text-[10px] uppercase tracking-wider text-faint">
            Servidores de comando e controle de botnets
          </h3>
          {c2Servers.length === 0 ? (
            <EmptyState>{c2EmptyMessage}</EmptyState>
          ) : (
            <ul className="space-y-1.5">
              {c2Servers.map((server) => (
                <li
                  key={`${server.ip}:${server.port}`}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <CountryChip code={server.countryCode} />
                    <span className="font-mono text-ink">
                      {server.ip}:{server.port}
                    </span>
                    <span className="truncate text-faint">{server.malware}</span>
                  </span>
                  <span className="text-muted">
                    <Status tone={server.online ? "critical" : "neutral"}>
                      {server.online ? "Ativo" : "Inativo"}
                    </Status>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-[10px] uppercase tracking-wider text-faint">
            Principais origens de ataque (sensores DShield, global)
          </h3>
          {topAttackers.length === 0 ? (
            <EmptyState>{attackersEmptyMessage}</EmptyState>
          ) : (
            <ol className="space-y-1.5">
              {topAttackers.map((attacker) => (
                <li
                  key={attacker.ip}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-right tabular-nums text-faint">
                      {attacker.rank}
                    </span>
                    <span className="font-mono text-ink">{attacker.ip}</span>
                  </span>
                  <span className="tabular-nums text-muted">
                    {formatInteger(attacker.reports)} registros
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Panel>
  );
}
