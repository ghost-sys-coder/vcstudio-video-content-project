import {
  draftKey,
  draftStateSchema,
  fixtureAssets,
  libraryImage,
} from "./social-draft-data";
export async function saveSocialPostAction(form: FormData) {
  if (localStorage.getItem("fixture-save-error")) {
    throw new Error("Simulated network interruption");
  }
  const state = draftStateSchema.parse({
    version: Number(form.get("expectedVersion")) + 1,
    name: form.get("name"),
    connectionIds: JSON.parse(String(form.get("connectionIds"))),
    attachmentIds: form
      .getAll("attachments")
      .map((value) => String(value).split(":")[1]),
  });
  localStorage.setItem(draftKey, JSON.stringify(state));
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
export async function getMediaLibraryPageAction() {
  return {
    ok: true as const,
    view: {
      assets: [libraryImage],
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
