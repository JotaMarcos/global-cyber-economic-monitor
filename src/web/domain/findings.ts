import type {
  CriticalCve,
  HijackedNetworks,
  SourceStatus,
} from "../../contract/threat-snapshot.ts";

export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM";

export type FindingKind =
  | "RANSOMWARE_DISCLOSURES"
  | "ONLINE_C2"
  | "CRITICAL_CVES"
  | "RANSOMWARE_VULNERABILITIES"
  | "BLOCKED_ASNS"
  | "HIJACKED_NETWORKS"
  | "OFFLINE_SOURCES";

export interface Finding {
  readonly kind: FindingKind;
  readonly severity: FindingSeverity;
  /** Quantidade de registros que sustentam o achado. */
  readonly count: number;
  /** O achado acompanha o recorte geográfico selecionado nos filtros. */
  readonly scoped: boolean;
}

export interface FindingsInput {
  /** Incidentes e servidores já restritos ao recorte dos filtros. */
  readonly incidents: number;
  readonly c2ServersOnline: number;
  readonly blockedAsns: number;
  readonly criticalCves: readonly CriticalCve[];
  readonly ransomwareLinkedVulnerabilities: number;
  readonly hijackedNetworks: Pick<HijackedNetworks, "networkCount">;
  readonly sources: readonly SourceStatus[];
}

const CVSS_CRITICAL = 9;
const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
};

/**
 * Achados em aberto: cada um é uma contagem direta de registros das fontes,
 * sem ponderação. Achados sem registros são omitidos. A ordem é por
 * severidade e, dentro dela, por quantidade.
 */
export function buildFindings(input: FindingsInput): Finding[] {
  const candidates: Finding[] = [
    {
      kind: "RANSOMWARE_DISCLOSURES",
      severity: "CRITICAL",
      count: input.incidents,
      scoped: true,
    },
    {
      kind: "ONLINE_C2",
      severity: "CRITICAL",
      count: input.c2ServersOnline,
      scoped: true,
    },
    {
      kind: "CRITICAL_CVES",
      severity: "CRITICAL",
      count: input.criticalCves.filter((cve) => cve.score >= CVSS_CRITICAL).length,
      scoped: false,
    },
    {
      kind: "RANSOMWARE_VULNERABILITIES",
      severity: "HIGH",
      count: input.ransomwareLinkedVulnerabilities,
      scoped: false,
    },
    { kind: "BLOCKED_ASNS", severity: "HIGH", count: input.blockedAsns, scoped: true },
    {
      kind: "HIJACKED_NETWORKS",
      severity: "HIGH",
      count: input.hijackedNetworks.networkCount,
      scoped: false,
    },
    {
      kind: "OFFLINE_SOURCES",
      severity: "MEDIUM",
      count: input.sources.filter((source) => source.health === "OFFLINE").length,
      scoped: false,
    },
  ];

  return candidates
    .filter((finding) => finding.count > 0)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count,
    );
}
