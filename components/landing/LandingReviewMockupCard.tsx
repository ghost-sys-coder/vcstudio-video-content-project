import { CheckIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingReviewMockupCard() {
  return (
    <div className="mx-auto mt-14 max-w-2xl overflow-hidden rounded-2xl border bg-background shadow-lg">
      <div className="h-40 bg-[linear-gradient(135deg,#839eb1_0%,#3f4f5b_60%,#0b0e13_100%)]" />
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium">Scene 04 — Rooftop reveal</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Image generation · $0.038 reserved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" type="button" variant="outline">
            <RotateCcwIcon data-icon="inline-start" />
            Regenerate
          </Button>
          <Button size="sm" type="button">
            <CheckIcon data-icon="inline-start" />
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
