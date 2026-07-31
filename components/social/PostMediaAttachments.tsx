"use client";

import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "lucide-react";
import { MediaAssetPreview } from "@/components/social/MediaAssetPreview";
import { Button } from "@/components/ui/button";
import type { PostAttachmentView } from "@/lib/social/social-post-view";

/**
 * The post's attached media, in send order.
 *
 * Order is editable because it is meaningful: it decides carousel sequence on
 * Instagram and image order on LinkedIn and Facebook.
 */
export function PostMediaAttachments({
  attachments,
  editable,
  onMove,
  onRemove,
}: {
  attachments: PostAttachmentView[];
  editable: boolean;
  onMove: (assetId: string, direction: -1 | 1) => void;
  onRemove: (assetId: string) => void;
}) {
  if (attachments.length === 0)
    return (
      <p className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        No media attached. Text on its own can go to LinkedIn and Facebook;
        Instagram, TikTok, and YouTube all need something attached.
      </p>
    );

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {attachments.map((attachment, index) => (
        <li className="space-y-1" key={attachment.asset.id}>
          <MediaAssetPreview asset={attachment.asset} />
          <p className="truncate text-xs" title={attachment.asset.title}>
            {attachment.asset.title}
          </p>
          {attachment.source === "render" ? (
            <p className="text-xs text-muted-foreground">Project render</p>
          ) : null}
          {attachment.unavailable ? (
            <p className="text-xs text-amber-700 dark:text-amber-500">
              {attachment.source === "render"
                ? "This render is no longer available — re-render before posting."
                : "Removed from the library — still attached to this post."}
            </p>
          ) : null}
          {editable ? (
            <div className="flex gap-1">
              <Button
                aria-label={`Move ${attachment.asset.title} earlier`}
                disabled={index === 0}
                onClick={() => onMove(attachment.asset.id, -1)}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <ArrowLeftIcon />
              </Button>
              <Button
                aria-label={`Move ${attachment.asset.title} later`}
                disabled={index === attachments.length - 1}
                onClick={() => onMove(attachment.asset.id, 1)}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <ArrowRightIcon />
              </Button>
              <Button
                aria-label={`Remove ${attachment.asset.title}`}
                className="ml-auto"
                onClick={() => onRemove(attachment.asset.id)}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
