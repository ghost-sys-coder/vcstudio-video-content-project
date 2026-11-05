"use client";
import { useState } from "react";
import { ArrowUpRight, Clapperboard, LoaderCircle, X } from "lucide-react";
import {
  videoGenerationModeSchema,
  videoAspectRatioSchema,
  videoResolutionSchema,
  videoAudioModeSchema,
  videoInputRoleSchema,
  type VideoGenerationRequest,
  type VideoGenerationTarget,
} from "@studio/contracts/video";
import {
  quoteVideoAction,
  sceneStarterImageAction,
} from "@/app/(authenticated)/app/video/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { VideoSelectField } from "./VideoSelectField";
import { VideoAssetPicker } from "./VideoAssetPicker";
import { VideoQuoteDialog } from "./VideoQuoteDialog";
import {
  defaultVideoRequest,
  videoOutputChoices,
} from "@/lib/video-generation/video-composer-options";
import type { VideoCatalogView } from "@/lib/video-generation/video-generation-view";

const modeLabels = {
  text_to_video: "Text to video",
  image_to_video: "Image to video",
  reference_to_video: "Reference to video",
};
export function VideoComposer({
  workspaceId,
  catalog,
  canGenerate,
  target,
  initialPrompt = "",
  onStarted,
}: {
  workspaceId: string;
  catalog: VideoCatalogView;
  canGenerate: boolean;
  target?: VideoGenerationTarget;
  initialPrompt?: string;
  onStarted: () => void;
}) {
  const [request, setRequest] = useState<VideoGenerationRequest>(() => ({
    ...defaultVideoRequest(
      catalog.models.find((item) => item.configured)?.model ??
        catalog.models[0]!.model,
      target,
    ),
    prompt: initialPrompt,
  }));
  const [assetNames, setAssetNames] = useState<Record<string, string>>({});
  const [quoting, setQuoting] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [loadingStarter, setLoadingStarter] = useState(false);
  const [quote, setQuote] = useState<
    | Extract<
        Awaited<ReturnType<typeof quoteVideoAction>>,
        { ok: true }
      >["value"]
    | null
  >(null);
  const entry =
    catalog.models.find((entry) => entry.model.id === request.modelId) ??
    catalog.models[0]!;
  const model = entry.model,
    choices = videoOutputChoices(model, request);
  const disabled =
    !canGenerate || !catalog.enabled || !entry.configured || quoting;
  const patch = (next: Partial<VideoGenerationRequest>) => {
    setError(null);
    setRequest((current) => ({ ...current, ...next }));
  };
  async function estimate() {
    setQuoting(true);
    setError(null);
    try {
      const result = await quoteVideoAction(workspaceId, request);
      if (result.ok) setQuote(result.value);
      else setError(result.error);
    } catch {
      setError(
        "The estimate could not be loaded. Your prompt is still here; try again.",
      );
    } finally {
      setQuoting(false);
    }
  }
  async function applySceneStarter() {
    if (request.target.kind !== "scene") return;
    setLoadingStarter(true);
    setError(null);
    try {
      const result = await sceneStarterImageAction(workspaceId, {
        projectId: request.target.projectId,
        sceneId: request.target.sceneId,
      });
      if (!result.ok) setError(result.error);
      else if (result.value.sceneVersionId !== request.target.sceneVersionId)
        setError(
          "The scene changed. Return to it and reopen video generation.",
        );
      else {
        patch({
          mode: "image_to_video",
          inputs: [
            {
              assetId: result.value.assetId,
              source: "scene_image",
              role: "first_frame",
            },
          ],
        });
        setAssetNames((current) => ({
          ...current,
          [result.value.assetId]: result.value.title,
        }));
      }
    } catch {
      setError(
        "The approved scene image could not be loaded. Your prompt is preserved.",
      );
    } finally {
      setLoadingStarter(false);
    }
  }
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl border bg-secondary">
              <Clapperboard className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">
                {target?.kind === "scene"
                  ? "Create scene footage"
                  : "Create a video"}
              </h2>
              <p className="text-xs text-muted-foreground">
                One prompt. Your choice of motion.
              </p>
            </div>
          </div>
          <Badge variant="outline">
            {target?.kind === "scene"
              ? "Project narration"
              : "Independent creation"}
          </Badge>
        </div>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void estimate();
          }}
        >
          <fieldset disabled={quoting} className="min-w-0 space-y-5">
            {request.target.kind === "scene" &&
            model.modes.includes("image_to_video") ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/20 p-4">
                <p className="max-w-md text-sm text-muted-foreground">
                  Animate the scene&apos;s approved still, or start from another
                  reference.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canGenerate || loadingStarter}
                  onClick={() => void applySceneStarter()}
                >
                  {loadingStarter ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : null}
                  {loadingStarter
                    ? "Loading scene image…"
                    : "Use approved scene image"}
                </Button>
              </div>
            ) : null}
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <VideoSelectField
                id="video-model"
                label="Model"
                value={request.modelId}
                options={catalog.models.map((item) => ({
                  value: item.model.id,
                  label: `${item.model.name}${!item.configured ? " · Not configured" : ""}`,
                  disabled: !item.configured,
                }))}
                onChange={(id) => {
                  const next = catalog.models.find(
                    (item) => item.model.id === id,
                  );
                  if (next) {
                    setRequest((current) => ({
                      ...defaultVideoRequest(next.model, current.target),
                      title: current.title,
                      prompt: current.prompt,
                    }));
                    setAssetNames({});
                  }
                }}
              />
              <VideoSelectField
                id="video-mode"
                label="Starting point"
                value={request.mode}
                options={model.modes.map((mode) => ({
                  value: mode,
                  label: modeLabels[mode],
                }))}
                onChange={(value) => {
                  const mode = videoGenerationModeSchema.parse(value);
                  const defaults = defaultVideoRequest(model, request.target);
                  patch({
                    ...defaults,
                    mode,
                    prompt: request.prompt,
                    title: request.title,
                    inputs: [],
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-title">Name</Label>
              <Input
                id="video-title"
                value={request.title}
                maxLength={160}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="video-prompt">Describe your video</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {request.prompt.length}/{model.maxPromptCharacters}
                </span>
              </div>
              <Textarea
                id="video-prompt"
                className="min-h-44 resize-y text-base leading-relaxed"
                placeholder="Describe the subject, movement, camera and atmosphere. For native audio, include the dialogue or sounds you want."
                value={request.prompt}
                minLength={5}
                maxLength={model.maxPromptCharacters}
                required
                onChange={(event) => patch({ prompt: event.target.value })}
              />
            </div>
            {request.mode !== "text_to_video" ? (
              <section
                className="space-y-3 rounded-2xl border border-dashed bg-muted/20 p-4"
                aria-label="Reference images"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {request.mode === "image_to_video"
                        ? model.inputRoles.includes("last_frame")
                          ? "First and last frames"
                          : "First frame"
                        : "Visual references"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Private library images · up to {model.maxInputs}
                    </p>
                  </div>
                  <VideoAssetPicker
                    disabled={request.inputs.length >= model.maxInputs}
                    onSelect={(asset) => {
                      const role =
                        request.mode === "image_to_video"
                          ? request.inputs.length
                            ? "last_frame"
                            : "first_frame"
                          : "reference";
                      if (!model.inputRoles.includes(role)) return;
                      patch({
                        inputs: [
                          ...request.inputs,
                          { assetId: asset.id, role },
                        ],
                      });
                      setAssetNames((current) => ({
                        ...current,
                        [asset.id]: asset.title,
                      }));
                    }}
                  />
                </div>
                {request.inputs.map((asset, index) => (
                  <div
                    className="flex min-w-0 flex-wrap items-end gap-3 rounded-xl border bg-card/70 p-3"
                    key={`${asset.assetId}:${index}`}
                  >
                    <span className="min-w-0 flex-1 truncate pb-2 text-sm">
                      {assetNames[asset.assetId] ?? "Library image"}
                    </span>
                    <div className="w-full min-w-0 sm:w-44">
                      <VideoSelectField
                        id={`video-reference-${index}`}
                        label="Use as"
                        value={asset.role}
                        options={model.inputRoles
                          .filter((role) =>
                            request.mode === "image_to_video"
                              ? ["first_frame", "last_frame"].includes(role)
                              : !["first_frame", "last_frame"].includes(role),
                          )
                          .map((role) => ({
                            value: role,
                            label: role.replaceAll("_", " "),
                          }))}
                        onChange={(value) =>
                          patch({
                            inputs: request.inputs.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    role: videoInputRoleSchema.parse(value),
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${assetNames[asset.assetId] ?? "reference"}`}
                      onClick={() =>
                        patch({
                          inputs: request.inputs.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </section>
            ) : null}
            {request.mode === "image_to_video" ? (
              <VideoSelectField
                id="video-reference-fit"
                label="Starting-frame fit"
                value={request.fit}
                options={[
                  { value: "contain", label: "Fit the entire image" },
                  { value: "cover", label: "Fill the frame (crop)" },
                ]}
                onChange={(value) => {
                  if (value === "contain" || value === "cover")
                    patch({ fit: value });
                }}
              />
            ) : null}
            <div className="grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-3">
              <VideoSelectField
                id="video-aspect"
                label="Aspect ratio"
                value={request.aspectRatio}
                options={choices.aspects.map((value) => ({
                  value,
                  label: value,
                }))}
                onChange={(value) => {
                  const aspectRatio = videoAspectRatioSchema.parse(value);
                  const output = model.outputs.find(
                    (output) =>
                      output.aspectRatio === aspectRatio &&
                      (!output.modes || output.modes.includes(request.mode)),
                  )!;
                  patch({
                    aspectRatio,
                    resolution: output.resolution,
                    durationSeconds: output.durationsSeconds.includes(
                      request.durationSeconds,
                    )
                      ? request.durationSeconds
                      : output.durationsSeconds[0]!,
                  });
                }}
              />
              <VideoSelectField
                id="video-resolution"
                label="Resolution"
                value={request.resolution}
                options={choices.resolutions.map((value) => ({
                  value,
                  label: `${value}${!entry.pricedOutputs.includes(value) ? " · Pricing pending" : ""}`,
                  disabled: !entry.pricedOutputs.includes(value),
                }))}
                onChange={(value) =>
                  patch({ resolution: videoResolutionSchema.parse(value) })
                }
              />
              <VideoSelectField
                id="video-duration"
                label={
                  model.durationControl === "prompt"
                    ? "Requested duration"
                    : "Duration"
                }
                value={String(request.durationSeconds)}
                options={choices.durations.map((value) => ({
                  value: String(value),
                  label: `${value} seconds`,
                }))}
                onChange={(value) => patch({ durationSeconds: Number(value) })}
              />
            </div>
            {model.audioModes.includes("native") &&
            request.target.kind === "direct" ? (
              <VideoSelectField
                id="video-audio"
                label="Native audio"
                value={request.audio}
                options={[
                  { value: "none", label: "Remove native audio" },
                  { value: "native", label: "Keep dialogue, music and sound" },
                ]}
                onChange={(value) =>
                  patch({ audio: videoAudioModeSchema.parse(value) })
                }
              />
            ) : null}
            {model.audioGeneration === "always" && request.audio === "none" ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                This model generates sound with every clip. Removing it does not
                reduce the provider price.
              </p>
            ) : null}
            {model.supportsNegativePrompt ? (
              <div className="space-y-2">
                <Label htmlFor="video-negative">Avoid in the result</Label>
                <Textarea
                  id="video-negative"
                  value={request.negativePrompt}
                  onChange={(event) =>
                    patch({ negativePrompt: event.target.value })
                  }
                />
              </div>
            ) : null}
            {model.supportsSeed ? (
              <div className="space-y-2">
                <Label htmlFor="video-seed">Seed (optional)</Label>
                <Input
                  id="video-seed"
                  type="number"
                  min={0}
                  max={2147483647}
                  value={request.seed ?? ""}
                  onChange={(event) =>
                    patch({
                      seed:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />
              </div>
            ) : null}
          </fieldset>
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              {model.durationControl === "prompt"
                ? "The model chooses the final length. Estimates cover its maximum duration."
                : "Review the cost before starting. Nothing is generated until you confirm."}
            </p>
            <Button
              type="submit"
              disabled={disabled || request.prompt.trim().length < 5}
            >
              {quoting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ArrowUpRight className="size-4" />
              )}
              {quoting ? "Getting estimate…" : "Review estimate"}
            </Button>
          </div>
          {!catalog.enabled ? (
            <p className="text-sm text-muted-foreground">
              Live generation is paused. Your prompt can still be prepared here.
            </p>
          ) : !canGenerate ? (
            <p className="text-sm text-muted-foreground">
              Your role allows viewing videos. An owner or editor can start
              generation.
            </p>
          ) : !entry.configured ? (
            <p className="text-sm text-muted-foreground">
              This provider needs configuration before generation.
            </p>
          ) : null}
        </form>
        {quote ? (
          <VideoQuoteDialog
            workspaceId={workspaceId}
            request={request}
            quote={quote}
            onClose={() => setQuote(null)}
            onStarted={onStarted}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
