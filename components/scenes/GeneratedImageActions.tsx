import type {
  SceneImageActionResult,
  SceneImageReviewStatus,
} from "@/lib/scenes/scene-image-view";
import { ApproveGeneratedImageButton } from "@/components/scenes/ApproveGeneratedImageButton";
import { RejectGeneratedImageButton } from "@/components/scenes/RejectGeneratedImageButton";

export function GeneratedImageActions({
  generationId,
  reviewStatus,
  disabled,
  onApprove,
  onReject,
}: {
  generationId: string;
  reviewStatus: SceneImageReviewStatus;
  disabled: boolean;
  onApprove: (generationId: string) => Promise<SceneImageActionResult>;
  onReject: (generationId: string) => Promise<SceneImageActionResult>;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ApproveGeneratedImageButton
        approved={reviewStatus === "approved"}
        disabled={disabled}
        generationId={generationId}
        onApprove={onApprove}
      />
      <RejectGeneratedImageButton
        disabled={disabled}
        generationId={generationId}
        onReject={onReject}
        rejected={reviewStatus === "rejected"}
      />
    </div>
  );
}
