import type { FeedStatus } from "../application/state/dashboard-state";
import type { SectorId } from "../domain/organization/sector";

export const FEED_STATUS_LABELS: Record<FeedStatus, string> = {
  BASELINE: "SANS ISC + Abuse.ch (Ativo)",
  LIVE: "SANS ISC DShield (Tempo Real)",
  CACHE_FALLBACK: "Cache SWR + Base OSINT Validada",
};

export const SECTOR_FILTER_LABELS: Record<SectorId, string> = {
  PRIMARIO: "Setor Primário (Agro & Extrativismo)",
  SECUNDARIO: "Setor Secundário (Indústria & Energia)",
  TERCIARIO: "Setor Terciário (Bancos, Bolsas, Big Tech, Comércio & Turismo)",
  ONG: "Terceiro Setor (ONGs & Institutos)",
};

export const SECTOR_CHART_LABELS: Record<SectorId, string> = {
  PRIMARIO: "Primário (Agro)",
  SECUNDARIO: "Secundário (Indústria)",
  TERCIARIO: "Terciário (Finanças/Tech)",
  ONG: "Terceiro Setor (ONGs)",
};
