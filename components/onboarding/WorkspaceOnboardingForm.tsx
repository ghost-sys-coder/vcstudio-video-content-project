"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createWorkspaceAction } from "@/app/(authenticated)/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_WORKSPACE_LOGO_BYTES,
  WORKSPACE_LOGO_CONTENT_TYPES,
} from "@/lib/schemas/workspace-logo";
import { uploadWorkspaceLogo } from "@/lib/storage/upload-workspace-logo.client";

export function WorkspaceOnboardingForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function previewLogo(file: File | undefined) {
    setError(null);
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    if (!WORKSPACE_LOGO_CONTENT_TYPES.some((type) => type === file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      if (fileRef.current) fileRef.current.value = "";
      setPreviewUrl(null);
      return;
    }
    if (file.size > MAX_WORKSPACE_LOGO_BYTES) {
      setError("The logo must be 5 MB or smaller.");
      if (fileRef.current) fileRef.current.value = "";
      setPreviewUrl(null);
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
  }

  function submit(formData: FormData) {
    const logoEntry = formData.get("logo");
    const file =
      logoEntry instanceof File && logoEntry.size > 0 ? logoEntry : null;
    setError(null);
    startTransition(async () => {
      const creation = workspaceId
        ? { error: null, workspaceId }
        : await createWorkspaceAction(formData);
      if (creation.error || !creation.workspaceId) {
        setError(creation.error ?? "The workspace could not be created.");
        return;
      }

      setWorkspaceId(creation.workspaceId);
      if (!file) {
        router.push("/app");
        router.refresh();
        return;
      }
      if (file.size > MAX_WORKSPACE_LOGO_BYTES) {
        setError("The logo must be 5 MB or smaller.");
        return;
      }

      try {
        await uploadWorkspaceLogo({
          workspaceId: creation.workspaceId,
          file,
        });
        router.push("/app");
        router.refresh();
      } catch {
        setError(
          "The workspace was created, but its logo could not be uploaded. Try again.",
        );
      }
    });
  }

  return (
    <form action={submit} className="mt-8 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          autoComplete="organization"
          disabled={pending || workspaceId !== null}
          id="workspace-name"
          maxLength={80}
          name="name"
          placeholder="Example: Studio North"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="workspace-logo">Organization logo (optional)</Label>
        <Input
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          id="workspace-logo"
          name="logo"
          onChange={(event) => previewLogo(event.currentTarget.files?.[0])}
          ref={fileRef}
          type="file"
        />
        {previewUrl ? (
          <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-3">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
              <Image
                alt="Organization logo preview"
                className="size-full object-contain p-1"
                height={80}
                src={previewUrl}
                unoptimized
                width={80}
              />
            </div>
            <div>
              <p className="text-sm font-medium">Logo preview</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This is how the selected image will appear before upload.
              </p>
            </div>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, or WebP. Maximum 5 MB.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} size="lg" type="submit">
        {pending
          ? "Saving workspace…"
          : workspaceId
            ? "Retry logo upload"
            : "Create workspace"}
      </Button>
    </form>
  );
}
