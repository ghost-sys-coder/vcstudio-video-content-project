"use client";

import { Plus } from "lucide-react";
import { CreateProjectForm } from "@/components/projects/CreateProjectForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateProjectDialog({
  defaultBudgetCents,
}: {
  defaultBudgetCents: number;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <Plus />
        New project
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Set the production format and budget ceiling. You can change these
            later.
          </DialogDescription>
        </DialogHeader>
        <CreateProjectForm defaultBudgetCents={defaultBudgetCents} />
      </DialogContent>
    </Dialog>
  );
}
