"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BRAND_TABS = [
  { value: "profile", label: "Profile", segment: "" },
  { value: "audiences", label: "Audiences", segment: "audiences" },
  { value: "offers", label: "What you sell", segment: "offers" },
  { value: "voice", label: "Voice", segment: "voice" },
  { value: "context", label: "Context", segment: "context" },
] as const;

/**
 * Route-backed tabs for the brand pages, following ProjectHeader: the active
 * tab is derived from the path rather than held in state, so a refresh or a
 * direct link lands on the right tab.
 */
export function BrandHeader({
  children,
  onboardingComplete,
}: {
  children: React.ReactNode;
  onboardingComplete: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab =
    BRAND_TABS.find(
      (tab) => tab.segment !== "" && pathname.endsWith(`/${tab.segment}`),
    )?.value ?? "profile";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button
            className="px-0"
            nativeButton={false}
            render={<Link href="/app/marketing" />}
            size="sm"
            variant="link"
          >
            ← Marketing Studio
          </Button>
          <h1 className="text-xl font-semibold">Brand</h1>
          <p className="text-sm text-muted-foreground">
            What the studio knows about the business. Everything it writes is
            grounded in this.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/app/marketing/brand/onboarding" />}
          variant={onboardingComplete ? "outline" : "default"}
        >
          {onboardingComplete ? "Revisit interview" : "Start the interview"}
        </Button>
      </header>

      <Tabs
        onValueChange={(value) => {
          const tab = BRAND_TABS.find((entry) => entry.value === value);
          if (!tab) return;
          router.push(
            tab.segment === ""
              ? "/app/marketing/brand"
              : `/app/marketing/brand/${tab.segment}`,
          );
        }}
        value={activeTab}
      >
        <div className="max-w-full overflow-x-auto pb-1">
          <TabsList variant="line">
            {BRAND_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value={activeTab}>{children}</TabsContent>
      </Tabs>
    </div>
  );
}
