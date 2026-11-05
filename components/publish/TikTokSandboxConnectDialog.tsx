"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowUpRight,
  FlaskConical,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loadTikTokConnectionSetupAction,
  startTikTokSandboxConnectionAction,
} from "@/app/(authenticated)/app/social/accounts/tiktok-actions";

export function TikTokSandboxConnectDialog({
  onClose,
  onPendingChange,
}: {
  onClose: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const busyRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [redirectUri, setRedirectUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void loadTikTokConnectionSetupAction()
      .then((result) => {
        if (!active) return;
        if (result.ok) setRedirectUri(result.redirectUri);
        else setError(result.error);
      })
      .catch(() => {
        if (active)
          setError(
            "TikTok setup could not be loaded. Close this dialog and try again.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function connect(form: FormData) {
    if (busyRef.current) return;
    busyRef.current = true;
    onPendingChange(true);
    setPending(true);
    setError(null);
    let redirecting = false;
    try {
      const result = await startTikTokSandboxConnectionAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      window.location.assign(result.authorizationUrl);
      redirecting = true;
    } catch {
      setError(
        "The connection could not start. Your details are still here; try again.",
      );
    } finally {
      if (!redirecting) {
        busyRef.current = false;
        onPendingChange(false);
        setPending(false);
      }
    }
  }

  return (
    <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
      <DialogHeader>
        <Badge
          variant="outline"
          className="h-7 border-cyan-300 bg-cyan-100 px-3 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200"
        >
          <FlaskConical />
          Sandbox connection
        </Badge>
        <DialogTitle>Connect a TikTok test account</DialogTitle>
        <DialogDescription>
          Use your sandbox app credentials, then sign in to the TikTok account
          you want to connect.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
        <p>
          Add each account under{" "}
          <strong>TikTok for Developers → Sandbox → Target users</strong>. You
          can connect up to ten target accounts per sandbox, one at a time.
        </p>
        <p className="text-muted-foreground">
          Enable Login Kit and Content Posting API with{" "}
          <code>user.info.basic</code> and <code>video.upload</code>. Register
          this exact Login Kit callback:
        </p>
        {loading ? (
          <p role="status" className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin" />
            Loading callback…
          </p>
        ) : redirectUri ? (
          <code className="block break-all rounded-lg border bg-background p-2 text-xs select-all">
            {redirectUri}
          </code>
        ) : null}
        <a
          href="https://developers.tiktok.com/apps/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
        >
          Open TikTok developer apps
          <ArrowUpRight className="size-3" />
        </a>
      </div>
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          void connect(new FormData(event.currentTarget));
        }}
        className="space-y-4"
        autoComplete="off"
      >
        <fieldset
          disabled={pending || loading || !redirectUri}
          className="min-w-0 space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor={`${id}-key`}>Sandbox Client Key</Label>
            <Input
              id={`${id}-key`}
              name="clientKey"
              required
              maxLength={128}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="From the Sandbox tab"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-secret`}>Sandbox Client Secret</Label>
            <Input
              id={`${id}-secret`}
              name="clientSecret"
              type="password"
              required
              maxLength={256}
              autoComplete="new-password"
              spellCheck={false}
              aria-describedby={`${id}-privacy`}
            />
          </div>
        </fieldset>
        <p
          id={`${id}-privacy`}
          className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
        >
          <LockKeyhole className="mt-0.5 size-4 shrink-0" />
          Credentials stay encrypted. Enter app credentials here; TikTok handles
          account sign-in on its own page. To add a different account, switch
          accounts there before authorizing.
        </p>
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Sandbox access does not enable public direct posting. Video delivery
          remains inbox-only and requires the creator to finish posting in
          TikTok.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending || loading || !redirectUri}>
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ArrowUpRight className="size-4" />
            )}
            {pending ? "Connecting…" : "Continue to TikTok"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
