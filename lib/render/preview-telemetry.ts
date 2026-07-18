/**
 * Instrumentation for the preview player's asset readiness and buffering.
 *
 * The first playback stutter this addresses is invisible without timing data,
 * so every load, decode, and buffering transition is recorded here with the
 * asset URL, asset type, scene id, and current frame. Events are kept in a
 * bounded in-memory ring (readable from the console for debugging) and, when
 * verbose logging is enabled, echoed to `console.debug`.
 *
 * This module is framework-free and side-effect-safe so it can be imported by
 * both the React hook and the Remotion media components.
 */

export type PreviewTelemetryEventType =
  | "load-start"
  | "load-complete"
  | "decode-complete"
  | "buffering-start"
  | "buffering-end"
  | "initial-ready"
  | "window-updated"
  | "asset-error";

export interface PreviewTelemetryEvent {
  type: PreviewTelemetryEventType;
  timestamp: number;
  assetUrl?: string;
  assetType?: "image" | "audio" | "font";
  sceneId?: string;
  currentFrame?: number;
  detail?: string;
}

const MAX_EVENTS = 500;
const events: PreviewTelemetryEvent[] = [];

function verboseLoggingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("preview:verbose") === "true";
  } catch {
    return false;
  }
}

/**
 * Records a single preview telemetry event, stamping the wall-clock time. The
 * asset URL is intentionally truncated before logging so signed query strings
 * are never written to the console in full.
 */
export function recordPreviewEvent(
  event: Omit<PreviewTelemetryEvent, "timestamp">,
): PreviewTelemetryEvent {
  const stamped: PreviewTelemetryEvent = { ...event, timestamp: Date.now() };
  events.push(stamped);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  if (verboseLoggingEnabled())
    console.debug("[preview]", stamped.type, {
      assetType: stamped.assetType,
      sceneId: stamped.sceneId,
      currentFrame: stamped.currentFrame,
      asset: stamped.assetUrl ? redactUrl(stamped.assetUrl) : undefined,
      detail: stamped.detail,
    });
  return stamped;
}

/** Returns a copy of the recorded events, most recent last. */
export function getPreviewTelemetry(): PreviewTelemetryEvent[] {
  return [...events];
}

/** Clears the recorded events. Primarily for tests and a fresh session. */
export function resetPreviewTelemetry(): void {
  events.length = 0;
}

/** Drops the query string (signed credentials) from a URL for safe logging. */
export function redactUrl(url: string): string {
  const queryIndex = url.indexOf("?");
  return queryIndex === -1 ? url : `${url.slice(0, queryIndex)}?…`;
}
