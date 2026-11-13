import type { CancelSchedule, Scheduler } from "../../application/ports/scheduler";

export class IntervalScheduler implements Scheduler {
  every(intervalMs: number, task: () => void): CancelSchedule {
    const handle = setInterval(task, intervalMs);
    return () => clearInterval(handle);
  }
}
