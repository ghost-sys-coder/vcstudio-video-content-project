"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createWorkspaceAction } from "@/app/(authenticated)/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const SUPPORTED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
    if (!SUPPORTED_LOGO_TYPES.includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image.");
      if (fileRef.current) fileRef.current.value = "";
      setPreviewUrl(null);
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("The logo must be 5 MB or smaller.");
      if (fileRef.current) fileRef.current.value = "";
      setPreviewUrl(null);
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
  }

  function submit(formData: FormData) {
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
      const file = fileRef.current?.files?.[0];
      if (!file) {
        router.push("/app");
        router.refresh();
        return;
      }
      if (file.size > MAX_LOGO_BYTES) {
        setError("The logo must be 5 MB or smaller.");
        return;
      }

      try {
        const authorization = await fetch(
          `/api/workspaces/${creation.workspaceId}/logo/upload`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contentType: file.type,
              fileName: file.name,
              sizeBytes: file.size,
            }),
          },
        );
        if (!authorization.ok) throw new Error("authorization failed");
        const upload = (await authorization.json()) as {
          objectKey: string;
          uploadUrl: string;
        };
        const uploaded = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });
        if (!uploaded.ok) throw new Error("upload failed");
        const completion = await fetch(
          `/api/workspaces/${creation.workspaceId}/logo/complete`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              objectKey: upload.objectKey,
              contentType: file.type,
              sizeBytes: file.size,
            }),
          },
        );
        if (!completion.ok) throw new Error("completion failed");
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
