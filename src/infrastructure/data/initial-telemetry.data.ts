import type { TelemetryPoint } from "../../domain/telemetry/telemetry-point";

export const INITIAL_TELEMETRY: readonly TelemetryPoint[] = [
  {
    time: "16:10",
    economicIndex: 104.2,
    cyberAttacksPerMin: 310,
    mitigatedRate: 99.8,
  },
  {
    time: "16:15",
    economicIndex: 105.1,
    cyberAttacksPerMin: 345,
    mitigatedRate: 99.9,
  },
  {
    time: "16:20",
    economicIndex: 104.8,
    cyberAttacksPerMin: 420,
    mitigatedRate: 99.7,
  },
  {
    time: "16:25",
    economicIndex: 106.4,
    cyberAttacksPerMin: 390,
    mitigatedRate: 99.9,
  },
  {
    time: "16:30",
    economicIndex: 107.0,
    cyberAttacksPerMin: 510,
    mitigatedRate: 99.8,
  },
  {
    time: "16:35",
    economicIndex: 108.3,
    cyberAttacksPerMin: 465,
    mitigatedRate: 99.9,
  },
];
