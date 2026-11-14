import type {
  Attacker,
  C2Server,
  CriticalCve,
  ExploitedVulnerability,
} from "../../contract/threat-snapshot.ts";

export type FeedSeverity = "CRITICAL" | "HIGH" | "MEDIUM";
export type FeedCategory = "VULNERABILITY" | "C2" | "ATTACK_SOURCE";

export interface FeedItem {
  readonly key: string;
  readonly category: FeedCategory;
  readonly severity: FeedSeverity;
  /** Indicador principal: CVE, IP:porta ou IP. */
  readonly indicator: string;
  readonly source: string;
  readonly title: string;
  readonly detail: string;
  /** Situação atual informada pela fonte, quando houver (ex.: servidor ativo). */
  readonly active: boolean | null;
}

export interface FeedInput {
  readonly knownExploited: readonly ExploitedVulnerability[];
  readonly criticalCves: readonly CriticalCve[];
  readonly c2Servers: readonly C2Server[];
  readonly topAttackers: readonly Attacker[];
}

/** Limiares de severidade das origens de ataque, por volume de registros no DShield. */
const ATTACKER_CRITICAL_REPORTS = 100_000;
const ATTACKER_HIGH_REPORTS = 10_000;
const CVSS_CRITICAL = 9;
const INTEGER = new Intl.NumberFormat("pt-BR");

const SEVERITY_ORDER: Record<FeedSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };

/**
 * Unifica as fontes de indicadores em um único feed, com severidade derivada
 * de critérios objetivos de cada fonte. Ordena do mais grave para o menos
 * grave, preservando a ordem original da fonte dentro da mesma severidade.
 */
export function buildThreatFeed(input: FeedInput): FeedItem[] {
  const vulnerabilities: FeedItem[] = input.knownExploited.map((entry) => ({
    key: `kev|${entry.cveId}`,
    category: "VULNERABILITY",
    severity: entry.ransomwareUse ? "CRITICAL" : "HIGH",
    indicator: entry.cveId,
    source: "CISA KEV",
    title: `${entry.vendor} ${entry.product}`,
    detail: entry.ransomwareUse
      ? `${entry.name} · usada em ransomware`
      : `${entry.name} · exploração ativa confirmada`,
    active: null,
  }));

  const cves: FeedItem[] = input.criticalCves.map((cve) => ({
    key: `nvd|${cve.cveId}`,
    category: "VULNERABILITY",
    severity: cve.score >= CVSS_CRITICAL ? "CRITICAL" : "HIGH",
    indicator: cve.cveId,
    source: "NIST NVD",
    title: `CVSS ${cve.score.toFixed(1)}`,
    detail: cve.summary,
    active: null,
  }));

  const c2: FeedItem[] = input.c2Servers.map((server) => ({
    key: `c2|${server.ip}:${server.port}`,
    category: "C2",
    severity: server.online ? "CRITICAL" : "MEDIUM",
    indicator: `${server.ip}:${server.port}`,
    source: "abuse.ch Feodo",
    title: `Servidor de comando e controle ${server.malware}`,
    detail: server.network,
    active: server.online,
  }));

  const attackers: FeedItem[] = input.topAttackers.map((attacker) => ({
    key: `dshield|${attacker.ip}`,
    category: "ATTACK_SOURCE",
    severity:
      attacker.reports >= ATTACKER_CRITICAL_REPORTS
        ? "CRITICAL"
        : attacker.reports >= ATTACKER_HIGH_REPORTS
          ? "HIGH"
          : "MEDIUM",
    indicator: attacker.ip,
    source: "SANS ISC / DShield",
    title: `Origem de ataques nº ${attacker.rank}`,
    detail: `${INTEGER.format(attacker.reports)} registros contra ${INTEGER.format(attacker.targets)} alvos`,
    active: null,
  }));

  return [...vulnerabilities, ...cves, ...c2, ...attackers]
    .map((item, position) => ({ item, position }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.item.severity] - SEVERITY_ORDER[b.item.severity] ||
        a.position - b.position,
    )
    .map(({ item }) => item);
}
