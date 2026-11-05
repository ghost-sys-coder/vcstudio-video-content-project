"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/FormSelect";
import { Label } from "@/components/ui/label";
import { SelectItem } from "@/components/ui/select";
import { Spinner } from "@/components/ui/Spinner";
import {
  PRODUCTION_QUEUE_ATTENTION_FILTERS,
  PRODUCTION_QUEUE_RELEASE_FILTERS,
  type ProductionQueueAttentionFilter,
  type ProductionQueueReleaseFilter,
} from "@/lib/production/production-queue-filters";
import {
  ATTENTION_FILTER_LABELS,
  RELEASE_FILTER_LABELS,
  buildProductionQueueHref,
} from "@/lib/production/production-queue-view";

export function ProductionQueueFilters({
  attention,
  channelProfileId,
  channels,
  release,
}: {
  attention: ProductionQueueAttentionFilter;
  channelProfileId: string | null;
  channels: { id: string; name: string }[];
  release: ProductionQueueReleaseFilter;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const filtered =
    attention !== "all" || release !== "all" || channelProfileId !== null;
  const unavailableChannel =
    channelProfileId !== null &&
    !channels.some((channel) => channel.id === channelProfileId);
  function navigate(href: string) {
    startTransition(() => router.push(href));
  }
  return (
    <Card className="min-w-0 shadow-sm">
      <CardHeader className="border-b">
        <div className="app-page-header items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <SlidersHorizontal aria-hidden="true" className="size-4" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">
              Focus your queue
            </h2>
          </div>
          {filtered && (
            <Link
              href="/app/queue"
              prefetch={false}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Clear filters
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-5 md:grid-cols-2">
        <nav aria-label="Queue attention" className="space-y-2 md:col-span-2">
          <p className="text-sm font-medium">Attention</p>
          <div className="flex flex-wrap gap-2">
            {PRODUCTION_QUEUE_ATTENTION_FILTERS.map((value) => (
              <Link
                key={value}
                href={buildProductionQueueHref({
                  attention: value,
                  channelProfileId,
                  release,
                })}
                prefetch={false}
                aria-current={attention === value ? "page" : undefined}
                className={buttonVariants({
                  size: "sm",
                  variant: attention === value ? "secondary" : "ghost",
                })}
              >
                {ATTENTION_FILTER_LABELS[value]}
              </Link>
            ))}
          </div>
        </nav>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="queue-release">Release state</Label>
          <FormSelect
            id="queue-release"
            className="w-full min-w-0"
            value={release}
            disabled={isPending}
            onValueChange={(value) => {
              const nextRelease = PRODUCTION_QUEUE_RELEASE_FILTERS.find(
                (candidate) => candidate === value,
              );
              if (nextRelease)
                navigate(
                  buildProductionQueueHref({
                    attention,
                    channelProfileId,
                    release: nextRelease,
                  }),
                );
            }}
          >
            {PRODUCTION_QUEUE_RELEASE_FILTERS.map((value) => (
              <SelectItem key={value} value={value}>
                {RELEASE_FILTER_LABELS[value]}
              </SelectItem>
            ))}
          </FormSelect>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="queue-channel">Channel</Label>
          <FormSelect
            id="queue-channel"
            className="w-full min-w-0"
            value={channelProfileId ?? ""}
            disabled={isPending || channels.length === 0}
            onValueChange={(value) =>
              navigate(
                buildProductionQueueHref({
                  attention,
                  channelProfileId: value || null,
                  release,
                }),
              )
            }
          >
            <SelectItem value="">Every channel</SelectItem>
            {unavailableChannel && (
              <SelectItem value={channelProfileId} disabled>
                Unavailable channel
              </SelectItem>
            )}
            {channels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                {channel.name}
              </SelectItem>
            ))}
          </FormSelect>
        </div>
        {isPending && (
          <p
            role="status"
            className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2"
          >
            <Spinner aria-hidden />
            Updating queue…
          </p>
        )}
      </CardContent>
    </Card>
  );
}
