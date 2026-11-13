import { describe, expect, it } from "vitest";
import {
  appendToWindow,
  MAX_SERIES_POINTS,
  nextTelemetryPoint,
  type TelemetryPoint,
} from "../../src/domain/telemetry/telemetry-point";
import {
  DDOS_BURST_SIZE,
  estimateBurstSize,
  inspectBurst,
} from "../../src/domain/security/traffic-inspection";

const point = (overrides: Partial<TelemetryPoint> = {}): TelemetryPoint => ({
  time: "12:00:00",
  economicIndex: 100,
  cyberAttacksPerMin: 400,
  mitigatedRate: 99.89,
  ...overrides,
});

const sample = {
  timeLabel: "12:00:02",
  economicNoise: 0.46,
  attackNoise: 0,
  ddosSimulationActive: false,
};

describe("nextTelemetryPoint", () => {
  it("mantém o índice quando o ruído equivale ao viés", () => {
    expect(nextTelemetryPoint(point(), sample)).toEqual({
      time: "12:00:02",
      economicIndex: 100,
      cyberAttacksPerMin: 310,
      mitigatedRate: 99.89,
    });
  });

  it("limita o índice econômico ao piso e ao teto", () => {
    const floor = nextTelemetryPoint(point({ economicIndex: 92 }), {
      ...sample,
      economicNoise: 0,
    });
    const ceiling = nextTelemetryPoint(point({ economicIndex: 135 }), {
      ...sample,
      economicNoise: 0.99,
    });

    expect(floor.economicIndex).toBe(92);
    expect(ceiling.economicIndex).toBe(135);
  });

  it("eleva a carga de ataques durante a simulação de DDoS", () => {
    const result = nextTelemetryPoint(point(), {
      ...sample,
      attackNoise: 0.5,
      ddosSimulationActive: true,
    });

    expect(result.cyberAttacksPerMin).toBe(2075);
    expect(result.mitigatedRate).toBe(99.94);
  });

  it("parte do índice padrão quando a série está vazia", () => {
    expect(nextTelemetryPoint(undefined, sample).economicIndex).toBe(106);
  });
});

describe("appendToWindow", () => {
  it("acrescenta sem descartar enquanto houver espaço", () => {
    expect(appendToWindow([point({ time: "a" })], point({ time: "b" }))).toHaveLength(2);
  });

  it("mantém o tamanho máximo descartando o ponto mais antigo", () => {
    const full = Array.from({ length: MAX_SERIES_POINTS }, (_, i) =>
      point({ time: `t${i}` }),
    );
    const result = appendToWindow(full, point({ time: "novo" }));

    expect(result).toHaveLength(MAX_SERIES_POINTS);
    expect(result[0]?.time).toBe("t1");
    expect(result.at(-1)?.time).toBe("novo");
  });

  it("não altera a série original", () => {
    const original = [point()];
    appendToWindow(original, point());
    expect(original).toHaveLength(1);
  });
});

describe("inspeção de tráfego", () => {
  it("estima rajada normal entre 25 e 59 requisições", () => {
    expect(estimateBurstSize(false, 0)).toBe(25);
    expect(estimateBurstSize(false, 0.999)).toBe(59);
  });

  it("usa rajada fixa durante a simulação de DDoS", () => {
    expect(estimateBurstSize(true, 0.1)).toBe(DDOS_BURST_SIZE);
  });

  it("aceita toda a rajada quando há capacidade", () => {
    expect(inspectBurst(30, false, () => true)).toEqual({
      burstSize: 30,
      accepted: 30,
      dropped: 0,
      maliciousBlocked: 0,
    });
  });

  it("descarta o que excede a capacidade de admissão", () => {
    let budget = 10;
    const result = inspectBurst(30, false, () => budget-- > 0);
    expect(result).toMatchObject({ accepted: 10, dropped: 20 });
  });

  it("descarta sem inspeção o excedente de uma rajada volumétrica e bloqueia cargas maliciosas", () => {
    let admissions = 0;
    const result = inspectBurst(DDOS_BURST_SIZE, true, () => {
      admissions += 1;
      return true;
    });

    expect(admissions).toBe(120);
    expect(result.accepted).toBe(120);
    expect(result.dropped).toBe(DDOS_BURST_SIZE - 120);
    expect(result.maliciousBlocked).toBe(14); // índices 0, 9, ..., 117
  });
});
