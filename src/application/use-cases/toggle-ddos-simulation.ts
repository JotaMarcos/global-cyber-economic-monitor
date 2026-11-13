import type { ObservableState } from "../../shared/observable/observable";

export class ToggleDdosSimulationUseCase {
  constructor(private readonly ddosSimulation: ObservableState<boolean>) {}

  execute(): void {
    this.ddosSimulation.update((active) => !active);
  }
}
