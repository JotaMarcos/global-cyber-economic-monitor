import type {
  InfoconLevel,
  RegistryId,
  SourceHealth,
  SourceId,
  ThreatSnapshot,
} from "../../contract/threat-snapshot.ts";
import type { ConnectionStatus } from "../application/threat-feed.ts";
import type { FindingKind } from "../domain/findings.ts";
import type { ContinentId } from "../domain/geography.ts";
import type { ObservatoryAccess, ObservatoryKind } from "../domain/observatories.ts";
import type { ControlRule, ControlSeverity } from "../domain/posture.ts";

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

export const SEVERITY_LABELS: Record<ControlSeverity, string> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
};

export const CONTROL_RULE_LABELS: Record<ControlRule, string> = {
  COLLECTION: "A última coleta da fonte deve ter sido concluída com sucesso",
  CIRCUIT: "O circuit breaker da fonte deve permanecer fechado",
  FRESHNESS: "Os dados devem ter no máximo dois ciclos de coleta",
  VALIDATION: "Nenhum registro deve ser rejeitado na validação por esquema",
};

export const FINDING_LABELS: Record<
  FindingKind,
  { readonly title: string; readonly source: string }
> = {
  RANSOMWARE_DISCLOSURES: {
    title: "Organizações divulgadas por grupos de ransomware",
    source: "Ransomware.live",
  },
  ONLINE_C2: {
    title: "Servidores de comando e controle de botnet online",
    source: "abuse.ch Feodo",
  },
  CRITICAL_CVES: {
    title: "Vulnerabilidades recentes com CVSS igual ou superior a 9",
    source: "NIST NVD",
  },
  RANSOMWARE_VULNERABILITIES: {
    title: "Vulnerabilidades exploradas com uso conhecido em ransomware",
    source: "CISA KEV",
  },
  BLOCKED_ASNS: {
    title: "Sistemas autônomos controlados por operações maliciosas",
    source: "Spamhaus ASN-DROP",
  },
  HIJACKED_NETWORKS: {
    title: "Redes sequestradas ou cedidas a operações maliciosas",
    source: "Spamhaus DROP",
  },
  OFFLINE_SOURCES: {
    title: "Fontes de dados sem resposta",
    source: "Gateway de ingestão",
  },
};

export const REGISTRY_LABELS: Record<RegistryId, string> = {
  afrinic: "AFRINIC (África)",
  apnic: "APNIC (Ásia-Pacífico)",
  arin: "ARIN (América do Norte)",
  lacnic: "LACNIC (América Latina e Caribe)",
  ripencc: "RIPE NCC (Europa e Oriente Médio)",
};

export const OBSERVATORY_KIND_LABELS: Record<ObservatoryKind, string> = {
  THREAT_MAP: "Mapa de ameaças",
  THREAT_INTEL: "Inteligência de ameaças",
  BLOCKLIST: "Listas de bloqueio",
  SIEM: "SIEM comercial",
};

export const OBSERVATORY_ACCESS_LABELS: Record<ObservatoryAccess, string> = {
  INTEGRATED: "Integrada ao gateway",
  PARTIAL: "Parcialmente integrada",
  EXTERNAL: "Painel externo, sem dados abertos",
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
