import { Check } from "lucide-react";
import { acknowledgeActivityAction } from "@/app/(authenticated)/app/activity/actions";
import { Button } from "@/components/ui/button";

export function ActivityAcknowledgeButton({
  activityKey,
  workspaceId,
}: {
  activityKey: string;
  workspaceId: string;
}) {
  return (
    <form action={acknowledgeActivityAction}>
      <input type="hidden" name="activityKey" value={activityKey} />
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <Button type="submit" size="sm" variant="outline">
        <Check />
        Acknowledge
      </Button>
    </form>
  );
}
