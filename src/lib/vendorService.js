import {
  collection, query, where, getDocs, updateDoc, doc,
} from 'firebase/firestore';
import {
  EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail,
} from 'firebase/auth';
import { db, auth } from '../config/firebase';
import { deactivateAllStaff } from './staffService';

/** Loads the vendors/{id} record for a signed-in vendor, by email. */
export async function fetchVendorByEmail(email) {
  if (!email) return null;
  const vendorQ = query(collection(db, 'vendors'), where('email', '==', email.trim().toLowerCase()));
  const snap = await getDocs(vendorQ);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function updateVendorAccount(vendorId, fields) {
  await updateDoc(doc(db, 'vendors', vendorId), {
    name: fields.name,
    companyName: fields.companyName,
    phone: fields.phone,
    address: fields.address,
    updatedAt: new Date().toISOString(),
  });
}

export async function sendOwnPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Soft-deletes the vendor's own account.
 *
 * Nothing is destroyed: the vendors doc is flagged, every staff login under it
 * is set inactive so no one can keep scanning, and the scan/user history stays
 * intact for reporting. A super admin does the real purge from the Firebase
 * console. The vendor's Firebase Auth user is deliberately left alone — this
 * project has no Admin SDK, and deleting it here would make the flag
 * unrecoverable by anyone but Google.
 *
 * Requires the current password: reauthenticate first so a walked-away-from
 * session can't be used to park a clinic.
 */
export async function softDeleteVendorAccount({ vendor, password }) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('You are not signed in.');

  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  const staffDeactivated = await deactivateAllStaff(vendor.email);

  await updateDoc(doc(db, 'vendors', vendor.id), {
    status: 'deleted',
    deletedAt: new Date().toISOString(),
    deletedBy: user.email,
  });

  return { staffDeactivated };
}
