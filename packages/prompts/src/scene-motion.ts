export const SCENE_MOTION_PROMPT_VERSION = "scene-motion-v1";
export const SCENE_MOTION_PROMPT_TEMPLATE_SOURCE = `VCStudio scene motion prompt
Layers: immutable approved frame, motion description, loop seam, explainer
restraint, and negative constraints.`;
export const SCENE_MOTION_PROMPT_TEMPLATE_SOURCE_HASH =
  "7ed1436aea8c8cd36f4422892af6619fed7338da239603159414eabbfe60a995";

/**
 * Asks a video model to put an approved still into motion, and nothing more.
 *
 * **This prompt is where slop is prevented or admitted.** Given open
 * instructions, a video model will redraw faces, drift the style, invent
 * subjects at the edges and push everything towards glossy hyperrealism,
 * because that is what its training rewards. The approved still already carries
 * the workspace's visual style, its characters and its composition, and all of
 * that is thrown away the moment the model is allowed to reinterpret rather
 * than animate. So the instruction is narrow on purpose: the frame is fixed,
 * only motion is being asked for.
 *
 * **Why it asks for a seamless loop.** A clip is a few seconds; a scene runs
 * for as long as its narration, so the clip repeats underneath it. Motion that
 * ends where it began repeats invisibly. Motion that ends somewhere else jumps
 * on every repeat, and a jump every few seconds is far more distracting than a
 * still image would have been.
 */
export function renderSceneMotionPrompt(input: {
  /** What should move, in the creator's words. Empty asks for ambient motion. */
  motionDescription: string;
  /** Kept so the model is told the register, not left to guess it. */
  visualStyleSummary: string;
  durationSeconds: number;
  /** True when the clip will repeat, which is the usual case. */
  loops: boolean;
}): string {
  const described = input.motionDescription.trim();
  const style = input.visualStyleSummary.trim();

  const lines = [
    "Animate the supplied image. Treat it as a finished frame that is already correct.",
    described.length > 0
      ? `The motion to perform: ${described}`
      : "Add only gentle ambient motion: a slow drift, a soft parallax, small secondary movement in background elements.",
    `The clip is ${input.durationSeconds} seconds long.`,
  ];

  if (input.loops)
    lines.push(
      "It will be repeated back to back underneath a voiceover, so end the motion where it began. The last frame must join the first without a visible jump.",
    );

  if (style.length > 0)
    lines.push(
      `Hold the existing visual style exactly: ${style}. Do not make it more photographic, more detailed, or more cinematic than the supplied frame.`,
    );
  else
    lines.push(
      "Hold the existing visual style exactly. Do not make it more photographic, more detailed, or more cinematic than the supplied frame.",
    );

  lines.push(
    "This is an explanatory video, so motion should support the narration rather than compete with it. Restraint is correct; dramatic camera work is not.",
    "Do not redraw, replace, restyle, or reinterpret any subject, face, or object already in the frame.",
    "Do not introduce new subjects, characters, objects, text, captions, logos, or watermarks.",
    "Do not cut, dissolve, or change shot. The clip is one continuous take from the supplied frame.",
    "Do not distort faces or hands, and do not morph one object into another.",
  );

  return lines.join("\n");
}
