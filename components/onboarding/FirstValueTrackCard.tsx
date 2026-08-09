import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FirstValueMilestoneRow } from "@/components/onboarding/FirstValueMilestoneRow";
import type { FirstValueTrack } from "@/lib/onboarding/first-value-onboarding";

export function FirstValueTrackCard({ track }: { track: FirstValueTrack }) {
  const percentage = track.totalCount
    ? Math.min(100, Math.round((track.completedCount / track.totalCount) * 100))
    : 0;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{track.title}</CardTitle>
          <span className="text-xs text-muted-foreground">
            {track.completedCount}/{track.totalCount}
          </span>
        </div>
        <CardDescription>{track.description}</CardDescription>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`${track.title} ${percentage}% complete`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {track.milestones.map((milestone) => (
            <FirstValueMilestoneRow key={milestone.id} milestone={milestone} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
