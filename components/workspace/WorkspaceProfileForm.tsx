"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWorkspaceProfileAction } from "@/app/(authenticated)/app/settings/workspace/actions";
import { WorkspaceLogoImage } from "@/components/application/WorkspaceLogoImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_WORKSPACE_LOGO_BYTES,
  WORKSPACE_LOGO_CONTENT_TYPES,
} from "@/lib/schemas/workspace-logo";
import { uploadWorkspaceLogo } from "@/lib/storage/upload-workspace-logo.client";

export function WorkspaceProfileForm({
  logoUrl,
  workspaceId,
  workspaceName,
}: {
  logoUrl: string | null;
  workspaceId: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoDeleted, setLogoDeleted] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function selectLogo(file: File | undefined) {
    setError(null);
    setMessage(null);
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
    const logoFile =
      logoEntry instanceof File && logoEntry.size > 0 ? logoEntry : null;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updateWorkspaceProfileAction(formData);
      if (!result.success) {
        setError(result.error ?? "The workspace could not be updated.");
        return;
      }
      try {
        if (logoFile) {
          await uploadWorkspaceLogo({ workspaceId, file: logoFile });
          setLogoDeleted(false);
        }
        setMessage("Workspace profile updated.");
        setPreviewUrl(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch {
        setError("The workspace name was saved, but the logo upload failed.");
      }
    });
  }

  function deleteLogo() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/logo`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError("The workspace logo could not be deleted.");
        return;
      }
      setLogoDeleted(true);
      setPreviewUrl(null);
      setMessage("Workspace logo deleted.");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-8">
      <input name="workspaceId" type="hidden" value={workspaceId} />
      <div className="space-y-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          defaultValue={workspaceName}
          disabled={pending}
          id="workspace-name"
          maxLength={80}
          name="name"
          required
        />
      </div>
      <div className="space-y-4">
        <div>
          <Label htmlFor="workspace-logo">Workspace logo</Label>
          <p className="mt-1 text-sm text-muted-foreground">
            PNG, JPEG, or WebP. Maximum 5 MB.
          </p>
        </div>
        <div className="flex flex-col gap-5 rounded-xl border p-4 sm:flex-row sm:items-center">
          {previewUrl ? (
            // Blob previews are local and intentionally bypass image optimization.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="New workspace logo preview"
              className="size-24 rounded-lg border bg-background object-contain p-1"
              src={previewUrl}
            />
          ) : (
            <WorkspaceLogoImage
              logoUrl={logoDeleted ? null : logoUrl}
              name={workspaceName}
              size="large"
            />
          )}
          <div className="flex-1 space-y-3">
            <Input
              accept={WORKSPACE_LOGO_CONTENT_TYPES.join(",")}
              disabled={pending}
              id="workspace-logo"
              name="logo"
              onChange={(event) => selectLogo(event.currentTarget.files?.[0])}
              ref={fileRef}
              type="file"
            />
            {logoUrl && !logoDeleted ? (
              <Button
                disabled={pending}
                onClick={deleteLogo}
                type="button"
                variant="destructive"
              >
                Delete logo
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      <Button disabled={pending} size="lg" type="submit">
        {pending ? "Saving changes…" : "Save workspace profile"}
      </Button>
    </form>
  );
}
