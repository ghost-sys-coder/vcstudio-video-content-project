import { z } from "zod";
import { contentPlatformEnum } from "@/db/schema";
import { MARKETING_SKILL_KEYS } from "@/lib/marketing/skills/skill-key";
import { SOCIAL_POST_PLATFORMS } from "@/lib/social/platform-post-capabilities";

export const DELEGATABLE_MARKETING_SKILL_KEYS = [
  "create_social_post",
  "write_email",
  "write_blog_post",
  "create_newsletter",
  "create_media_story",
] as const;

export type DelegatableMarketingSkillKey =
  (typeof DELEGATABLE_MARKETING_SKILL_KEYS)[number];

export const USER_SKILL_CONTENT_KIND_BY_BASE = {
  create_social_post: "social_post",
  write_email: "email",
  write_blog_post: "blog_post",
  create_newsletter: "newsletter",
  create_media_story: "media_story",
} as const;

const fieldKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-zA-Z0-9_]{0,39}$/, {
    message:
      "Field keys must start with a lowercase letter and use letters, numbers, or underscores.",
  });

const commonField = {
  key: fieldKeySchema,
  label: z.string().trim().min(1).max(80),
  required: z.boolean(),
  placeholder: z.string().trim().max(200).optional(),
  defaultValue: z.string().trim().max(2_000).optional(),
};

export const marketingSkillInputFieldSchema = z.discriminatedUnion("type", [
  z.object({ ...commonField, type: z.literal("text") }).strict(),
  z.object({ ...commonField, type: z.literal("longtext") }).strict(),
  z
    .object({
      ...commonField,
      type: z.literal("select"),
      options: z.array(z.string().trim().min(1).max(100)).min(2).max(20),
    })
    .strict(),
  z
    .object({
      ...commonField,
      type: z.literal("number"),
      minimum: z.number().finite().optional(),
      maximum: z.number().finite().optional(),
    })
    .strict()
    .refine(
      (field) =>
        field.minimum === undefined ||
        field.maximum === undefined ||
        field.minimum <= field.maximum,
      { message: "A number field minimum cannot exceed its maximum." },
    ),
  z
    .object({
      ...commonField,
      type: z.literal("platform"),
      options: z.array(z.enum(SOCIAL_POST_PLATFORMS)).optional(),
    })
    .strict(),
]);

export const marketingSkillInputFieldsSchema = z
  .array(marketingSkillInputFieldSchema)
  .min(1, "Add at least one input field.")
  .max(10, "A skill can have at most 10 input fields.")
  .superRefine((fields, context) => {
    const seen = new Set<string>();
    fields.forEach((field, index) => {
      if (seen.has(field.key))
        context.addIssue({
          code: "custom",
          path: [index, "key"],
          message: "Input field keys must be unique.",
        });
      seen.add(field.key);
      if (
        field.type === "select" &&
        field.defaultValue &&
        !field.options.includes(field.defaultValue)
      )
        context.addIssue({
          code: "custom",
          path: [index, "defaultValue"],
          message:
            "A select field's starting value must be one of its options.",
        });
      if (
        field.type === "platform" &&
        field.defaultValue &&
        !(SOCIAL_POST_PLATFORMS as readonly string[]).includes(
          field.defaultValue,
        )
      )
        context.addIssue({
          code: "custom",
          path: [index, "defaultValue"],
          message: "Choose a supported platform starting value.",
        });
      if (field.type === "number" && field.defaultValue) {
        const numeric = Number(field.defaultValue);
        if (
          !Number.isFinite(numeric) ||
          (field.minimum !== undefined && numeric < field.minimum) ||
          (field.maximum !== undefined && numeric > field.maximum)
        )
          context.addIssue({
            code: "custom",
            path: [index, "defaultValue"],
            message: "Choose a numeric starting value within the field limits.",
          });
      }
    });
  });

function stripControlCharacters(value: string) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

export const marketingSkillSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/, {
    message:
      "Use 3-40 lowercase letters, numbers, or hyphens, without a leading or trailing hyphen.",
  })
  .refine(
    (slug) => !(MARKETING_SKILL_KEYS as readonly string[]).includes(slug),
    { message: "That slug is reserved by a built-in skill." },
  );

export const marketingSkillMutationSchema = z
  .object({
    skillId: z.uuid().optional(),
    slug: marketingSkillSlugSchema,
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().min(10).max(300),
    instructions: z
      .string()
      .transform(stripControlCharacters)
      .pipe(z.string().trim().min(10).max(8_000)),
    baseSkillKey: z.enum(DELEGATABLE_MARKETING_SKILL_KEYS),
    inputFields: marketingSkillInputFieldsSchema,
    defaultPlatform: z
      .union([z.enum(contentPlatformEnum.enumValues), z.literal("")])
      .optional(),
    isEnabled: z.boolean(),
  })
  .transform((value) => ({
    ...value,
    defaultPlatform: value.defaultPlatform || null,
    defaultContentKind: USER_SKILL_CONTENT_KIND_BY_BASE[value.baseSkillKey],
  }));

export const marketingSkillFormSchema = z.preprocess((value) => {
  if (typeof value !== "object" || value === null) return value;
  const raw = value as Record<string, unknown>;
  let inputFields: unknown = raw.inputFields;
  if (typeof inputFields === "string") {
    try {
      inputFields = JSON.parse(inputFields);
    } catch {
      inputFields = null;
    }
  }
  return { ...raw, inputFields, isEnabled: raw.isEnabled === "on" };
}, marketingSkillMutationSchema);

export const marketingSkillIdSchema = z.object({ skillId: z.uuid() });

export type MarketingSkillMutationInput = z.infer<
  typeof marketingSkillMutationSchema
>;
