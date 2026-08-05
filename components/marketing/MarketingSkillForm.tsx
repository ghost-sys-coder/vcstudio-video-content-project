"use client";

import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMarketingSkillAction } from "@/app/(authenticated)/app/marketing/skills/actions";
import { Button } from "@/components/ui/button";
import type { MarketingSkill, MarketingSkillInputFieldData } from "@/db/schema";
import { SOCIAL_POST_PLATFORMS } from "@/lib/social/platform-post-capabilities";

const BASE_SKILLS = [
  ["create_social_post", "Social post"],
  ["write_email", "Marketing email"],
  ["write_blog_post", "Blog post"],
  ["create_newsletter", "Newsletter"],
  ["create_media_story", "Media story"],
] as const;

type EditorField = MarketingSkillInputFieldData & { rowId: string };

const SAMPLE_FIELDS: MarketingSkillInputFieldData[] = [
  {
    key: "topic",
    label: "Topic",
    type: "longtext",
    required: true,
    defaultValue:
      "Explain one practical way a local service business can turn more website visits into qualified enquiries.",
  },
  {
    key: "audience",
    label: "Audience",
    type: "text",
    required: true,
    defaultValue: "Owners of established local service businesses",
  },
  {
    key: "tone",
    label: "Tone",
    type: "select",
    required: true,
    defaultValue: "Clear and practical",
    options: [
      "Clear and practical",
      "Warm and conversational",
      "Direct and concise",
    ],
  },
];

function persistedField(field: EditorField): MarketingSkillInputFieldData {
  const common = {
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    ...(field.placeholder ? { placeholder: field.placeholder } : {}),
    ...(field.defaultValue ? { defaultValue: field.defaultValue } : {}),
  };
  if (field.type === "select")
    return { ...common, type: "select", options: field.options ?? [] };
  if (field.type === "number")
    return {
      ...common,
      type: "number",
      ...(field.minimum !== undefined ? { minimum: field.minimum } : {}),
      ...(field.maximum !== undefined ? { maximum: field.maximum } : {}),
    };
  if (field.type === "platform") return { ...common, type: "platform" };
  return { ...common, type: field.type };
}

export function MarketingSkillForm({ skill }: { skill?: MarketingSkill }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState<EditorField[]>(() =>
    (skill?.inputFields ?? SAMPLE_FIELDS).map((field) => ({
      ...field,
      rowId: crypto.randomUUID(),
    })),
  );

  function save(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveMarketingSkillAction(formData);
      if (!result.ok) return setError(result.error);
      router.push("/app/marketing/skills");
      router.refresh();
    });
  }

  return (
    <form action={save} className="grid max-w-4xl gap-5 rounded-xl border p-4">
      {skill ? <input name="skillId" type="hidden" value={skill.id} /> : null}
      <input
        name="inputFields"
        type="hidden"
        value={JSON.stringify(fields.map(persistedField))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1 text-sm font-medium">
          Skill name
          <input
            className="h-10 min-w-0 rounded-lg border bg-background px-3"
            defaultValue={skill?.name ?? "Local business insight"}
            name="name"
            required
          />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-medium">
          Slash command
          <span className="flex h-10 min-w-0 items-center rounded-lg border bg-background px-3 focus-within:ring-2 focus-within:ring-ring/40">
            <span className="text-muted-foreground">/</span>
            <input
              className="min-w-0 flex-1 bg-transparent outline-none"
              defaultValue={skill?.slug ?? "local-business-insight"}
              name="slug"
              required
            />
          </span>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Description
        <input
          className="h-10 rounded-lg border bg-background px-3"
          defaultValue={
            skill?.description ??
            "Create a useful, conversion-focused insight for local business owners."
          }
          name="description"
          required
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Writing format
          <select
            className="h-10 w-full min-w-0 rounded-lg border bg-background px-3"
            defaultValue={skill?.baseSkillKey ?? "create_social_post"}
            name="baseSkillKey"
          >
            {BASE_SKILLS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Default platform (optional)
          <select
            className="h-10 w-full min-w-0 rounded-lg border bg-background px-3"
            defaultValue={skill?.defaultPlatform ?? ""}
            name="defaultPlatform"
          >
            <option value="">Ask when used</option>
            {SOCIAL_POST_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Instructions
        <textarea
          className="min-h-36 rounded-lg border bg-background p-3"
          defaultValue={
            skill?.instructions ??
            "Lead with one specific problem the audience recognizes. Explain the practical consequence, give three actionable improvements, and close with a low-pressure invitation to request a website review. Keep the advice grounded in our brand context and avoid unsupported performance claims."
          }
          name="instructions"
          required
        />
      </label>
      <fieldset className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <legend className="text-sm font-medium">Input fields</legend>
            <p className="text-xs text-muted-foreground">
              These fields appear before the slash command runs. Maximum 10.
            </p>
          </div>
          <Button
            disabled={fields.length >= 10}
            onClick={() =>
              setFields((current) => [
                ...current,
                {
                  rowId: crypto.randomUUID(),
                  key: `input${current.length + 1}`,
                  label: `Input ${current.length + 1}`,
                  type: "text",
                  required: true,
                  defaultValue:
                    "Replace this starting value with your preference",
                },
              ])
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <PlusIcon /> Add field
          </Button>
        </div>
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div className="grid gap-3 rounded-lg border p-3" key={field.rowId}>
              <div className="grid gap-3 sm:grid-cols-[1fr_1.25fr_0.8fr_auto]">
                <label className="grid min-w-0 gap-1 text-xs font-medium">
                  Key
                  <input
                    className="h-9 min-w-0 rounded-lg border bg-background px-2"
                    onChange={(event) =>
                      setFields((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, key: event.target.value }
                            : item,
                        ),
                      )
                    }
                    value={field.key}
                  />
                </label>
                <label className="grid min-w-0 gap-1 text-xs font-medium">
                  Label
                  <input
                    className="h-9 min-w-0 rounded-lg border bg-background px-2"
                    onChange={(event) =>
                      setFields((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      )
                    }
                    value={field.label}
                  />
                </label>
                <label className="grid min-w-0 gap-1 text-xs font-medium">
                  Type
                  <select
                    className="h-9 min-w-0 rounded-lg border bg-background px-2"
                    onChange={(event) => {
                      const type = event.target.value as EditorField["type"];
                      setFields((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                rowId: item.rowId,
                                key: item.key,
                                label: item.label,
                                required: item.required,
                                defaultValue:
                                  type === "select"
                                    ? "Option one"
                                    : type === "platform"
                                      ? "linkedin"
                                      : type === "number"
                                        ? "1"
                                        : item.defaultValue,
                                type,
                                ...(type === "select"
                                  ? { options: ["Option one", "Option two"] }
                                  : {}),
                              }
                            : item,
                        ),
                      );
                    }}
                    value={field.type}
                  >
                    <option value="text">Short text</option>
                    <option value="longtext">Long text</option>
                    <option value="select">Select</option>
                    <option value="number">Number</option>
                    <option value="platform">Platform</option>
                  </select>
                </label>
                <Button
                  aria-label={`Remove ${field.label}`}
                  disabled={fields.length === 1}
                  onClick={() =>
                    setFields((current) =>
                      current.filter((item) => item.rowId !== field.rowId),
                    )
                  }
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2Icon />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="grid min-w-0 gap-1 text-xs font-medium">
                  Usable starting value
                  <input
                    className="h-9 min-w-0 rounded-lg border bg-background px-2"
                    onChange={(event) =>
                      setFields((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, defaultValue: event.target.value }
                            : item,
                        ),
                      )
                    }
                    value={field.defaultValue ?? ""}
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-xs font-medium">
                  <input
                    checked={field.required}
                    onChange={(event) =>
                      setFields((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, required: event.target.checked }
                            : item,
                        ),
                      )
                    }
                    type="checkbox"
                  />
                  Required
                </label>
              </div>
              {field.type === "select" ? (
                <label className="grid gap-1 text-xs font-medium">
                  Options (comma separated)
                  <input
                    className="h-9 rounded-lg border bg-background px-2"
                    onChange={(event) =>
                      setFields((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                options: event.target.value
                                  .split(",")
                                  .map((option) => option.trim())
                                  .filter(Boolean),
                              }
                            : item,
                        ),
                      )
                    }
                    value={(field.options ?? []).join(", ")}
                  />
                </label>
              ) : null}
            </div>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          defaultChecked={skill?.isEnabled ?? true}
          name="isEnabled"
          type="checkbox"
        />
        Available in Marketing Chat
      </label>
      <p className="rounded-lg border border-notice-info-edge bg-notice-info p-3 text-xs text-notice-info-foreground">
        Custom instructions refine writing only. The selected built-in format
        still controls execution, cost reservation, rate limits, and review.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        {skill ? "Save skill" : "Create skill"}
      </Button>
    </form>
  );
}
