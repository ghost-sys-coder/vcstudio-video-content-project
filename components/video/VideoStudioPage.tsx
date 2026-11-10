"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Film,
  ArrowUpRight,
  RefreshCw,
  LoaderCircle,
  Layers3,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VideoComposer } from "./VideoComposer";
import { VideoGenerationCard } from "./VideoGenerationCard";
import { videoHistoryAction } from "@/app/(authenticated)/app/video/actions";
import type {
  VideoCatalogView,
  VideoGenerationView,
} from "@/lib/video-generation/video-generation-view";
import type { VideoGenerationTarget } from "@studio/contracts/video";
import { videoMoney } from "@/lib/video-generation/video-composer-options";
export function VideoStudioPage({
  workspaceId,
  catalog,
  canGenerate,
  history,
  target,
  initialPrompt,
}: {
  workspaceId: string;
  catalog: VideoCatalogView;
  canGenerate: boolean;
  history: { items: VideoGenerationView[]; nextCursor: string | null };
  target?: VideoGenerationTarget;
  initialPrompt?: string;
}) {
  const [items, setItems] = useState(history.items),
    [cursor, setCursor] = useState(history.nextCursor),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function refresh(more = false) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await videoHistoryAction(
        workspaceId,
        more ? (cursor ?? undefined) : undefined,
      );
      if (!result.ok) setError(result.error);
      else {
        setItems((previous) =>
          more
            ? [
                ...previous,
                ...result.value.items.filter(
                  (item) => !previous.some((prior) => prior.id === item.id),
                ),
              ]
            : result.value.items,
        );
        setCursor(result.value.nextCursor);
      }
    } catch {
      setError(
        "Video history could not be refreshed. Your prompt is preserved.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="app-page font-[family-name:var(--font-geist-sans,Arial,sans-serif)]">
      <header className="app-page-header items-center">
        <div className="app-heading max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">
            Create · Motion
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Video Studio
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Turn an idea or an existing image into moving footage. Create
            independently, then bring the result into your production.
          </p>
        </div>
        <Badge
          variant="outline"
          className={`h-8 gap-2 px-3 text-xs font-semibold ${catalog.enabled ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" : "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"}`}
        >
          <span
            className={`size-1.5 rounded-full ${catalog.enabled ? "bg-emerald-500" : "bg-amber-500"}`}
          />
          {catalog.enabled ? "Generation available" : "Generation paused"}
        </Badge>
      </header>
      {catalog.elevenlabs ? (
        <div className="app-panel flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="space-y-1">
            <p className="font-semibold">ElevenLabs media service</p>
            <p className="text-muted-foreground">
              {catalog.elevenlabs.video.reason ??
                "Video API configured. Existing estimates and credit limits apply."}
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            {catalog.elevenlabs.usageMode === "internal"
              ? "In-house only"
              : "Licensed service"}
          </Badge>
        </div>
      ) : null}
      {target?.kind === "scene" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-notice-ready-edge bg-notice-ready p-4 text-sm text-notice-ready-foreground">
          <span>
            Creating footage for an existing project scene. Narration stays with
            the project; results require scene review.
          </span>
          <Link
            className="shrink-0 underline underline-offset-4"
            href={`/app/projects/${target.projectId}/scenes?sceneId=${target.sceneId}`}
          >
            Return to scene
          </Link>
        </div>
      ) : null}
      <div className="app-grid grid-cols-1 items-start xl:grid-cols-[minmax(0,1.8fr)_minmax(16rem,0.85fr)]">
        <VideoComposer
          workspaceId={workspaceId}
          catalog={catalog}
          canGenerate={canGenerate}
          target={target}
          initialPrompt={initialPrompt}
          onStarted={() => void refresh()}
        />
        <aside className="min-w-0 space-y-5">
          <Card className="overflow-hidden">
            <CardContent className="space-y-5">
              <div className="flex size-11 items-center justify-center rounded-2xl border bg-secondary">
                <Film className="size-5" />
              </div>
              <div className="app-heading">
                <h2 className="text-lg font-semibold tracking-tight">
                  A shot, on your terms
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Start with a prompt, animate a first frame, or guide the
                  result with references. Available controls follow the model
                  you choose.
                </p>
              </div>
              <div className="space-y-4 border-t pt-4">
                <div className="flex gap-3">
                  <Layers3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Finished clips live in your private library, ready for scene
                    reuse or a Social draft.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Volume2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Keep native audio for independent clips. Project scenes use
                    your existing narration.
                  </p>
                </div>
              </div>
              <Button
                nativeButton={false}
                variant="outline"
                className="w-full justify-between"
                render={<Link href="/app/social/library" />}
              >
                Open media library
                <ArrowUpRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
          <section className="rounded-2xl border bg-muted/20 p-5">
            <h2 className="text-sm font-semibold">Spending boundaries</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Per request</dt>
                <dd className="tabular-nums">
                  {videoMoney(catalog.maximumCostCents)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Daily video limit</dt>
                <dd className="tabular-nums">
                  {videoMoney(catalog.dailyBudgetCents)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Total video allowance</dt>
                <dd className="tabular-nums">
                  {videoMoney(catalog.lifetimeBudgetCents)}
                </dd>
              </div>
            </dl>
            <p className="mt-4 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
              Every request needs cost confirmation. Existing workspace and
              project budgets apply too.
            </p>
          </section>
        </aside>
      </div>
      <section className="app-section" aria-labelledby="video-history-heading">
        <div className="app-page-header items-center">
          <div className="app-heading">
            <h2
              id="video-history-heading"
              className="text-xl font-semibold tracking-tight"
            >
              Your video requests
            </h2>
            <p className="text-sm text-muted-foreground">
              Inspect progress, recover existing work and preview completed
              clips.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {loading ? "Refreshing…" : "Refresh status"}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        {items.length ? (
          <div className="app-grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
            {items.map((job) => (
              <VideoGenerationCard
                key={job.id}
                workspaceId={workspaceId}
                job={job}
                canEdit={canGenerate}
                onChanged={() => void refresh()}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed bg-card/40 py-14 text-center">
            <Film className="size-8 text-muted-foreground/60" />
            <h3 className="font-semibold">
              Your first moving frame starts here
            </h3>
            <p className="max-w-sm px-4 text-sm leading-relaxed text-muted-foreground">
              Describe one shot above. Review its estimate and start when you
              are ready.
            </p>
          </div>
        )}
        {cursor ? (
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void refresh(true)}
          >
            Load earlier requests
          </Button>
        ) : null}
      </section>
    </div>
  );
}
