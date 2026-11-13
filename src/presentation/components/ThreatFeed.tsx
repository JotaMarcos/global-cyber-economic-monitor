import { CheckCircle2, ShieldAlert } from "lucide-react";
import type { ThreatLog } from "../../domain/threat/threat-log";
import { useDashboard } from "../context/dashboard-context";
import { useObservable } from "../hooks/use-observable";

function severityClass(severity: ThreatLog["severity"]): string {
  return severity === "CRÍTICA"
    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
    : "bg-amber-500/20 text-amber-300 border border-amber-500/40";
}

function ThreatFeedItem({ log }: { readonly log: ThreatLog }) {
  return (
    <li className="p-3 rounded-lg bg-slate-950/90 border border-slate-800/90 flex items-start justify-between gap-2 text-xs">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-cyan-300">{log.ip}</span>
          <span className="text-slate-500">:{log.port}</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
            {log.agency}
          </span>
        </div>
        <p className="text-slate-300 font-medium">{log.threatType}</p>
        <p className="text-[11px] text-slate-500">Alvo Setorial: {log.targetSector}</p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold ${severityClass(log.severity)}`}
        >
          {log.severity}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
          <CheckCircle2 className="w-3 h-3" />
          {log.status}
        </span>
      </div>
    </li>
  );
}

export function ThreatFeed() {
  const { state } = useDashboard();
  const { threatLogs } = useObservable(state.threatIntel);

  return (
    <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <h2 className="text-sm font-bold text-white">
            Feed OSINT Tratado & Sanitizado
          </h2>
        </div>
        <span className="text-[11px] text-slate-400">SANS ISC • Abuse.ch • CISA</span>
      </div>

      <ul className="space-y-2.5 overflow-y-auto max-h-96 pr-1">
        {threatLogs.map((log) => (
          <ThreatFeedItem key={log.id} log={log} />
        ))}
      </ul>
    </div>
  );
}
