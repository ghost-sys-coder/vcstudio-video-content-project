"use client";

import { Plus } from "lucide-react";
import { CreateProjectForm } from "@/components/projects/CreateProjectForm";
import type { FormatChoice } from "@/lib/formats/format-choice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { IdeaNicheGroup } from "@/lib/ideas/ideas-view";
import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";

export function CreateProjectDialog({
  defaultBudgetCents,
  formats,
  ideaGroups,
  initialIdeaId,
  styles,
}: {
  defaultBudgetCents: number;
  formats: FormatChoice[];
  ideaGroups: IdeaNicheGroup[];
  initialIdeaId?: string | null;
  styles: SceneImageStylePresetView[];
}) {
  return (
    <Dialog defaultOpen={Boolean(initialIdeaId)}>
      <DialogTrigger render={<Button />}>
        <Plus />
        New project
      </DialogTrigger>
      {/* Wider than the default `sm:max-w-sm`: this form has a two-column
          field group, and at the default width each column is too narrow to
          read comfortably. */}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Set the production format and budget ceiling. You can change these
            later.
          </DialogDescription>
        </DialogHeader>
        <CreateProjectForm
          defaultBudgetCents={defaultBudgetCents}
          formats={formats}
          ideaGroups={ideaGroups}
          initialIdeaId={initialIdeaId}
          styles={styles}
        />
      </DialogContent>
    </Dialog>
  );
}
