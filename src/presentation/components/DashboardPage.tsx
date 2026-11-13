import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboard } from "../context/dashboard-context";
import { useObservable } from "../hooks/use-observable";
import { ApiDocsModal } from "./ApiDocsModal";
import { DashboardHeader } from "./DashboardHeader";
import { FilterPanel } from "./FilterPanel";
import { KpiCards } from "./KpiCards";
import { OrganizationTable } from "./OrganizationTable";
import { SectorExposureChart } from "./SectorExposureChart";
import { SecurityTelemetryBar } from "./SecurityTelemetryBar";
import { TelemetryChart } from "./TelemetryChart";
import { ThreatFeed } from "./ThreatFeed";

export function DashboardPage() {
  const { state, queries, runtime } = useDashboard();
  const filter = useObservable(state.filter);
  const ddosActive = useObservable(state.ddosSimulation);
  const [isApiDocsOpen, setIsApiDocsOpen] = useState(false);

  useEffect(() => {
    runtime.start();
    return () => runtime.stop();
  }, [runtime]);

  const overview = useMemo(
    () => queries.getOrganizationOverview(filter, ddosActive),
    [queries, filter, ddosActive],
  );

  const openApiDocs = useCallback(() => setIsApiDocsOpen(true), []);
  const closeApiDocs = useCallback(() => setIsApiDocsOpen(false), []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      <SecurityTelemetryBar onOpenApiDocs={openApiDocs} />
      <DashboardHeader />

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <FilterPanel />
        <KpiCards kpis={overview.kpis} />

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TelemetryChart />
          <SectorExposureChart summary={overview.sectorSummary} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <ThreatFeed />
          <OrganizationTable organizations={overview.organizations} />
        </section>
      </main>

      {isApiDocsOpen && <ApiDocsModal onClose={closeApiDocs} />}
    </div>
  );
}
