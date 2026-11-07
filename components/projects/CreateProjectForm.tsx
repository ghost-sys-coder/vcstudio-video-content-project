"use client";

import { FormSelect } from "@/components/ui/FormSelect";
import {
  SelectItem,
  SelectGroup,
  SelectGroupLabel,
} from "@/components/ui/select";
import { useMemo, useState, useTransition } from "react";
import { createProjectAction } from "@/app/(authenticated)/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormatInheritanceSummary } from "@/components/projects/FormatInheritanceSummary";
import { ProjectStyleField } from "@/components/projects/ProjectStyleField";
import type { FormatChoice } from "@/lib/formats/format-choice";
import { resolveFormatInheritance } from "@/lib/formats/format-inheritance";
import { Textarea } from "@/components/ui/textarea";
import { ProjectVisualMediaSelect } from "@/components/projects/ProjectVisualMediaSelect";
import type { ProjectAspectRatio } from "@/db/schema";
import type { IdeaNicheGroup, SavedIdeaView } from "@/lib/ideas/ideas-view";
import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";
import {
  suggestAspectRatioForPlatform,
  suggestProjectNameFromTopic,
} from "@/lib/ideas/project-seed-from-idea";

export function CreateProjectForm({
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
  const ideasById = useMemo(() => {
    const map = new Map<string, SavedIdeaView>();
    for (const group of ideaGroups)
      for (const idea of group.ideas) map.set(idea.id, idea);
    return map;
  }, [ideaGroups]);

  const initialIdea = initialIdeaId
    ? (ideasById.get(initialIdeaId) ?? null)
    : null;
  const [ideaId, setIdeaId] = useState(initialIdea?.id ?? "");
  const [name, setName] = useState(
    initialIdea ? suggestProjectNameFromTopic(initialIdea.topic) : "",
  );
  const [aspectRatio, setAspectRatio] = useState<ProjectAspectRatio>(
    initialIdea
      ? suggestAspectRatioForPlatform(initialIdea.primaryPlatform)
      : "16:9",
  );
  const [formatPresetId, setFormatPresetId] = useState("");
  // Defaults to the workspace default so a creator who ignores the field gets
  // exactly the behaviour projects had before it existed.
  const [stylePresetId, setStylePresetId] = useState(
    styles.find((style) => style.isDefault)?.id ?? styles[0]?.id ?? "",
  );
  const [framesPerSecond, setFramesPerSecond] = useState("30");
  const [budgetDollars, setBudgetDollars] = useState(
    (defaultBudgetCents / 100).toFixed(2),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedFormat =
    formats.find((format) => format.id === formatPresetId) ?? null;

  /** Seeds the form from the format; the creator may then change anything. */
  function applyFormat(id: string) {
    setFormatPresetId(id);
    const format = formats.find((entry) => entry.id === id);
    if (!format) return;
    if (format.values.aspectRatio)
      setAspectRatio(format.values.aspectRatio as ProjectAspectRatio);
    if (format.values.framesPerSecond !== null)
      setFramesPerSecond(String(format.values.framesPerSecond));
    if (format.values.maximumBudgetCents !== null)
      setBudgetDollars((format.values.maximumBudgetCents / 100).toFixed(2));
    // A format may name a style. Adopt it, but only when this workspace still
    // offers it, so an archived style cannot be reintroduced by an old format.
    if (
      format.values.stylePresetId &&
      styles.some((style) => style.id === format.values.stylePresetId)
    )
      setStylePresetId(format.values.stylePresetId);
  }

  const inheritance = selectedFormat
    ? resolveFormatInheritance({
        preset: selectedFormat.values,
        effective: {
          aspectRatio,
          framesPerSecond: Number(framesPerSecond),
          targetDurationSeconds: selectedFormat.values.targetDurationSeconds,
          maximumBudgetCents: Math.round(Number(budgetDollars) * 100),
          captionsEnabled: selectedFormat.values.captionsEnabled,
          voicePresetId: selectedFormat.values.voicePresetId,
          stylePresetId: selectedFormat.values.stylePresetId,
        },
      })
    : [];

  function applyIdea(id: string) {
    setIdeaId(id);
    const idea = ideasById.get(id);
    if (!idea) return;
    setName(suggestProjectNameFromTopic(idea.topic));
    setAspectRatio(suggestAspectRatioForPlatform(idea.primaryPlatform));
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await createProjectAction(formData);
          if (result?.error) setError(result.error);
        })
      }
      className="space-y-4"
    >
      <input name="ideaId" type="hidden" value={ideaId} />
      <input name="formatPresetId" type="hidden" value={formatPresetId} />
      {formats.length ? (
        <div className="space-y-2">
          <Label htmlFor="project-format">Format</Label>
          <FormSelect
            id="project-format"
            onValueChange={(selectedValue) => applyFormat(selectedValue)}
            value={formatPresetId}
          >
            <SelectItem value="">No format</SelectItem>
            {formats.map((format) => (
              <SelectItem key={format.id} value={String(format.id)}>
                {format.name} (v{format.versionNumber})
              </SelectItem>
            ))}
          </FormSelect>
        </div>
      ) : null}
      <ProjectStyleField
        onChange={setStylePresetId}
        styles={styles}
        value={stylePresetId}
      />
      {ideaGroups.length ? (
        <div className="space-y-2">
          <Label htmlFor="project-idea">Start from a saved idea</Label>
          <FormSelect
            id="project-idea"
            onValueChange={(selectedValue) => applyIdea(selectedValue)}
            value={ideaId}
          >
            <SelectItem value="">Blank project</SelectItem>
            {ideaGroups.map((group) => (
              <SelectGroup key={group.niche}>
                <SelectGroupLabel>{group.niche}</SelectGroupLabel>
                {group.ideas.map((idea) => (
                  <SelectItem key={idea.id} value={String(idea.id)}>
                    {idea.topic || "(untitled idea)"}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </FormSelect>
          <p className="text-xs text-muted-foreground">
            Prefills the project name, aspect ratio, and brief from the idea —
            everything below stays editable.
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="project-name">Project name</Label>
        <Input
          id="project-name"
          maxLength={100}
          name="name"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          name="description"
          maxLength={2000}
        />
      </div>
      <ProjectVisualMediaSelect />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="project-ratio">Aspect ratio</Label>
          <FormSelect
            id="project-ratio"
            name="aspectRatio"
            onValueChange={(selectedValue) =>
              setAspectRatio(selectedValue as ProjectAspectRatio)
            }
            value={aspectRatio}
          >
            <SelectItem value="16:9">16:9</SelectItem>
            <SelectItem value="9:16">9:16</SelectItem>
            <SelectItem value="1:1">1:1</SelectItem>
          </FormSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-fps">Frame rate</Label>
          <FormSelect
            id="project-fps"
            name="framesPerSecond"
            onValueChange={(selectedValue) => setFramesPerSecond(selectedValue)}
            value={framesPerSecond}
          >
            <SelectItem value="24">24</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="30">30</SelectItem>
            <SelectItem value="60">60</SelectItem>
          </FormSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-language">Language</Label>
          <Input
            defaultValue="English"
            id="project-language"
            name="language"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-budget">Maximum budget (USD)</Label>
          <Input
            id="project-budget"
            min="0"
            name="budgetDollars"
            onChange={(event) => setBudgetDollars(event.target.value)}
            step="0.01"
            type="number"
            value={budgetDollars}
          />
        </div>
      </div>
      {selectedFormat ? (
        <FormatInheritanceSummary
          formatName={selectedFormat.name}
          resolutions={inheritance}
          versionNumber={selectedFormat.versionNumber}
        />
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}
