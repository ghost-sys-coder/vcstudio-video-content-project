import {
  draftKey,
  draftStateSchema,
  fixtureAssets,
  libraryPageAssets,
} from "./social-draft-data";
export async function saveSocialPostAction(form: FormData) {
  const delay = Number(localStorage.getItem("fixture-save-delay") ?? 0);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  if (localStorage.getItem("fixture-save-error")) {
    throw new Error("Simulated network interruption");
  }
  if (localStorage.getItem("fixture-save-conflict")) {
    return {
      ok: false,
      error: "This post changed in another tab. Reload before saving again.",
    };
  }
  const state = draftStateSchema.parse({
    version: Number(form.get("expectedVersion")) + 1,
    name: form.get("name"),
    bodyDocument: JSON.parse(String(form.get("bodyDocument"))),
    connectionIds: JSON.parse(String(form.get("connectionIds"))),
    youtubeSettings: JSON.parse(String(form.get("youtubeSettings") ?? "null")),
    youtubeThumbnailAssetId: form.get("youtubeThumbnailAssetId") || null,
    attachmentIds: form
      .getAll("attachments")
      .map((value) => String(value).split(":")[1]),
  });
  localStorage.setItem(draftKey, JSON.stringify(state));
  localStorage.setItem(
    "fixture-save-count",
    String(Number(localStorage.getItem("fixture-save-count") ?? 0) + 1),
  );
  return {
    ok: true,
    version: state.version,
    plainText: "A relevant saved post.",
  };
}
function noDispatch() {
  localStorage.setItem("unexpected-dispatch", "true");
  return {
    ok: false,
    error: "Dispatch is mocked and must not run in this journey.",
  };
}
export async function publishSocialPostAction() {
  return noDispatch();
}
export async function scheduleSocialPostAction() {
  return noDispatch();
}
export async function cancelSocialPostScheduleAction() {
  return noDispatch();
}
export async function retryYouTubeThumbnailAction() {
  return noDispatch();
}
export async function getMediaLibraryPageAction() {
  return {
    ok: true as const,
    view: {
      assets: libraryPageAssets,
      pageSize: 24,
      kind: null,
      nextCursor: null,
    },
  };
}
export async function getPostMediaStatusAction(input: unknown) {
  const asset = fixtureAssets().find((item) => item.id === input);
  return asset
    ? { ok: true as const, asset }
    : { ok: false as const, error: "That media is no longer available." };
}
