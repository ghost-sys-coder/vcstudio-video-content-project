import { draftKey, draftStateSchema } from "./social-draft-data";
export async function saveSocialPostAction(form: FormData) {
  const state = draftStateSchema.parse({
    version: Number(form.get("expectedVersion")) + 1,
    name: form.get("name"),
    connectionIds: JSON.parse(String(form.get("connectionIds"))),
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
  return { ok: true, assets: [], nextCursor: null };
}
