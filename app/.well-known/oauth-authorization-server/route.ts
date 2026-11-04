import { clerkOAuthIssuer } from "@/lib/mcp/config";
export async function GET() {
  const response = await fetch(
    `${clerkOAuthIssuer()}/.well-known/oauth-authorization-server`,
    { next: { revalidate: 300 }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok)
    return Response.json(
      { error: "Authorization metadata unavailable." },
      { status: 503 },
    );
  return Response.json(await response.json(), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
