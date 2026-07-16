"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Character } from "@/db/schema";
import {
  createCharacterAction,
  updateCharacterAction,
} from "@/app/(authenticated)/app/characters/actions";
import { Button } from "@/components/ui/button";
import { CharacterJsonLoader } from "@/components/characters/CharacterJsonLoader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CharacterFormValues } from "@/lib/schemas/character";

const fields = [
  ["description", "Description"],
  ["visualIdentity", "Visual identity"],
  ["bodyProportions", "Body proportions"],
  ["faceDescription", "Face description"],
  ["hairDescription", "Hair description"],
  ["skinToneDescription", "Skin tone description"],
  ["defaultOutfitDescription", "Default outfit"],
  ["personalityNotes", "Personality notes"],
  ["continuityRules", "Continuity rules"],
  ["negativeConstraints", "Negative constraints"],
] as const;

export function CharacterForm({
  character,
  onSuccess,
  readOnly = false,
}: {
  character?: Character;
  onSuccess?: () => void;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          setSuccess(null);
          const result = character
            ? await updateCharacterAction(formData)
            : await createCharacterAction(formData);
          setError(result.error);
          if (result.success) {
            setSuccess(character ? "Character saved successfully." : null);
            router.refresh();
            onSuccess?.();
          }
        })
      }
      className="space-y-5"
    >
      {readOnly ? null : (
        <div className="flex justify-end">
          <CharacterJsonLoader
            onLoad={(values: CharacterFormValues) => {
              const form = formRef.current;
              if (!form) return;
              for (const [name, value] of Object.entries(values)) {
                const field = form.elements.namedItem(name);
                if (
                  field instanceof HTMLInputElement ||
                  field instanceof HTMLTextAreaElement ||
                  field instanceof HTMLSelectElement
                ) {
                  field.value = value;
                }
              }
              setError(null);
              setSuccess(
                "Character JSON loaded. Review the details, then save.",
              );
            }}
          />
        </div>
      )}
      {character ? (
        <input name="characterId" type="hidden" value={character.id} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="character-name">Name</Label>
          <Input
            defaultValue={character?.name}
            disabled={readOnly}
            id="character-name"
            name="name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="character-status">Status</Label>
          <select
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            defaultValue={character?.status ?? "draft"}
            disabled={readOnly}
            id="character-status"
            name="status"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            {character?.status === "archived" ? (
              <option value="archived">Archived</option>
            ) : null}
          </select>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {fields.map(([name, label]) => (
          <div className="space-y-2" key={name}>
            <Label htmlFor={`character-${name}`}>{label}</Label>
            <Textarea
              defaultValue={character?.[name] ?? ""}
              disabled={readOnly}
              id={`character-${name}`}
              name={name}
              rows={3}
            />
          </div>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="text-sm text-emerald-700 dark:text-emerald-400"
          role="status"
        >
          {success}
        </p>
      ) : null}
      {readOnly ? null : (
        <Button disabled={pending} type="submit">
          {pending
            ? "Saving…"
            : character
              ? "Save character"
              : "Create character"}
        </Button>
      )}
    </form>
  );
}
