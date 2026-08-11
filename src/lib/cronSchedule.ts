/**
 * Mirrors the cron schedules in vercel.json (all times UTC) so the UI can
 * show "next update" without calling the Vercel API. Keep in sync manually
 * if vercel.json changes.
 */
type CronTime = { days: number[]; hour: number; minute: number };

const WEEKDAYS = [1, 2, 3, 4, 5];

export const DAILY_DIGEST_SCHEDULE: CronTime[] = [
  { days: WEEKDAYS, hour: 13, minute: 35 },
  { days: WEEKDAYS, hour: 20, minute: 5 },
];

export const WEEKLY_TRENDS_SCHEDULE: CronTime[] = [{ days: [1], hour: 12, minute: 0 }];

/** Checks every ~2 hours during market hours rather than hourly -- Gemini's
 * free tier caps the whole project at 20 requests/day shared across every
 * user and report type, so this keeps real headroom instead of sitting
 * right at that ceiling as more users are added. */
export const BREAKING_NEWS_SCHEDULE: CronTime[] = [13, 15, 17, 19].map((hour) => ({
  days: WEEKDAYS,
  hour,
  minute: 20,
}));

/** Earliest future UTC Date matching any entry in the schedule. */
export function getNextRun(schedule: CronTime[], from: Date = new Date()): Date {
  let best: Date | null = null;
  for (const entry of schedule) {
    for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
      const candidate = new Date(
        Date.UTC(
          from.getUTCFullYear(),
          from.getUTCMonth(),
          from.getUTCDate() + dayOffset,
          entry.hour,
          entry.minute,
          0
        )
      );
      if (entry.days.includes(candidate.getUTCDay()) && candidate > from) {
        if (!best || candidate < best) best = candidate;
        break;
      }
    }
  }
  return best ?? from;
}
