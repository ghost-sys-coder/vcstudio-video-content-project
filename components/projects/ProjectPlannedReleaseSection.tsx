"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setPlannedReleaseAction } from "@/app/(authenticated)/app/projects/planned-release-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** An existing date as the value a date input expects, in UTC. */
function toDateInputValue(value: Date | null): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

/**
 * Records when this project is meant to be released.
 *
 * The copy is explicit that this is a plan rather than progress, because the
 * queue shows it beside derived readiness and the two must never be confused.
 */
export function ProjectPlannedReleaseSection({
  canEdit,
  plannedReleaseAt,
  projectId,
}: {
  canEdit: boolean;
  plannedReleaseAt: Date | null;
  projectId: string;
}) {
  const router = useRouter();
  const initial = toDateInputValue(plannedReleaseAt);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      // A date-only value is stored at midnight UTC so it means the same day
      // for every viewer, rather than drifting with the browser's zone.
      formData.set(
        "plannedReleaseAt",
        value === "" ? "" : `${value}T00:00:00.000Z`,
      );
      const result = await setPlannedReleaseAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="planned-release-heading"
      className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8"
    >
      <h2 className="text-lg font-semibold" id="planned-release-heading">
        Intended release
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Orders this project in the production queue. It records what you plan,
        not what is finished, so setting a date never marks the video ready.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 max-w-xs flex-1 space-y-1.5">
          <Label className="text-xs" htmlFor="planned-release-input">
            Release date
          </Label>
          <Input
            disabled={!canEdit || isPending}
            id="planned-release-input"
            onChange={(event) => {
              setValue(event.target.value);
              setSaved(false);
            }}
            type="date"
            value={value}
          />
        </div>
        {canEdit ? (
          <Button
            className="h-10 shrink-0"
            disabled={initial === value || isPending}
            onClick={save}
            type="button"
          >
            {isPending ? "Saving…" : "Save date"}
          </Button>
        ) : null}
        {canEdit && value !== "" ? (
          <Button
            className="h-10 shrink-0"
            disabled={isPending}
            onClick={() => {
              setValue("");
              setSaved(false);
            }}
            type="button"
            variant="ghost"
          >
            Clear
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          Release date saved.
        </p>
      ) : null}
    </section>
  );
}
