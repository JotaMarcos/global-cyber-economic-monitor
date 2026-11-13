import { Activity, Code2, Cpu, Lock, ShieldCheck, Zap } from "lucide-react";
import { DDOS_BURST_SIZE } from "../../domain/security/traffic-inspection";
import { useDashboard } from "../context/dashboard-context";
import { formatInteger } from "../formatters";
import { useObservable } from "../hooks/use-observable";

interface SecurityTelemetryBarProps {
  readonly onOpenApiDocs: () => void;
}

export function SecurityTelemetryBar({ onOpenApiDocs }: SecurityTelemetryBarProps) {
  const { state, commands } = useDashboard();
  const metrics = useObservable(state.securityMetrics);
  const ddosActive = useObservable(state.ddosSimulation);

  return (
    <div
      className={`border-b px-4 py-2.5 text-xs transition-colors ${
        ddosActive
          ? "bg-red-950/80 border-red-500/60 text-red-100"
          : "bg-slate-900/95 border-slate-800 text-slate-300"
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            WAF / Edge Shield: ATIVO
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            Circuit Breaker:{" "}
            <strong
              className={
                metrics.circuitState === "CLOSED" ? "text-emerald-400" : "text-amber-400"
              }
            >
              {metrics.circuitState}
            </strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            Tráfego: <strong>{metrics.currentRps} req/s</strong> | Descartados (Rate
            Limit):{" "}
            <strong className="text-amber-400">
              {formatInteger(metrics.requestsDropped)}
            </strong>
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            Payloads XSS/SQLi Bloqueados: <strong>{metrics.xssBlocked}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={ddosActive}
            onClick={commands.toggleDdosSimulation}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
              ddosActive
                ? "bg-red-600 hover:bg-red-500 text-white animate-pulse"
                : "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            {ddosActive
              ? `Parar Ataque DDoS (Mitigando ${DDOS_BURST_SIZE} req/s)`
              : "Simular Ataque DDoS"}
          </button>

          <button
            type="button"
            onClick={onOpenApiDocs}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 font-semibold transition cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" />
            API & Arquitetura
          </button>
        </div>
      </div>
    </div>
  );
}
