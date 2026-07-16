"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CharacterReferenceAsset } from "@/db/schema";
import { characterReferenceTypeLabels } from "@/components/characters/CharacterReferenceTypeSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CharacterReferenceCard({
  reference,
  canManage,
}: {
  reference: CharacterReferenceAsset;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const url = `/api/workspaces/${reference.workspaceId}/characters/${reference.characterId}/references/${reference.id}`;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-square bg-muted">
        <Image
          alt={`${characterReferenceTypeLabels[reference.type]} for character`}
          fill
          sizes="(max-width: 640px) 100vw, 240px"
          src={url}
          unoptimized
        />
      </div>
      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {characterReferenceTypeLabels[reference.type]}
          </p>
          <Badge variant="secondary">{reference.source}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {reference.width}×{reference.height} ·{" "}
          {(reference.sizeBytes / 1024 / 1024).toFixed(1)} MB
        </p>
        {canManage ? (
          <Button
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  "Delete this reference image? This also removes it from storage.",
                )
              )
                return;
              startTransition(async () => {
                const response = await fetch(url, { method: "DELETE" });
                if (!response.ok)
                  return setError("The reference could not be deleted.");
                router.refresh();
              });
            }}
            size="sm"
            type="button"
            variant="destructive"
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
