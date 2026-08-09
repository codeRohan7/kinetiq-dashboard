/**
 * Static plantar-pressure panel, in the layout of the reference clinical
 * report: per-foot forefoot/hindfoot load either side of the heatmaps, the
 * bilateral split beneath, and a parameter table under that.
 *
 * Every number here comes from FsrtekAnalytics, computed on the mat frame at
 * scan time. Where the analytics only produces a combined figure — contact
 * area, mean and peak pressure, arch index are measured across the whole mat —
 * the table says "both feet" rather than inventing a per-foot split. Load
 * share is a PRESSURE ratio, so apportioning area by it would be a guess
 * dressed as a measurement.
 */

import React from 'react';

const ZONE_KEYS = ['heel', 'midfoot', 'forefoot', 'toes'];

/**
 * Forefoot vs hindfoot share for one foot.
 *
 * Zone values are percentages of TOTAL (both-feet) pressure, so they are
 * renormalised against this foot's own total to give a split that sums to 100
 * for the foot in question. Forefoot takes the toes with it and hindfoot takes
 * the midfoot, matching the reference report's two-way division.
 */
export function loadSplit(zones, side) {
  if (!zones) return null;
  const value = key => Number(zones[key]?.[side] ?? 0);
  const fore = value('forefoot') + value('toes');
  const hind = value('heel') + value('midfoot');
  const total = fore + hind;
  if (!(total > 0)) return null;
  return {
    fore: Math.round((fore / total) * 100),
    hind: Math.round((hind / total) * 100),
  };
}

function hasZoneData(zones) {
  return !!zones && ZONE_KEYS.some(k => Number(zones[k]?.left ?? 0) + Number(zones[k]?.right ?? 0) > 0);
}

function LoadColumn({ split, side }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 w-24 shrink-0">
      <div className="text-center">
        <p className="text-[10px] text-gray-500 leading-tight">Forefoot<br />Load</p>
        <p className="text-2xl font-extrabold text-blue-600 tabular-nums">
          {split ? `${split.fore}%` : '—'}
        </p>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-gray-500 leading-tight">Hindfoot<br />Load</p>
        <p className="text-2xl font-extrabold text-blue-600 tabular-nums">
          {split ? `${split.hind}%` : '—'}
        </p>
      </div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{side}</p>
    </div>
  );
}

/** Vertical 0–100 pressure scale, matching the heatmap colour ramp. */
function PressureScale() {
  return (
    <div className="flex items-stretch gap-1.5 shrink-0">
      <div
        className="w-3 rounded-sm"
        style={{ background: 'linear-gradient(to top, #1d4ed8, #22c55e, #facc15, #f97316, #ef4444)' }}
      />
      <div className="flex flex-col justify-between text-[9px] text-gray-400 tabular-nums py-0.5">
        <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
      </div>
    </div>
  );
}

function ParameterRow({ label, left, right, combined }) {
  if (combined !== undefined) {
    return (
      <tr className="border-b border-gray-100 last:border-0">
        <td className="py-2 text-sm text-gray-400 text-center">—</td>
        <td className="py-2 text-sm font-semibold text-gray-700 text-center">{label}</td>
        <td className="py-2 text-sm font-bold text-gray-900 text-center tabular-nums">{combined}</td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 text-sm font-bold text-gray-900 text-center tabular-nums">{left ?? '—'}</td>
      <td className="py-2 text-sm font-semibold text-gray-700 text-center">{label}</td>
      <td className="py-2 text-sm font-bold text-gray-900 text-center tabular-nums">{right ?? '—'}</td>
    </tr>
  );
}

export default function FootPressurePanel({ analytics, heatmapUrls = [], archType }) {
  const zones     = analytics?.zones;
  const leftSplit  = loadSplit(zones, 'left');
  const rightSplit = loadSplit(zones, 'right');
  const bilateral  = analytics?.bilateral;

  const num = (v, digits = 1) => (typeof v === 'number' && isFinite(v) ? v.toFixed(digits) : null);

  return (
    <div className="space-y-5">
      {/* ── Feet with per-side load columns ─────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <LoadColumn split={leftSplit} side="Left" />

          <div className="flex gap-3 flex-1 justify-center min-w-[220px]">
            {heatmapUrls.length > 0 ? (
              heatmapUrls.slice(0, 2).map((url, i) => (
                <div key={i} className="flex flex-col items-center">
                  <p className="text-xs font-bold text-gray-600 mb-1">
                    {i === 0 ? 'LEFT FOOT' : 'RIGHT FOOT'}
                  </p>
                  <img
                    src={url}
                    alt={i === 0 ? 'Left foot pressure map' : 'Right foot pressure map'}
                    className="max-h-64 object-contain"
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 py-12 text-center">
                No pressure capture recorded for this scan.
              </p>
            )}
          </div>

          <LoadColumn split={rightSplit} side="Right" />
          <PressureScale />
        </div>
      </div>

      {/* ── Bilateral distribution ──────────────────────────────────────── */}
      {bilateral && (
        <div className="rounded-2xl bg-blue-50 border border-blue-100 px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-3xl font-extrabold text-blue-700 tabular-nums">
            {num(bilateral.left, 1)}%
          </p>
          <p className="text-sm font-bold text-gray-600 text-center">Bilateral load distribution</p>
          <p className="text-3xl font-extrabold text-blue-700 tabular-nums">
            {num(bilateral.right, 1)}%
          </p>
        </div>
      )}

      {/* ── Parameter table ─────────────────────────────────────────────── */}
      {analytics ? (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="py-2 text-xs font-bold uppercase tracking-wider">Left</th>
              <th className="py-2 text-xs font-bold uppercase tracking-wider">Parameter</th>
              <th className="py-2 text-xs font-bold uppercase tracking-wider">Right</th>
            </tr>
          </thead>
          <tbody>
            <ParameterRow
              label="Forefoot load"
              left={leftSplit  ? `${leftSplit.fore}%`  : null}
              right={rightSplit ? `${rightSplit.fore}%` : null}
            />
            <ParameterRow
              label="Hindfoot load"
              left={leftSplit  ? `${leftSplit.hind}%`  : null}
              right={rightSplit ? `${rightSplit.hind}%` : null}
            />
            <ParameterRow
              label="Load share"
              left={num(bilateral?.left)  ? `${num(bilateral.left)}%`  : null}
              right={num(bilateral?.right) ? `${num(bilateral.right)}%` : null}
            />
            {/* Measured across the whole mat — one figure for both feet. */}
            <ParameterRow label="Contact area (both feet)" combined={num(analytics.footAreaCm2) ? `${num(analytics.footAreaCm2)} cm²` : '—'} />
            <ParameterRow label="Mean pressure"            combined={num(analytics.meanPressureKpa) ? `${num(analytics.meanPressureKpa)} kPa` : '—'} />
            <ParameterRow label="Peak pressure"            combined={num(analytics.peakPressureKpa, 0) ? `${num(analytics.peakPressureKpa, 0)} kPa` : '—'} />
            <ParameterRow label="Arch index"               combined={num(analytics.archIndex, 2) ?? '—'} />
            <ParameterRow label="Arch type"                combined={archType || '—'} />
            <ParameterRow label="Sensors in contact"       combined={analytics.activeSensorCount ?? '—'} />
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-gray-400 text-center py-6">
          No pressure-mat analytics were recorded for this scan.
        </p>
      )}

      {!hasZoneData(zones) && analytics && (
        <p className="text-xs text-gray-400 italic text-center">
          Zone breakdown unavailable — forefoot and hindfoot shares require a mat capture with contact in all regions.
        </p>
      )}

      <p className="text-[11px] text-gray-400 italic">
        Static standing measurement. Gait-phase timing, foot-progression angle and
        balance sway are not part of this scan and are therefore not reported.
      </p>
    </div>
  );
}
