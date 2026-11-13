export const SECTOR_IDS = ["PRIMARIO", "SECUNDARIO", "TERCIARIO", "ONG"] as const;

export type SectorId = (typeof SECTOR_IDS)[number];
