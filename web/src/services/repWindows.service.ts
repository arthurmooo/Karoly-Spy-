import type { ActivityInterval, RepWindow, StreamPoint } from "@/types/activity";

const BIKE_SPORTS = new Set(["VELO", "VTT", "Bike", "bike"]);
const MIN_POINTS = 10;

function getWindowDuration(durationSec: number): number {
  if (durationSec >= 360) return 120;
  if (durationSec >= 180) return 90;
  return 60;
}

export function computeFrontendRepWindows(
  intervals: ActivityInterval[],
  streams: StreamPoint[],
  sportType: string,
): RepWindow[] {
  const isBike = BIKE_SPORTS.has(sportType);
  const workIntervals = intervals.filter((i) => i.type === "work" || i.type === "active");
  if (workIntervals.length === 0 || streams.length === 0) return [];

  const results: RepWindow[] = [];

  for (let idx = 0; idx < workIntervals.length; idx++) {
    const intv = workIntervals[idx]!;
    const duration = intv.duration ?? (intv.end_time - intv.start_time);
    if (duration <= 0) continue;

    const windowDur = Math.min(getWindowDuration(duration), duration);
    const windowStart = intv.end_time - windowDur;
    const windowEnd = intv.end_time;

    // Extract stream points within the window (using chart-time `t`)
    const windowPts = streams.filter(
      (pt) => pt.t >= windowStart && pt.t <= windowEnd
    );

    const hrPts = windowPts.filter((pt) => pt.hr != null && Number.isFinite(pt.hr));
    if (hrPts.length < MIN_POINTS) continue;

    const hrRaw = hrPts.reduce((sum, pt) => sum + pt.hr!, 0) / hrPts.length;

    let output: number | null = null;
    if (isBike) {
      const pwrPts = windowPts.filter((pt) => pt.pwr != null && Number.isFinite(pt.pwr));
      if (pwrPts.length >= MIN_POINTS) {
        output = pwrPts.reduce((sum, pt) => sum + pt.pwr!, 0) / pwrPts.length;
      }
    } else {
      const spdPts = windowPts.filter((pt) => pt.spd != null && Number.isFinite(pt.spd) && pt.spd > 0);
      if (spdPts.length >= MIN_POINTS) {
        const avgSpd = spdPts.reduce((sum, pt) => sum + pt.spd!, 0) / spdPts.length;
        output = avgSpd * 3.6; // m/s → km/h
      }
    }

    results.push({
      rep_index: idx + 1,
      start_sec: windowStart,
      end_sec: windowEnd,
      duration_sec: windowDur,
      hr_raw: Math.round(hrRaw * 10) / 10,
      hr_corr: null,
      output: output != null ? Math.round(output * 100) / 100 : null,
      ea: null,
    });
  }

  return results;
}
