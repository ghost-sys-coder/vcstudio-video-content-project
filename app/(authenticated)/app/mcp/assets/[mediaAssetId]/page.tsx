import { notFound, redirect } from "next/navigation";
import { loadMcpAssetDownload } from "@/lib/mcp/asset-download";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ mediaAssetId: string }>;
  searchParams: Promise<{ workspaceId?: string }>;
}) {
  const { mediaAssetId } = await params;
  const href = await loadMcpAssetDownload(
    mediaAssetId,
    (await searchParams).workspaceId,
  );
  if (!href) notFound();
  redirect(href);
}
