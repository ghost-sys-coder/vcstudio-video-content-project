"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateCharacterReferenceAction } from "@/app/(authenticated)/app/characters/actions";
import type { PortraitViewOption } from "@/lib/characters/character-reference-generation-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function GenerateCharacterPortraitDialog({
  characterId,
  model,
  views,
}: {
  characterId: string;
  model: string;
  views: PortraitViewOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(views[0]?.type ?? "front");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedView = views.find((view) => view.type === selected) ?? views[0];

  function generate() {
    startTransition(async () => {
      const data = new FormData();
      data.set("characterId", characterId);
      data.set("referenceType", selected);
      data.set("requestNonce", crypto.randomUUID());
      const result = await generateCharacterReferenceAction(data);
      setError(result.error);
      if (result.success) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
      open={open}
    >
      <DialogTrigger render={<Button size="sm" variant="default" />}>
        Generate portrait
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate a reference portrait</DialogTitle>
          <DialogDescription>
            Create a canonical reference image from this character&apos;s
            identity using {model}. It is saved as a generated reference and
            used automatically in scenes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {views.map((view) => (
            <label
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
              key={view.type}
            >
              <span className="flex items-center gap-3">
                <input
                  checked={selected === view.type}
                  name="portrait-view"
                  onChange={() => setSelected(view.type)}
                  type="radio"
                />
                <span className="text-sm font-medium">{view.label}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                ~{formatCents(view.estimatedCostCents)}
              </span>
            </label>
          ))}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter showCloseButton>
          <Button disabled={pending} onClick={generate}>
            {pending
              ? "Starting…"
              : `Generate (~${formatCents(selectedView?.estimatedCostCents ?? 0)})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
