// migrate_vendor_to_staff.mjs
// Run with: node migrate_vendor_to_staff.mjs
//
// What this does:
//  1. Reads the vendor doc for edfcvzm@gmail.com
//  2. Reads the vendor doc for ashutosh.apple@gmail.com (the parent vendor)
//  3. Creates a staff document for edfcvzm@gmail.com under ashutosh.apple@gmail.com
//  4. Updates every user with vendorEmail == edfcvzm@gmail.com:
//       - sets staffEmail  = "edfcvzm@gmail.com"
//       - sets vendorEmail = "ashutosh.apple@gmail.com"
//  5. Deletes the old vendor doc for edfcvzm@gmail.com so they log in as staff

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAdJldm2L-HRChGyu6vpF3SYqBm--RQ9sU",
  authDomain: "kinetiq-3ec44.firebaseapp.com",
  projectId: "kinetiq-3ec44",
  storageBucket: "kinetiq-3ec44.firebasestorage.app",
  messagingSenderId: "1043474090428",
  appId: "1:1043474090428:web:19bb670e0e2ab1486b03b9",
};

const STAFF_EMAIL  = 'edfcvzm@gmail.com';
const PARENT_EMAIL = 'ashutosh.apple@gmail.com';

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

async function migrate() {
  console.log('=== Kinetiq Staff Migration ===\n');

  // ── 1. Fetch the vendor-to-become-staff ─────────────────────────────────────
  const staffVendorQ    = query(collection(db, 'vendors'), where('email', '==', STAFF_EMAIL));
  const staffVendorSnap = await getDocs(staffVendorQ);

  if (staffVendorSnap.empty) {
    console.error(`❌  No vendor found with email: ${STAFF_EMAIL}`);
    process.exit(1);
  }
  const staffVendorDoc  = staffVendorSnap.docs[0];
  const staffVendorData = staffVendorDoc.data();
  console.log(`✅  Found vendor to migrate: ${staffVendorData.name || STAFF_EMAIL}`);

  // ── 2. Fetch the parent vendor ───────────────────────────────────────────────
  const parentQ    = query(collection(db, 'vendors'), where('email', '==', PARENT_EMAIL));
  const parentSnap = await getDocs(parentQ);

  if (parentSnap.empty) {
    console.error(`❌  No parent vendor found with email: ${PARENT_EMAIL}`);
    process.exit(1);
  }
  const parentDoc  = parentSnap.docs[0];
  const parentData = parentDoc.data();
  console.log(`✅  Found parent vendor: ${parentData.companyName || parentData.name || PARENT_EMAIL}`);

  // ── 3. Check if staff entry already exists ───────────────────────────────────
  const existingStaffQ    = query(collection(db, 'staff'), where('email', '==', STAFF_EMAIL));
  const existingStaffSnap = await getDocs(existingStaffQ);

  let staffDocId;
  if (!existingStaffSnap.empty) {
    staffDocId = existingStaffSnap.docs[0].id;
    console.log(`ℹ️   Staff entry already exists (id: ${staffDocId}) — skipping creation`);
  } else {
    // ── 3a. Create staff document ────────────────────────────────────────────
    const newStaffRef = await addDoc(collection(db, 'staff'), {
      name:               staffVendorData.name  || '',
      email:              STAFF_EMAIL,
      phone:              staffVendorData.phone || '',
      vendorEmail:        PARENT_EMAIL,
      vendorId:           parentDoc.id,
      vendorCompanyName:  parentData.companyName || parentData.name || '',
      createdAt:          staffVendorData.createdAt || new Date().toISOString(),
      status:             'active',
      isStaff:            true,
      migratedFromVendor: true,
    });
    staffDocId = newStaffRef.id;
    console.log(`✅  Created staff document (id: ${staffDocId})`);
  }

  // ── 4. Reassign all users from old vendor → parent vendor ────────────────────
  const usersQ    = query(collection(db, 'users'), where('vendorEmail', '==', STAFF_EMAIL));
  const usersSnap = await getDocs(usersQ);
  console.log(`\n📦  Found ${usersSnap.size} user(s) under ${STAFF_EMAIL} to migrate…`);

  let migrated = 0;
  for (const userDoc of usersSnap.docs) {
    await updateDoc(doc(db, 'users', userDoc.id), {
      vendorEmail: PARENT_EMAIL,
      staffEmail:  STAFF_EMAIL,
    });
    migrated++;
    process.stdout.write(`\r   Migrated ${migrated}/${usersSnap.size} users…`);
  }
  if (usersSnap.size > 0) console.log('\n');
  console.log(`✅  ${migrated} user(s) updated`);

  // ── 5. Delete old vendor doc ─────────────────────────────────────────────────
  await deleteDoc(doc(db, 'vendors', staffVendorDoc.id));
  console.log(`✅  Deleted old vendor document for ${STAFF_EMAIL}`);

  console.log('\n🎉  Migration complete!');
  console.log(`    ${STAFF_EMAIL} is now a staff member under ${PARENT_EMAIL}`);
  console.log(`    Their ${migrated} user(s) are now attributed to the parent vendor with staffEmail set.`);
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
