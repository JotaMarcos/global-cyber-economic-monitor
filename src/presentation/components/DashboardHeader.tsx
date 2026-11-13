import { Globe, Radio, RefreshCw, Shield } from "lucide-react";
import { useDashboard } from "../context/dashboard-context";
import { useObservable } from "../hooks/use-observable";
import { FEED_STATUS_LABELS } from "../labels";

export function DashboardHeader() {
  const { state, commands } = useDashboard();
  const { feedStatus, infoconLevel, isSyncing } = useObservable(state.threatIntel);

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <Globe className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Global Cyber & Economic Real-Time Monitor
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              Observabilidade Multi-Setorial (Primário, Secundário, Terciário & ONGs) +
              Threat Intelligence OSINT
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-slate-400">Feed OSINT:</span>
            <span className="font-medium text-slate-200">
              {FEED_STATUS_LABELS[feedStatus]}
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">SANS Infocon:</span>
            <span
              className={`font-bold px-1.5 py-0.5 rounded ${
                infoconLevel === "GREEN"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-amber-500/20 text-amber-300"
              }`}
            >
              {infoconLevel}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void commands.syncOsintFeeds()}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-cyan-400" : ""}`}
            />
            Atualizar Feeds
          </button>
        </div>
      </div>
    </header>
  );
}
