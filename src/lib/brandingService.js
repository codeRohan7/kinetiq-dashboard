import {
  doc, getDoc, setDoc, serverTimestamp, increment,
} from 'firebase/firestore';
import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from 'firebase/storage';
import { db, storage } from '../config/firebase';
import {
  normalizeBranding, IMAGE_MIME, PDF_MIME, MAX_IMAGE_BYTES, MAX_PDF_BYTES,
} from './brandingSchema';

/**
 * Reads/writes vendorBranding/{vendorId} and the matching files under
 * vendors/{vendorId}/ in Cloud Storage.
 *
 * Every mutation writes the whole slot value at once (merge:true at the field
 * level) and bumps `revision`.
 *
 * `revision` is a change counter for humans reading the doc — it is recorded in
 * KinetiQE's cache manifest but deliberately not what drives re-downloads.
 * KinetiQE invalidates per asset, on the Cloud Storage path: uploadAsset() below
 * mints a fresh path for every upload and never reuses one, so a changed path is
 * exactly "the vendor replaced this file". That beats a revision check on two
 * counts — a revision bump from an unrelated field costs no downloads, and a
 * file deleted or corrupted on the kiosk's disk still gets repaired.
 */

export const brandingDocRef = (vendorId) => doc(db, 'vendorBranding', vendorId);

export async function fetchBranding(vendorId) {
  if (!vendorId) return normalizeBranding(null);
  const snap = await getDoc(brandingDocRef(vendorId));
  return normalizeBranding(snap.exists() ? snap.data() : null);
}

/**
 * Writes one slot. `value` is already in its final stored shape.
 * setDoc(merge:true) so a brand-new vendor doesn't need the doc pre-created.
 */
export async function writeSlot(vendorId, slotId, value) {
  await setDoc(
    brandingDocRef(vendorId),
    {
      [slotId]: value,
      vendorId,
      revision: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

function extensionFor(file) {
  const fromName = (file.name || '').split('.').pop();
  if (fromName && fromName.length <= 5 && /^[A-Za-z0-9]+$/.test(fromName)) {
    return fromName.toLowerCase();
  }
  if (file.type === 'application/pdf') return 'pdf';
  return (file.type.split('/')[1] || 'bin').toLowerCase();
}

/** Throws a human-readable Error when the file isn't something the rules accept. */
export function assertUploadable(file, accept) {
  const isPdf = accept === 'pdf';
  const allowed = isPdf ? PDF_MIME : IMAGE_MIME;
  const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;

  if (!allowed.includes(file.type)) {
    throw new Error(
      isPdf ? 'That file is not a PDF.' : 'Use a JPG, PNG, WebP, GIF or AVIF image.',
    );
  }
  if (file.size > maxBytes) {
    throw new Error(
      `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${maxBytes / 1024 / 1024} MB.`,
    );
  }
}

/**
 * Uploads one file and returns the { path, url, updatedAt } record stored in
 * Firestore. Filenames are generated, never taken from the user, so a vendor
 * cannot traverse out of their folder or collide with an existing asset.
 */
export async function uploadAsset(vendorId, folder, file, accept = 'image') {
  assertUploadable(file, accept);

  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `vendors/${vendorId}/${folder}/${unique}.${extensionFor(file)}`;
  const objectRef = ref(storage, path);

  await uploadBytes(objectRef, file, {
    contentType: file.type,
    cacheControl: 'public,max-age=31536000,immutable',
  });
  const url = await getDownloadURL(objectRef);

  return { path, url, updatedAt: new Date().toISOString() };
}

/**
 * Best-effort removal of the underlying object. A failure here is logged and
 * swallowed: the Firestore record is the source of truth, and an orphaned
 * object costs pennies, whereas a half-applied delete confuses the vendor.
 */
export async function deleteAsset(assetRecord) {
  if (!assetRecord?.path) return;
  try {
    await deleteObject(ref(storage, assetRecord.path));
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') {
      console.warn('Could not delete storage object', assetRecord.path, err);
    }
  }
}
