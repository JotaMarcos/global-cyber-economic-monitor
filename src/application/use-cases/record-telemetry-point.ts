import type {
  ObservableState,
  ReadonlyObservable,
} from "../../shared/observable/observable";
import {
  appendToWindow,
  nextTelemetryPoint,
  type TelemetryPoint,
} from "../../domain/telemetry/telemetry-point";
import type { Clock } from "../ports/clock";
import type { RandomSource } from "../ports/random-source";

export interface RecordTelemetryPointDependencies {
  readonly clock: Clock;
  readonly random: RandomSource;
  readonly ddosSimulation: ReadonlyObservable<boolean>;
  readonly telemetry: ObservableState<readonly TelemetryPoint[]>;
}

const TIME_LABEL_LENGTH = 8; // HH:MM:SS

/** Acrescenta uma amostra à série temporal em janela deslizante. */
export class RecordTelemetryPointUseCase {
  constructor(private readonly deps: RecordTelemetryPointDependencies) {}

  execute(): void {
    const { clock, random, ddosSimulation, telemetry } = this.deps;
    const point = nextTelemetryPoint(telemetry.getValue().at(-1), {
      timeLabel: clock.now().toTimeString().slice(0, TIME_LABEL_LENGTH),
      economicNoise: random.next(),
      attackNoise: random.next(),
      ddosSimulationActive: ddosSimulation.getValue(),
    });

    telemetry.update((series) => appendToWindow(series, point));
  }
}
