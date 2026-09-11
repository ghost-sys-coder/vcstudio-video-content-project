import { describe, expect, it } from "vitest";
import {
  MAX_SOURCE_TITLE_LENGTH,
  normalizeSourceUrl,
  sanitizeSourceText,
  UNTRUSTED_SOURCE_NOTICE,
} from "@/lib/editorial/source-input";

describe("links that can serve as evidence", () => {
  it("accepts an ordinary https citation and reports its host", () => {
    const result = normalizeSourceUrl("https://www.federalreserve.gov/data.htm");
    expect(result).toEqual({
      ok: true,
      url: "https://www.federalreserve.gov/data.htm",
      host: "www.federalreserve.gov",
    });
  });

  it("accepts http, because plenty of archives are still served that way", () => {
    const result = normalizeSourceUrl("http://example.org/a");
    expect(result.ok).toBe(true);
  });
});

describe("links that cannot", () => {
  it("refuses a javascript URL and names the scheme", () => {
    const result = normalizeSourceUrl("javascript:alert(1)");
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.message).toContain("javascript");
  });

  it("refuses a data URL", () => {
    expect(normalizeSourceUrl("data:text/html,<b>hi</b>").ok).toBe(false);
  });

  it("refuses embedded credentials", () => {
    const result = normalizeSourceUrl("https://user:secret@example.com/a");
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.message).toContain("credentials");
  });

  it("refuses a host only the author can reach", () => {
    // Not an SSRF claim: nothing fetches these. A citation nobody else can
    // open is simply not a citation.
    for (const url of [
      "http://localhost:3000/x",
      "http://127.0.0.1/x",
      "http://192.168.1.9/x",
      "http://10.0.0.4/x",
    ])
      expect(normalizeSourceUrl(url).ok).toBe(false);
  });

  it("refuses a bare word that is not a link at all", () => {
    const result = normalizeSourceUrl("federalreserve.gov");
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.message).toContain("https://");
  });

  it("refuses an empty value", () => {
    expect(normalizeSourceUrl("   ").ok).toBe(false);
  });
});

describe("text that could lie about itself on screen", () => {
  it("strips the bidi override that would reverse displayed text", () => {
    const sneaky = "Report from \u202emoc.elpmaxe\u202c";
    const clean = sanitizeSourceText(sneaky, 200);
    expect(clean).not.toContain("\u202e");
    expect(clean).not.toContain("\u202c");
  });

  it("strips control characters but keeps paragraph breaks", () => {
    const clean = sanitizeSourceText("one\u0001two\n\nthree", 200);
    expect(clean).toBe("onetwo\n\nthree");
  });

  it("caps length so a paste cannot become a payload", () => {
    expect(
      sanitizeSourceText("x".repeat(5000), MAX_SOURCE_TITLE_LENGTH),
    ).toHaveLength(MAX_SOURCE_TITLE_LENGTH);
  });

  it("composes Unicode so the same text stores the same way", () => {
    // Decomposed e plus combining acute in, precomposed out.
    expect(sanitizeSourceText("cafe\u0301", 50)).toBe("caf\u00e9");
  });
});

describe("what the interface promises", () => {
  it("says the application does not read sources", () => {
    expect(UNTRUSTED_SOURCE_NOTICE).toContain("does not open them");
  });
});
