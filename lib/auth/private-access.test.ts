import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { NextRequest } from "next/server";
import { privateAccessEnvironmentSchema } from "@/lib/env/server-schema";
import {
  canAccessPrivateApplication,
  isPrivateApplicationPath,
} from "./private-access";
import { privateAccessResponse } from "./private-access-response";

afterEach(() => vi.unstubAllEnvs());
const settings = privateAccessEnvironmentSchema.parse({
  ENABLE_PRIVATE_ACCESS: "true",
  PRIVATE_ACCESS_CLERK_USER_IDS: "user_owner1, user_owner2,user_owner1",
});
describe("private application access", () => {
  it("preserves both exact owner identities and fails closed for everyone else", () => {
    expect(settings.PRIVATE_ACCESS_CLERK_USER_IDS).toEqual([
      "user_owner1",
      "user_owner2",
    ]);
    for (const id of ["user_owner1", "user_owner2"])
      expect(canAccessPrivateApplication(id, settings)).toBe(true);
    for (const id of [null, undefined, "", "user_other", "user_OWNER1"])
      expect(canAccessPrivateApplication(id, settings)).toBe(false);
    expect(
      canAccessPrivateApplication(
        "user_other",
        privateAccessEnvironmentSchema.parse({}),
      ),
    ).toBe(false);
  });
  it("validates settings and requires an explicit public-access override", () => {
    expect(
      privateAccessEnvironmentSchema.safeParse({
        PRIVATE_ACCESS_CLERK_USER_IDS: "somebody@example.com",
      }).success,
    ).toBe(false);
    expect(
      privateAccessEnvironmentSchema.safeParse({ ENABLE_PRIVATE_ACCESS: "yes" })
        .success,
    ).toBe(false);
    expect(
      canAccessPrivateApplication(
        "user_other",
        privateAccessEnvironmentSchema.parse({
          ENABLE_PRIVATE_ACCESS: "false",
        }),
      ),
    ).toBe(true);
  });
  it.each([
    "/",
    "/waitlist",
    "/sign-in",
    "/sign-up",
    "/privacy",
    "/terms",
    "/api/webhooks/clerk",
    "/.well-known/oauth-protected-resource/mcp",
  ])("keeps %s public", (path) => {
    expect(isPrivateApplicationPath(path)).toBe(false);
    expect(
      privateAccessResponse(
        new NextRequest(`https://studio.example${path}`),
        "user_other",
      ),
    ).toBeNull();
  });
  it.each([
    "/app",
    "/app/projects/123",
    "/onboarding",
    "/invite/token",
    "/api/audio/voice-preview",
    "/api/projects/123/scene-images/upload",
    "/api/webhooks/clerk-not-public",
  ])("protects %s", (path) => {
    vi.stubEnv("ENABLE_PRIVATE_ACCESS", "true");
    vi.stubEnv("PRIVATE_ACCESS_CLERK_USER_IDS", "user_owner1,user_owner2");
    const request = new NextRequest(`https://studio.example${path}`);
    expect(isPrivateApplicationPath(path)).toBe(true);
    expect(privateAccessResponse(request, "user_owner1")).toBeNull();
    expect(privateAccessResponse(request, "user_owner2")).toBeNull();
    const response = privateAccessResponse(request, "user_other");
    if (!response) throw new Error("Expected private-access denial");
    expect(response.status).toBe(path.startsWith("/api/") ? 403 : 307);
    if (!path.startsWith("/api/"))
      expect(response.headers.get("location")).toBe(
        "https://studio.example/waitlist",
      );
  });
  it("returns API errors rather than serving HTML or provisioning a workspace", async () => {
    vi.stubEnv("ENABLE_PRIVATE_ACCESS", "true");
    vi.stubEnv("PRIVATE_ACCESS_CLERK_USER_IDS", "user_owner1");
    const request = new NextRequest("https://studio.example/api/projects");
    expect(privateAccessResponse(request, null)?.status).toBe(401);
    expect(
      await privateAccessResponse(request, "user_other")?.json(),
    ).toMatchObject({
      code: "private_access_required",
      waitlistUrl: "/waitlist",
    });
    const mutation = privateAccessResponse(
      new NextRequest("https://studio.example/onboarding", { method: "POST" }),
      "user_other",
    );
    expect(mutation?.status).toBe(303);
  });
});
