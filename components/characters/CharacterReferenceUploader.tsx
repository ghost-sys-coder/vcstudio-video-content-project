"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CharacterReferenceType } from "@/db/schema";
import { CharacterReferenceTypeSelector } from "@/components/characters/CharacterReferenceTypeSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadCharacterReference } from "@/lib/storage/upload-character-reference.client";

export function CharacterReferenceUploader({
  workspaceId,
  characterId,
}: {
  workspaceId: string;
  characterId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<CharacterReferenceType>("master");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <CharacterReferenceTypeSelector
        disabled={pending}
        onChange={setType}
        value={type}
      />
      <div className="space-y-2">
        <Label htmlFor="character-reference-file">Image</Label>
        <Input
          accept="image/png,image/jpeg,image/webp"
          disabled={pending}
          id="character-reference-file"
          ref={inputRef}
          type="file"
        />
      </div>
      <Button
        disabled={pending}
        onClick={() => {
          const file = inputRef.current?.files?.[0];
          if (!file) return setError("Choose an image first.");
          startTransition(async () => {
            try {
              await uploadCharacterReference({
                workspaceId,
                characterId,
                type,
                file,
              });
              setError(null);
              if (inputRef.current) inputRef.current.value = "";
              router.refresh();
            } catch (uploadError) {
              setError(
                uploadError instanceof Error
                  ? uploadError.message
                  : "Upload failed.",
              );
            }
          });
        }}
        type="button"
      >
        {pending ? "Uploading…" : "Upload reference"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive sm:col-span-3" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground sm:col-span-3">
        PNG, JPEG, or WebP · maximum 5 MB · 512–4096 pixels per dimension.
      </p>
    </div>
  );
}
