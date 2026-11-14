import type { SourceId, SourceStatus } from "../../contract/threat-snapshot.ts";

export const CONTROL_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type ControlSeverity = (typeof CONTROL_SEVERITIES)[number];

export type ControlRule = "COLLECTION" | "CIRCUIT" | "FRESHNESS" | "VALIDATION";

/** Tolerância de atualização: dois ciclos de coleta sem sucesso. */
const FRESHNESS_CYCLES = 2;

interface RuleDefinition {
  readonly rule: ControlRule;
  readonly severity: ControlSeverity;
  passes(source: SourceStatus, evaluatedAt: number): boolean;
}

/**
 * Controles verificados em cada fonte. A severidade reflete o efeito da falha
 * sobre o painel: sem coleta não há dado; circuito aberto suspende a coleta;
 * dado antigo e registro rejeitado reduzem a confiança no que é exibido.
 */
const RULES: readonly RuleDefinition[] = [
  {
    rule: "COLLECTION",
    severity: "CRITICAL",
    passes: (source) => source.health === "ONLINE",
  },
  {
    rule: "CIRCUIT",
    severity: "HIGH",
    passes: (source) => source.circuitState === "CLOSED",
  },
  {
    rule: "FRESHNESS",
    severity: "MEDIUM",
    passes: (source, evaluatedAt) =>
      source.lastSuccessAt !== null &&
      evaluatedAt - Date.parse(source.lastSuccessAt) <=
        FRESHNESS_CYCLES * source.refreshIntervalSeconds * 1000,
  },
  {
    rule: "VALIDATION",
    severity: "LOW",
    passes: (source) => source.rejectedCount === 0,
  },
];

export interface PostureControl {
  /** Identificador hierárquico: posição da fonte e do controle (ex.: "3.2"). */
  readonly id: string;
  readonly rule: ControlRule;
  readonly severity: ControlSeverity;
  readonly passed: boolean;
}

export interface PostureGroup {
  readonly sourceId: SourceId;
  readonly sourceName: string;
  readonly controls: readonly PostureControl[];
  readonly passed: number;
}

export interface SeverityTally {
  readonly severity: ControlSeverity;
  readonly passed: number;
  readonly total: number;
}

export interface Posture {
  /** Percentual de controles aprovados, de 0 a 100. Nulo sem fontes avaliadas. */
  readonly score: number | null;
  readonly passed: number;
  readonly total: number;
  readonly bySeverity: readonly SeverityTally[];
  readonly groups: readonly PostureGroup[];
}

/**
 * Postura do monitoramento: proporção de controles operacionais aprovados no
 * conjunto das fontes. Mede a confiabilidade da coleta, não o nível de ameaça.
 */
export function buildPosture(
  sources: readonly SourceStatus[],
  evaluatedAt: string,
): Posture {
  const instant = Date.parse(evaluatedAt);
  const groups: PostureGroup[] = sources.map((source, sourceIndex) => {
    const controls = RULES.map((definition, ruleIndex) => ({
      id: `${sourceIndex + 1}.${ruleIndex + 1}`,
      rule: definition.rule,
      severity: definition.severity,
      passed: definition.passes(source, instant),
    }));
    return {
      sourceId: source.id,
      sourceName: source.name,
      controls,
      passed: controls.filter((control) => control.passed).length,
    };
  });

  const all = groups.flatMap((group) => group.controls);
  const passed = all.filter((control) => control.passed).length;

  return {
    score: all.length === 0 ? null : (passed / all.length) * 100,
    passed,
    total: all.length,
    bySeverity: CONTROL_SEVERITIES.map((severity) => {
      const ofSeverity = all.filter((control) => control.severity === severity);
      return {
        severity,
        passed: ofSeverity.filter((control) => control.passed).length,
        total: ofSeverity.length,
      };
    }),
    groups,
  };
}
