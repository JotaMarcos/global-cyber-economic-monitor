import type { SectorId } from "./sector";

export type CyberRisk = "BAIXO" | "MÉDIO" | "ALTO";

export interface Organization {
  readonly id: number;
  readonly name: string;
  readonly segment: string;
  readonly sector: SectorId;
  readonly country: string;
  readonly state: string;
  readonly city: string;
  readonly volumeUsdBi: number;
  readonly cyberRisk: CyberRisk;
  readonly attacksBlocked24h: number;
  readonly sla: string;
}
