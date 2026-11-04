"use client";
import { useRef, useState, type FormEvent } from "react";
import { useWaitlist } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { waitlistInputSchema } from "@/lib/schemas/waitlist";

export function WaitlistForm() {
  const { waitlist, errors, fetchStatus } = useWaitlist();
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || !waitlist) return;
    const input = waitlistInputSchema.safeParse({
      emailAddress: new FormData(event.currentTarget).get("emailAddress"),
    });
    if (!input.success) {
      setMessage(
        input.error.issues[0]?.message ?? "Enter a valid email address.",
      );
      return;
    }
    locked.current = true;
    setPending(true);
    setMessage("");
    try {
      const { error } = await waitlist.join(input.data);
      if (error) {
        setMessage("We couldn't add your email right now. Please try again.");
        return;
      }
      setComplete(true);
    } catch {
      setMessage("We couldn't add your email right now. Please try again.");
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  if (complete || waitlist?.id)
    return (
      <div role="status" className="rounded-xl border bg-muted/40 p-5">
        <p className="font-medium">You&apos;re on the waitlist.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ll share updates when early access is ready.
        </p>
      </div>
    );
  const error = message || errors.fields.emailAddress?.longMessage;
  return (
    <form onSubmit={submit} className="app-section">
      <div className="app-heading">
        <Label htmlFor="waitlist-email">Email address</Label>
        <Input
          id="waitlist-email"
          name="emailAddress"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          aria-invalid={!!error}
          aria-describedby={error ? "waitlist-error" : undefined}
        />
      </div>
      {error && (
        <p
          id="waitlist-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={!waitlist || pending || fetchStatus === "fetching"}
      >
        {pending || fetchStatus === "fetching" ? "Joining..." : "Join waitlist"}
      </Button>
      <p className="text-xs text-muted-foreground">
        We&apos;ll use your email for early access updates. Joining the waitlist
        does not create a workspace.
      </p>
    </form>
  );
}
