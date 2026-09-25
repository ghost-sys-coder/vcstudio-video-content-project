import { describe, expect, it } from "vitest";
import {
  parseNewSceneInput,
  parseSceneEditorInput,
} from "./scene-editor-input";

const projectId = "a2aac49e-6745-4eb7-8ef7-214e6ce77927";

function completeForm() {
  const form = new FormData();
  form.set("projectId", projectId);
  form.set("narrationText", "Save before investing.");
  form.set("visualDescription", "A budget chart fills the screen.");
  form.set("locationDescription", "Home office");
  form.set("actionDescription", "Numbers rise on the chart.");
  form.set("cameraShot", "wide");
  form.set("cameraAngle", "eye level");
  form.set("cameraMotion", "static");
  form.set("emotionalTone", "reassuring");
  form.set("characterNames", "Alex, Morgan");
  form.set("propNames", "chart, notebook");
  form.set("continuityNotes", "Keep the budget example consistent.");
  form.set("estimatedDurationMilliseconds", "12000");
  return form;
}

describe("manual scene input", () => {
  it("accepts the complete editable scene contract without a script or run", () => {
    const parsed = parseNewSceneInput(completeForm());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.projectId).toBe(projectId);
    expect(parsed.data.characterNames).toEqual(["Alex", "Morgan"]);
    expect(parsed.data.propNames).toEqual(["chart", "notebook"]);
    expect(parsed.data.estimatedDurationMilliseconds).toBe(12000);
  });

  it("rejects missing required scene fields and invalid duration", () => {
    const form = completeForm();
    form.delete("visualDescription");
    form.set("estimatedDurationMilliseconds", "0");
    expect(parseNewSceneInput(form).success).toBe(false);
  });

  it("keeps editing's version requirement separate from creation", () => {
    const form = completeForm();
    expect(parseNewSceneInput(form).success).toBe(true);
    expect(parseSceneEditorInput(form).success).toBe(false);
  });
});
