/**
 * Threshold-bar geometry for the patient report.
 *
 * PORTED FROM the desktop app: KinetiQE/src/lib/pose/metricBands.ts. The two
 * must agree — the bar drawn here and the severity KinetiQE computed at scan
 * time describe the same measurement, so the cut-points below mirror
 * gradeSeverity() in KinetiQE/src/lib/pose/angles.ts exactly. Change one, change
 * the other.
 *
 * Bands are derived from each angle's own normalRange (synced with the scan)
 * rather than a table of per-metric numbers, so a metric whose range is tuned
 * in KinetiQE needs no edit here.
 */

export const SEVERITY_COLORS = {
  severe:   '#ef4444',
  moderate: '#f97316',
  mild:     '#eab308',
  normal:   '#22c55e',
};

const MILD_TO     = 5;
const MODERATE_TO = 9;
const SEVERE_SPAN = 6;
const SEVERE_TO   = MODERATE_TO + SEVERE_SPAN;

function band(severity, from, to) {
  return { severity, from, to, color: SEVERITY_COLORS[severity] };
}

/** Mirrors gradeSeverity() in the desktop app. */
export function gradeSeverity(value, range) {
  const [lo, hi] = range;
  const deviation = value < lo ? lo - value : value > hi ? value - hi : 0;
  if (deviation === 0) return 'normal';
  if (deviation < MILD_TO) return 'mild';
  if (deviation < MODERATE_TO) return 'moderate';
  return 'severe';
}

export function severityLabel(severity) {
  switch (severity) {
    case 'mild':     return 'Milder';
    case 'moderate': return 'Moderate';
    case 'severe':   return 'Serious';
    default:         return 'Normal';
  }
}

/**
 * One-sided bar for deviation metrics (normal starts at 0), symmetric bar for
 * joint angles whose normal range has a non-zero floor — falling short of
 * 160° of knee extension is as real as exceeding 185°.
 */
export function bandScaleFor(range) {
  const [lo, hi] = range;
  const bands = [];

  if (lo > 0) {
    bands.push(
      band('severe',   lo - SEVERE_TO,   lo - MODERATE_TO),
      band('moderate', lo - MODERATE_TO, lo - MILD_TO),
      band('mild',     lo - MILD_TO,     lo),
    );
  }

  bands.push(
    band('normal',   lo,               hi),
    band('mild',     hi,               hi + MILD_TO),
    band('moderate', hi + MILD_TO,     hi + MODERATE_TO),
    band('severe',   hi + MODERATE_TO, hi + SEVERE_TO),
  );

  const min = bands[0].from;
  const max = bands[bands.length - 1].to;
  return { min, max, bands, ticks: [min, ...bands.map(b => b.to)] };
}

export function positionOn(scale, value) {
  const span = scale.max - scale.min;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (value - scale.min) / span));
}

/** Bilateral bar: normal in the middle, one named direction either side. */
export function bilateralScaleFor(range) {
  const hi = range[1];
  const bands = [
    band('normal',   0,                hi),
    band('mild',     hi,               hi + MILD_TO),
    band('moderate', hi + MILD_TO,     hi + MODERATE_TO),
    band('severe',   hi + MODERATE_TO, hi + SEVERE_TO),
  ];
  return { half: hi + SEVERE_TO, bands, ticks: bands.map(b => b.to) };
}

/** `side`: -1 draws left of centre, +1 right, 0 sits on centre. */
export function bilateralPosition(scale, degrees, side) {
  const clamped = Math.min(scale.half, Math.abs(degrees));
  return 0.5 + (side * clamped) / (scale.half * 2);
}

/** Full mirrored band list for rendering a bilateral track left-to-right. */
export function mirroredBands(scale) {
  return [
    ...[...scale.bands].reverse().map(b => ({ ...b, from: -b.to, to: -b.from })),
    ...scale.bands,
  ];
}
