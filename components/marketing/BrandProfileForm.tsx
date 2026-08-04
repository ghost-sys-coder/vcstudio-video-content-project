"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { saveBrandProfileAction } from "@/app/(authenticated)/app/marketing/brand/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BrandProfileView } from "@/lib/marketing/brand/brand-view";

export function BrandProfileForm({ profile }: { profile: BrandProfileView }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const result = await saveBrandProfileAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <form action={save} className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="brand-name">Business name</Label>
        <Input
          defaultValue={profile.businessName}
          disabled={pending}
          id="brand-name"
          name="businessName"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand-one-liner">One-liner</Label>
        <Input
          defaultValue={profile.oneLiner}
          disabled={pending}
          id="brand-one-liner"
          name="oneLiner"
          placeholder="What you do, in one sentence."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand-description">Description</Label>
        <Textarea
          defaultValue={profile.longDescription}
          disabled={pending}
          id="brand-description"
          name="longDescription"
          rows={5}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brand-website">Website</Label>
          <Input
            defaultValue={profile.websiteUrl}
            disabled={pending}
            id="brand-website"
            name="websiteUrl"
            placeholder="https://example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-industry">Industry</Label>
          <Input
            defaultValue={profile.industry}
            disabled={pending}
            id="brand-industry"
            name="industry"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-language">Language</Label>
          <Input
            defaultValue={profile.primaryLanguage}
            disabled={pending}
            id="brand-language"
            name="primaryLanguage"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-timezone">Time zone</Label>
          <Input
            defaultValue={profile.timezone}
            disabled={pending}
            id="brand-timezone"
            name="timezone"
            required
          />
        </div>
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
            "Save profile"
          )}
        </Button>
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {savedAt ? `Saved at ${savedAt}` : null}
        </p>
      </div>
    </form>
  );
}
