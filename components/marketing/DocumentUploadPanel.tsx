"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileTextIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { pasteDocumentAction } from "@/app/(authenticated)/app/marketing/assets/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MARKETING_DOCUMENT_EXTENSIONS } from "@/lib/schemas/marketing-document";
import { uploadMarketingDocument } from "@/lib/storage/upload-marketing-document.client";

const ACCEPTED = Object.keys(MARKETING_DOCUMENT_EXTENSIONS).join(",");

/**
 * Two ways in: upload a file, or paste text.
 *
 * Pasting exists because a lot of the most useful brand material — an About
 * page, a positioning note, an email someone wrote well — is not a file. Making
 * people save it as `.txt` first is friction with no purpose.
 *
 * Uploads run sequentially rather than in parallel, matching the media library:
 * a partial failure should name the file that failed, which a concurrent batch
 * makes harder to report honestly.
 */
export function DocumentUploadPanel({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setFailures([]);

    for (const file of Array.from(files)) {
      const lowerName = file.name.toLowerCase();
      const contentType = lowerName.endsWith(".md")
        ? ("text/markdown" as const)
        : lowerName.endsWith(".pdf")
          ? ("application/pdf" as const)
          : lowerName.endsWith(".docx")
            ? ("application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const)
            : ("text/plain" as const);
      setUploadingName(file.name);
      try {
        await uploadMarketingDocument({
          workspaceId,
          title: file.name.replace(/\.(txt|md|pdf|docx)$/i, ""),
          file,
          contentType,
        });
      } catch (uploadError) {
        setFailures((current) => [
          ...current,
          `${file.name}: ${
            uploadError instanceof Error
              ? uploadError.message
              : "Upload failed."
          }`,
        ]);
      }
    }

    setUploadingName(null);
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
  }

  function paste(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await pasteDocumentAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPasteOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed bg-muted/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          accept={ACCEPTED}
          className="sr-only"
          multiple
          onChange={(event) => void upload(event.currentTarget.files)}
          ref={fileInput}
          type="file"
        />
        <Button
          disabled={uploadingName !== null}
          onClick={() => fileInput.current?.click()}
          type="button"
          variant="outline"
        >
          {uploadingName ? (
            <>
              <Loader2Icon aria-hidden className="animate-spin" />
              Uploading {uploadingName}…
            </>
          ) : (
            <>
              <UploadIcon />
              Upload document
            </>
          )}
        </Button>
        <Button
          onClick={() => setPasteOpen((current) => !current)}
          type="button"
          variant="ghost"
        >
          <FileTextIcon />
          {pasteOpen ? "Cancel" : "Paste text instead"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Supports TXT, Markdown, PDF, and DOCX. Files are extracted in the
        background and may take a moment to become ready.
      </p>

      {pasteOpen ? (
        <form
          action={paste}
          className="space-y-3 rounded-lg border bg-background p-3"
        >
          <div className="space-y-2">
            <Label htmlFor="paste-title">Title</Label>
            <Input
              disabled={pending}
              id="paste-title"
              name="title"
              placeholder="About page copy"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paste-body">Text</Label>
            <Textarea
              disabled={pending}
              id="paste-body"
              name="body"
              required
              rows={8}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button disabled={pending} type="submit">
            {pending ? (
              <>
                <Loader2Icon aria-hidden className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save text"
            )}
          </Button>
        </form>
      ) : null}

      {failures.length > 0 ? (
        <ul
          aria-live="polite"
          className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive"
        >
          {failures.map((failure) => (
            <li key={failure}>{failure}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
