import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

/**
 * Resolves the signed-in account to one of: super-admin, vendor, or staff.
 *
 * Dashboard.jsx already works this out as part of its own big fetchData(), but
 * the sidebar and the Vendor Settings page need the same answer without
 * pulling in every vendor/user/scan row. This does the minimum lookup and
 * caches it for the session.
 *
 * `vendor` is the vendor record the account acts on:
 *   - vendor account → their own vendors/{id} doc
 *   - staff account  → their PARENT vendor's doc, because staff inherit their
 *     vendor's branding and must never edit their own
 *   - super admin    → their own doc (they pick a vendor to act on elsewhere)
 */

const RoleContext = createContext({});

export const useRole = () => useContext(RoleContext);

export const RoleProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [role, setRole] = useState(null); // 'superAdmin' | 'vendor' | 'staff' | 'unknown'
  const [vendor, setVendor] = useState(null);
  const [staffDoc, setStaffDoc] = useState(null);
  const [resolving, setResolving] = useState(true);

  const resolve = useCallback(async () => {
    if (!currentUser?.email) {
      setRole(null);
      setVendor(null);
      setStaffDoc(null);
      setResolving(false);
      return;
    }

    setResolving(true);
    const email = currentUser.email.toLowerCase();

    try {
      const vendorSnap = await getDocs(
        query(collection(db, 'vendors'), where('email', '==', email)),
      );

      if (!vendorSnap.empty) {
        const record = { id: vendorSnap.docs[0].id, ...vendorSnap.docs[0].data() };
        setVendor(record);
        setStaffDoc(null);
        setRole(record.isSuperAdmin === true ? 'superAdmin' : 'vendor');
        setResolving(false);
        return;
      }

      const staffSnap = await getDocs(
        query(collection(db, 'staff'), where('email', '==', email)),
      );

      if (!staffSnap.empty) {
        const record = { id: staffSnap.docs[0].id, ...staffSnap.docs[0].data() };
        setStaffDoc(record);
        setRole('staff');

        // Staff see their parent vendor's settings read-only.
        if (record.vendorEmail) {
          const parentSnap = await getDocs(
            query(collection(db, 'vendors'), where('email', '==', record.vendorEmail)),
          );
          setVendor(parentSnap.empty
            ? null
            : { id: parentSnap.docs[0].id, ...parentSnap.docs[0].data() });
        } else {
          setVendor(null);
        }
        setResolving(false);
        return;
      }

      setRole('unknown');
      setVendor(null);
      setStaffDoc(null);
    } catch (err) {
      console.error('Could not resolve role:', err);
      setRole('unknown');
    } finally {
      setResolving(false);
    }
  }, [currentUser]);

  useEffect(() => { resolve(); }, [resolve]);

  const value = {
    role,
    vendor,
    staffDoc,
    resolving,
    isSuperAdmin: role === 'superAdmin',
    isVendor: role === 'vendor',
    isStaff: role === 'staff',
    /** Only a vendor edits their own settings; staff read, super admins manage elsewhere. */
    canEditVendorSettings: role === 'vendor',
    refreshRole: resolve,
    setVendor,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};
