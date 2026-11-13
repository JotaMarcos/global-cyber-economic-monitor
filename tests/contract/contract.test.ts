import { describe, expect, it } from "vitest";
import {
  agencyDirectorySchema,
  CONTRACT_VERSION,
  incidentSchema,
  threatSnapshotSchema,
} from "../../src/contract/threat-snapshot.ts";
import { makeAgency, makeIncident, makeSnapshot } from "../support/fakes.ts";

describe("contrato do retrato de ameaças", () => {
  it("aceita um retrato íntegro", () => {
    expect(threatSnapshotSchema.safeParse(makeSnapshot()).success).toBe(true);
  });

  it("rejeita versão de contrato divergente", () => {
    const result = threatSnapshotSchema.safeParse({
      ...makeSnapshot(),
      contractVersion: "0",
    });
    expect(result.success).toBe(false);
  });

  it.each([
    ["país fora do padrão ISO", { countryCode: "Brasil" }],
    ["data sem fuso", { discoveredAt: "2026-11-12 10:00:00" }],
    ["organização vazia", { organization: "" }],
  ])("rejeita incidente com %s", (_caso, patch) => {
    expect(incidentSchema.safeParse({ ...makeIncident(), ...patch }).success).toBe(false);
  });

  it("aceita incidente sem país informado", () => {
    expect(incidentSchema.safeParse(makeIncident({ countryCode: null })).success).toBe(
      true,
    );
  });

  it("rejeita referência de prejuízo não positiva", () => {
    const snapshot = makeSnapshot({ lossReference: { perIncidentUsd: 0, source: "x" } });
    expect(threatSnapshotSchema.safeParse(snapshot).success).toBe(false);
  });

  it("valida o diretório de agências e recusa site com esquema inseguro", () => {
    const directory = {
      contractVersion: CONTRACT_VERSION,
      generatedAt: "2026-11-13T12:00:00.000Z",
      agencies: [makeAgency()],
    };
    expect(agencyDirectorySchema.safeParse(directory).success).toBe(true);
    expect(
      agencyDirectorySchema.safeParse({
        ...directory,
        agencies: [makeAgency({ website: "não é url" })],
      }).success,
    ).toBe(false);
  });
});
