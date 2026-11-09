import { useState } from "react";
import { MediaUploadDropzone } from "@/components/social/MediaUploadDropzone";
import type { MediaAssetView } from "@/lib/media/media-asset-view";

export function MediaUploadHarness() {
  const [assets, setAssets] = useState<MediaAssetView[]>([]);
  return (
    <main className="app-page mx-auto max-w-3xl">
      <h1>Media library</h1>
      <MediaUploadDropzone
        maxImageBytes={25 * 1024 * 1024}
        maxVideoBytes={512 * 1024 * 1024}
        workspaceId="test-workspace"
        onUploaded={(uploaded) =>
          setAssets((current) => [...current, ...uploaded])
        }
      />
      <ul>
        {assets.map((asset) => (
          <li key={asset.id}>{asset.title}</li>
        ))}
      </ul>
    </main>
  );
}
