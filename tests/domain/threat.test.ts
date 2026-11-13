import { describe, expect, it } from "vitest";
import { INVALID_IP_MARKER } from "../../src/domain/security/sanitizer";
import { parseInfoconLevel } from "../../src/domain/threat/infocon-level";
import {
  createThreatLogFromAttacker,
  isThreatLog,
  MAX_THREAT_LOGS,
  mergeThreatLogs,
} from "../../src/domain/threat/threat-log";
import { makeThreatLog } from "../support/fakes";

describe("parseInfoconLevel", () => {
  it.each([
    ["green", "GREEN"],
    [" Yellow ", "YELLOW"],
    ["ORANGE", "ORANGE"],
    ["red", "RED"],
  ])("normaliza %s para %s", (raw, expected) => {
    expect(parseInfoconLevel(raw)).toBe(expected);
  });

  it.each(["purple", "", null, 3, "<script>"])("rejeita o valor %s", (raw) => {
    expect(parseInfoconLevel(raw)).toBeNull();
  });
});

describe("createThreatLogFromAttacker", () => {
  const record = { sourceIp: "45.142.212.91", targetPort: 8080, eventCount: 1500 };

  it("converte um registro válido", () => {
    expect(createThreatLogFromAttacker(record, 0, "batch")).toEqual({
      id: "sans-batch-0",
      agency: "SANS ISC / DShield (Live)",
      ip: "45.142.212.91",
      port: 8080,
      threatType: "DShield Top Attacker (1500 eventos)",
      targetSector: "TERCIARIO",
      severity: "CRÍTICA",
      status: "BLOQUEADO",
    });
  });

  it("classifica como crítica apenas as duas primeiras posições", () => {
    const severities = [0, 1, 2, 3].map(
      (rank) => createThreatLogFromAttacker(record, rank, "b").severity,
    );
    expect(severities).toEqual(["CRÍTICA", "CRÍTICA", "ALTA", "ALTA"]);
  });

  it("alterna o setor-alvo conforme a posição", () => {
    const sectors = [0, 1, 2, 3, 4].map(
      (rank) => createThreatLogFromAttacker(record, rank, "b").targetSector,
    );
    expect(sectors).toEqual(["TERCIARIO", "SECUNDARIO", "PRIMARIO", "ONG", "TERCIARIO"]);
  });

  it("neutraliza campos maliciosos ou ausentes", () => {
    const log = createThreatLogFromAttacker(
      { sourceIp: "<script>alert(1)</script>", targetPort: "99999", eventCount: "<b>" },
      0,
      "b",
    );
    expect(log.ip).toBe(INVALID_IP_MARKER);
    expect(log.port).toBe(443);
    expect(log.threatType).toBe("DShield Top Attacker (N/D eventos)");
  });
});

describe("mergeThreatLogs", () => {
  it("posiciona os novos registros no topo", () => {
    const merged = mergeThreatLogs(
      [makeThreatLog({ id: "novo" })],
      [makeThreatLog({ id: "antigo" })],
    );
    expect(merged.map((log) => log.id)).toEqual(["novo", "antigo"]);
  });

  it("descarta o excedente mais antigo", () => {
    const current = Array.from({ length: MAX_THREAT_LOGS }, (_, index) =>
      makeThreatLog({ id: `antigo-${index}` }),
    );
    const merged = mergeThreatLogs([makeThreatLog({ id: "novo" })], current);

    expect(merged).toHaveLength(MAX_THREAT_LOGS);
    expect(merged.at(-1)?.id).toBe(`antigo-${MAX_THREAT_LOGS - 2}`);
  });
});

describe("isThreatLog", () => {
  it("aceita um registro íntegro", () => {
    expect(isThreatLog(makeThreatLog())).toBe(true);
  });

  it.each([
    null,
    "texto",
    { ...makeThreatLog(), port: "443" },
    { ...makeThreatLog(), severity: "DESCONHECIDA" },
    { ...makeThreatLog(), targetSector: "OUTRO" },
    { ...makeThreatLog(), status: "ABERTO" },
  ])("rejeita o valor adulterado %#", (value) => {
    expect(isThreatLog(value)).toBe(false);
  });
});
