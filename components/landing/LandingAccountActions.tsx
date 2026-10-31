"use client";

import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingAccountActions({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Show when="signed-out">
        <SignInButton>
          <Button
            className="h-11 rounded-full lg:h-9"
            onClick={onNavigate}
            type="button"
            variant="ghost"
          >
            Sign in
          </Button>
        </SignInButton>
        <SignUpButton>
          <Button
            className="h-11 rounded-full lg:h-9"
            onClick={onNavigate}
            type="button"
          >
            Create account
          </Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Button
          className="h-11 rounded-full lg:h-9"
          nativeButton={false}
          onClick={onNavigate}
          render={<Link href="/app" />}
        >
          Open workspace
        </Button>
      </Show>
    </div>
  );
}
