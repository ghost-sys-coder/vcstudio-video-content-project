import { z } from "zod";
import { characterReferenceTypeEnum, characterStatusEnum } from "@/db/schema";

export const characterReferenceContentTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

const detail = z.string().trim().max(5000);

export const characterFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: detail,
  visualIdentity: detail,
  bodyProportions: detail,
  faceDescription: detail,
  hairDescription: detail,
  skinToneDescription: detail,
  defaultOutfitDescription: detail,
  personalityNotes: detail,
  continuityRules: detail,
  negativeConstraints: detail,
  status: z.enum(characterStatusEnum.enumValues).exclude(["archived"]),
});

export const characterImportSchema = characterFormSchema.strict();

export type CharacterFormValues = z.infer<typeof characterFormSchema>;

export const updateCharacterSchema = characterFormSchema.extend({
  characterId: z.uuid(),
});

export const characterIdSchema = z.object({ characterId: z.uuid() });

export const assignSceneCharactersSchema = z.object({
  projectId: z.uuid(),
  sceneId: z.uuid(),
  sceneVersionId: z.uuid(),
  characterIds: z.array(z.uuid()).max(50),
});

export function createCharacterReferenceUploadSchema(input: {
  allowedTypes: string[];
  maximumBytes: number;
}) {
  return z.object({
    type: z.enum(characterReferenceTypeEnum.enumValues),
    contentType: z
      .enum(characterReferenceContentTypes)
      .refine((value) => input.allowedTypes.includes(value), {
        message: "Unsupported reference image type.",
      }),
    fileName: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().positive().max(input.maximumBytes),
  });
}

export function completeCharacterReferenceUploadSchema(input: {
  allowedTypes: string[];
  maximumBytes: number;
}) {
  return createCharacterReferenceUploadSchema(input)
    .omit({ fileName: true })
    .extend({
      objectKey: z.string().min(1).max(512),
    });
}
