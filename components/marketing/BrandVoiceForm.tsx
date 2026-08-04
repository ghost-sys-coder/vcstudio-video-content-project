"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { saveBrandVoiceAction } from "@/app/(authenticated)/app/marketing/brand/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BrandProfileView } from "@/lib/marketing/brand/brand-view";

/**
 * Voice, and the rules that constrain it.
 *
 * The list fields are newline-separated textareas rather than tag inputs: the
 * entries are phrases and sentences, not tokens, and a tag input encourages
 * single words where "never promise a guaranteed result" is what actually
 * stops a bad sentence being written.
 */
export function BrandVoiceForm({ profile }: { profile: BrandProfileView }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const result = await saveBrandVoiceAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  const lists = [
    {
      name: "toneAttributes",
      label: "Tone attributes",
      help: "One per line. Direct, dry, technical.",
      value: profile.toneAttributes,
    },
    {
      name: "writingRules",
      label: "Writing rules",
      help: "One per line. Short sentences. No exclamation marks.",
      value: profile.writingRules,
    },
    {
      name: "bannedPhrases",
      label: "Never say",
      help: "One per line. These become hard constraints on every generation.",
      value: profile.bannedPhrases,
    },
    {
      name: "valueProps",
      label: "Value propositions",
      help: "One per line. Why someone picks you.",
      value: profile.valueProps,
    },
    {
      name: "proofPoints",
      label: "Proof points",
      help: "One per line. Facts it may cite. Anything absent will not be claimed.",
      value: profile.proofPoints,
    },
  ] as const;

  return (
    <form action={save} className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="brand-voice-summary">Voice summary</Label>
        <Textarea
          defaultValue={profile.brandVoiceSummary}
          disabled={pending}
          id="brand-voice-summary"
          name="brandVoiceSummary"
          rows={4}
        />
      </div>

      {lists.map((list) => (
        <div className="space-y-2" key={list.name}>
          <Label htmlFor={`brand-${list.name}`}>{list.label}</Label>
          <Textarea
            defaultValue={list.value.join("\n")}
            disabled={pending}
            id={`brand-${list.name}`}
            name={list.name}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">{list.help}</p>
        </div>
      ))}

      <div className="space-y-2">
        <Label htmlFor="brand-compliance">Compliance notes</Label>
        <Textarea
          defaultValue={profile.complianceNotes}
          disabled={pending}
          id="brand-compliance"
          name="complianceNotes"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Regulated wording the studio must be careful with. Content touching
          these will always need a human.
        </p>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button disabled={pending} type="submit">
          {pending ? (
            <>
              <Loader2Icon aria-hidden className="animate-spin" />
              Saving…
            </>
          ) : (
            "Save voice"
          )}
        </Button>
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {savedAt ? `Saved at ${savedAt}` : null}
        </p>
      </div>
    </form>
  );
}
