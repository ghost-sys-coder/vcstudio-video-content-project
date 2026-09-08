import { describe, expect, it } from "vitest";
import {
  hasSceneContentChanged,
  projectCurrentSceneTimings,
  sceneMediaCompatibility,
} from "./scene-revision";
import { createProductionBaselineFixture } from "@/lib/test-utils/version-two-production-fixture";
import { sceneContentSchema } from "@/lib/schemas/scene";
import { parseSceneEditorInput } from "@/lib/scenes/scene-editor-input";

describe("scene revision content and timing", () => {
  it("keeps images for narration edits and narration for every visual-only edit", () => {
    const version = createProductionBaselineFixture().rows[0]!.version;
    expect(
      sceneMediaCompatibility(version, {
        ...version,
        narrationText: "A different sentence.",
      }),
    ).toEqual({ image: true, audio: false });
    for (const field of [
      "visualDescription",
      "locationDescription",
      "actionDescription",
      "cameraShot",
      "cameraAngle",
      "cameraMotion",
      "emotionalTone",
      "continuityNotes",
    ] as const) {
      expect(
        sceneMediaCompatibility(version, { ...version, [field]: "Changed" }),
        field,
      ).toEqual({ image: false, audio: true });
    }
    for (const field of ["characterNames", "propNames"] as const)
      expect(
        sceneMediaCompatibility(version, { ...version, [field]: ["Changed"] }),
        field,
      ).toEqual({ image: false, audio: true });
    expect(
      sceneMediaCompatibility(version, {
        ...version,
        estimatedDurationMilliseconds: 14000,
      }),
    ).toEqual({ image: true, audio: true });
  });
  it("ignores identity, timestamp and derived timing differences", () => {
    const version = createProductionBaselineFixture().rows[0]!.version;
    expect(
      hasSceneContentChanged(version, {
        ...version,
        ...{ id: "other", startTimeMilliseconds: 999 },
      }),
    ).toBe(false);
  });
  it("compares every editorial field, including array order and empty notes", () => {
    const version = createProductionBaselineFixture().rows[0]!.version;
    for (const field of Object.keys(sceneContentSchema.shape)) {
      const record = sceneContentSchema.parse(version);
      const changed = Object.fromEntries(
        Object.entries(record).map(([key, value]) => [
          key,
          key !== field
            ? value
            : Array.isArray(value)
              ? [...value, "Added"]
              : typeof value === "number"
                ? value + 1
                : `${value}!`,
        ]),
      );
      expect(
        hasSceneContentChanged(record, sceneContentSchema.parse(changed)),
        field,
      ).toBe(true);
    }
  });
  it("recalculates downstream display timing without mutating versions or approvals", () => {
    const { rows } = createProductionBaselineFixture();
    rows[1]!.version.estimatedDurationMilliseconds += 1000;
    const before = JSON.stringify(rows);
    const projected = projectCurrentSceneTimings(rows);
    expect(projected[2]!.version.startTimeMilliseconds).toBe(25000);
    expect(projected[39]!.version.endTimeMilliseconds).toBe(481000);
    expect(projected.map((row) => [row.version.id, row.scene.status])).toEqual(
      rows.map((row) => [row.version.id, row.scene.status]),
    );
    expect(JSON.stringify(rows)).toBe(before);
  });
  it("round trips the editor form without creating an edit", () => {
    const { rows } = createProductionBaselineFixture();
    const target = rows[0]!;
    const form = new FormData();
    for (const [key, value] of Object.entries(
      sceneContentSchema.parse(target.version),
    ))
      form.set(key, Array.isArray(value) ? value.join(", ") : String(value));
    form.set("projectId", target.scene.projectId);
    form.set("sceneId", target.scene.id);
    form.set("expectedVersion", "1");
    const parsed = parseSceneEditorInput(form);
    expect(parsed.success).toBe(true);
    if (parsed.success)
      expect(hasSceneContentChanged(target.version, parsed.data)).toBe(false);
  });
});
