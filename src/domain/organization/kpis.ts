import type { Organization } from "./organization";

/** Acréscimo de bloqueios contabilizado enquanto a simulação de DDoS está ativa. */
export const DDOS_SIMULATION_EXTRA_BLOCKS = 14_820;

export interface OrganizationKpis {
  readonly totalVolumeUsdBi: number;
  readonly totalAttacksBlocked: number;
  readonly entitiesCount: number;
  readonly highRiskCount: number;
}

export function computeKpis(
  organizations: readonly Organization[],
  ddosSimulationActive: boolean,
): OrganizationKpis {
  const blocked = organizations.reduce((sum, org) => sum + org.attacksBlocked24h, 0);

  return {
    totalVolumeUsdBi: organizations.reduce((sum, org) => sum + org.volumeUsdBi, 0),
    totalAttacksBlocked:
      blocked + (ddosSimulationActive ? DDOS_SIMULATION_EXTRA_BLOCKS : 0),
    entitiesCount: organizations.length,
    highRiskCount: organizations.filter((org) => org.cyberRisk === "ALTO").length,
  };
}
