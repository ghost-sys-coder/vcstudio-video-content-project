"use client";

import { useState } from "react";
import { createChannelProfileAction } from "@/app/(authenticated)/app/settings/workspace/channel-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CHANNEL_CADENCES,
  CHANNEL_PROFILE_PLATFORMS,
} from "@/lib/schemas/channel-profile";

export function ChannelProfileForm({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const result = await createChannelProfileAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onCreated();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a channel</DialogTitle>
          <DialogDescription>
            A channel is a production identity. It exists whether or not the
            account is connected, and survives disconnecting or reconnecting.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="channel-name">Channel name</Label>
            <Input id="channel-name" maxLength={120} name="name" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="channel-platform">Platform</Label>
              <select
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                defaultValue="youtube"
                id="channel-platform"
                name="platform"
              >
                {CHANNEL_PROFILE_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="channel-language">Language</Label>
              <Input
                defaultValue="en-US"
                id="channel-language"
                name="language"
                placeholder="en-US"
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="channel-cadence">Release cadence</Label>
              <select
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                defaultValue="weekly"
                id="channel-cadence"
                name="cadence"
              >
                {CHANNEL_CADENCES.map((cadence) => (
                  <option key={cadence} value={cadence}>
                    {cadence}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="channel-timezone">Time zone</Label>
              <Input
                defaultValue={
                  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
                }
                id="channel-timezone"
                name="timeZone"
                placeholder="Europe/London"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="channel-audience">Audience</Label>
            <Textarea
              id="channel-audience"
              maxLength={2000}
              name="audienceDescription"
              placeholder="Who this channel is for."
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="channel-tone">Tone</Label>
            <Input
              id="channel-tone"
              maxLength={1000}
              name="toneDescription"
              placeholder="Calm, evidence-led, no hype."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="channel-account">
              Platform account id (optional)
            </Label>
            <Input
              id="channel-account"
              maxLength={200}
              name="externalAccountId"
              placeholder="The channel id from the connected account"
            />
            <p className="text-xs text-muted-foreground">
              Links this channel to a connected account. Publishing stays
              blocked until the account is connected, but the channel and its
              projects remain usable either way.
            </p>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? "Adding…" : "Add channel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
