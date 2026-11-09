import { createRoot } from "react-dom/client";
import { MediaLibraryWorkspace } from "@/components/social/MediaLibraryWorkspace";
import { uploadedVideo } from "./social-draft-data";
const query = new URLSearchParams(location.search);
const failed = query.has("failed");
document.documentElement.classList.toggle(
  "dark",
  query.get("theme") === "dark",
);
if (failed) localStorage.setItem("inspection-result", "failed");
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <MediaLibraryWorkspace
      canEdit
      maxImageBytes={25 * 1024 * 1024}
      maxVideoBytes={512 * 1024 * 1024}
      workspaceId="test-workspace"
      view={{
        assets: [],
        total: 0,
        pageSize: 24,
        kind: null,
        processingAssets: [
          {
            ...uploadedVideo,
            inspectionPending: !failed,
            inspectionFailed: failed,
            inspectionError: failed
              ? "Verification ran out of memory. Retry using the saved original."
              : null,
          },
        ],
      }}
    />,
  );
