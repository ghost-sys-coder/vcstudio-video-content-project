import { describe, expect, it } from "vitest";
import {
  findKnownPromptTemplate,
  KNOWN_PROMPT_TEMPLATES,
  verifyPromptTemplate,
} from "@/lib/prompts/prompt-template-registry";

const CURRENT = {
  templateKey: "scene-outpaint" as const,
  version: "scene-outpaint-v2",
  sourceHash:
    "c0d750d1047ed31bdd36d331ad4015da7a811ed8eedabda255ffabb6d2b9ed61",
};

function verify(overrides: {
  pinnedVersion?: string | null;
  pinnedVersionId?: string | null;
  storedTemplate?: { id: string; version: string; sourceHash: string } | null;
}) {
  return verifyPromptTemplate({
    templateKey: "scene-outpaint",
    pinnedVersion: CURRENT.version,
    pinnedVersionId: "row-1",
    storedTemplate: {
      id: "row-1",
      version: CURRENT.version,
      sourceHash: CURRENT.sourceHash,
    },
    ...overrides,
  });
}

describe("a job whose template is genuine", () => {
  it("passes on the current version", () => {
    expect(verify({}).outcome).toBe("verified");
  });

  it("passes on a retired version, which is the whole point", () => {
    // A worker that has moved on must still run jobs created a minute earlier
    // against the version it has just replaced.
    expect(
      verifyPromptTemplate({
        templateKey: "scene-outpaint",
        pinnedVersion: "scene-outpaint-v1",
        pinnedVersionId: "row-0",
        storedTemplate: {
          id: "row-0",
          version: "scene-outpaint-v1",
          sourceHash:
            "edf57d722c63ce2f42ed6fa89787b8aef2694e8968ac0f96453d3b1f417b5f97",
        },
      }).outcome,
    ).toBe("verified");
  });
});

describe("a version this build has never heard of", () => {
  it("is reported as unknown, not as a mismatch", () => {
    // This is the case that used to kill jobs: the website had moved to a
    // version the worker did not carry yet. It means the worker is behind,
    // which is worth waiting out rather than failing.
    const result = verify({
      pinnedVersion: "scene-outpaint-v9",
      storedTemplate: {
        id: "row-1",
        version: "scene-outpaint-v9",
        sourceHash: "9".repeat(64),
      },
    });
    expect(result.outcome).toBe("unknownVersion");
    if (result.outcome === "unknownVersion")
      expect(result.version).toBe("scene-outpaint-v9");
  });

  it("is only reached when everything else lines up", () => {
    // Leniency must never be the escape hatch for an inconsistent job, so a
    // row that disagrees with its pin is a mismatch even when the version is
    // one nobody recognises.
    expect(
      verify({
        pinnedVersion: "scene-outpaint-v9",
        storedTemplate: {
          id: "another-row",
          version: "scene-outpaint-v9",
          sourceHash: "9".repeat(64),
        },
      }).outcome,
    ).toBe("mismatch");
  });
});

describe("a job that genuinely does not line up", () => {
  it("refuses when the template row has gone", () => {
    expect(verify({ storedTemplate: null }).outcome).toBe("mismatch");
  });

  it("refuses when the row is not the one the job was pinned to", () => {
    expect(
      verify({
        storedTemplate: {
          id: "somewhere-else",
          version: CURRENT.version,
          sourceHash: CURRENT.sourceHash,
        },
      }).outcome,
    ).toBe("mismatch");
  });

  it("refuses when the version string changed after pinning", () => {
    expect(
      verify({
        storedTemplate: {
          id: "row-1",
          version: "scene-outpaint-v1",
          sourceHash: CURRENT.sourceHash,
        },
      }).outcome,
    ).toBe("mismatch");
  });

  it("refuses when the stored source no longer hashes to its published value", () => {
    // The tamper check, and the only reason the hash is carried at all.
    expect(
      verify({
        storedTemplate: {
          id: "row-1",
          version: CURRENT.version,
          sourceHash: "0".repeat(64),
        },
      }).outcome,
    ).toBe("mismatch");
  });

  it("refuses a generation that names no template", () => {
    expect(verify({ pinnedVersion: null }).outcome).toBe("mismatch");
    expect(verify({ pinnedVersionId: null }).outcome).toBe("mismatch");
  });
});

describe("the registry itself", () => {
  it("carries every version of every template, retired ones included", () => {
    for (const [key, version] of [
      ["scene-image", "scene-image-v1"],
      ["scene-image", "scene-image-v2"],
      ["scene-image", "scene-image-v3"],
      ["scene-outpaint", "scene-outpaint-v1"],
      ["scene-outpaint", "scene-outpaint-v2"],
      ["character-reference", "character-reference-v1"],
      ["thumbnail", "thumbnail-v1"],
    ] as const)
      expect(findKnownPromptTemplate(key, version)).not.toBeNull();
  });

  it("names each version exactly once", () => {
    // Two entries for one version would make verification depend on order.
    const seen = KNOWN_PROMPT_TEMPLATES.map(
      (template) => `${template.templateKey}:${template.version}`,
    );
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("carries a full-length hash for every entry", () => {
    for (const template of KNOWN_PROMPT_TEMPLATES)
      expect(template.sourceHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
