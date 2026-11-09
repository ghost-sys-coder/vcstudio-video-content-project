"use client";

import { useRef, useState } from "react";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import {
  uploadMediaAsset,
  type MediaUploadProgress,
} from "@/lib/storage/upload-media-asset.client";

export type ActiveMediaUpload = {
  fileName: string;
  fileIndex: number;
  fileCount: number;
  progress: MediaUploadProgress;
};

type UploadFailure = { fileName: string; message: string };

/** Keep large uploads sequential and preserve each file's independent outcome. */
export function useMediaUploadQueue(input: {
  workspaceId: string;
  onUploaded: (assets: MediaAssetView[]) => void;
  onProcessing?: (assets: MediaAssetView[]) => void;
}) {
  const busy = useRef(false);
  const [active, setActive] = useState<ActiveMediaUpload | null>(null);
  const [failures, setFailures] = useState<UploadFailure[]>([]);
  const [processingCount, setProcessingCount] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);

  async function uploadAll(files: File[]) {
    if (files.length === 0 || busy.current) return;
    busy.current = true;
    setFailures([]);
    setProcessingCount(0);
    setUploadedCount(0);
    const uploaded: MediaAssetView[] = [];
    const processing: MediaAssetView[] = [];
    try {
      for (const [index, file] of files.entries()) {
        const current = {
          fileName: file.name,
          fileIndex: index + 1,
          fileCount: files.length,
        };
        setActive({
          ...current,
          progress: {
            phase: "preparing",
            uploadedBytes: 0,
            totalBytes: file.size,
          },
        });
        try {
          const asset = await uploadMediaAsset({
            workspaceId: input.workspaceId,
            file,
            onProgress: (progress) => setActive({ ...current, progress }),
          });
          if (asset.inspectionPending) processing.push(asset);
          else uploaded.push(asset);
        } catch (error) {
          setFailures((currentFailures) => [
            ...currentFailures,
            {
              fileName: file.name,
              message:
                error instanceof Error
                  ? error.message
                  : "That file could not be uploaded.",
            },
          ]);
        }
      }
      setProcessingCount(processing.length);
      setUploadedCount(uploaded.length + processing.length);
      if (uploaded.length > 0) input.onUploaded(uploaded);
      if (processing.length > 0) input.onProcessing?.(processing);
    } finally {
      busy.current = false;
      setActive(null);
    }
  }

  return { active, failures, processingCount, uploadedCount, uploadAll };
}
