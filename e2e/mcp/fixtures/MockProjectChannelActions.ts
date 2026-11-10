export async function assignProjectChannelAction(formData: FormData) {
  sessionStorage.setItem(
    "saved-project-channel",
    JSON.stringify(Object.fromEntries(formData)),
  );
  return { success: true, error: null };
}
