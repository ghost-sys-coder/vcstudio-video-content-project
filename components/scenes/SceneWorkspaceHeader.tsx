import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SceneWorkspaceHeader({
  sceneNumber,
  totalCount,
  previousDisabled,
  nextDisabled,
  onPrevious,
  onNext,
}: {
  sceneNumber: number;
  totalCount: number;
  previousDisabled: boolean;
  nextDisabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <div>
        <p className="text-sm font-medium">Scene {sceneNumber}</p>
        <p className="text-xs text-muted-foreground">
          Scene {sceneNumber} of {totalCount}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          disabled={previousDisabled}
          onClick={onPrevious}
          type="button"
          variant="outline"
        >
          <ChevronLeftIcon data-icon="inline-start" />
          Previous
        </Button>
        <Button
          disabled={nextDisabled}
          onClick={onNext}
          type="button"
          variant="outline"
        >
          Next
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
