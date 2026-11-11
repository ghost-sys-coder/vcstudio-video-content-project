import { describe, expect, it } from "vitest";
import {
  planProductionStep,
  type ProductionRunCursor,
  type ProductionRunFacts,
} from "@/lib/production-runs/plan-production-step";
import {
  defaultProductionRunPolicy,
  type ProductionRunPolicy,
} from "@/lib/production-runs/production-run-policy";
import type { ProductionRunStage } from "@/lib/production-runs/production-run-state";

const words = (count: number) =>
  Array.from({ length: count }, () => "word").join(" ");
const script = words(300);

function facts(
  overrides: Partial<ProductionRunFacts> = {},
): ProductionRunFacts {
  return {
    project: {
      id: "p",
      status: "draft",
      maximumBudgetCents: 1000,
      channelPlatform: "youtube",
    },
    script: {
      approvedVersionId: null,
      draft: { content: "", revision: 1, updatedAt: new Date("2026-01-01") },
      briefHasTopic: true,
      targetDurationSeconds: 120,
      maximumCharacters: 20_000,
      generation: null,
    },
    scenes: { analysis: null, current: [], maximumScenes: 50 },
    images: { targetSize: "1536x1024", perScene: [] },
    audio: { voicePresetId: "voice", perScene: [] },
    render: { own: null },
    release: {
      platform: "youtube",
      titles: null,
      hasTitleSuggestions: false,
      thumbnail: null,
      hasUsableThumbnail: false,
      packageId: null,
    },
    ...overrides,
  };
}

function cursor(
  stage: ProductionRunStage,
  overrides: {
    attempts?: Partial<Record<ProductionRunStage, number>>;
    policy?: Partial<ProductionRunPolicy>;
  } = {},
): ProductionRunCursor {
  const policy = defaultProductionRunPolicy({ maximumCostCents: 500 });
  return {
    stage,
    attempts: overrides.attempts ?? {},
    policy: {
      ...policy,
      ...overrides.policy,
      stages: { ...policy.stages, ...overrides.policy?.stages },
    },
  };
}

const scene = (
  n: number,
  status: ProductionRunFacts["scenes"]["current"][number]["status"] = "approved",
) => ({
  sceneId: `s${n}`,
  sceneVersionId: `v${n}`,
  sceneNumber: n,
  status,
  narrationText: words(40),
  visualDescription: "A room.",
});

const image = (
  n: number,
  latest: ProductionRunFacts["images"]["perScene"][number]["latest"],
) => ({
  sceneId: `s${n}`,
  sceneNumber: n,
  latest,
});
const goodImage = (id: string, reviewStatus = "pending") => ({
  id,
  status: "succeeded",
  reviewStatus,
  assetObjectKey: "k",
  assetWidth: 1536,
  assetHeight: 1024,
  safeErrorMessage: null,
});

const audio = (
  n: number,
  latest: ProductionRunFacts["audio"]["perScene"][number]["latest"],
) => ({
  sceneId: `s${n}`,
  sceneNumber: n,
  narrationText: words(150),
  latest,
});
const goodAudio = (id: string, reviewStatus = "pending") => ({
  id,
  status: "succeeded",
  reviewStatus,
  assetObjectKey: "k",
  durationMilliseconds: 60_000,
  amplitudeEnvelope: null,
  safeErrorMessage: null,
});

describe("planProductionStep: script", () => {
  it("fails an archived project at any stage", () => {
    expect(
      planProductionStep(
        facts({ project: { ...facts().project, status: "archived" } }),
        cursor("images"),
      ).kind,
    ).toBe("fail");
  });
  it("advances when a script is already approved", () => {
    expect(
      planProductionStep(
        facts({ script: { ...facts().script, approvedVersionId: "sv" } }),
        cursor("script"),
      ),
    ).toEqual({ kind: "advance", to: "scenes" });
  });
  it("generates a script from the brief when nothing is written", () => {
    expect(planProductionStep(facts(), cursor("script")).kind).toBe(
      "generate_script",
    );
  });
  it("holds without a brief topic or a draft", () => {
    const step = planProductionStep(
      facts({ script: { ...facts().script, briefHasTopic: false } }),
      cursor("script"),
    );
    expect(step.kind).toBe("hold");
  });
  it("waits while its generation runs", () => {
    const f = facts({
      script: {
        ...facts().script,
        generation: {
          id: "g",
          status: "running",
          generatedContent: null,
          completedAt: null,
          safeErrorMessage: null,
        },
      },
    });
    expect(planProductionStep(f, cursor("script")).kind).toBe("wait");
  });
  it("approves a generated script that passes the gate", () => {
    const f = facts({
      script: {
        ...facts().script,
        generation: {
          id: "g",
          status: "completed",
          generatedContent: script,
          completedAt: new Date("2026-01-02"),
          safeErrorMessage: null,
        },
      },
    });
    const step = planProductionStep(f, cursor("script"));
    expect(step.kind).toBe("approve_script");
    if (step.kind === "approve_script") {
      expect(step.content).toBe(script);
      expect(step.draftRevision).toBe(1);
      expect(step.gate.result.verdict).toBe("pass");
    }
  });
  it("prefers a draft edited after the generation finished", () => {
    const f = facts({
      script: {
        ...facts().script,
        draft: {
          content: words(280),
          revision: 4,
          updatedAt: new Date("2026-01-03"),
        },
        generation: {
          id: "g",
          status: "completed",
          generatedContent: script,
          completedAt: new Date("2026-01-02"),
          safeErrorMessage: null,
        },
      },
    });
    const step = planProductionStep(f, cursor("script"));
    expect(step.kind === "approve_script" && step.content).toBe(words(280));
  });
  it("holds a script that fails the gate instead of approving it", () => {
    const f = facts({
      script: {
        ...facts().script,
        draft: { content: words(20), revision: 1, updatedAt: new Date() },
      },
    });
    const step = planProductionStep(f, cursor("script"));
    expect(step.kind).toBe("hold");
    if (step.kind === "hold")
      expect(step.gates[0]?.result.verdict).toBe("fail");
  });
  it("holds when the policy says the script waits for a person", () => {
    const f = facts({
      script: {
        ...facts().script,
        draft: { content: script, revision: 1, updatedAt: new Date() },
      },
    });
    expect(
      planProductionStep(
        f,
        cursor("script", {
          policy: {
            stages: { script: "hold" } as ProductionRunPolicy["stages"],
          },
        }),
      ).kind,
    ).toBe("hold");
  });
  it("retries a failed generation once, then holds", () => {
    const failed = {
      id: "g",
      status: "failed" as const,
      generatedContent: null,
      completedAt: null,
      safeErrorMessage: "x",
    };
    const f = facts({ script: { ...facts().script, generation: failed } });
    expect(
      planProductionStep(f, cursor("script", { attempts: { script: 1 } })).kind,
    ).toBe("generate_script");
    expect(
      planProductionStep(f, cursor("script", { attempts: { script: 2 } })).kind,
    ).toBe("hold");
  });
});

describe("planProductionStep: scenes", () => {
  const withScript = () =>
    facts({ script: { ...facts().script, approvedVersionId: "sv" } });
  it("holds if the approved script disappeared", () => {
    expect(planProductionStep(facts(), cursor("scenes")).kind).toBe("hold");
  });
  it("starts analysis when there are no scenes", () => {
    expect(planProductionStep(withScript(), cursor("scenes")).kind).toBe(
      "analyze_scenes",
    );
  });
  it("waits on a running analysis and holds on an empty completed one", () => {
    const running = {
      ...withScript(),
      scenes: {
        analysis: {
          id: "a",
          status: "running" as const,
          safeErrorMessage: null,
        },
        current: [],
        maximumScenes: 50,
      },
    };
    expect(planProductionStep(running, cursor("scenes")).kind).toBe("wait");
    const empty = {
      ...withScript(),
      scenes: {
        analysis: {
          id: "a",
          status: "completed" as const,
          safeErrorMessage: null,
        },
        current: [],
        maximumScenes: 50,
      },
    };
    expect(planProductionStep(empty, cursor("scenes")).kind).toBe("hold");
  });
  it("approves a plan in review that passes the gate", () => {
    const f = {
      ...withScript(),
      scenes: {
        analysis: null,
        current: [scene(1, "review"), scene(2, "review")],
        maximumScenes: 50,
      },
    };
    expect(planProductionStep(f, cursor("scenes")).kind).toBe("approve_scenes");
  });
  it("advances once every scene is accepted", () => {
    const f = {
      ...withScript(),
      scenes: {
        analysis: null,
        current: [scene(1), scene(2, "generated")],
        maximumScenes: 50,
      },
    };
    expect(planProductionStep(f, cursor("scenes"))).toEqual({
      kind: "advance",
      to: "images",
    });
  });
  it("does not retry analysis past the attempt limit", () => {
    const f = {
      ...withScript(),
      scenes: {
        analysis: { id: "a", status: "failed" as const, safeErrorMessage: "x" },
        current: [],
        maximumScenes: 50,
      },
    };
    expect(
      planProductionStep(f, cursor("scenes", { attempts: { scenes: 2 } })).kind,
    ).toBe("hold");
  });
});

describe("planProductionStep: images", () => {
  it("generates for scenes with no image and skips approved ones", () => {
    const f = facts({
      images: {
        targetSize: "1536x1024",
        perScene: [image(1, null), image(2, goodImage("g2", "approved"))],
      },
    });
    expect(planProductionStep(f, cursor("images"))).toEqual({
      kind: "generate_images",
      sceneIds: ["s1"],
    });
  });
  it("approves pending images that pass before generating anything else", () => {
    const f = facts({
      images: {
        targetSize: "1536x1024",
        perScene: [image(1, goodImage("g1")), image(2, null)],
      },
    });
    const step = planProductionStep(f, cursor("images"));
    expect(step.kind).toBe("approve_images");
    if (step.kind === "approve_images")
      expect(step.approvals[0]?.subjectId).toBe("g1");
  });
  it("holds a pending image that fails its check", () => {
    const wrongSize = {
      ...goodImage("g1"),
      assetWidth: 1024,
      assetHeight: 1024,
    };
    const f = facts({
      images: { targetSize: "1536x1024", perScene: [image(1, wrongSize)] },
    });
    expect(planProductionStep(f, cursor("images")).kind).toBe("hold");
  });
  it("holds pending images when the policy says images wait for a person", () => {
    const f = facts({
      images: {
        targetSize: "1536x1024",
        perScene: [image(1, goodImage("g1"))],
      },
    });
    expect(
      planProductionStep(
        f,
        cursor("images", {
          policy: {
            stages: { images: "hold" } as ProductionRunPolicy["stages"],
          },
        }),
      ).kind,
    ).toBe("hold");
  });
  it("regenerates failed images within the attempt limit, then holds", () => {
    const failed = {
      ...goodImage("g1"),
      status: "failed",
      assetObjectKey: null,
    };
    const f = facts({
      images: { targetSize: "1536x1024", perScene: [image(1, failed)] },
    });
    expect(
      planProductionStep(f, cursor("images", { attempts: { images: 1 } })).kind,
    ).toBe("generate_images");
    expect(
      planProductionStep(f, cursor("images", { attempts: { images: 2 } })).kind,
    ).toBe("hold");
  });
  it("waits while images run and advances when all are approved", () => {
    const running = { ...goodImage("g1"), status: "running" };
    expect(
      planProductionStep(
        facts({
          images: { targetSize: "1536x1024", perScene: [image(1, running)] },
        }),
        cursor("images"),
      ).kind,
    ).toBe("wait");
    expect(
      planProductionStep(
        facts({
          images: {
            targetSize: "1536x1024",
            perScene: [image(1, goodImage("g1", "approved"))],
          },
        }),
        cursor("images"),
      ),
    ).toEqual({ kind: "advance", to: "audio" });
  });
});

describe("planProductionStep: audio", () => {
  it("holds when no voice is available", () => {
    expect(
      planProductionStep(
        facts({ audio: { voicePresetId: null, perScene: [audio(1, null)] } }),
        cursor("audio"),
      ).kind,
    ).toBe("hold");
  });
  it("generates, approves, waits and advances like images", () => {
    expect(
      planProductionStep(
        facts({ audio: { voicePresetId: "v", perScene: [audio(1, null)] } }),
        cursor("audio"),
      ),
    ).toEqual({ kind: "generate_audio", sceneIds: ["s1"] });
    expect(
      planProductionStep(
        facts({
          audio: { voicePresetId: "v", perScene: [audio(1, goodAudio("a1"))] },
        }),
        cursor("audio"),
      ).kind,
    ).toBe("approve_audio");
    expect(
      planProductionStep(
        facts({
          audio: {
            voicePresetId: "v",
            perScene: [audio(1, { ...goodAudio("a1"), status: "queued" })],
          },
        }),
        cursor("audio"),
      ).kind,
    ).toBe("wait");
    expect(
      planProductionStep(
        facts({
          audio: {
            voicePresetId: "v",
            perScene: [audio(1, goodAudio("a1", "approved"))],
          },
        }),
        cursor("audio"),
      ),
    ).toEqual({ kind: "advance", to: "render" });
  });
  it("holds a clip that is implausibly short for its words", () => {
    const f = facts({
      audio: {
        voicePresetId: "v",
        perScene: [
          audio(1, { ...goodAudio("a1"), durationMilliseconds: 3_000 }),
        ],
      },
    });
    expect(planProductionStep(f, cursor("audio")).kind).toBe("hold");
  });
});

describe("planProductionStep: render", () => {
  it("starts a render when the run has none, waits on it, then advances", () => {
    expect(planProductionStep(facts(), cursor("render")).kind).toBe(
      "start_render",
    );
    expect(
      planProductionStep(
        facts({
          render: {
            own: { id: "r", status: "running", safeErrorMessage: null },
          },
        }),
        cursor("render"),
      ).kind,
    ).toBe("wait");
    expect(
      planProductionStep(
        facts({
          render: {
            own: { id: "r", status: "succeeded", safeErrorMessage: null },
          },
        }),
        cursor("render"),
      ),
    ).toEqual({ kind: "advance", to: "release" });
  });
  it("holds a finished render when the policy asks for a review", () => {
    const f = facts({
      render: { own: { id: "r", status: "succeeded", safeErrorMessage: null } },
    });
    expect(
      planProductionStep(
        f,
        cursor("render", {
          policy: {
            stages: { render: "hold" } as ProductionRunPolicy["stages"],
          },
        }),
      ).kind,
    ).toBe("hold");
  });
  it("retries a failed render once and then holds", () => {
    const f = facts({
      render: { own: { id: "r", status: "failed", safeErrorMessage: "x" } },
    });
    expect(
      planProductionStep(f, cursor("render", { attempts: { render: 1 } })).kind,
    ).toBe("start_render");
    expect(
      planProductionStep(f, cursor("render", { attempts: { render: 2 } })).kind,
    ).toBe("hold");
  });
});

describe("planProductionStep: release", () => {
  it("writes titles, then a thumbnail, then saves the package, then completes", () => {
    expect(planProductionStep(facts(), cursor("release")).kind).toBe(
      "generate_titles",
    );
    expect(
      planProductionStep(
        facts({ release: { ...facts().release, hasTitleSuggestions: true } }),
        cursor("release"),
      ).kind,
    ).toBe("generate_thumbnail");
    expect(
      planProductionStep(
        facts({
          release: {
            ...facts().release,
            hasTitleSuggestions: true,
            hasUsableThumbnail: true,
          },
        }),
        cursor("release"),
      ).kind,
    ).toBe("save_release_package");
    expect(
      planProductionStep(
        facts({ release: { ...facts().release, packageId: "pkg" } }),
        cursor("release"),
      ).kind,
    ).toBe("complete");
  });
  it("waits on in-flight title and thumbnail work", () => {
    expect(
      planProductionStep(
        facts({
          release: {
            ...facts().release,
            titles: { status: "running", safeErrorMessage: null },
          },
        }),
        cursor("release"),
      ).kind,
    ).toBe("wait");
    expect(
      planProductionStep(
        facts({
          release: {
            ...facts().release,
            hasTitleSuggestions: true,
            thumbnail: { status: "queued", safeErrorMessage: null },
          },
        }),
        cursor("release"),
      ).kind,
    ).toBe("wait");
  });
  it("holds after the attempt limit rather than paying again", () => {
    const f = facts({
      release: {
        ...facts().release,
        titles: { status: "failed", safeErrorMessage: "x" },
      },
    });
    expect(
      planProductionStep(f, cursor("release", { attempts: { release: 2 } }))
        .kind,
    ).toBe("hold");
  });
});
