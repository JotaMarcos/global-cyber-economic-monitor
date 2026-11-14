import type { SourceId } from "../../contract/threat-snapshot.ts";

export type ObservatoryKind = "THREAT_MAP" | "THREAT_INTEL" | "BLOCKLIST" | "SIEM";

/**
 * Forma de acesso aos dados da plataforma:
 * INTEGRATED: conjunto aberto coletado pelo gateway;
 * PARTIAL: parte integrada, parte condicionada a credencial;
 * EXTERNAL: sem conjunto de dados aberto; consulta apenas no painel do provedor.
 */
export type ObservatoryAccess = "INTEGRATED" | "PARTIAL" | "EXTERNAL";

export interface Observatory {
  readonly id: string;
  readonly name: string;
  readonly organization: string;
  /** País-sede da organização. Nulo quando o operador não é identificado. */
  readonly countryCode: string | null;
  readonly kind: ObservatoryKind;
  readonly access: ObservatoryAccess;
  /** Fontes do gateway alimentadas por esta plataforma. */
  readonly integratedSources: readonly SourceId[];
  readonly description: string;
  readonly url: string;
}

/**
 * Plataformas de monitoramento de ameaças acompanhadas pelo painel. A
 * classificação de acesso registra o que foi verificado: só entram no gateway
 * conjuntos de dados abertos, sem credencial e com termos de uso públicos.
 */
export const OBSERVATORIES: readonly Observatory[] = [
  {
    id: "spamhaus",
    name: "Spamhaus Threat Map e listas DROP",
    organization: "The Spamhaus Project",
    countryCode: "AD",
    kind: "BLOCKLIST",
    access: "INTEGRATED",
    integratedSources: ["spamhaus-drop"],
    description:
      "As listas DROP e ASN-DROP são abertas e estão integradas ao gateway. O mapa de ameaças é visualização do provedor, sem conjunto de dados próprio.",
    url: "https://www.spamhaus.com/threat-map/",
  },
  {
    id: "abuse-ch",
    name: "abuse.ch",
    organization: "abuse.ch / Universidade de Ciências Aplicadas de Berna",
    countryCode: "CH",
    kind: "BLOCKLIST",
    access: "PARTIAL",
    integratedSources: ["abusech-feodo"],
    description:
      "O Feodo Tracker é aberto e está integrado ao gateway. URLhaus e ThreatFox exigem chave de autenticação (Auth-Key) vinculada a uma conta e não são coletados.",
    url: "https://abuse.ch/",
  },
  {
    id: "kaspersky-cybermap",
    name: "Kaspersky Cyberthreat Real-Time Map",
    organization: "Kaspersky",
    countryCode: "RU",
    kind: "THREAT_MAP",
    access: "EXTERNAL",
    integratedSources: [],
    description:
      "Mapa de detecções da telemetria dos produtos do fabricante. Sem conjunto de dados aberto.",
    url: "https://cybermap.kaspersky.com/",
  },
  {
    id: "fortiguard-threat-map",
    name: "FortiGuard Labs Threat Map",
    organization: "Fortinet",
    countryCode: "US",
    kind: "THREAT_MAP",
    access: "EXTERNAL",
    integratedSources: [],
    description:
      "Mapa de eventos observados pela rede de sensores do fabricante. Sem conjunto de dados aberto.",
    url: "https://fortiguard.fortinet.com/threat-map",
  },
  {
    id: "check-point-research",
    name: "Check Point Threat Intelligence & Research",
    organization: "Check Point Software Technologies",
    countryCode: "IL",
    kind: "THREAT_INTEL",
    access: "EXTERNAL",
    integratedSources: [],
    description:
      "Pesquisa e inteligência de ameaças do fabricante, publicadas em relatórios e em painel próprio. Sem conjunto de dados aberto.",
    url: "https://www.checkpoint.com/pt/solutions/threat-intelligence-research/",
  },
  {
    id: "hudson-rock",
    name: "Hudson Rock",
    organization: "Hudson Rock",
    countryCode: "IL",
    kind: "THREAT_INTEL",
    access: "EXTERNAL",
    integratedSources: [],
    description:
      "Inteligência sobre credenciais comprometidas por malware do tipo infostealer, por consulta individual de domínio ou e-mail. Sem conjunto agregado aberto.",
    url: "https://www.hudsonrock.com/",
  },
  {
    id: "cyberattackmap",
    name: "Cyber Attack Map",
    organization: "cyberattackmap.net",
    countryCode: null,
    kind: "THREAT_MAP",
    access: "EXTERNAL",
    integratedSources: [],
    description:
      "Página de visualização de ataques em mapa. Operador, origem dos dados e metodologia não foram verificados.",
    url: "https://cyberattackmap.net/br/",
  },
  {
    id: "datadog-security",
    name: "Datadog Cloud SIEM",
    organization: "Datadog",
    countryCode: "US",
    kind: "SIEM",
    access: "EXTERNAL",
    integratedSources: [],
    description:
      "Plataforma comercial de detecção e postura de segurança do ambiente do próprio cliente. Requer conta e não publica dados globais de ameaças.",
    url: "https://www.datadoghq.com/dg/security/cyber-security-threats/",
  },
];
