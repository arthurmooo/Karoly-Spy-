/**
 * Generate clean, round Y-axis ticks for pace display (min/km or min/100m).
 * Works with decimal min values: 3.25 = 3'15, 3.5 = 3'30, etc.
 * Step is chosen to divide 60 evenly so ticks always show clean seconds.
 */
export function generatePaceTicks(
  min: number,
  max: number,
): { ticks: number[]; domainMin: number; domainMax: number; stepSec: number } {
  // Edge case: all values identical
  if (max - min < 0.01) {
    min -= 0.25;
    max += 0.25;
  }

  const rangeSec = (max - min) * 60;

  // Choose step that divides 60 evenly → round seconds on every minute boundary
  const stepSec =
    rangeSec <= 60 ? 10
    : rangeSec <= 150 ? 15
    : rangeSec <= 300 ? 30
    : 60;

  // Integer arithmetic in seconds space to avoid floating-point drift
  const startSec = Math.floor((min * 60) / stepSec) * stepSec;
  const endSec = Math.ceil((max * 60) / stepSec) * stepSec;

  const ticks: number[] = [];
  for (let s = startSec; s <= endSec + 0.5; s += stepSec) {
    ticks.push(s / 60);
  }

  return {
    ticks,
    domainMin: startSec / 60,
    domainMax: endSec / 60,
    stepSec,
  };
}

/**
 * Inject the fastest actual pace as an extra tick if it doesn't collide
 * with an existing tick (must be > half-step away from every regular tick).
 * Returns a new sorted ticks array (does NOT mutate the input).
 */
export function injectFastestPaceTick(
  ticks: number[],
  fastestPace: number,
  stepSec: number,
): number[] {
  const minGap = stepSec / 60 / 3;
  if (ticks.every((t) => Math.abs(t - fastestPace) > minGap)) {
    return [...ticks, fastestPace].sort((a, b) => a - b);
  }
  return ticks;
}
