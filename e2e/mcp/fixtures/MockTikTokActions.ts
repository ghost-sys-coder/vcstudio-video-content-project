export async function loadTikTokConnectionSetupAction() {
  await new Promise<void>((resolve) => setTimeout(resolve, 150));
  localStorage.setItem("tiktokSetupLoaded", "true");
  return {
    ok: true as const,
    redirectUri: "https://studio.example/api/tiktok/callback",
  };
}
export async function startTikTokSandboxConnectionAction(form: FormData) {
  localStorage.setItem(
    "tiktokStartCount",
    String(Number(localStorage.getItem("tiktokStartCount") ?? 0) + 1),
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
  if (form.get("clientKey") === "error")
    return {
      ok: false as const,
      error: "TikTok authorization could not start. Please try again.",
    };
  return {
    ok: true as const,
    authorizationUrl:
      "https://www.tiktok.com/v2/auth/authorize/?client_key=test-sandbox&state=test-only",
  };
}
