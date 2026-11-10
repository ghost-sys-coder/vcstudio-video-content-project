"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoSelectField } from "./VideoSelectField";
import { projectVisualDefaultAction } from "@/app/(authenticated)/app/video/actions";
export function ProjectVisualDefault({
  workspaceId,
  projectId,
  initialKind,
  updatedAt,
  canEdit,
}: {
  workspaceId: string;
  projectId: string;
  initialKind: "image" | "video";
  updatedAt: string;
  canEdit: boolean;
}) {
  const [kind, setKind] = useState(initialKind),
    [revision, setRevision] = useState(updatedAt),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const result = await projectVisualDefaultAction(workspaceId, {
        projectId,
        kind,
        expectedUpdatedAt: revision,
      });
      if (!result.ok) setMessage(result.error);
      else {
        setRevision(result.value.updatedAt);
        setMessage("Visual default saved. Individual scenes can override it.");
        router.refresh();
      }
    } catch {
      setMessage(
        "The default could not be saved. Refresh the project and try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="app-panel space-y-4">
      <div className="app-heading">
        <h2 className="font-semibold">Default scene visuals</h2>
        <p className="text-sm text-muted-foreground">
          Mix still images and video in one project. Scenes inherit this choice
          unless you override them. Video footage uses existing project
          narration.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 sm:flex-1">
          <VideoSelectField
            id="project-visual-default"
            label="Use by default"
            value={kind}
            disabled={!canEdit || pending}
            options={[
              { value: "image", label: "Still images" },
              { value: "video", label: "Video footage" },
            ]}
            onChange={(value) => {
              if (value === "image" || value === "video") setKind(value);
            }}
          />
        </div>
        <Button
          className="h-10 w-full sm:w-auto"
          disabled={!canEdit || pending}
          onClick={() => void save()}
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {pending ? "Saving…" : "Save visual default"}
        </Button>
      </div>
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </section>
  );
}
