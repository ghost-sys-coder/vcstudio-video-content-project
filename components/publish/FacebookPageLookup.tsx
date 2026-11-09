"use client";

import { useActionState, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import type { FacebookPageLookupState } from "@studio/contracts/publishing";
import { FacebookPageConnectButton } from "@/components/publish/FacebookPageConnectButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FacebookPageLookup({
  action,
  connectAction,
}: {
  action: (
    previous: FacebookPageLookupState,
    formData: FormData,
  ) => Promise<FacebookPageLookupState>;
  connectAction: (formData: FormData) => void | Promise<void>;
}) {
  const [pageId, setPageId] = useState("");
  const submitting = useRef(false);
  const [state, submit, pending] = useActionState(
    async (previous: FacebookPageLookupState, data: FormData) => {
      try {
        return await action(previous, data);
      } catch (error) {
        unstable_rethrow(error);
        return {
          page: null,
          error:
            "The lookup could not finish. Your Page ID is still here; try again.",
        };
      } finally {
        submitting.current = false;
      }
    },
    { page: null, error: null },
  );
  return (
    <section
      aria-labelledby="facebook-page-lookup-heading"
      className="app-panel app-section rounded-xl border bg-card"
    >
      <div className="app-heading">
        <h2 id="facebook-page-lookup-heading" className="text-lg font-semibold">
          Missing a Page?
        </h2>
        <p className="text-sm text-muted-foreground">
          If you selected a Page on Facebook but it is missing above, find it by
          its Page ID. We will verify access before you connect it.
        </p>
      </div>
      <form
        action={submit}
        aria-busy={pending}
        className="space-y-3"
        onSubmit={(event) => {
          if (submitting.current) event.preventDefault();
          else submitting.current = true;
        }}
      >
        <Label htmlFor="facebook-page-id">Facebook Page ID</Label>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            id="facebook-page-id"
            name="pageId"
            inputMode="numeric"
            pattern="[0-9]{1,32}"
            maxLength={32}
            required
            disabled={pending}
            value={pageId}
            onChange={(event) => setPageId(event.target.value)}
            aria-describedby="facebook-page-id-help"
            className="sm:flex-1"
          />
          <Button
            type="submit"
            variant="outline"
            className="h-10"
            disabled={pending}
          >
            {pending ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Search aria-hidden className="size-4" />
            )}
            {pending ? "Checking Facebook…" : "Find Page"}
          </Button>
        </div>
        <p id="facebook-page-id-help" className="text-xs text-muted-foreground">
          Find the numeric ID in Facebook&apos;s Page selection or the
          Page&apos;s About section. No password or access token is needed.
        </p>
      </form>
      <div aria-live="polite" aria-atomic="true">
        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        {state.page ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-muted/40 p-4">
            <div className="min-w-0">
              <p className="break-words font-medium">
                {state.page.externalAccountName}
              </p>
              <p className="break-all text-sm text-muted-foreground">
                Access verified · Page ID: {state.page.externalAccountId}
              </p>
            </div>
            <form action={connectAction}>
              <input
                type="hidden"
                name="pageId"
                value={state.page.externalAccountId}
              />
              <FacebookPageConnectButton />
            </form>
          </div>
        ) : null}
      </div>
      <a
        href="/api/facebook/authorize"
        className="w-fit text-sm font-medium underline underline-offset-4"
      >
        Reconnect to review Facebook permissions
      </a>
    </section>
  );
}
