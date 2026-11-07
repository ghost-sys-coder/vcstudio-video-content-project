export async function createProjectAction(form: FormData) {
  sessionStorage.setItem(
    "created-project",
    JSON.stringify(Object.fromEntries(form)),
  );
  return { error: null, success: true };
}
