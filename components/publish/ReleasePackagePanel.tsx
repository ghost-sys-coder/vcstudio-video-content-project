"use client";

import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
import { useCallback, useMemo, useState } from "react";
import { PackageIcon } from "lucide-react";
import { loadReleasePackagesAction } from "@/app/(authenticated)/app/projects/[projectId]/publish/actions";
import { ReleasePackageEditor } from "@/components/publish/ReleasePackageEditor";
import { ReleasePackageStatusBadge } from "@/components/publish/ReleasePackageStatusBadge";
import { Label } from "@/components/ui/label";
import type { ReleasePackagesView } from "@/lib/releases/release-package-view";
import type { ThumbnailsView } from "@/lib/thumbnails/thumbnail-view";
import type { TitlesView } from "@/lib/titles/title-view";

/**
 * Where a release is packaged: one destination at a time, kept in the database.
 *
 * Publishing metadata used to live in this page's React state keyed by
 * platform, so it was lost on reload and two channels on one platform shared a
 * copy. Each destination now has its own stored package, and the editor is
 * remounted per destination so nothing can carry across between them.
 */
export function ReleasePackagePanel({
  projectId,
  canEdit,
  initialData,
  titles,
  thumbnails,
}: {
  projectId: string;
  canEdit: boolean;
  initialData: ReleasePackagesView;
  titles: TitlesView;
  thumbnails: ThumbnailsView;
}) {
  const [data, setData] = useState(initialData);
  const [activeKey, setActiveKey] = useState(
    () => initialData.packages[0]?.key ?? "",
  );

  const active = useMemo(
    () => data.packages.find((entry) => entry.key === activeKey) ?? null,
    [activeKey, data.packages],
  );

  const refresh = useCallback(async () => {
    const next = await loadReleasePackagesAction(projectId);
    if (next) setData(next);
  }, [projectId]);

  if (!active)
    return (
      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Release package</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This project has no output to package yet.
        </p>
      </section>
    );

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PackageIcon aria-hidden className="size-4" />
          <h2 className="text-sm font-semibold">Release package</h2>
        </div>
        <ReleasePackageStatusBadge status={active.state.status} />
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        What this video is called, what it looks like, and where it goes. Each
        destination keeps its own copy, saved to the project rather than to this
        page, so it survives a reload and never leaks into another channel.
      </p>

      <div>
        <Label className="text-xs" htmlFor="release-destination">
          Destination
        </Label>
        <FormSelect
          className="mt-1 max-w-md"
          id="release-destination"
          onValueChange={(selectedValue) => setActiveKey(selectedValue)}
          value={activeKey}
        >
          {data.packages.map((entry) => (
            <SelectItem key={entry.key} value={String(entry.key)}>
              {entry.outputLabel} → {entry.destinationLabel}
            </SelectItem>
          ))}
        </FormSelect>
      </div>

      <ReleasePackageEditor
        canEdit={canEdit}
        entry={active}
        key={active.key}
        onSaved={refresh}
        projectId={projectId}
        thumbnails={
          thumbnails.platforms.find(
            (entry) => entry.platform === active.platform,
          )?.thumbnails ?? []
        }
        titleSuggestions={
          titles.platforms.find((entry) => entry.platform === active.platform)
            ?.suggestions ?? []
        }
      />
    </section>
  );
}
