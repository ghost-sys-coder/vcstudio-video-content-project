"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  disconnectGoogleBusinessAction,
  saveGoogleBusinessSelectionAction,
  syncGoogleBusinessAction,
} from "@/app/(authenticated)/app/marketing/integrations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { GoogleBusinessIntegrationView } from "@/lib/marketing/integrations/marketing-integrations-view";

export function GoogleBusinessIntegrationPanel({
  canManage,
  integration,
}: {
  canManage: boolean;
  integration: GoogleBusinessIntegrationView;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(
    action: () => Promise<
      { ok: true; message: string } | { ok: false; error: string }
    >,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setError(result.error);
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <section
      className="space-y-4 rounded-2xl border bg-card p-6"
      aria-labelledby="google-business-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold" id="google-business-heading">
              Google Business Profile
            </h2>
            <Badge
              variant={
                integration.status === "active" ? "secondary" : "outline"
              }
            >
              {integration.statusLabel}
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Selected locations become attributed business facts in Marketing
            Studio AI context. Manual brand fields remain unchanged.
          </p>
        </div>
        {canManage ? (
          integration.connected ? (
            <div className="flex gap-2">
              <Button
                disabled={pending}
                onClick={() => run(syncGoogleBusinessAction)}
                size="sm"
                variant="outline"
              >
                Sync now
              </Button>
              <Dialog>
                <DialogTrigger
                  render={
                    <Button
                      disabled={pending}
                      size="sm"
                      variant="destructive"
                    />
                  }
                >
                  Disconnect
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Disconnect Google Business Profile?
                    </DialogTitle>
                    <DialogDescription>
                      VCStudio will destroy the stored OAuth credentials and
                      stop future synchronization. Existing snapshots remain for
                      audit history, but Google facts stop contributing to new
                      AI context.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                      Cancel
                    </DialogClose>
                    <Button
                      disabled={pending}
                      onClick={() => run(disconnectGoogleBusinessAction)}
                      variant="destructive"
                    >
                      Disconnect
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <Button
              nativeButton={false}
              render={<Link href="/api/google-business/authorize" />}
              size="sm"
            >
              Connect Google
            </Button>
          )
        ) : null}
      </div>
      {integration.message ? (
        <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
          {integration.message}
        </p>
      ) : null}
      {integration.lastError ? (
        <p className="text-sm text-destructive">{integration.lastError}</p>
      ) : null}
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {integration.locations.length > 0 ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(() => saveGoogleBusinessSelectionAction(data));
          }}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {integration.locations.map((location) => (
              <label className="rounded-xl border p-4" key={location.id}>
                <span className="flex items-start gap-3">
                  <input
                    defaultChecked={location.selected}
                    disabled={!canManage || pending}
                    name="locationIds"
                    type="checkbox"
                    value={location.id}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {location.title || "Unnamed location"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {location.accountDisplayName || location.accountName}
                    </span>
                    <span className="mt-2 flex items-center gap-2 text-xs">
                      <input
                        defaultChecked={location.isPrimary}
                        disabled={!canManage || pending}
                        name="primaryLocationId"
                        type="radio"
                        value={location.id}
                      />
                      Primary location
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
          {canManage ? (
            <Button disabled={pending} size="sm" type="submit">
              Save location selection
            </Button>
          ) : null}
        </form>
      ) : integration.connected ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          No accessible Business Profile locations were returned. Confirm the
          Google account manages a verified location and the API project has
          Business Profile access.
        </p>
      ) : null}
    </section>
  );
}
