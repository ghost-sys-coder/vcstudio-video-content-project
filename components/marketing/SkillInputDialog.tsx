"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SkillConfirmCostCheckbox } from "@/components/marketing/SkillConfirmCostCheckbox";
import { SkillCostBadge } from "@/components/marketing/SkillCostBadge";
import { SkillInputField } from "@/components/marketing/SkillInputField";
import type { MarketingSkillCatalogueItem } from "@/lib/marketing/skills/skill-definition";
export function SkillInputDialog({
  skill,
  onClose,
  onSubmit,
}: {
  skill: MarketingSkillCatalogueItem | null;
  onClose: () => void;
  onSubmit: (inputs: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  if (!skill) return null;
  const complete = skill.inputFields.every(
    (field) => !field.required || (values[field.key] ?? "").trim() !== "",
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{skill.label}</DialogTitle>
          <DialogDescription>{skill.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {skill.inputFields.map((field) => (
            <SkillInputField
              field={field}
              key={field.key}
              onChange={(value) =>
                setValues((current) => ({ ...current, [field.key]: value }))
              }
              value={values[field.key] ?? ""}
            />
          ))}
          <SkillCostBadge range={skill.estimatedCostRangeCents} />
          {skill.requiresConfirmation ? (
            <SkillConfirmCostCheckbox
              checked={confirmed}
              onChange={setConfirmed}
            />
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={!complete || (skill.requiresConfirmation && !confirmed)}
            onClick={() => onSubmit(values)}
            type="button"
          >
            Use skill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
