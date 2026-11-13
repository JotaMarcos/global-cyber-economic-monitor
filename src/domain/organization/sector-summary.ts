import type { Organization } from "./organization";
import { SECTOR_IDS, type SectorId } from "./sector";

export interface SectorSummary {
  readonly sector: SectorId;
  readonly volumeUsdBi: number;
  readonly blockedThousands: number;
}

function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/** Consolida volume e bloqueios por setor, mantendo setores sem registros. */
export function summarizeBySector(
  organizations: readonly Organization[],
): SectorSummary[] {
  return SECTOR_IDS.map((sector) => {
    const members = organizations.filter((org) => org.sector === sector);
    const volume = members.reduce((sum, org) => sum + org.volumeUsdBi, 0);
    const blocked = members.reduce((sum, org) => sum + org.attacksBlocked24h, 0);

    return {
      sector,
      volumeUsdBi: round(volume, 1),
      blockedThousands: round(blocked / 1000, 2),
    };
  });
}
