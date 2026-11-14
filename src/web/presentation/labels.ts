import type {
  InfoconLevel,
  SourceHealth,
  SourceId,
  ThreatSnapshot,
} from "../../contract/threat-snapshot.ts";
import type { ConnectionStatus } from "../application/threat-feed.ts";
import type { ContinentId } from "../domain/geography.ts";

export const CONTINENT_LABELS: Record<ContinentId, string> = {
  SOUTH_AMERICA: "América do Sul",
  CENTRAL_AMERICA: "América Central e Caribe",
  NORTH_AMERICA: "América do Norte",
  EUROPE: "Europa",
  ASIA: "Ásia e Oriente Médio",
  OCEANIA: "Oceania",
  AFRICA: "África",
};

const SECTOR_LABELS: Record<string, string> = {
  "Agriculture and Food Production": "Agricultura e alimentos",
  "Business Services": "Serviços empresariais",
  Construction: "Construção",
  "Consumer Services": "Serviços ao consumidor",
  Education: "Educação",
  "Energy & Utilities": "Energia e serviços públicos",
  "Financial Services": "Serviços financeiros",
  "Government & Defense": "Governo e defesa",
  Healthcare: "Saúde",
  Hospitality: "Hotelaria e turismo",
  Manufacturing: "Indústria",
  "Media & Entertainment": "Mídia e entretenimento",
  Other: "Outros",
  "Professional Services": "Serviços profissionais",
  "Retail & E-Commerce": "Varejo e comércio eletrônico",
  Technology: "Tecnologia",
  Telecommunications: "Telecomunicações",
  Transportation: "Transporte e logística",
  Unclassified: "Não classificado",
};

/** Setores fora da tabela são exibidos como vieram da fonte. */
export const sectorLabel = (sector: string): string => SECTOR_LABELS[sector] ?? sector;

export const CONNECTION_LABELS: Record<ConnectionStatus, string> = {
  CONNECTING: "Conectando",
  LIVE: "Ao vivo",
  RECONNECTING: "Reconectando",
  OFFLINE: "Sem conexão",
};

export const HEALTH_LABELS: Record<SourceHealth, string> = {
  PENDING: "Aguardando",
  ONLINE: "Operacional",
  STALE: "Dados em cache",
  OFFLINE: "Indisponível",
};

export const INFOCON_LABELS: Record<InfoconLevel, string> = {
  GREEN: "Verde",
  YELLOW: "Amarelo",
  ORANGE: "Laranja",
  RED: "Vermelho",
};

/**
 * Texto para painel sem registros. Distingue "a fonte respondeu e não há
 * nada" de "a fonte ainda não respondeu", que são situações diferentes.
 */
export function emptyMessage(
  snapshot: ThreatSnapshot,
  sourceId: SourceId,
  whenEmpty: string,
): string {
  const health = snapshot.sources.find((source) => source.id === sourceId)?.health;
  if (health === "OFFLINE") return "Fonte indisponível no momento.";
  if (health === "PENDING" || health === undefined)
    return "Aguardando a primeira coleta.";
  return whenEmpty;
}
