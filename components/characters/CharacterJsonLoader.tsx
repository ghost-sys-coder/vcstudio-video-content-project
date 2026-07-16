"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileJsonIcon } from "lucide-react";
import {
  characterJsonSample,
  parseCharacterJson,
} from "@/lib/domain/character-json";
import type { CharacterFormValues } from "@/lib/schemas/character";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const maximumJsonFileBytes = 100 * 1024;

export function CharacterJsonLoader({
  onLoad,
}: {
  onLoad: (values: CharacterFormValues) => void;
}) {
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadValues(values: CharacterFormValues) {
    onLoad(values);
    setError(null);
    setOpen(false);
  }

  function importJson() {
    const result = parseCharacterJson(json);
    if (!result.success) {
      setError(result.error);
      return;
    }
    loadValues(result.data);
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > maximumJsonFileBytes) {
      setError("The JSON file must be 100 KB or smaller.");
      return;
    }
    setJson(await file.text());
    setError(null);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <FileJsonIcon data-icon="inline-start" /> Load JSON
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Load character JSON</DialogTitle>
          <DialogDescription>
            Paste JSON, select a file, or load the sample. This fills the form
            without saving it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="character-json-file">JSON file</Label>
            <Input
              accept=".json,application/json"
              id="character-json-file"
              onChange={selectFile}
              ref={fileInputRef}
              type="file"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="character-json">Character JSON</Label>
            <Textarea
              className="max-h-[45vh] min-h-64 font-mono text-xs"
              id="character-json"
              onChange={(event) => setJson(event.target.value)}
              placeholder='{ "name": "Character name", ... }'
              value={json}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter showCloseButton>
          <Button
            onClick={() => {
              setJson(JSON.stringify(characterJsonSample, null, 2));
              loadValues(characterJsonSample);
            }}
            type="button"
            variant="secondary"
          >
            Load sample
          </Button>
          <Button disabled={!json.trim()} onClick={importJson} type="button">
            Load into form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
