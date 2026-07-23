import type { ContentPlatform } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  formatDurationLabel,
  PLATFORM_LABELS,
} from "@/lib/ideas/platform-labels";

export type IdeaCardData = {
  topic: string;
  targetAudience: string;
  tone: string;
  targetDurationSeconds: number | null;
  primaryPlatform: ContentPlatform;
  hookAngle: string;
  rationale: string;
  hookType: string;
};

/** Shared read-only presentation of an idea's fields, used by generated and saved cards. */
export function IdeaCardBody({ idea }: { idea: IdeaCardData }) {
  return (
    <div className="space-y-3">
      <p className="font-medium leading-snug">{idea.topic}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">
          {PLATFORM_LABELS[idea.primaryPlatform]}
        </Badge>
        <Badge variant="outline">
          {formatDurationLabel(idea.targetDurationSeconds)}
        </Badge>
        {idea.hookType ? (
          <Badge variant="outline">{idea.hookType}</Badge>
        ) : null}
      </div>
      <dl className="space-y-1.5 text-xs text-muted-foreground">
        {idea.targetAudience ? (
          <div>
            <dt className="inline font-medium text-foreground">Audience: </dt>
            <dd className="inline">{idea.targetAudience}</dd>
          </div>
        ) : null}
        {idea.tone ? (
          <div>
            <dt className="inline font-medium text-foreground">Tone: </dt>
            <dd className="inline">{idea.tone}</dd>
          </div>
        ) : null}
        {idea.hookAngle ? (
          <div>
            <dt className="inline font-medium text-foreground">Hook: </dt>
            <dd className="inline">{idea.hookAngle}</dd>
          </div>
        ) : null}
      </dl>
      {idea.rationale ? (
        <p className="text-xs text-muted-foreground italic">{idea.rationale}</p>
      ) : null}
    </div>
  );
}
