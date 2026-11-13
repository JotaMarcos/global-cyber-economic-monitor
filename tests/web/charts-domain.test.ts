import { describe, expect, it } from "vitest";
import { buildPressureSeries } from "../../src/web/domain/pressure-series.ts";
import { buildThreatFeed } from "../../src/web/domain/threat-feed-items.ts";
import { makeIncident } from "../support/fakes.ts";

describe("buildPressureSeries", () => {
  const now = new Date("2026-11-13T12:40:00.000Z");

  it("conta eventos por hora em janela que termina na hora corrente", () => {
    const series = buildPressureSeries(
      [
        makeIncident({ id: "a", discoveredAt: "2026-11-13T12:05:00.000Z" }),
        makeIncident({ id: "b", discoveredAt: "2026-11-13T12:30:00.000Z" }),
        makeIncident({ id: "c", discoveredAt: "2026-11-13T10:59:00.000Z" }),
      ],
      [
        {
          cveId: "CVE-2026-1",
          publishedAt: "2026-11-13T10:00:00.000Z",
          score: 9.8,
          summary: "",
        },
      ],
      now,
      3,
    );

    expect(series).toEqual([
      { hourStart: "2026-11-13T10:00:00.000Z", incidents: 1, criticalCves: 1 },
      { hourStart: "2026-11-13T11:00:00.000Z", incidents: 0, criticalCves: 0 },
      { hourStart: "2026-11-13T12:00:00.000Z", incidents: 2, criticalCves: 0 },
    ]);
  });

  it("ignora eventos fora da janela e datas inválidas", () => {
    const series = buildPressureSeries(
      [
        makeIncident({ id: "antigo", discoveredAt: "2026-11-01T00:00:00.000Z" }),
        makeIncident({ id: "futuro", discoveredAt: "2026-11-14T00:00:00.000Z" }),
        makeIncident({ id: "invalido", discoveredAt: "sem data" }),
      ],
      [],
      now,
      2,
    );

    expect(series.every((point) => point.incidents === 0)).toBe(true);
  });
});

describe("buildThreatFeed", () => {
  it("deriva a severidade de critérios objetivos e ordena da mais grave", () => {
    const feed = buildThreatFeed({
      knownExploited: [
        {
          cveId: "CVE-2026-2",
          vendor: "V",
          product: "P",
          name: "Falha",
          dateAdded: "2026-11-10",
          dueDate: null,
          ransomwareUse: false,
        },
      ],
      criticalCves: [
        {
          cveId: "CVE-2026-3",
          publishedAt: "2026-11-13T00:00:00.000Z",
          score: 9.1,
          summary: "s",
        },
      ],
      c2Servers: [
        {
          ip: "1.1.1.1",
          port: 443,
          online: false,
          countryCode: "US",
          malware: "QakBot",
          network: "AS1",
          lastOnline: null,
        },
      ],
      topAttackers: [
        { rank: 1, ip: "2.2.2.2", reports: 150_000, targets: 3 },
        { rank: 2, ip: "3.3.3.3", reports: 20_000, targets: 1 },
        { rank: 3, ip: "4.4.4.4", reports: 10, targets: 1 },
      ],
    });

    expect(feed.map((item) => [item.indicator, item.severity])).toEqual([
      ["CVE-2026-3", "CRITICAL"],
      ["2.2.2.2", "CRITICAL"],
      ["CVE-2026-2", "HIGH"],
      ["3.3.3.3", "HIGH"],
      ["1.1.1.1:443", "MEDIUM"],
      ["4.4.4.4", "MEDIUM"],
    ]);
    expect(feed.find((item) => item.category === "C2")?.active).toBe(false);
  });
});
