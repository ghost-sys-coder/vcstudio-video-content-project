"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getPlatformPostCapability } from "@/lib/social/platform-post-capabilities";
import type { SocialPostPlatform } from "@/lib/social/platform-post-capabilities";

export function PlatformCaptionEditor({
  baseText,
  customized,
  label,
  onChange,
  onCustomizedChange,
  platform,
  value,
}: {
  baseText: string;
  customized: boolean;
  label: string;
  onChange: (value: string) => void;
  onCustomizedChange: (customized: boolean) => void;
  platform: SocialPostPlatform;
  value: string;
}) {
  const limit = getPlatformPostCapability(platform).maxCharacters;
  const effectiveText = customized ? value : baseText;

  return (
    <div className="space-y-2 rounded-xl border bg-background/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            checked={customized}
            onChange={(event) => onCustomizedChange(event.target.checked)}
            type="checkbox"
          />
          Custom caption for {label}
        </Label>
        <span
          className={`text-xs tabular-nums ${effectiveText.length > limit ? "text-destructive" : "text-muted-foreground"}`}
        >
          {effectiveText.length.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      {customized ? (
        <Textarea
          aria-label={`${label} caption`}
          className="min-h-28 resize-y"
          maxLength={limit}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Uses the shared post text. Turn this on to tailor the copy for this
          platform.
        </p>
      )}
    </div>
  );
}
