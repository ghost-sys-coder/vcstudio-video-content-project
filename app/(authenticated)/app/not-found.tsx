import { NotFoundState } from "@/components/application/NotFoundState";

/**
 * Sits inside `(authenticated)/app/layout.tsx`'s tree, so `ApplicationShell`
 * (sidebar, workspace switcher) still renders around it — the common case here
 * is `notFound()` from a page whose project/character/etc. no longer exists,
 * not a stray URL, so keeping the user inside the app shell is the better
 * landing spot than the bare marketing-site 404.
 */
export default function AppNotFound() {
  return <NotFoundState homeHref="/app" homeLabel="Go to dashboard" />;
}
