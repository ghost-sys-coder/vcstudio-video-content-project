import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { buildSecurityHeaders } from "@/lib/security/security-headers";

export default clerkMiddleware((_auth, request) => {
  const response = NextResponse.next();
  const nodeEnvironment =
    process.env.NODE_ENV === "production"
      ? "production"
      : process.env.NODE_ENV === "test"
        ? "test"
        : "development";
  const headers = buildSecurityHeaders({
    pathname: request.nextUrl.pathname,
    environment: {
      nodeEnvironment,
      cspMode:
        process.env.SECURITY_CSP_MODE === "enforce" ? "enforce" : "report-only",
      r2Endpoint: process.env.R2_ENDPOINT,
    },
  });
  for (const [name, value] of Object.entries(headers))
    response.headers.set(name, value);
  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
