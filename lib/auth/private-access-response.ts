import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessPrivateApplication,
  isPrivateApplicationPath,
  PRIVATE_ACCESS_MESSAGE,
} from "./private-access";

export function privateAccessResponse(
  request: NextRequest,
  clerkUserId: string | null | undefined,
): NextResponse | null {
  if (
    !isPrivateApplicationPath(request.nextUrl.pathname) ||
    canAccessPrivateApplication(clerkUserId)
  )
    return null;
  if (/^\/api(?:\/|$)/.test(request.nextUrl.pathname)) {
    return NextResponse.json(
      {
        code: clerkUserId ? "private_access_required" : "unauthenticated",
        error: PRIVATE_ACCESS_MESSAGE,
        waitlistUrl: "/waitlist",
      },
      {
        status: clerkUserId ? 403 : 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  return NextResponse.redirect(
    new URL(clerkUserId ? "/waitlist" : "/sign-in", request.url),
    request.method === "GET" || request.method === "HEAD" ? 307 : 303,
  );
}
