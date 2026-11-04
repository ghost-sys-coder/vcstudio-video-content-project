import { redirect } from "next/navigation";
import { McpSettingsPage } from "@/components/mcp/McpSettingsPage";
import { loadMcpSettings } from "@/lib/mcp/settings-view";
export default async function Page() {
  const data = await loadMcpSettings();
  if (!data) redirect("/onboarding");
  return <McpSettingsPage data={data} />;
}
