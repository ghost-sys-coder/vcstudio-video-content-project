"use client";

import { useTransition } from "react";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { createSocialPostAction } from "@/app/(authenticated)/app/social/posts/actions";
import { Button } from "@/components/ui/button";

/**
 * Creates an empty draft and navigates straight into the composer, rather than
 * asking for a name in a dialog first — the name is internal-only and can be
 * filled in while writing.
 */
export function CreatePostButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await createSocialPostAction(new FormData());
        })
      }
      type="button"
    >
      {pending ? (
        <>
          <Loader2Icon aria-hidden className="animate-spin" />
          Creating…
        </>
      ) : (
        <>
          <PlusIcon />
          New post
        </>
      )}
    </Button>
  );
}
