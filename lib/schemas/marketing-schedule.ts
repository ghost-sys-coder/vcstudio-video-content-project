import { z } from "zod";
import {
  contentPlatformEnum,
  marketingScheduleFrequencyEnum,
  marketingTrafficTypeEnum,
} from "@/db/schema";

export const SCHEDULE_SKILL_OPTIONS = [
  "create_social_post",
  "create_social_graphic",
] as const;

export const scheduleSkillKeySchema = z.enum(SCHEDULE_SKILL_OPTIONS);
export type ScheduleSkillKey = z.infer<typeof scheduleSkillKeySchema>;

const kindBySkill = {
  create_social_post: "social_post",
  create_social_graphic: "graphic",
} as const;

function isTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const marketingScheduleRuleSchema = z
  .object({
    ruleId: z.uuid().optional(),
    name: z.string().trim().min(2).max(120),
    campaignId: z.union([z.uuid(), z.literal("")]).optional(),
    skillKey: scheduleSkillKeySchema,
    platforms: z.array(z.enum(contentPlatformEnum.enumValues)).min(1).max(6),
    trafficType: z.enum(marketingTrafficTypeEnum.enumValues),
    isBranded: z.boolean(),
    promptBrief: z.string().trim().min(10).max(10_000),
    frequency: z.enum(marketingScheduleFrequencyEnum.enumValues),
    byWeekday: z.array(z.number().int().min(0).max(6)).max(7),
    byMonthDay: z.number().int().min(1).max(28).nullable(),
    timeOfDayMinutes: z.number().int().min(0).max(1439),
    timezone: z.string().trim().min(1).max(64).refine(isTimezone, {
      message: "Choose a valid IANA timezone.",
    }),
    leadTimeMinutes: z.number().int().min(0).max(43_200),
    maxItemsPerRun: z.number().int().min(1).max(10),
    autoSchedule: z.boolean(),
    monthlyBudgetCents: z.number().int().min(0).max(10_000_000).nullable(),
  })
  .superRefine((value, context) => {
    if (value.frequency === "weekly" && value.byWeekday.length === 0)
      context.addIssue({
        code: "custom",
        path: ["byWeekday"],
        message: "Choose at least one weekday.",
      });
    if (value.frequency === "monthly" && value.byMonthDay === null)
      context.addIssue({
        code: "custom",
        path: ["byMonthDay"],
        message: "Choose a monthly day from 1 to 28.",
      });
  })
  .transform((value) => ({
    ...value,
    campaignId: value.campaignId || null,
    contentKind: kindBySkill[value.skillKey],
    byWeekday: [...new Set(value.byWeekday)].sort(
      (left, right) => left - right,
    ),
    byMonthDay: value.frequency === "monthly" ? value.byMonthDay : null,
  }));

export const marketingScheduleRuleFormSchema = z.preprocess((value) => {
  if (typeof value !== "object" || value === null) return value;
  const raw = value as Record<string, unknown>;
  const budget = String(raw.monthlyBudgetCents ?? "").trim();
  return {
    ...raw,
    platforms: Array.isArray(raw.platforms) ? raw.platforms : [],
    byWeekday: Array.isArray(raw.byWeekday) ? raw.byWeekday.map(Number) : [],
    byMonthDay:
      String(raw.byMonthDay ?? "").trim() === ""
        ? null
        : Number(raw.byMonthDay),
    timeOfDayMinutes: Number(raw.timeOfDayMinutes),
    leadTimeMinutes: Number(raw.leadTimeMinutes),
    maxItemsPerRun: Number(raw.maxItemsPerRun),
    monthlyBudgetCents: budget === "" ? null : Number(budget),
    isBranded: raw.isBranded === "on",
    autoSchedule: raw.autoSchedule === "on",
  };
}, marketingScheduleRuleSchema);

export const marketingScheduleRuleIdSchema = z.object({ ruleId: z.uuid() });

export type MarketingScheduleRuleInput = z.infer<
  typeof marketingScheduleRuleSchema
>;
