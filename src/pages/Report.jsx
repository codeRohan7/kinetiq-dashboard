import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

// ── Severity helpers ──────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  normal:   { label: 'Normal',   bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  mild:     { label: 'Mild',     bg: 'bg-yellow-50',  border: 'border-yellow-200',  text: 'text-yellow-700',  badge: 'bg-yellow-100 text-yellow-800',  dot: 'bg-yellow-400' },
  moderate: { label: 'Moderate', bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-800',  dot: 'bg-orange-500' },
  severe:   { label: 'Severe',   bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-800',        dot: 'bg-red-500'    },
};

function getSeverityConfig(s) {
  return SEVERITY_CONFIG[s] ?? SEVERITY_CONFIG.normal;
}

const ANALYSIS_LABELS = {
  pageFirst:  { title: 'Clinical Overview',              icon: '🩺', color: 'from-violet-500 to-purple-600' },
  pageSecond: { title: 'Biomechanical Analysis',         icon: '🦶', color: 'from-blue-500 to-cyan-600'    },
  pageThird:  { title: 'Clinical Impact & Risk',         icon: '⚠️', color: 'from-orange-500 to-red-600'   },
  pageFourth: { title: 'Orthotic Prescription',          icon: '👟', color: 'from-teal-500 to-green-600'   },
  pageFifth:  { title: 'Lifestyle & Rehabilitation',     icon: '🏃', color: 'from-pink-500 to-rose-600'    },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children, noPad }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-gray-200">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
        {icon && <span className="text-xl">{icon}</span>}
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      </div>
      <div className={noPad ? '' : 'p-6'}>{children}</div>
    </div>
  );
}

function MetricBadge({ label, value, variant = 'neutral' }) {
  const colors = {
    neutral:  'bg-gray-100 text-gray-700 border-gray-200',
    purple:   'bg-purple-100 text-purple-800 border-purple-200',
    pink:     'bg-pink-100 text-pink-800 border-pink-200',
    blue:     'bg-blue-100 text-blue-800 border-blue-200',
    emerald:  'bg-emerald-100 text-emerald-800 border-emerald-200',
    orange:   'bg-orange-100 text-orange-800 border-orange-200',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[variant]}`}>
      <p className="text-xs font-medium opacity-70 mb-0.5">{label}</p>
      <p className="font-bold capitalize text-sm leading-tight">{value || 'N/A'}</p>
    </div>
  );
}

function AngleRow({ angle }) {
  const color  = angle.normal ? 'text-emerald-600' : (angle.severity === 'severe' ? 'text-red-600' : 'text-orange-600');
  const dot    = angle.normal ? 'bg-emerald-400' : (angle.severity === 'severe' ? 'bg-red-500' : 'bg-orange-400');
  const bgRow  = angle.normal ? '' : 'bg-red-50/40';
  return (
    <tr className={`border-b border-gray-50 last:border-0 ${bgRow}`}>
      <td className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
          <span className="text-sm text-gray-700">{angle.name}</span>
        </div>
      </td>
      <td className={`py-2 font-semibold text-sm tabular-nums ${color}`}>
        {angle.degrees.toFixed(1)}°
      </td>
      <td className="py-2 text-xs text-gray-400">
        {angle.normalRange ? `${angle.normalRange[0]}–${angle.normalRange[1]}°` : '—'}
      </td>
      <td className="py-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${getSeverityConfig(angle.severity ?? (angle.normal ? 'normal' : 'moderate')).badge}`}>
          {angle.severity ?? (angle.normal ? 'normal' : 'review')}
        </span>
      </td>
    </tr>
  );
}

function ScoreGauge({ score, label }) {
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f97316' : '#ef4444';
  const angle = -135 + (score / 100) * 270;
  const toRad = d => (d * Math.PI) / 180;
  const cx = 60; const cy = 60; const r = 44;
  const arcX = d => cx + r * Math.cos(toRad(d));
  const arcY = d => cy + r * Math.sin(toRad(d));
  const large = score > 50 ? 1 : 0;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 90" className="w-32 h-24">
        <path d={`M ${arcX(-135)} ${arcY(-135)} A ${r} ${r} 0 1 1 ${arcX(135)} ${arcY(135)}`}
          fill="none" stroke="#f1f5f9" strokeWidth="8" strokeLinecap="round" />
        <path d={`M ${arcX(-135)} ${arcY(-135)} A ${r} ${r} 0 ${large} 1 ${arcX(angle)} ${arcY(angle)}`}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={cx + (r - 10) * Math.cos(toRad(angle))} y2={cy + (r - 10) * Math.sin(toRad(angle))}
          stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill={color} />
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="16" fontWeight="bold" fill={color}>{score}</text>
      </svg>
      <p className="text-xs text-gray-500 -mt-1">{label}</p>
    </div>
  );
}

function ArchVisual({ archType }) {
  const config = {
    collapsed: { bars: [6, 3, 2, 3, 5],    label: 'Collapsed / Flat', color: '#3b82f6' },
    low:       { bars: [6, 5, 3, 5, 6],    label: 'Low Arch',         color: '#06b6d4' },
    normal:    { bars: [6, 7, 7, 7, 6],    label: 'Normal Arch',      color: '#22c55e' },
    high:      { bars: [7, 9, 10, 9, 7],   label: 'High Arch',        color: '#a855f7' },
  };
  const c = config[archType?.toLowerCase()] ?? config.normal;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-end gap-1 h-12">
        {c.bars.map((h, i) => (
          <div key={i} className="w-5 rounded-t-sm transition-all" style={{ height: `${h * 4}px`, background: c.color }} />
        ))}
      </div>
      <p className="text-xs font-semibold" style={{ color: c.color }}>{c.label}</p>
    </div>
  );
}

function PronationIcon({ type }) {
  const config = {
    'severe-overpronation': { emoji: '🔴', label: 'Severe Overpronation', color: 'text-red-600' },
    overpronation:          { emoji: '🟠', label: 'Overpronation',        color: 'text-orange-600' },
    neutral:                { emoji: '🟢', label: 'Neutral',              color: 'text-emerald-600' },
    underpronation:         { emoji: '🟡', label: 'Underpronation',       color: 'text-yellow-600' },
  };
  const key = type?.toLowerCase()?.replace(/\s+/g, '-');
  const c = config[key] ?? { emoji: '⚪', label: type || 'Unknown', color: 'text-gray-500' };
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-3xl">{c.emoji}</span>
      <p className={`text-xs font-semibold ${c.color}`}>{c.label}</p>
    </div>
  );
}

// ── Main Report Component ─────────────────────────────────────────────────────

const Report = () => {
  const { id } = useParams();
  const [scanData, setScanData] = useState(null);
  const [loading, setLoading]   = useState(true);
  const printRef = useRef(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const scanSnap = await getDoc(doc(db, 'scans', id));
        if (scanSnap.exists()) {
          setScanData(scanSnap.data());
        } else {
          toast.error('Report not found or invalid link.');
        }
      } catch {
        toast.error('Failed to load report.');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your secure report…</p>
          <p className="text-gray-400 text-sm mt-1">Powered by KinetiQ AI</p>
        </div>
      </div>
    );
  }

  if (!scanData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white rounded-2xl p-10 shadow-lg border border-gray-100 max-w-md">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Report Not Found</h2>
          <p className="text-gray-500">This report link may be expired or invalid. Please contact your clinic.</p>
        </div>
      </div>
    );
  }

  const {
    patientName, firstName, lastName, age, gender, email, phone,
    vendorName, timestamp, medialArchType, footType,
    postureData, visionAnalysis, archVisionAnalysis,
    analysis, heatmapUrls, imageUrls, postureOverlayUrl,
    occupation, lifestyle, activities, problem,
  } = scanData;

  const scanDate   = timestamp ? new Date(timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const archSev    = archVisionAnalysis?.severity ?? 'normal';
  const sevConfig  = getSeverityConfig(archSev);

  const postureScore = postureData?.score ?? null;
  const postureAngles = Array.isArray(postureData?.angles) ? postureData.angles : [];

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm 12mm; }
          body { background: white !important; font-size: 11px; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          img { max-height: 220px; object-fit: contain; break-inside: avoid; }
          .rounded-2xl, .rounded-xl { break-inside: avoid; }
        }
        .report-gradient { background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #0891b2 100%); }
      `}</style>

      <div className="min-h-screen bg-gray-50 print:bg-white">

        {/* ═══ STICKY HEADER (no-print) ═══════════════════════════════════════ */}
        <header className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl report-gradient flex items-center justify-center text-white font-black text-sm">K</div>
              <div>
                <p className="font-bold text-gray-900 text-sm leading-none">KinetiQ Footcare</p>
                <p className="text-xs text-gray-400">{vendorName || 'Clinic Report'}</p>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10m-2 0H5a2 2 0 01-2-2v-2" />
              </svg>
              Download PDF
            </button>
          </div>
        </header>

        <main ref={printRef} className="max-w-5xl mx-auto px-4 py-8 space-y-6">

          {/* ═══ HERO BANNER ═══════════════════════════════════════════════════ */}
          <div className="report-gradient rounded-2xl overflow-hidden text-white shadow-xl print:shadow-none">
            <div className="px-8 py-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">KinetiQ AI Biomechanics Report</p>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  {patientName || `${firstName ?? ''} ${lastName ?? ''}`.trim() || 'Patient Report'}
                </h1>
                <div className="flex flex-wrap gap-3 mt-3">
                  {age      && <span className="bg-white/20 rounded-lg px-3 py-1 text-xs font-semibold">Age: {age} yrs</span>}
                  {gender   && <span className="bg-white/20 rounded-lg px-3 py-1 text-xs font-semibold">{gender}</span>}
                  {scanDate && <span className="bg-white/20 rounded-lg px-3 py-1 text-xs font-semibold">📅 {scanDate}</span>}
                  {vendorName && <span className="bg-white/20 rounded-lg px-3 py-1 text-xs font-semibold">🏥 {vendorName}</span>}
                </div>
              </div>
              <div className="flex flex-col items-center bg-white/15 backdrop-blur rounded-xl px-6 py-4 text-center shrink-0">
                <p className="text-white/70 text-xs mb-1">Scan Reference</p>
                <p className="font-mono font-bold text-sm tracking-wider">{id?.slice(0, 8).toUpperCase()}</p>
                {archSev !== 'normal' && (
                  <span className={`mt-2 text-xs font-bold px-3 py-1 rounded-full bg-white/20`}>
                    {sevConfig.label} Severity
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ═══ PATIENT DETAILS GRID ══════════════════════════════════════════ */}
          <SectionCard title="Patient Profile" icon="👤">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <MetricBadge label="Full Name"    value={patientName || `${firstName ?? ''} ${lastName ?? ''}`.trim()} variant="neutral" />
              <MetricBadge label="Age"          value={age ? `${age} years` : null}   variant="blue"    />
              <MetricBadge label="Gender"       value={gender}   variant="purple"  />
              <MetricBadge label="Scan Date"    value={scanDate} variant="neutral"  />
              {occupation && <MetricBadge label="Occupation" value={occupation} variant="neutral" />}
              {lifestyle  && <MetricBadge label="Lifestyle"  value={lifestyle}  variant="emerald" />}
              {email      && <MetricBadge label="Email"      value={email}      variant="neutral" />}
              {phone      && <MetricBadge label="Phone"      value={phone}      variant="neutral" />}
            </div>
            {problem && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-semibold text-amber-700 mb-1">Chief Complaint</p>
                <p className="text-sm text-amber-900">{problem}</p>
              </div>
            )}
            {Array.isArray(activities) && activities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {activities.map(a => (
                  <span key={a} className="bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium px-3 py-1 rounded-full">{a}</span>
                ))}
              </div>
            )}
          </SectionCard>

          {/* ═══ BIOMECHANICAL SUMMARY ════════════════════════════════════════ */}
          <SectionCard title="Biomechanical Findings Summary" icon="📊">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">

              {/* Arch visual */}
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Medial Arch</p>
                <ArchVisual archType={archVisionAnalysis?.archHeight || medialArchType} />
                <span className={`text-xs font-bold px-3 py-1 rounded-full border capitalize ${sevConfig.badge} ${sevConfig.border}`}>
                  {archVisionAnalysis?.archHeight || medialArchType || '—'}
                </span>
              </div>

              {/* Pronation */}
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Foot Type / Pronation</p>
                <PronationIcon type={archVisionAnalysis?.pronationStatus || footType} />
                <span className="text-xs font-bold px-3 py-1 rounded-full border bg-gray-100 text-gray-700 border-gray-200 capitalize">
                  {archVisionAnalysis?.pronationStatus || footType || '—'}
                </span>
              </div>

              {/* Posture score or severity badge */}
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Posture Score</p>
                {postureScore !== null ? (
                  <ScoreGauge score={postureScore} label="Alignment Score" />
                ) : (
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${sevConfig.border} ${sevConfig.bg}`}>
                    <span className={`text-lg font-extrabold ${sevConfig.text}`}>{sevConfig.label.charAt(0)}</span>
                  </div>
                )}
                <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${sevConfig.badge}`}>
                  {archSev} severity
                </span>
              </div>

            </div>

            {/* archVisionAnalysis clinical findings */}
            {archVisionAnalysis?.clinicalFindings && (
              <div className="mt-5 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                <p className="text-xs font-semibold text-indigo-600 mb-1 uppercase tracking-wide">AI Clinical Findings (Foot Scanner)</p>
                <p className="text-sm text-indigo-900 leading-relaxed">{archVisionAnalysis.clinicalFindings}</p>
              </div>
            )}
          </SectionCard>

          {/* ═══ POSTURE ANALYSIS ════════════════════════════════════════════ */}
          {(postureOverlayUrl || postureAngles.length > 0 || visionAnalysis) && (
            <SectionCard title="Posture & Body Alignment Analysis" icon="🧍">
              <div className="grid md:grid-cols-2 gap-6">

                {/* Posture overlay image */}
                {postureOverlayUrl && (
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-900">
                    <div className="px-3 py-2 bg-gray-900 text-teal-400 text-xs font-semibold tracking-wider">
                      MediaPipe AI Skeleton Overlay
                    </div>
                    <img
                      src={postureOverlayUrl}
                      alt="Posture analysis with alignment markers"
                      className="w-full object-contain max-h-80"
                    />
                    {(postureData?.landmarksEdited || postureData?.scaleSource === "patient-height") && (
                      <div className="px-3 py-2 space-y-1 border-t border-white/10">
                        {postureData?.landmarksEdited && (
                          <p className="text-xs text-gray-500 italic">
                            Landmark positions reviewed and adjusted by the clinician.
                          </p>
                        )}
                        {postureData?.scaleSource === "patient-height" && (
                          <p className="text-xs text-gray-500 italic">
                            Centimetre values are estimated from recorded patient height and are indicative, not measured.
                            Angle measurements are independent of this estimate.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {/* Angle measurements table */}
                  {postureAngles.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Joint Angle Measurements</p>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b-2 border-gray-100">
                            <th className="text-xs font-semibold text-gray-400 pb-2">Measurement</th>
                            <th className="text-xs font-semibold text-gray-400 pb-2">Value</th>
                            <th className="text-xs font-semibold text-gray-400 pb-2">Normal</th>
                            <th className="text-xs font-semibold text-gray-400 pb-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {postureAngles.map((a, i) => (
                            <AngleRow key={i} angle={a} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* AI Vision insights */}
                  {visionAnalysis && (
                    <div className="space-y-3">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide">AI Posture Summary</p>
                        <p className="text-sm text-blue-900 leading-relaxed">{visionAnalysis.postureSummary}</p>
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Body Alignment Details</p>
                        <p className="text-sm text-slate-800 leading-relaxed">{visionAnalysis.bodyAlignment}</p>
                      </div>
                      <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
                        <p className="text-xs font-semibold text-teal-600 mb-1 uppercase tracking-wide">Recommended Action</p>
                        <p className="text-sm text-teal-900 leading-relaxed">{visionAnalysis.recommendedAction}</p>
                      </div>
                    </div>
                  )}

                  {/* Posture summary */}
                  {postureData?.summary && !visionAnalysis && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                      <p className="text-sm text-gray-700">{postureData.summary}</p>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          )}

          {/* ═══ PLANTAR PRESSURE HEATMAPS ═══════════════════════════════════ */}
          {heatmapUrls?.length > 0 && (
            <SectionCard title="Plantar Pressure Heatmap Analysis" icon="🌡️">
              <div className="mb-4 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Low pressure</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Medium</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> High</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-600 inline-block" /> Peak pressure</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {heatmapUrls.map((url, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-gray-100 bg-black/5">
                    <div className="text-center text-xs font-semibold text-gray-500 py-2 bg-gray-50">
                      {i === 0 ? 'Left Foot' : i === 1 ? 'Right Foot' : `Scan ${i + 1}`}
                    </div>
                    <img src={url} alt={`Heatmap ${i + 1}`} className="w-full object-contain max-h-56 bg-black" />
                  </div>
                ))}
              </div>
              {archVisionAnalysis && (
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  {archVisionAnalysis.leftFoot && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-xs font-bold text-blue-700 mb-1">Left Foot Analysis</p>
                      <p className="text-xs text-blue-800 leading-relaxed">{archVisionAnalysis.leftFoot}</p>
                    </div>
                  )}
                  {archVisionAnalysis.rightFoot && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                      <p className="text-xs font-bold text-purple-700 mb-1">Right Foot Analysis</p>
                      <p className="text-xs text-purple-800 leading-relaxed">{archVisionAnalysis.rightFoot}</p>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          )}

          {/* ═══ ORTHOTIC RECOMMENDATIONS ════════════════════════════════════ */}
          {(archVisionAnalysis?.insoleRecommendation || archVisionAnalysis?.footwearAdvice) && (
            <SectionCard title="Recommended Orthotics & Footwear" icon="👟">
              <div className="grid md:grid-cols-2 gap-4">
                {archVisionAnalysis.insoleRecommendation && (
                  <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
                    <p className="text-xs font-bold text-teal-700 mb-2 uppercase tracking-wide">Custom Insole Prescription</p>
                    <p className="text-sm text-teal-900 leading-relaxed">{archVisionAnalysis.insoleRecommendation}</p>
                  </div>
                )}
                {archVisionAnalysis.footwearAdvice && (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <p className="text-xs font-bold text-indigo-700 mb-2 uppercase tracking-wide">Footwear Advice</p>
                    <p className="text-sm text-indigo-900 leading-relaxed">{archVisionAnalysis.footwearAdvice}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {/* ═══ FULL AI CLINICAL REPORT ══════════════════════════════════════ */}
          {analysis && (
            <SectionCard title="Full AI Clinical Report" icon="📋">
              <div className="space-y-4">
                {Object.entries(analysis).map(([key, text]) => {
                  const meta = ANALYSIS_LABELS[key] ?? { title: key, icon: '📌', color: 'from-gray-500 to-gray-600' };
                  return (
                    <div key={key} className="rounded-xl border border-gray-100 overflow-hidden">
                      <div className={`flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r ${meta.color}`}>
                        <span className="text-base">{meta.icon}</span>
                        <h3 className="text-sm font-bold text-white">{meta.title}</h3>
                      </div>
                      <div className="px-4 py-3 bg-white">
                        <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* ═══ CLINICAL SCAN GALLERY ════════════════════════════════════════ */}
          {imageUrls?.length > 0 && (
            <SectionCard title="Clinical Scan Captures" icon="📸">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {imageUrls.map((url, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={url} alt={`Scan ${i + 1}`} className="w-full object-cover max-h-52" />
                    <p className="text-center text-xs text-gray-400 py-1.5">
                      {i < imageUrls.length - 1 ? `Posture ${i + 1}` : 'Foot Scan'}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ═══ FOOTER ══════════════════════════════════════════════════════ */}
          <div className="text-center py-6 space-y-1">
            <p className="text-xs text-gray-400">
              Report generated by <span className="font-semibold text-violet-600">KinetiQ AI Footcare System</span> · Powered by Claude AI Vision
            </p>
            <p className="text-xs text-gray-300">
              {vendorName} · Scan ID: {id} · {scanDate}
            </p>
            <p className="text-[10px] text-gray-300 max-w-lg mx-auto">
              This report is for clinical reference only and does not constitute a medical diagnosis.
              Consult a qualified healthcare professional for treatment decisions.
            </p>
          </div>

        </main>
      </div>
    </>
  );
};

export default Report;
