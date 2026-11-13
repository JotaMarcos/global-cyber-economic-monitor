export type CancelSchedule = () => void;

export interface Scheduler {
  every(intervalMs: number, task: () => void): CancelSchedule;
}
