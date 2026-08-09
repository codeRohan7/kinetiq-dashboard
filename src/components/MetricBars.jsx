/**
 * Threshold bars for the patient report, in the style of the reference
 * clinical report: a green-to-red track with the band boundaries labelled and
 * a pin at the patient's value.
 *
 * Geometry comes from lib/metricBands.js, which derives the bands from each
 * angle's own normal range — so the colour under the pin always matches the
 * severity the scan recorded.
 */

import React from 'react';
import {
  SEVERITY_COLORS, bandScaleFor, bilateralPosition, bilateralScaleFor,
  gradeSeverity, mirroredBands, positionOn, severityLabel,
} from '../lib/metricBands';

function Pin({ left, value, color, badge, above = true }) {
  return (
    <div
      className="absolute flex flex-col items-center pointer-events-none"
      style={{
        left: `${left * 100}%`,
        transform: 'translateX(-50%)',
        ...(above ? { bottom: '100%' } : { top: '100%' }),
      }}
    >
      {above && (
        <span className="text-[10px] font-bold leading-none mb-0.5 tabular-nums" style={{ color }}>
          {value}
        </span>
      )}
      <svg width="11" height="13" viewBox="0 0 11 13" className={above ? '' : 'rotate-180'}>
        <path d="M5.5 13 L1.4 6.2 A4.6 4.6 0 1 1 9.6 6.2 Z" fill="#1f2937" />
        <circle cx="5.5" cy="4.8" r="1.6" fill="#ffffff" />
      </svg>
      {badge && (
        <span className="text-[9px] font-bold leading-none text-white bg-gray-800 rounded px-1 mt-0.5">
          {badge}
        </span>
      )}
      {!above && (
        <span className="text-[10px] font-bold leading-none mt-0.5 tabular-nums" style={{ color }}>
          {value}
        </span>
      )}
    </div>
  );
}

function Track({ bands }) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      {bands.map((b, i) => (
        <div
          key={i}
          className="h-full"
          style={{ flexGrow: Math.max(0.0001, b.to - b.from), backgroundColor: b.color }}
        />
      ))}
    </div>
  );
}

/**
 * One measurement row: label and plain-language finding on the left, the
 * threshold bar on the right.
 */
export function MetricBar({ label, angle, normalText = 'no', abnormalText }) {
  const range = angle.normalRange;
  if (!range) return null;

  const scale    = bandScaleFor(range);
  const severity = gradeSeverity(angle.degrees, range);
  const color    = SEVERITY_COLORS[severity];
  const finding  = severity === 'normal' ? normalText : (abnormalText || label.toLowerCase());

  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0 break-inside-avoid">
      <div className="w-40 flex-shrink-0">
        <p className="text-xs text-gray-500 leading-tight">{label}:</p>
        <p className="text-sm font-bold leading-tight" style={{ color }}>
          {finding}
          {severity !== 'normal' && (
            <span
              className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded text-white align-middle"
              style={{ backgroundColor: color }}
            >
              {severityLabel(severity)}
            </span>
          )}
        </p>
      </div>
      <div className="flex-1 pt-4">
        <div className="relative w-full">
          <Pin left={positionOn(scale, angle.degrees)} value={`${angle.degrees.toFixed(0)}°`} color={color} />
          <Track bands={scale.bands} />
        </div>
        <div className="relative h-4 w-full">
          {scale.ticks.map((t, i) => (
            <span
              key={i}
              className="absolute text-[9px] text-gray-400 tabular-nums"
              style={{ left: `${positionOn(scale, t) * 100}%`, transform: 'translateX(-50%)' }}
            >
              {t}°
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SideSummary({ side, tag }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-bold text-white bg-gray-700 rounded px-1.5 py-0.5">{tag}</span>
      {side ? (
        <span className="text-xs font-semibold" style={{ color: SEVERITY_COLORS[side.severity] }}>
          {side.text}
          {side.severity !== 'normal' && (
            <span
              className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
              style={{ backgroundColor: SEVERITY_COLORS[side.severity] }}
            >
              {severityLabel(side.severity)}
            </span>
          )}
        </span>
      ) : (
        <span className="text-xs text-gray-400">not measured</span>
      )}
    </div>
  );
}

/**
 * Two-directional bar: normal in the middle, one named direction either side,
 * left leg pinned above the track and right below — the layout the reference
 * report uses for heel tilt and tibial torsion.
 */
export function BilateralBar({ title, range, leftLabel, rightLabel, left, right }) {
  const scale = bilateralScaleFor(range);
  const bands = mirroredBands(scale);

  return (
    <div className="py-4 border-b border-gray-100 last:border-0 break-inside-avoid">
      <p className="text-sm font-bold text-gray-800 mb-2">{title}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-5">
        <SideSummary side={left} tag="L" />
        <SideSummary side={right} tag="R" />
      </div>

      <div className="relative w-full">
        {left && (
          <Pin
            left={bilateralPosition(scale, left.degrees, left.side)}
            value={`${left.degrees.toFixed(0)}°`}
            color={SEVERITY_COLORS[left.severity]}
            badge="L"
          />
        )}
        <Track bands={bands} />
        {right && (
          <Pin
            left={bilateralPosition(scale, right.degrees, right.side)}
            value={`${right.degrees.toFixed(0)}°`}
            color={SEVERITY_COLORS[right.severity]}
            badge="R"
            above={false}
          />
        )}
      </div>

      <div className="relative h-4 w-full mt-10">
        {scale.ticks.map(t => (
          <span key={`l${t}`}
            className="absolute text-[9px] text-gray-400 tabular-nums"
            style={{ left: `${bilateralPosition(scale, t, -1) * 100}%`, transform: 'translateX(-50%)' }}>
            {t}
          </span>
        ))}
        <span className="absolute text-[9px] text-gray-400" style={{ left: '50%', transform: 'translateX(-50%)' }}>0</span>
        {scale.ticks.map(t => (
          <span key={`r${t}`}
            className="absolute text-[9px] text-gray-400 tabular-nums"
            style={{ left: `${bilateralPosition(scale, t, 1) * 100}%`, transform: 'translateX(-50%)' }}>
            {t}
          </span>
        ))}
      </div>

      <div className="flex justify-between text-[10px] font-semibold text-gray-500 mt-1">
        <span>{leftLabel}</span>
        <span className="text-emerald-600">Normal</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

/**
 * Rows of the "Body condition" panel, in the reading order of the reference
 * report. A row renders only when its metric was measured, so a scan without a
 * side view simply omits the sagittal rows rather than showing blanks.
 */
export const BODY_CONDITION_ROWS = [
  { metric: 'Shoulder tilt',        label: 'Shoulder droop',      normal: 'no', abnormal: 'dropped' },
  { metric: 'Spine deviation',      label: 'Spinal deviation',    normal: 'no', abnormal: 'deviated' },
  { metric: 'Pelvic obliquity',     label: 'Pelvic tilt',         normal: 'no', abnormal: 'tilted' },
  { metric: 'Left knee deviation',  label: 'X/O-shaped legs (L)', normal: 'no', abnormal: 'deviated' },
  { metric: 'Right knee deviation', label: 'X/O-shaped legs (R)', normal: 'no', abnormal: 'deviated' },
  { metric: 'Forward head',         label: 'Neck tilt',           normal: 'no', abnormal: 'forward' },
  { metric: 'Trunk lean',           label: 'Trunk lean',          normal: 'no', abnormal: 'leaning' },
  { metric: 'Left knee flexion',    label: 'Knee hyperextension', normal: 'no', abnormal: 'hyperextended' },
];

/** Normal ranges the report needs for findings that arrive without one. */
export const HEEL_RANGE = [0, 6];
export const SHIN_RANGE = [0, 5];

/** Map a synced heel finding onto a bilateral pin. */
export function heelSide(finding) {
  if (!finding) return null;
  return {
    degrees:  finding.degrees,
    side:     finding.finding === 'normal' ? 0 : finding.finding === 'varus' ? -1 : 1,
    severity: gradeSeverity(finding.degrees, HEEL_RANGE),
    text:     finding.finding === 'normal' ? 'Normal'
            : finding.finding === 'varus'  ? 'varus (outward tilt)'
            :                                'valgus (inward tilt)',
  };
}

/** Map a synced shin finding onto a bilateral pin. */
export function shinSide(finding) {
  if (!finding) return null;
  return {
    degrees:  finding.degrees,
    side:     finding.finding === 'neutral' ? 0 : finding.finding === 'internal-rotation' ? -1 : 1,
    severity: gradeSeverity(finding.degrees, SHIN_RANGE),
    text:     finding.finding === 'neutral'           ? 'Normal'
            : finding.finding === 'internal-rotation' ? 'internal rotation of the lower leg'
            :                                           'external rotation of the lower leg',
  };
}
