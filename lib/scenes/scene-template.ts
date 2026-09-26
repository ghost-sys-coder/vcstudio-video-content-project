import type { SceneContent } from "@/lib/schemas/scene";

/**
 * The shape of a scene, as something a creator can hold in their hands.
 *
 * Every field the editor exposes, with nothing hidden and nothing extra, so a
 * plan written outside this application can be brought in whole rather than
 * retyped into twelve inputs per scene.
 *
 * Blank rather than filled with an example. A template that arrives carrying
 * someone else's words invites them to be left in by accident, and a scene that
 * narrates the template's placeholder text is worse than an empty one: it looks
 * finished.
 */
export const SCENE_TEMPLATE: SceneContent = {
  narrationText: "",
  visualDescription: "",
  locationDescription: "",
  actionDescription: "",
  cameraShot: "",
  cameraAngle: "",
  cameraMotion: "",
  emotionalTone: "",
  characterNames: [],
  propNames: [],
  continuityNotes: "",
  // Only a starting point. Left out entirely, it is estimated from the
  // narration; either way the finished video is timed by the recording.
  estimatedDurationMilliseconds: 10_000,
};

/** What each field is for, shown beside the template rather than guessed at. */
export const SCENE_FIELD_GUIDE: ReadonlyArray<{
  field: keyof SceneContent;
  required: boolean;
  description: string;
}> = [
  {
    field: "narrationText",
    required: true,
    description: "The words spoken aloud in this scene.",
  },
  {
    field: "visualDescription",
    required: true,
    description:
      "What the picture shows. This is what the image is drawn from.",
  },
  {
    field: "locationDescription",
    required: true,
    description: "Where the scene takes place.",
  },
  {
    field: "actionDescription",
    required: true,
    description: "What happens during the scene.",
  },
  {
    field: "cameraShot",
    required: true,
    description: "Framing, such as wide, medium or close-up.",
  },
  {
    field: "cameraAngle",
    required: true,
    description: "Viewpoint, such as eye level, high or low.",
  },
  {
    field: "cameraMotion",
    required: true,
    description: "Movement, such as static, pan or push in.",
  },
  {
    field: "emotionalTone",
    required: true,
    description: "How the scene should feel, such as calm or urgent.",
  },
  {
    field: "characterNames",
    required: false,
    description: "Characters present. A list, or a comma-separated line.",
  },
  {
    field: "propNames",
    required: false,
    description: "Objects that matter. A list, or a comma-separated line.",
  },
  {
    field: "continuityNotes",
    required: false,
    description: "Anything that must match neighbouring scenes.",
  },
  {
    field: "estimatedDurationMilliseconds",
    required: false,
    description:
      "A planning estimate. Omit it and it is worked out from the narration.",
  },
];

export const SCENE_TEMPLATE_JSON = JSON.stringify(SCENE_TEMPLATE, null, 2);

/**
 * Two blanks rather than one, because the point of the array form is that it
 * holds more than one scene and a template showing a single entry does not
 * make that obvious.
 */
export const SCENE_ARRAY_TEMPLATE_JSON = JSON.stringify(
  [SCENE_TEMPLATE, SCENE_TEMPLATE],
  null,
  2,
);

/** Filename offered when the template is downloaded. */
export const SCENE_TEMPLATE_FILENAME = "scene-template.json";
export const SCENE_ARRAY_TEMPLATE_FILENAME = "scenes-template.json";
