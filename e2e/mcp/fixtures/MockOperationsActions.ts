export async function saveBudgetSettingsAction(form: FormData) {
  window.localStorage.setItem(
    "usage-budget-save",
    JSON.stringify(Object.fromEntries(form.entries())),
  );
  return new URLSearchParams(location.search).get("fail") === "budget"
    ? { success: false, error: "The budget could not be saved. Try again." }
    : { success: true };
}
export async function saveOperationalLimitsAction(form: FormData) {
  window.localStorage.setItem(
    "usage-limits-save",
    JSON.stringify(Object.fromEntries(form.entries())),
  );
  return { success: true };
}
