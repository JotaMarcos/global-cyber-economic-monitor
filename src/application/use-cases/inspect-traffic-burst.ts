import type {
  ObservableState,
  ReadonlyObservable,
} from "../../shared/observable/observable";
import {
  estimateBurstSize,
  inspectBurst,
} from "../../domain/security/traffic-inspection";
import type { RandomSource } from "../ports/random-source";
import type { RateLimiter } from "../ports/rate-limiter";
import type { SecurityMetrics } from "../state/dashboard-state";

export interface InspectTrafficBurstDependencies {
  readonly rateLimiter: RateLimiter;
  readonly random: RandomSource;
  readonly ddosSimulation: ReadonlyObservable<boolean>;
  readonly securityMetrics: ObservableState<SecurityMetrics>;
}

/** Aplica rate limiting e sanitização a uma rajada de tráfego e acumula as métricas. */
export class InspectTrafficBurstUseCase {
  constructor(private readonly deps: InspectTrafficBurstDependencies) {}

  execute(): void {
    const { rateLimiter, random, ddosSimulation, securityMetrics } = this.deps;
    const ddosActive = ddosSimulation.getValue();
    const burstSize = estimateBurstSize(ddosActive, random.next());
    const result = inspectBurst(burstSize, ddosActive, () => rateLimiter.tryConsume());

    securityMetrics.update((metrics) => ({
      ...metrics,
      requestsAccepted: metrics.requestsAccepted + result.accepted,
      requestsDropped: metrics.requestsDropped + result.dropped,
      xssBlocked: metrics.xssBlocked + result.maliciousBlocked,
      currentRps: result.burstSize,
    }));
  }
}
