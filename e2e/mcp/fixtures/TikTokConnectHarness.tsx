import { ConnectTikTokButton } from "@/components/publish/ConnectTikTokButton";
import { ConnectLinkedInButton } from "@/components/publish/ConnectLinkedInButton";
export function TikTokConnectHarness() {
  return (
    <main className="app-page mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Accounts &amp; connections</h1>
      <div className="flex flex-wrap gap-2">
        <ConnectLinkedInButton />
        <ConnectTikTokButton />
      </div>
      <ConnectTikTokButton disabled label="Disabled TikTok" />
    </main>
  );
}
