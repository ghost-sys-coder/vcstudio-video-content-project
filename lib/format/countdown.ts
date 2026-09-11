/**
 * How long until something scheduled is due.
 *
 * Deliberately minute-grained, and deliberately silent about seconds. Both
 * schedulers in this application are sweepers: releases are swept every ten
 * minutes, social posts about once a minute. A ticking `00:00:07` would promise
 * a firing instant neither of them has, and a creator watching it reach zero
 * and then waiting seven more minutes would read that as a fault.
 *
 * So this says when a thing is *due*, never when it will fire, and it stops
 * counting once the remaining time is inside the sweeper's own window. Below
 * that the honest answer is a range, not a number.
 */

export type CountdownPhrase = {
  /** Ready to render, e.g. "Due in 3h 12m". */
  label: string;
  /** The moment has passed. Callers may style this differently. */
  elapsed: boolean;
  /**
   * Inside the sweeper's delivery window, so the label is a range rather than
   * a count. Distinct from `elapsed`: this is "about to", not "should have".
   */
  imminent: boolean;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Past this, hours and minutes are more noise than a plain day count. */
const DAYS_THRESHOLD_MS = 48 * HOUR_MS;

export function describeCountdown(input: {
  target: Date;
  now: Date;
  /**
   * How often the sweeper that will act on this runs. The countdown stops
   * being a number inside this window.
   */
  sweepWindowMinutes: number;
}): CountdownPhrase {
  const remaining = input.target.getTime() - input.now.getTime();
  const sweepWindowMs =
    Math.max(0, Math.round(input.sweepWindowMinutes)) * MINUTE_MS;

  if (remaining <= 0)
    return { label: "Due now", elapsed: true, imminent: false };

  if (remaining <= sweepWindowMs) {
    const minutes = Math.max(1, Math.round(input.sweepWindowMinutes));
    return {
      label:
        minutes === 1
          ? "Due in under a minute"
          : `Due in under ${minutes} minutes`,
      elapsed: false,
      imminent: true,
    };
  }

  if (remaining >= DAYS_THRESHOLD_MS) {
    const days = Math.floor(remaining / DAY_MS);
    return {
      label: `Due in ${days} days`,
      elapsed: false,
      imminent: false,
    };
  }

  if (remaining >= HOUR_MS) {
    const hours = Math.floor(remaining / HOUR_MS);
    const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS);
    return {
      label:
        minutes === 0 ? `Due in ${hours}h` : `Due in ${hours}h ${minutes}m`,
      elapsed: false,
      imminent: false,
    };
  }

  // Floor rather than round: "Due in 5m" turning out to be 5m59s is a pleasant
  // surprise, whereas rounding 4m30s up to 5m makes the thing appear late.
  const minutes = Math.max(1, Math.floor(remaining / MINUTE_MS));
  return {
    label: `Due in ${minutes}m`,
    elapsed: false,
    imminent: false,
  };
}
