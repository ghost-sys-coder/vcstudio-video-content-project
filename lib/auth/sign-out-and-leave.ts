/**
 * Signs the user out, then leaves the application with a **full document load**
 * instead of a client-side navigation.
 *
 * Clerk's own `signOut({ redirectUrl })` navigates through the App Router's
 * soft `router.push`. A soft navigation keeps the client Router Cache and the
 * already-mounted authenticated layout alive, so the dashboard stays on screen
 * over a dead session until the user refreshes by hand. Passing a callback
 * suppresses Clerk's navigation so this one runs instead: a document load
 * discards the cache and forces middleware to re-evaluate with the session
 * cookie already cleared.
 *
 * `navigate` is injected only so this is testable outside a real browser.
 */
export async function signOutAndLeave({
  destination,
  navigate = (url) => window.location.assign(url),
  signOut,
}: {
  destination: string;
  navigate?: (url: string) => void;
  signOut: (callback: () => void) => Promise<unknown>;
}): Promise<void> {
  await signOut(() => {
    navigate(destination);
  });
}
