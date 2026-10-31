import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { decodeLibraryCursor, encodeLibraryCursor } from "./library-cursor";
import { mediaLibraryHref } from "./library-navigation";
import {
  mediaLibraryQuerySchema,
  mediaPickerQuerySchema,
} from "@/lib/schemas/media-library";

const boundary = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-10-31T12:00:00.000Z",
  direction: "next" as const,
};

describe("media library navigation", () => {
  it.each(["next", "previous"] as const)(
    "round trips a %s boundary without an offset",
    (direction) => {
      const value = { ...boundary, direction };
      expect(decodeLibraryCursor(encodeLibraryCursor(value))).toEqual(value);
    },
  );
  it.each([
    undefined,
    "",
    "not-json",
    "x".repeat(513),
    Buffer.from(
      JSON.stringify({ ...boundary, id: "foreign-or-invalid" }),
    ).toString("base64url"),
  ])("rejects invalid boundary %s", (value) => {
    expect(decodeLibraryCursor(value)).toBeNull();
  });
  it("keeps kind and cursor in both library routes", () => {
    expect(mediaLibraryHref()).toBe("/app/social/library");
    expect(mediaLibraryHref("audio", "a+b")).toBe(
      "/app/social/library?kind=audio&cursor=a%2Bb",
    );
    expect(
      mediaLibraryHref(null, "next", "/app/marketing/assets/library"),
    ).toBe("/app/marketing/assets/library?cursor=next");
  });
  it("allows audio in the library but excludes it from post pickers", () => {
    expect(mediaLibraryQuerySchema.safeParse({ kind: "audio" }).success).toBe(
      true,
    );
    expect(mediaPickerQuerySchema.safeParse({ kind: "audio" }).success).toBe(
      false,
    );
    expect(
      mediaPickerQuerySchema.parse({ kind: "image", workspaceId: "injected" }),
    ).toEqual({ kind: "image" });
  });
});
