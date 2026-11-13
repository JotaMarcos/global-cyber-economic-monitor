import type {
  CancelSchedule,
  Clock,
  Logger,
  Scheduler,
} from "../../application/ports.ts";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class IntervalScheduler implements Scheduler {
  every(intervalMs: number, task: () => void): CancelSchedule {
    const handle = setInterval(task, intervalMs);
    // Não impede o encerramento do processo.
    if (typeof handle === "object") handle.unref();
    return () => clearInterval(handle);
  }
}

type LogSink = (line: string) => void;

/** Log estruturado em JSON, uma linha por evento. */
export class JsonLogger implements Logger {
  private readonly clock: Clock;
  private readonly sink: LogSink;

  constructor(clock: Clock, sink: LogSink) {
    this.clock = clock;
    this.sink = sink;
  }

  info(message: string, context: Record<string, unknown> = {}): void {
    this.write("info", message, context);
  }

  warn(message: string, context: Record<string, unknown> = {}): void {
    this.write("warn", message, context);
  }

  private write(level: string, message: string, context: Record<string, unknown>): void {
    this.sink(
      JSON.stringify({
        time: this.clock.now().toISOString(),
        level,
        message,
        ...context,
      }),
    );
  }
}
