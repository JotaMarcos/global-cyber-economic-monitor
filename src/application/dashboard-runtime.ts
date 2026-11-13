import type { CancelSchedule, Scheduler } from "./ports/scheduler";
import type { InspectTrafficBurstUseCase } from "./use-cases/inspect-traffic-burst";
import type { RecordTelemetryPointUseCase } from "./use-cases/record-telemetry-point";
import type { SyncOsintFeedsUseCase } from "./use-cases/sync-osint-feeds";

export const OSINT_SYNC_INTERVAL_MS = 30_000;
export const TELEMETRY_TICK_INTERVAL_MS = 2_200;

export interface DashboardRuntimeDependencies {
  readonly scheduler: Scheduler;
  readonly syncOsintFeeds: SyncOsintFeedsUseCase;
  readonly inspectTrafficBurst: InspectTrafficBurstUseCase;
  readonly recordTelemetryPoint: RecordTelemetryPointUseCase;
}

/** Ciclo de vida dos processos periódicos do painel (polling e streaming). */
export class DashboardRuntime {
  private cancellations: CancelSchedule[] = [];

  constructor(private readonly deps: DashboardRuntimeDependencies) {}

  start(): void {
    if (this.cancellations.length > 0) return;
    const { scheduler, syncOsintFeeds, inspectTrafficBurst, recordTelemetryPoint } =
      this.deps;

    void syncOsintFeeds.execute();
    this.cancellations = [
      scheduler.every(OSINT_SYNC_INTERVAL_MS, () => void syncOsintFeeds.execute()),
      scheduler.every(TELEMETRY_TICK_INTERVAL_MS, () => {
        inspectTrafficBurst.execute();
        recordTelemetryPoint.execute();
      }),
    ];
  }

  stop(): void {
    this.cancellations.forEach((cancel) => cancel());
    this.cancellations = [];
  }
}
