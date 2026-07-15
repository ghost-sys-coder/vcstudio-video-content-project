import { describe, expect, it } from "vitest";
import {
  MAX_WORKSPACE_LOGO_BYTES,
  requestWorkspaceLogoUploadSchema,
} from "@/lib/schemas/workspace-logo";

describe("workspace logo validation", () => {
  it("accepts supported images up to 5 MB", () => {
    expect(
      requestWorkspaceLogoUploadSchema.safeParse({
        contentType: "image/png",
        fileName: "logo.png",
        sizeBytes: MAX_WORKSPACE_LOGO_BYTES,
      }).success,
    ).toBe(true);
  });

  it("rejects files larger than 5 MB", () => {
    expect(
      requestWorkspaceLogoUploadSchema.safeParse({
        contentType: "image/png",
        fileName: "logo.png",
        sizeBytes: MAX_WORKSPACE_LOGO_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it("rejects unsupported image formats", () => {
    expect(
      requestWorkspaceLogoUploadSchema.safeParse({
        contentType: "image/svg+xml",
        fileName: "logo.svg",
        sizeBytes: 100,
      }).success,
    ).toBe(false);
  });
});
