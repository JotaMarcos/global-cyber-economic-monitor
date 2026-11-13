export interface TelemetryPoint {
  readonly time: string;
  readonly economicIndex: number;
  readonly cyberAttacksPerMin: number;
  readonly mitigatedRate: number;
}

export const MAX_SERIES_POINTS = 24;

const ECONOMIC_INDEX_FLOOR = 92;
const ECONOMIC_INDEX_CEILING = 135;
const ECONOMIC_DRIFT_BIAS = 0.46;
const ECONOMIC_VOLATILITY = 0.8;
const DEFAULT_ECONOMIC_INDEX = 106;

interface AttackProfile {
  readonly base: number;
  readonly spread: number;
  readonly mitigatedRate: number;
}

const NORMAL_PROFILE: AttackProfile = { base: 310, spread: 260, mitigatedRate: 99.89 };
const DDOS_PROFILE: AttackProfile = { base: 1850, spread: 450, mitigatedRate: 99.94 };

export interface TelemetrySample {
  readonly timeLabel: string;
  /** Valores uniformes em [0, 1) fornecidos por quem chama (função pura). */
  readonly economicNoise: number;
  readonly attackNoise: number;
  readonly ddosSimulationActive: boolean;
}

/** Passeio aleatório limitado para o índice econômico e carga de ataques do perfil. */
export function nextTelemetryPoint(
  previous: TelemetryPoint | undefined,
  sample: TelemetrySample,
): TelemetryPoint {
  const lastIndex = previous?.economicIndex ?? DEFAULT_ECONOMIC_INDEX;
  const drift = (sample.economicNoise - ECONOMIC_DRIFT_BIAS) * ECONOMIC_VOLATILITY;
  const bounded = Math.max(
    ECONOMIC_INDEX_FLOOR,
    Math.min(ECONOMIC_INDEX_CEILING, lastIndex + drift),
  );
  const profile = sample.ddosSimulationActive ? DDOS_PROFILE : NORMAL_PROFILE;

  return {
    time: sample.timeLabel,
    economicIndex: Number(bounded.toFixed(2)),
    cyberAttacksPerMin: Math.floor(profile.base + sample.attackNoise * profile.spread),
    mitigatedRate: profile.mitigatedRate,
  };
}

/** Janela deslizante de tamanho fixo: o consumo de memória é constante. */
export function appendToWindow(
  series: readonly TelemetryPoint[],
  point: TelemetryPoint,
  maxPoints: number = MAX_SERIES_POINTS,
): TelemetryPoint[] {
  return [...series.slice(-(maxPoints - 1)), point];
}
