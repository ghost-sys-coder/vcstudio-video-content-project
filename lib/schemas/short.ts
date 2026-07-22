import { z } from "zod";

export const shortClipInputSchema = z.object({
  id: z.uuid().optional(),
  sourceSceneId: z.uuid(),
  sourceSceneVersionId: z.uuid(),
  position: z.number().int().min(1).max(50),
  sourceStartMilliseconds: z.number().int().nonnegative(),
  sourceEndMilliseconds: z.number().int().positive(),
  transition: z.enum(["cut", "fade"]),
});

export const createShortCompositionSchema = z
  .object({
    projectId: z.uuid(),
    outputVariantId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    clips: z.array(shortClipInputSchema).min(1).max(50),
  })
  .superRefine((input, context) => {
    if (
      new Set(input.clips.map((clip) => clip.position)).size !==
      input.clips.length
    )
      context.addIssue({
        code: "custom",
        path: ["clips"],
        message: "Clip positions must be unique.",
      });
    input.clips.forEach((clip, index) => {
      if (clip.sourceEndMilliseconds <= clip.sourceStartMilliseconds)
        context.addIssue({
          code: "custom",
          path: ["clips", index, "sourceEndMilliseconds"],
          message: "A clip must end after it starts.",
        });
    });
  });
