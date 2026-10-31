import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-20 pt-4">
      <nav className="app-public-container flex min-h-14 flex-wrap items-center gap-y-2 rounded-full border bg-background/80 px-4 py-2 shadow-sm backdrop-blur sm:px-6">
        <Link className="mr-auto" href="/" aria-label="VCStudio home">
          <BrandLogo />
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          <a
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="#studio"
          >
            Studio
          </a>
          <a
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="#workflow"
          >
            Workflow
          </a>
          <a
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="#features"
          >
            Features
          </a>
        </div>
        <div className="ml-4 flex items-center gap-2">
          <Show when="signed-out">
            <SignInButton>
              <Button className="rounded-full" type="button" variant="ghost">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton>
              <Button className="rounded-full" type="button">
                Create account
              </Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Button
              className="rounded-full"
              nativeButton={false}
              render={<Link href="/app" />}
            >
              Open workspace
            </Button>
          </Show>
        </div>
      </nav>
    </header>
  );
}
