import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword, sendPasswordResetEmail,
  setPersistence, inMemoryPersistence,
} from 'firebase/auth';
import { db, auth } from '../config/firebase';
import { secondaryAuth } from './secondaryAuth';

/**
 * Staff CRUD, shared by the super-admin "Manage Staff" dialog on the main
 * dashboard and the vendor's own Staff tab in Vendor Settings. Both surfaces
 * do exactly the same thing to the same `staff` collection; only the vendor
 * they act on differs.
 */

export async function listStaffForVendor(vendorEmail) {
  if (!vendorEmail) return [];
  const staffQ = query(collection(db, 'staff'), where('vendorEmail', '==', vendorEmail));
  const snap = await getDocs(staffQ);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Creates the login and the staff record.
 *
 * Returns { authExisted } — true when the email already had a Firebase Auth
 * account. In that case we do NOT know their password, so a reset email is
 * sent instead and the caller should say so.
 */
export async function createStaff({ form, vendor }) {
  const normalizedEmail = form.email.trim().toLowerCase();

  if (!form.name?.trim()) throw new Error('Name is required');
  if (!normalizedEmail) throw new Error('Email is required');
  if (!form.password || form.password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const existingStaffQ = query(collection(db, 'staff'), where('email', '==', normalizedEmail));
  if (!(await getDocs(existingStaffQ)).empty) {
    throw new Error('A staff member with this email already exists.');
  }

  await setPersistence(secondaryAuth, inMemoryPersistence);

  let authExisted = false;
  try {
    await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, form.password);
    await secondaryAuth.signOut();
  } catch (authError) {
    if (authError.code === 'auth/email-already-in-use') {
      authExisted = true;
      await sendPasswordResetEmail(auth, normalizedEmail);
    } else {
      throw authError;
    }
  }

  await addDoc(collection(db, 'staff'), {
    name: form.name,
    email: normalizedEmail,
    phone: form.phone || '',
    companyName: form.companyName || vendor.companyName || vendor.name || '',
    address: form.address || vendor.address || '',
    vendorEmail: vendor.email,
    vendorId: vendor.id,
    vendorCompanyName: vendor.companyName || vendor.name || '',
    createdAt: new Date().toISOString(),
    status: 'active',
    isStaff: true,
  });

  return { authExisted };
}

export async function updateStaff(staffId, fields) {
  await updateDoc(doc(db, 'staff', staffId), {
    name: fields.name,
    phone: fields.phone,
    companyName: fields.companyName,
    address: fields.address,
    status: fields.status,
  });
}

export async function deleteStaff(staffId) {
  await deleteDoc(doc(db, 'staff', staffId));
}

export async function resetStaffPassword(staffEmail) {
  await sendPasswordResetEmail(auth, staffEmail);
}

/** Used by the vendor soft-delete: parks every staff login without removing history. */
export async function deactivateAllStaff(vendorEmail) {
  const staff = await listStaffForVendor(vendorEmail);
  await Promise.all(
    staff.map((s) => updateDoc(doc(db, 'staff', s.id), { status: 'inactive' })),
  );
  return staff.length;
}

export const emptyStaffForm = () => ({
  name: '', email: '', phone: '', companyName: '', address: '', password: '',
});
