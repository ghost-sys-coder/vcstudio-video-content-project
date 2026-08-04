"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ASSET_TABS = [
  { value: "brand", label: "Brand assets", segment: "" },
  { value: "documents", label: "Documents", segment: "documents" },
  { value: "library", label: "Media library", segment: "library" },
] as const;

export function AssetsHeader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab =
    ASSET_TABS.find(
      (tab) => tab.segment !== "" && pathname.endsWith(`/${tab.segment}`),
    )?.value ?? "brand";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Button
          className="px-0"
          nativeButton={false}
          render={<Link href="/app/marketing" />}
          size="sm"
          variant="link"
        >
          ← Marketing Studio
        </Button>
        <h1 className="text-xl font-semibold">Assets</h1>
        <p className="text-sm text-muted-foreground">
          The images the studio designs with, and the written material it treats
          as fact.
        </p>
      </header>

      <Tabs
        onValueChange={(value) => {
          const tab = ASSET_TABS.find((entry) => entry.value === value);
          if (!tab) return;
          router.push(
            tab.segment === ""
              ? "/app/marketing/assets"
              : `/app/marketing/assets/${tab.segment}`,
          );
        }}
        value={activeTab}
      >
        <div className="max-w-full overflow-x-auto pb-1">
          <TabsList variant="line">
            {ASSET_TABS.map((tab) => (
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
