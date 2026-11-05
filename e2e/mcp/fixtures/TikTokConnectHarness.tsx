import { ConnectTikTokButton } from "@/components/publish/ConnectTikTokButton";
export function TikTokConnectHarness() {
  return (
    <main className="app-page mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Accounts &amp; connections</h1>
      <ConnectTikTokButton />
      <ConnectTikTokButton disabled label="Disabled TikTok" />
    </main>
  );
}
