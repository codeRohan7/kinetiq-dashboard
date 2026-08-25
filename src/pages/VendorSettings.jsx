import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, ImageIcon, Save, Loader2, Plus, Edit2, Trash2,
  KeyRound, Eye, EyeOff, AlertTriangle, Lock, Info,
} from 'lucide-react';
import { toast } from 'sonner';

import { auth } from '../config/firebase';
import { useRole } from '../contexts/RoleContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../components/ui/dialog';

import {
  SLOT_BY_ID, FOOT_TYPE_KEYS, FOOT_TYPE_LABELS, emptyBranding,
} from '../lib/brandingSchema';
import { fetchBranding, writeSlot, uploadAsset, deleteAsset } from '../lib/brandingService';
import {
  listStaffForVendor, createStaff, updateStaff, deleteStaff,
  resetStaffPassword, emptyStaffForm,
} from '../lib/staffService';
import { updateVendorAccount, sendOwnPasswordReset, softDeleteVendorAccount } from '../lib/vendorService';
import { ImageListSlot, SingleImageSlot, PdfMapSlot } from '../components/branding/AssetSlot';
import VideoMapSlot from '../components/branding/VideoMapSlot';

/**
 * Vendor Settings — the vendor's own control panel, reached from the sidebar.
 *
 *   Account  — edit the clinic record, send a password reset, soft-delete
 *   Staff    — full CRUD over the staff logins under this vendor
 *   Media    — everything KinetiQE renders dynamically
 *
 * Staff members can open this page but everything is read-only for them: they
 * inherit their vendor's branding and must not be able to rewrite it.
 */
const VendorSettings = () => {
  const navigate = useNavigate();
  const { vendor, role, resolving, isStaff, canEditVendorSettings, setVendor } = useRole();

  const readOnly = !canEditVendorSettings;

  // ── Account ──────────────────────────────────────────────────────────────
  const [accountForm, setAccountForm] = useState({ name: '', companyName: '', phone: '', address: '' });
  const [savingAccount, setSavingAccount] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ── Staff ────────────────────────────────────────────────────────────────
  const [staffList, setStaffList] = useState([]);
  const [staffForm, setStaffForm] = useState(emptyStaffForm());
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [editStaffData, setEditStaffData] = useState(null);

  // ── Media ────────────────────────────────────────────────────────────────
  const [branding, setBranding] = useState(emptyBranding());
  const [loadingBranding, setLoadingBranding] = useState(true);
  const [savingSlot, setSavingSlot] = useState(null);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!vendor) return;
    setAccountForm({
      name: vendor.name || '',
      companyName: vendor.companyName || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
    });
  }, [vendor]);

  const reloadStaff = useCallback(async () => {
    if (!vendor?.email) return;
    setStaffList(await listStaffForVendor(vendor.email));
  }, [vendor]);

  const reloadBranding = useCallback(async () => {
    if (!vendor?.id) return;
    setLoadingBranding(true);
    try {
      setBranding(await fetchBranding(vendor.id));
    } catch (err) {
      console.error('Could not load branding', err);
      toast.error('Could not load media settings');
    } finally {
      setLoadingBranding(false);
    }
  }, [vendor]);

  useEffect(() => { reloadStaff(); }, [reloadStaff]);
  useEffect(() => { reloadBranding(); }, [reloadBranding]);

  // ── Account handlers ─────────────────────────────────────────────────────
  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (!accountForm.companyName.trim()) {
      toast.error('Clinic name is required');
      return;
    }
    setSavingAccount(true);
    try {
      await updateVendorAccount(vendor.id, accountForm);
      setVendor((v) => ({ ...v, ...accountForm }));
      toast.success('Account details saved');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not save account details');
    } finally {
      setSavingAccount(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      await sendOwnPasswordReset(vendor.email);
      toast.success(`Password reset email sent to ${vendor.email}`);
    } catch (err) {
      toast.error(err.message || 'Could not send reset email');
    }
  };

  const expectedConfirm = (vendor?.companyName || vendor?.name || '').trim();

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== expectedConfirm) {
      toast.error('The name you typed does not match.');
      return;
    }
    setDeleting(true);
    try {
      const { staffDeactivated } = await softDeleteVendorAccount({
        vendor,
        password: deletePassword,
      });
      toast.success(
        `Account marked for deletion. ${staffDeactivated} staff login${staffDeactivated === 1 ? '' : 's'} deactivated.`,
      );
      await auth.signOut();
      navigate('/login');
    } catch (err) {
      console.error(err);
      toast.error(
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'That password is not correct.'
          : err.message || 'Could not delete the account',
      );
    } finally {
      setDeleting(false);
    }
  };

  // ── Staff handlers ───────────────────────────────────────────────────────
  const handleAddStaff = async (e) => {
    e.preventDefault();
    setAddingStaff(true);
    try {
      const { authExisted } = await createStaff({ form: staffForm, vendor });
      toast[authExisted ? 'warning' : 'success'](
        authExisted
          ? 'That email already had an account — a password reset email was sent instead.'
          : `Staff member "${staffForm.name}" added`,
      );
      setStaffForm(emptyStaffForm());
      setShowStaffPassword(false);
      setAddStaffOpen(false);
      await reloadStaff();
    } catch (err) {
      toast.error(err.message || 'Could not add staff member');
    } finally {
      setAddingStaff(false);
    }
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    try {
      await updateStaff(editStaffData.id, editStaffData);
      toast.success('Staff member updated');
      setEditStaffData(null);
      await reloadStaff();
    } catch (err) {
      toast.error(err.message || 'Could not update staff member');
    }
  };

  const handleDeleteStaff = async (member) => {
    if (!window.confirm(`Delete staff member "${member.name}"? Their scan history stays on record.`)) return;
    try {
      await deleteStaff(member.id);
      toast.success('Staff member deleted');
      setStaffList((prev) => prev.filter((s) => s.id !== member.id));
    } catch (err) {
      toast.error('Could not delete staff member');
    }
  };

  // ── Media handlers ───────────────────────────────────────────────────────

  /**
   * Persists one slot, then mirrors it into local state.
   *
   * Firestore is written last on purpose: if the write fails, the objects we
   * just uploaded are orphaned in Storage (harmless, invisible) rather than
   * being referenced by a doc that never saved.
   */
  const persistSlot = async (slotId, nextValue, removedAssets = []) => {
    setSavingSlot(slotId);
    try {
      await writeSlot(vendor.id, slotId, nextValue);
      setBranding((b) => ({ ...b, [slotId]: nextValue, revision: (b.revision || 0) + 1 }));
      await Promise.all(removedAssets.map(deleteAsset));
      toast.success('Saved — KinetiQE picks this up at the next login.');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not save');
      await reloadBranding();
    } finally {
      setSavingSlot(null);
    }
  };

  const handleUploadToList = async (slotId, files) => {
    const slot = SLOT_BY_ID[slotId];
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadAsset(vendor.id, slot.folder, file, 'image'));
      }
      const next = [...(branding[slotId] || []), ...uploaded].slice(0, slot.cap);
      await persistSlot(slotId, next);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  };

  const handleChangeList = async (slotId, nextList) => {
    const current = branding[slotId] || [];
    const removed = current.filter((a) => !nextList.some((n) => n.path === a.path));
    await persistSlot(slotId, nextList, removed);
  };

  const handleUploadSingle = async (slotId, files) => {
    const slot = SLOT_BY_ID[slotId];
    try {
      const uploaded = await uploadAsset(vendor.id, slot.folder, files[0], 'image');
      const previous = branding[slotId];
      await persistSlot(slotId, uploaded, previous ? [previous] : []);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  };

  const handleChangeSingle = async (slotId, next) => {
    const previous = branding[slotId];
    await persistSlot(slotId, next, !next && previous ? [previous] : []);
  };

  const handleUploadPdf = async (slotId, key, file) => {
    const slot = SLOT_BY_ID[slotId];
    try {
      const uploaded = await uploadAsset(vendor.id, slot.folder, file, 'pdf');
      const previous = branding[slotId]?.[key];
      await persistSlot(
        slotId,
        { ...(branding[slotId] || {}), [key]: uploaded },
        previous ? [previous] : [],
      );
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  };

  const handleChangePdfMap = async (slotId, nextMap) => {
    const current = branding[slotId] || {};
    const removed = FOOT_TYPE_KEYS
      .filter((k) => current[k] && !nextMap[k])
      .map((k) => current[k]);
    await persistSlot(slotId, nextMap, removed);
  };

  // ── Guards ───────────────────────────────────────────────────────────────
  if (resolving) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading settings...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!vendor) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Card className="bg-white/70 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle size={20} />
              No clinic linked to this account
            </CardTitle>
            <CardDescription>
              {role === 'superAdmin'
                ? 'Super admin accounts manage branding per vendor from the Vendors tab on the dashboard.'
                : 'This login is not attached to a vendor record. Ask a KinetiQ administrator to link it.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const busy = savingSlot !== null;

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold text-gray-800"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          data-testid="vendor-settings-title"
        >
          Vendor Settings
        </h1>
        <p className="text-gray-500 mt-1">
          {vendor.companyName || vendor.name} — account, staff and everything the scanner app shows.
        </p>
      </div>

      {readOnly && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3">
          <Lock size={18} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800">
            {isStaff
              ? 'You are signed in as staff, so these settings are read-only. Your clinic’s vendor account can change them.'
              : 'These settings are read-only for this account.'}
          </p>
        </div>
      )}

      <Tabs defaultValue="account">
        <TabsList className="mb-6 bg-white/70 border border-purple-100">
          <TabsTrigger value="account" className="gap-2"><Building2 size={16} />Account</TabsTrigger>
          <TabsTrigger value="staff" className="gap-2"><Users size={16} />Staff</TabsTrigger>
          <TabsTrigger value="media" className="gap-2"><ImageIcon size={16} />Media</TabsTrigger>
        </TabsList>

        {/* ══ Account ══════════════════════════════════════════════════════ */}
        <TabsContent value="account">
          <Card className="bg-white/70 border-purple-100 mb-6">
            <CardHeader>
              <CardTitle>Clinic details</CardTitle>
              <CardDescription>
                These appear on generated reports and invoices in KinetiQE.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveAccount} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label htmlFor="vs-company">Clinic / company name</Label>
                  <Input
                    id="vs-company"
                    value={accountForm.companyName}
                    disabled={readOnly || savingAccount}
                    onChange={(e) => setAccountForm((f) => ({ ...f, companyName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="vs-name">Contact name</Label>
                  <Input
                    id="vs-name"
                    value={accountForm.name}
                    disabled={readOnly || savingAccount}
                    onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="vs-phone">Phone</Label>
                  <Input
                    id="vs-phone"
                    value={accountForm.phone}
                    disabled={readOnly || savingAccount}
                    onChange={(e) => setAccountForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="vs-email">Email</Label>
                  <Input id="vs-email" value={vendor.email} disabled />
                  <p className="text-xs text-gray-400 mt-1">
                    The sign-in email cannot be changed here.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="vs-address">Address</Label>
                  <Input
                    id="vs-address"
                    value={accountForm.address}
                    disabled={readOnly || savingAccount}
                    onChange={(e) => setAccountForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>

                {!readOnly && (
                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    <Button
                      type="submit"
                      disabled={savingAccount}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 text-white gap-2"
                      data-testid="save-account-button"
                    >
                      {savingAccount ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Save changes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePasswordReset}
                      className="gap-2 border-purple-200 hover:bg-purple-50"
                    >
                      <KeyRound size={16} />
                      Email me a password reset
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {!readOnly && (
            <Card className="bg-white/70 border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Delete this account
                </CardTitle>
                <CardDescription>
                  Marks the clinic as deleted and deactivates every staff login under it, so no
                  one can keep scanning. Your scan and patient history is kept on record, and a
                  KinetiQ administrator can reverse this. It is not an instant permanent erase.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setDeleteConfirmText(''); setDeletePassword(''); setDeleteDialogOpen(true); }}
                  className="gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                  data-testid="delete-account-button"
                >
                  <Trash2 size={16} />
                  Delete account
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ Staff ════════════════════════════════════════════════════════ */}
        <TabsContent value="staff">
          <Card className="bg-white/70 border-purple-100">
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle>Staff</CardTitle>
                  <CardDescription>
                    Staff sign into KinetiQE with their own login and see only the patients they scanned.
                  </CardDescription>
                </div>
                {!readOnly && (
                  <Button
                    onClick={() => { setStaffForm(emptyStaffForm()); setAddStaffOpen(true); }}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white gap-2"
                    data-testid="add-staff-button"
                  >
                    <Plus size={16} />
                    Add staff
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {staffList.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">
                  No staff members yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        {!readOnly && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffList.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell className="text-gray-600">{member.email}</TableCell>
                          <TableCell className="text-gray-600">{member.phone || '—'}</TableCell>
                          <TableCell>
                            <Badge variant={member.status === 'inactive' ? 'secondary' : 'default'}>
                              {member.status || 'active'}
                            </Badge>
                          </TableCell>
                          {!readOnly && (
                            <TableCell className="text-right whitespace-nowrap">
                              <Button size="sm" variant="ghost" onClick={() => setEditStaffData({ ...member })} aria-label="Edit">
                                <Edit2 size={15} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  try {
                                    await resetStaffPassword(member.email);
                                    toast.success(`Password reset email sent to ${member.email}`);
                                  } catch (err) {
                                    toast.error('Could not send reset email');
                                  }
                                }}
                                aria-label="Send password reset"
                              >
                                <KeyRound size={15} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => handleDeleteStaff(member)}
                                aria-label="Delete"
                              >
                                <Trash2 size={15} />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ Media ════════════════════════════════════════════════════════ */}
        <TabsContent value="media">
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-3">
            <Info size={18} className="text-purple-500 mt-0.5 shrink-0" />
            <p className="text-sm text-purple-900">
              Changes save immediately. Each KinetiQE machine downloads them at the next sign-in
              and keeps a local copy, so a clinic that loses internet mid-scan still shows the
              right images. Empty slots fall back to the images built into the app.
            </p>
          </div>

          {loadingBranding ? (
            <div className="py-16 text-center">
              <Loader2 size={28} className="animate-spin mx-auto text-purple-500 mb-3" />
              <p className="text-gray-500 text-sm">Loading media…</p>
            </div>
          ) : (
            <div className="space-y-5">
              <ImageListSlot
                slot={SLOT_BY_ID.moldingImages}
                value={branding.moldingImages}
                disabled={readOnly || busy}
                onUpload={(files) => handleUploadToList('moldingImages', files)}
                onChange={(next) => handleChangeList('moldingImages', next)}
              />

              <SingleImageSlot
                slot={SLOT_BY_ID.moldingCenterLogo}
                value={branding.moldingCenterLogo}
                disabled={readOnly || busy}
                onUpload={(files) => handleUploadSingle('moldingCenterLogo', files)}
                onChange={(next) => handleChangeSingle('moldingCenterLogo', next)}
              />

              <ImageListSlot
                slot={SLOT_BY_ID.landingBackgrounds}
                value={branding.landingBackgrounds}
                disabled={readOnly || busy}
                onUpload={(files) => handleUploadToList('landingBackgrounds', files)}
                onChange={(next) => handleChangeList('landingBackgrounds', next)}
              />

              <ImageListSlot
                slot={SLOT_BY_ID.scanHelpImages}
                value={branding.scanHelpImages}
                disabled={readOnly || busy}
                onUpload={(files) => handleUploadToList('scanHelpImages', files)}
                onChange={(next) => handleChangeList('scanHelpImages', next)}
              />

              <PdfMapSlot
                slot={SLOT_BY_ID.footTypePdfs}
                value={branding.footTypePdfs}
                keys={FOOT_TYPE_KEYS}
                labels={FOOT_TYPE_LABELS}
                disabled={readOnly || busy}
                onUpload={(key, file) => handleUploadPdf('footTypePdfs', key, file)}
                onChange={(next) => handleChangePdfMap('footTypePdfs', next)}
              />

              <VideoMapSlot
                slot={SLOT_BY_ID.footTypeVideos}
                value={branding.footTypeVideos}
                keys={FOOT_TYPE_KEYS}
                labels={FOOT_TYPE_LABELS}
                disabled={readOnly || busy}
                onChange={(next) => persistSlot('footTypeVideos', next)}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ══ Add staff dialog ═══════════════════════════════════════════════ */}
      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
            <DialogDescription>
              Creates a KinetiQE login for {vendor.companyName || vendor.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div>
              <Label htmlFor="st-name">Name</Label>
              <Input id="st-name" required value={staffForm.name}
                onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="st-email">Email</Label>
              <Input id="st-email" type="email" required value={staffForm.email}
                onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="st-phone">Phone</Label>
              <Input id="st-phone" value={staffForm.phone}
                onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="st-pass">Temporary password</Label>
              <div className="relative">
                <Input
                  id="st-pass"
                  type={showStaffPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={staffForm.password}
                  onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowStaffPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  aria-label={showStaffPassword ? 'Hide password' : 'Show password'}
                >
                  {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">At least 6 characters. They can change it later.</p>
            </div>
            <Button
              type="submit"
              disabled={addingStaff}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white gap-2"
            >
              {addingStaff ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Add staff member
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══ Edit staff dialog ══════════════════════════════════════════════ */}
      <Dialog open={!!editStaffData} onOpenChange={(open) => !open && setEditStaffData(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit staff member</DialogTitle>
            <DialogDescription>{editStaffData?.email}</DialogDescription>
          </DialogHeader>
          {editStaffData && (
            <form onSubmit={handleUpdateStaff} className="space-y-4">
              <div>
                <Label htmlFor="est-name">Name</Label>
                <Input id="est-name" required value={editStaffData.name || ''}
                  onChange={(e) => setEditStaffData((d) => ({ ...d, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="est-phone">Phone</Label>
                <Input id="est-phone" value={editStaffData.phone || ''}
                  onChange={(e) => setEditStaffData((d) => ({ ...d, phone: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="est-address">Address</Label>
                <Input id="est-address" value={editStaffData.address || ''}
                  onChange={(e) => setEditStaffData((d) => ({ ...d, address: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="est-status">Status</Label>
                <select
                  id="est-status"
                  value={editStaffData.status || 'active'}
                  onChange={(e) => setEditStaffData((d) => ({ ...d, status: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive — cannot sign in</option>
                </select>
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white gap-2">
                <Save size={16} />
                Save changes
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ Delete account dialog ══════════════════════════════════════════ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle size={18} />
              Delete {expectedConfirm}?
            </DialogTitle>
            <DialogDescription>
              Every staff login under this clinic will be deactivated immediately and no one will
              be able to run a scan. Patient and scan records are kept.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="del-confirm">
                Type <span className="font-semibold text-gray-800">{expectedConfirm}</span> to confirm
              </Label>
              <Input
                id="del-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="del-pass">Your password</Label>
              <Input
                id="del-pass"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
                disabled={deleting || deleteConfirmText.trim() !== expectedConfirm || !deletePassword}
                onClick={handleDeleteAccount}
                data-testid="confirm-delete-account"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default VendorSettings;
