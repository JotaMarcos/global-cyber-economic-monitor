import { z } from "zod";

/**
 * Contrato público entre o gateway e o dashboard (linguagem publicada).
 * Os dois lados validam contra estes esquemas: o gateway antes de servir e o
 * dashboard ao receber.
 */
export const CONTRACT_VERSION = "2";

const timestamp = z.iso.datetime({ offset: true });
const calendarDate = z.iso.date();
const countryCode = z.string().regex(/^[A-Z]{2}$/);

export const SOURCE_IDS = [
  "ransomware-live",
  "cisa-kev",
  "nist-nvd",
  "sans-isc",
  "abusech-feodo",
  "first-teams",
  "ibge-localidades",
] as const;
export const sourceIdSchema = z.enum(SOURCE_IDS);

export const sourceHealthSchema = z.enum(["PENDING", "ONLINE", "STALE", "OFFLINE"]);
export const circuitStateSchema = z.enum(["CLOSED", "OPEN", "HALF-OPEN"]);
export const infoconLevelSchema = z.enum(["GREEN", "YELLOW", "ORANGE", "RED"]);

export const sourceStatusSchema = z.object({
  id: sourceIdSchema,
  name: z.string(),
  organization: z.string(),
  homeCountry: countryCode,
  dataset: z.string(),
  url: z.url(),
  refreshIntervalSeconds: z.number().int().positive(),
  health: sourceHealthSchema,
  circuitState: circuitStateSchema,
  lastAttemptAt: timestamp.nullable(),
  lastSuccessAt: timestamp.nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  recordCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
});

/** Organização listada publicamente como vítima por um grupo de ransomware. */
export const incidentSchema = z.object({
  id: z.string().min(1),
  organization: z.string().min(1),
  countryCode: countryCode.nullable(),
  sector: z.string().min(1),
  threatGroup: z.string().min(1),
  discoveredAt: timestamp,
  reportedAttackAt: timestamp.nullable(),
});

export const exploitedVulnerabilitySchema = z.object({
  cveId: z.string().regex(/^CVE-\d{4}-\d{4,}$/),
  vendor: z.string(),
  product: z.string(),
  name: z.string(),
  dateAdded: calendarDate,
  dueDate: calendarDate.nullable(),
  ransomwareUse: z.boolean(),
});

export const criticalCveSchema = z.object({
  cveId: z.string().regex(/^CVE-\d{4}-\d{4,}$/),
  publishedAt: timestamp,
  score: z.number().min(0).max(10),
  summary: z.string(),
});

export const c2ServerSchema = z.object({
  ip: z.string().min(1),
  port: z.number().int().min(1).max(65_535),
  online: z.boolean(),
  countryCode: countryCode.nullable(),
  malware: z.string(),
  network: z.string(),
  lastOnline: calendarDate.nullable(),
});

export const attackerSchema = z.object({
  rank: z.number().int().positive(),
  ip: z.string().min(1),
  reports: z.number().int().nonnegative(),
  targets: z.number().int().nonnegative(),
});

export const agencySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  host: z.string(),
  countryCode,
  types: z.array(z.string()),
  website: z.url().nullable(),
});

/** Parâmetro usado para estimar prejuízo. Não é perda apurada. */
export const lossReferenceSchema = z.object({
  perIncidentUsd: z.number().positive(),
  source: z.string(),
});

export const threatSnapshotSchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  generatedAt: timestamp,
  sources: z.array(sourceStatusSchema),
  infoconLevel: infoconLevelSchema.nullable(),
  incidents: z.array(incidentSchema),
  knownExploited: z.object({
    total: z.number().int().nonnegative(),
    ransomwareLinked: z.number().int().nonnegative(),
    recent: z.array(exploitedVulnerabilitySchema),
  }),
  criticalCves: z.array(criticalCveSchema),
  c2Servers: z.array(c2ServerSchema),
  topAttackers: z.array(attackerSchema),
  lossReference: lossReferenceSchema,
});

export const agencyDirectorySchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  generatedAt: timestamp,
  agencies: z.array(agencySchema),
});

/** Município da divisão territorial oficial, identificado pelo código IBGE. */
export const municipalitySchema = z.object({
  id: z.string().regex(/^\d{7}$/),
  name: z.string().min(1),
});

/** Unidade subnacional (no Brasil, unidade da federação) com seus municípios. */
export const subdivisionSchema = z.object({
  code: z.string().regex(/^[A-Z]{2}$/),
  name: z.string().min(1),
  municipalities: z.array(municipalitySchema),
});

/**
 * Divisão territorial oficial de um país. Serve apenas de referência para os
 * filtros: nenhuma fonte de incidentes informa localização abaixo do país.
 */
export const territoryDirectorySchema = z.object({
  contractVersion: z.literal(CONTRACT_VERSION),
  generatedAt: timestamp,
  countryCode,
  authority: z.string(),
  subdivisions: z.array(subdivisionSchema),
});

export type SourceId = z.infer<typeof sourceIdSchema>;
export type SourceHealth = z.infer<typeof sourceHealthSchema>;
export type CircuitState = z.infer<typeof circuitStateSchema>;
export type InfoconLevel = z.infer<typeof infoconLevelSchema>;
export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type Incident = z.infer<typeof incidentSchema>;
export type ExploitedVulnerability = z.infer<typeof exploitedVulnerabilitySchema>;
export type CriticalCve = z.infer<typeof criticalCveSchema>;
export type C2Server = z.infer<typeof c2ServerSchema>;
export type Attacker = z.infer<typeof attackerSchema>;
export type Agency = z.infer<typeof agencySchema>;
export type LossReference = z.infer<typeof lossReferenceSchema>;
export type ThreatSnapshot = z.infer<typeof threatSnapshotSchema>;
export type AgencyDirectory = z.infer<typeof agencyDirectorySchema>;
export type Municipality = z.infer<typeof municipalitySchema>;
export type Subdivision = z.infer<typeof subdivisionSchema>;
export type TerritoryDirectory = z.infer<typeof territoryDirectorySchema>;
