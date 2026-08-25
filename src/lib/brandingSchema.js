/**
 * Vendor branding — slot definitions.
 *
 * This file is the contract between the dashboard (which writes
 * vendorBranding/{vendorId}) and KinetiQE (which reads and caches it). A
 * near-identical copy lives at KinetiQE/src/lib/brandingSchema.ts — the two
 * apps ship separately, so the schema is duplicated rather than shared. If you
 * change a SLOT id, a cap, or a foot-type key, change it in BOTH files, and in
 * the isAllowedSlot() list in storage.rules.
 *
 * Caps mirror exactly what KinetiQE renders today. They are not arbitrary:
 *   6 molding images  → assets/Molding/image1..6.jpg
 *   5 landing bgs     → landing.tsx bgImages array
 *   5 scan-help imgs  → the [C6,C7,C5,C4,C3] ModalCarousel array
 * Uploading fewer than the cap is fine; every unset slot falls back to the
 * asset bundled in the KinetiQE build.
 */

export const FOOT_TYPE_KEYS = ['overpronation', 'neutral', 'supination'];

export const FOOT_TYPE_LABELS = {
  overpronation: 'Overpronation',
  neutral: 'Neutral',
  supination: 'Supination',
};

export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
export const PDF_MIME = ['application/pdf'];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/**
 * kind:
 *   'imageList'  → ordered array of { path, url, updatedAt }, length <= cap
 *   'image'      → single { path, url, updatedAt } | null
 *   'pdfMap'     → { [footTypeKey]: { path, url, updatedAt } | null }
 *   'videoMap'   → { [footTypeKey]: string (YouTube embed url) | null }
 */
export const SLOTS = [
  {
    id: 'moldingImages',
    kind: 'imageList',
    folder: 'molding',
    cap: 6,
    label: 'Molding slideshow images',
    help: 'Shown full-screen while an insole is molding. Cycles every 3 seconds.',
  },
  {
    id: 'moldingCenterLogo',
    kind: 'image',
    folder: 'logo',
    cap: 1,
    label: 'Molding centre logo',
    help: 'Overlaid in the centre of the molding slideshow. A transparent PNG works best.',
  },
  {
    id: 'landingBackgrounds',
    kind: 'imageList',
    folder: 'landing',
    cap: 5,
    label: 'Landing background images',
    help: 'Cross-fading backgrounds on the KinetiQE home screen.',
  },
  {
    id: 'scanHelpImages',
    kind: 'imageList',
    folder: 'scan-help',
    cap: 5,
    label: 'Scan help images (i button)',
    help: 'The carousel behind the info button on the Arch Selection and Scanning screens.',
  },
  {
    id: 'footTypePdfs',
    kind: 'pdfMap',
    folder: 'foot-type',
    cap: 3,
    label: 'Foot type PDFs (i button)',
    help: 'Opened from the info button on the Foot Type screen — one document per foot type.',
  },
  {
    id: 'footTypeVideos',
    kind: 'videoMap',
    folder: null,
    cap: 3,
    label: 'Foot type videos',
    help: 'Paste a YouTube link. Played from the video button on the Foot Type screen.',
  },
];

export const SLOT_BY_ID = SLOTS.reduce((acc, s) => ({ ...acc, [s.id]: s }), {});

/** An empty branding doc — also the shape KinetiQE assumes when none exists. */
export function emptyBranding() {
  return {
    moldingImages: [],
    moldingCenterLogo: null,
    landingBackgrounds: [],
    scanHelpImages: [],
    footTypePdfs: { overpronation: null, neutral: null, supination: null },
    footTypeVideos: { overpronation: null, neutral: null, supination: null },
    revision: 0,
  };
}

/**
 * Fills in anything missing on a doc read from Firestore, so consumers never
 * have to null-check a slot that was added after the doc was first written.
 */
export function normalizeBranding(raw) {
  const base = emptyBranding();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    moldingImages: Array.isArray(raw.moldingImages) ? raw.moldingImages.slice(0, 6) : [],
    landingBackgrounds: Array.isArray(raw.landingBackgrounds) ? raw.landingBackgrounds.slice(0, 5) : [],
    scanHelpImages: Array.isArray(raw.scanHelpImages) ? raw.scanHelpImages.slice(0, 5) : [],
    footTypePdfs: { ...base.footTypePdfs, ...(raw.footTypePdfs || {}) },
    footTypeVideos: { ...base.footTypeVideos, ...(raw.footTypeVideos || {}) },
    revision: Number(raw.revision) || 0,
  };
}

/**
 * Accepts the forms people actually paste — watch?v=, youtu.be/, /shorts/, or
 * an already-correct /embed/ URL — and returns an embeddable URL.
 * Returns null when it can't find an 11-character video id.
 */
export function toYouTubeEmbedUrl(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const patterns = [
    /(?:youtube\.com|youtube-nocookie\.com)\/embed\/([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com|youtube-nocookie\.com)\/shorts\/([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com|youtube-nocookie\.com)\/live\/([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com|youtube-nocookie\.com)\/.*[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return `https://www.youtube.com/embed/${m[1]}`;
  }
  // A bare video id pasted on its own.
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return `https://www.youtube.com/embed/${raw}`;
  return null;
}
