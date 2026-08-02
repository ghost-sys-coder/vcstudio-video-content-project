"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, SendIcon } from "lucide-react";
import { publishSocialPostAction } from "@/app/(authenticated)/app/social/posts/actions";
import { PostTargetRow } from "@/components/social/PostTargetRow";
import { SchedulePostDialog } from "@/components/social/SchedulePostDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toneContainerClassName } from "@/lib/social/eligibility-tone";
import type { PlatformEligibility } from "@/lib/social/select-eligible-platforms";
import type {
  PostConnectionView,
  SocialPostTargetView,
} from "@/lib/social/social-post-view";
import { isSocialPostPlatform } from "@/lib/social/platform-post-capabilities";

/** How often to re-read the server while a destination is still in flight. */
const POLL_INTERVAL_MS = 4000;

/**
 * Chooses destinations and sends the post.
 *
 * An account is only selectable when the **current draft** could actually go
 * there — the same eligibility the previews show, so a destination is never
 * offered and then rejected by the server. Unsaved edits are the one caveat
 * worth stating out loud, and the panel does: publishing sends what was last
 * saved.
 */
export function PublishPostPanel({
  canPublish,
  connections,
  eligibility,
  hasUnsavedChanges,
  postId,
  scheduledAt,
  targets,
}: {
  canPublish: boolean;
  connections: PostConnectionView[];
  eligibility: PlatformEligibility[];
  hasUnsavedChanges: boolean;
  postId: string;
  scheduledAt: string | null;
  targets: SocialPostTargetView[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const inFlight = targets.some(
    (target) => target.status === "queued" || target.status === "publishing",
  );

  // A publish runs in a background worker, so the page has to ask again rather
  // than being told. Polling stops as soon as every destination has settled.
  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [inFlight, router]);

  const eligibilityByPlatform = new Map(
    eligibility.map((entry) => [entry.platform, entry]),
  );

  function publish() {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("postId", postId);
      for (const id of selectedIds) data.append("connectionIds", id);
      data.set("requestNonce", crypto.randomUUID());
      const result = await publishSocialPostAction(data);
      if (result.ok) {
        setSelectedIds([]);
        router.refresh();
      } else setError(result.error);
    });
  }

  return (
    <section className="space-y-3 rounded-xl border p-3">
      <h2 className="text-sm font-medium">Destinations</h2>

      {connections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No accounts are connected yet. Connect one in workspace settings.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {connections.map((connection) => {
            const entry = isSocialPostPlatform(connection.platform)
              ? eligibilityByPlatform.get(connection.platform)
              : undefined;
            const eligible = entry?.eligible ?? false;
            const alreadySent = targets.some(
              (target) =>
                target.connectionId === connection.id &&
                target.status === "published",
            );
            const disabled = !canPublish || !eligible || alreadySent || pending;

            return (
              <li key={connection.id}>
                <Label
                  className={`flex items-start gap-2 rounded-lg border p-2 text-sm ${
                    disabled ? "opacity-60" : "cursor-pointer hover:bg-accent"
                  }`}
                >
                  <input
                    checked={selectedIds.includes(connection.id)}
                    className="mt-0.5"
                    disabled={disabled}
                    onChange={(event) =>
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...current, connection.id]
                          : current.filter((id) => id !== connection.id),
                      )
                    }
                    type="checkbox"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {connection.platformLabel}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {connection.accountName}
                    </span>
                    {alreadySent ? (
                      <span className="block text-xs text-muted-foreground">
                        Already sent to this account.
                      </span>
                    ) : entry && !entry.eligible ? (
                      // An unmet platform requirement is stated, not flagged —
                      // only a draft that breaks a limit is worth colouring.
                      <span
                        className={`mt-1 block text-xs ${toneContainerClassName(
                          entry.severity === "requirement" ? "info" : "warning",
                        )}`}
                      >
                        {entry.reason}
                      </span>
                    ) : null}
                  </span>
                </Label>
              </li>
            );
          })}
        </ul>
      )}

      {hasUnsavedChanges ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-500">
          Publishing sends the last saved version. Save the draft first to
          include your latest edits.
        </p>
      ) : null}

      {error ? (
        <p aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {canPublish ? (
        <div className="flex flex-wrap gap-2">
          <SchedulePostDialog
            disabled={selectedIds.length === 0 || pending}
            postId={postId}
            scheduledAt={scheduledAt}
            selectedConnectionIds={selectedIds}
          />
          <Button
            className="flex-1"
            disabled={selectedIds.length === 0 || pending}
            onClick={publish}
            type="button"
          >
            {pending ? (
              <>
                <Loader2Icon aria-hidden className="animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <SendIcon />
                Publish now
              </>
            )}
          </Button>
        </div>
      ) : null}

      {targets.length > 0 ? (
        <div className="space-y-2 pt-1">
          <h3 className="text-sm font-medium">Outcome</h3>
          <ul aria-live="polite" className="space-y-1.5">
            {targets.map((target) => (
              <PostTargetRow key={target.id} target={target} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
