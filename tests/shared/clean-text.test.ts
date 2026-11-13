import { describe, expect, it } from "vitest";
import { cleanText, isIpAddress, toHttpUrl } from "../../src/shared/text/clean-text.ts";

describe("cleanText", () => {
  it("remove delimitadores de marcação", () => {
    expect(cleanText("<script>alert(1)</script>")).toBe("scriptalert(1)/script");
  });

  it("remove caracteres de controle e marcadores de direção", () => {
    const withControls = `Empresa${String.fromCharCode(0)}${String.fromCharCode(0x202e)}Nome`;
    expect(cleanText(withControls)).toBe("Empresa Nome");
  });

  it("colapsa espaços, apara e limita o comprimento", () => {
    expect(cleanText("  a   b\n\tc  ")).toBe("a b c");
    expect(cleanText("abcdef", 3)).toBe("abc");
  });

  it("preserva apóstrofos, acentos e pontuação legítima", () => {
    expect(cleanText("O'Reilly & Cia. São Paulo")).toBe("O'Reilly & Cia. São Paulo");
  });

  it.each([null, undefined, 42, {}])(
    "devolve vazio para entrada não textual %s",
    (input) => {
      expect(cleanText(input)).toBe("");
    },
  );
});

describe("isIpAddress", () => {
  it.each(["185.220.101.42", "0.0.0.0", "255.255.255.255", "2001:db8::ff00:42:8329"])(
    "aceita %s",
    (ip) => expect(isIpAddress(ip)).toBe(true),
  );

  it.each(["256.1.1.1", "1.2.3", "abc", "<script>", "", 42, null])("rejeita %s", (ip) =>
    expect(isIpAddress(ip)).toBe(false),
  );
});

describe("toHttpUrl", () => {
  it("aceita http e https", () => {
    expect(toHttpUrl("https://cert.br/")).toBe("https://cert.br/");
    expect(toHttpUrl(" http://exemplo.org/a ")).toBe("http://exemplo.org/a");
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,x",
    "ftp://x.org",
    "sem esquema",
    "",
    null,
  ])("descarta %s", (input) => expect(toHttpUrl(input)).toBeNull());
});
