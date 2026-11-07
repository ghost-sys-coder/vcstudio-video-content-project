export async function saveMcpGrantAction(
  _previous: { ok: boolean; message: string },
  form: FormData,
) {
  sessionStorage.setItem(
    "saved-mcp-grant",
    JSON.stringify({
      ...Object.fromEntries(form),
      scopes: form.getAll("scopes"),
    }),
  );
  return { ok: true, message: "Workspace permissions saved." };
}
export async function revokeMcpConnectionAction() {
  return {
    ok: true,
    message:
      "AI connection disconnected. Approved Social schedules remain on the calendar.",
  };
}
export async function decideMcpOperationAction(
  _previous: { ok: boolean; message: string },
  form: FormData,
) {
  return {
    ok: true,
    message:
      form.get("decision") === "approve"
        ? "Approval recorded. Inspect per-destination progress."
        : "Request cancelled. No publication was started.",
  };
}
