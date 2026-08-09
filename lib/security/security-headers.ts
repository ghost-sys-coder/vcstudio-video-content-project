export type SecurityHeaderEnvironment = {
  nodeEnvironment: "development" | "test" | "production";
  cspMode: "report-only" | "enforce";
  r2Endpoint?: string;
};

const AUDIO_ROUTE = /^\/app\/projects\/[^/]+\/audio\/?$/;

function origin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy(
  environment: SecurityHeaderEnvironment,
): string {
  const r2Origin = origin(environment.r2Endpoint);
  const developmentScript =
    environment.nodeEnvironment === "development" ? " 'unsafe-eval'" : "";
  const assetOrigins = [
    r2Origin,
    "https://img.clerk.com",
    "https://images.clerk.dev",
  ]
    .filter(Boolean)
    .join(" ");
  const connectOrigins = [
    r2Origin,
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
  ]
    .filter(Boolean)
    .join(" ");
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${developmentScript} https://*.clerk.accounts.dev https://*.clerk.com`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${assetOrigins}`.trim(),
    `media-src 'self' blob: ${r2Origin ?? ""}`.trim(),
    `connect-src 'self' blob: ${connectOrigins}`.trim(),
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "frame-src https://*.clerk.accounts.dev https://*.clerk.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (environment.nodeEnvironment === "production")
    directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function buildSecurityHeaders(input: {
  pathname: string;
  environment: SecurityHeaderEnvironment;
}): Record<string, string> {
  const headers: Record<string, string> = {
    [input.environment.cspMode === "enforce"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only"]: buildContentSecurityPolicy(
      input.environment,
    ),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": `camera=(), microphone=${AUDIO_ROUTE.test(input.pathname) ? "(self)" : "()"}, geolocation=(), payment=(), usb=()`,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  if (input.environment.nodeEnvironment === "production")
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  return headers;
}
