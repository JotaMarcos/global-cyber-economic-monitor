import { describe, expect, it } from "vitest";
import {
  BLOCKED_MARKER,
  INVALID_IP_MARKER,
  isMaliciousPayload,
  sanitizeIp,
  sanitizeText,
} from "../../src/domain/security/sanitizer";

describe("sanitizeText", () => {
  it("remove caracteres usados em injeção de HTML", () => {
    expect(sanitizeText(`<img src="x">`)).toBe("img src=x");
  });

  it.each([
    "javascript:alert(1)",
    "onerror=steal()",
    "onload=run()",
    "eval(code)",
    "1 UNION  SELECT pass",
    "DROP TABLE users",
  ])("bloqueia o padrão de injeção em %s", (payload) => {
    expect(sanitizeText(payload)).toContain(BLOCKED_MARKER);
  });

  it("apara espaços e limita o comprimento", () => {
    expect(sanitizeText("  abcdef  ", 3)).toBe("abc");
  });

  it.each([null, undefined, 42, {}])(
    "devolve vazio para entrada não textual %s",
    (input) => {
      expect(sanitizeText(input)).toBe("");
    },
  );

  it("preserva texto legítimo com acentuação", () => {
    expect(sanitizeText("São Paulo - Finanças")).toBe("São Paulo - Finanças");
  });
});

describe("sanitizeIp", () => {
  it.each(["185.220.101.42", "0.0.0.0", "255.255.255.255", " 10.0.0.1 "])(
    "aceita o IPv4 %s",
    (ip) => {
      expect(sanitizeIp(ip)).toBe(ip.trim());
    },
  );

  it("aceita IPv6", () => {
    expect(sanitizeIp("2001:db8::ff00:42:8329")).toBe("2001:db8::ff00:42:8329");
  });

  it.each(["256.1.1.1", "1.2.3", "<script>", "1.2.3.4; DROP TABLE", ""])(
    "descarta o valor inválido %s",
    (ip) => {
      expect(sanitizeIp(ip)).toBe(INVALID_IP_MARKER);
    },
  );

  it("usa endereço neutro para entrada não textual", () => {
    expect(sanitizeIp(undefined)).toBe("0.0.0.0");
  });
});

describe("isMaliciousPayload", () => {
  it("identifica carga com script", () => {
    expect(isMaliciousPayload("<script>fetch('http://evil.tld')</script>")).toBe(true);
  });

  it("não acusa texto inofensivo", () => {
    expect(isMaliciousPayload("Manaus")).toBe(false);
  });
});
