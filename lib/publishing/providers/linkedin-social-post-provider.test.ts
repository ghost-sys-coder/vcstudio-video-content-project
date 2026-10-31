import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { LinkedInSocialPostProvider } from "./linkedin-social-post-provider";
import type { PublishPostRequest } from "@/lib/publishing/social-post-provider";

const fetchMock = vi.fn<typeof fetch>();
const request: PublishPostRequest = {
  tokens: { accessToken: "test-token" },
  account: { externalAccountId: "urn:li:organization:42" },
  text: "Reviewed post",
  media: [],
  providerOperationId: null,
  providerOperationSecret: null,
};
const provider = () => new LinkedInSocialPostProvider({ apiVersion: "202607" });
const accepted = () =>
  new Response(null, {
    status: 201,
    headers: { "x-restli-id": "urn:li:share:99" },
  });
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("LinkedIn profile and Page authors", () => {
  it.each([
    ["member-1", "urn:li:person:member-1"],
    ["urn:li:person:member-1", "urn:li:person:member-1"],
    ["urn:li:organization:42", "urn:li:organization:42"],
  ])(
    "publishes %s with the exact author %s",
    async (externalAccountId, author) => {
      fetchMock.mockResolvedValueOnce(accepted());
      await expect(
        provider().publishPost({ ...request, account: { externalAccountId } }),
      ).resolves.toMatchObject({ externalPostId: "urn:li:share:99" });
      expect(
        JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
      ).toMatchObject({ author, commentary: "Reviewed post" });
    },
  );
  it("uses the organization as image owner and post author", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: {
              uploadUrl: "https://www.linkedin.com/upload/image",
              image: "urn:li:image:image1",
            },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(accepted());
    await provider().publishPost({
      ...request,
      media: [
        {
          kind: "image",
          sourceUrl: "https://storage.test/private-image",
          contentType: "image/png",
          sizeBytes: 3,
          altText: "Page graphic",
          fileName: "graphic.png",
        },
      ],
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      initializeUploadRequest: { owner: "urn:li:organization:42" },
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body)),
    ).toMatchObject({
      author: "urn:li:organization:42",
      content: {
        media: { id: "urn:li:image:image1", altText: "Page graphic" },
      },
    });
  });
  it("refuses invalid identities before any upload or post", async () => {
    await expect(
      provider().publishPost({
        ...request,
        account: { externalAccountId: "urn:li:organization:invalid" },
      }),
    ).rejects.toMatchObject({
      failure: { category: "invalid_metadata", mayHavePublished: false },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports LinkedIn rejecting a revoked Page permission", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(provider().publishPost(request)).rejects.toMatchObject({
      failure: { category: "insufficient_permissions", retriable: false },
    });
  });

  it("does not automatically retry an ambiguous post-creation response", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(provider().publishPost(request)).rejects.toMatchObject({
      failure: {
        category: "transport_ambiguous",
        retriable: false,
        mayHavePublished: true,
      },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
