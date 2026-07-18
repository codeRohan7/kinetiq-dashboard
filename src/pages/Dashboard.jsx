import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, setPersistence, inMemoryPersistence, sendPasswordResetEmail } from 'firebase/auth';
import { collection, getDocs, addDoc, query, where, doc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import {
  Users, Building2, Activity, TrendingUp, LogOut, Plus, Search,
  Edit2, Trash2, Eye, EyeOff, KeyRound, Filter, Download, UserCog,
  UserCheck, Shield, ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

// Secondary Firebase app — uses inMemoryPersistence so it never
// touches localStorage and never displaces the admin session.
const secondaryApp = getApps().find(a => a.name === 'vendorHelper') ||
  initializeApp({
    apiKey: "AIzaSyAdJldm2L-HRChGyu6vpF3SYqBm--RQ9sU",
    authDomain: "kinetiq-3ec44.firebaseapp.com",
    projectId: "kinetiq-3ec44",
    storageBucket: "kinetiq-3ec44.firebasestorage.app",
    messagingSenderId: "1043474090428",
    appId: "1:1043474090428:web:19bb670e0e2ab1486b03b9",
  }, 'vendorHelper');
const secondaryAuth = getAuth(secondaryApp);
setPersistence(secondaryAuth, inMemoryPersistence).catch(console.error);

const ARCH_TYPES = [
  { id: 'All', label: 'All Arch Types' },
  { id: 'collapsed', label: 'Collapsed - (Flat)' },
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
];

const FOOT_TYPES = [
  { id: 'All', label: 'All Foot Types' },
  { id: 'severe-overpronation', label: 'Severe Overpronation' },
  { id: 'overpronation', label: 'Overpronation' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'underpronation', label: 'Underpronation (Supination)' },
];

// CSV export helper
const exportToCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showNewVendorPassword, setShowNewVendorPassword] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [currentVendorEmail, setCurrentVendorEmail] = useState(null);
  const [currentStaffData, setCurrentStaffData] = useState(null);
  // Chart & table filters
  const [archFilter, setArchFilter] = useState('All');
  const [footFilter, setFootFilter] = useState('All');

  // Staff management dialog state
  const [manageStaffDialogOpen, setManageStaffDialogOpen] = useState(false);
  const [selectedVendorForStaff, setSelectedVendorForStaff] = useState(null);
  const [vendorStaffList, setVendorStaffList] = useState([]);
  const [addStaffForm, setAddStaffForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  // Edit staff state
  const [editStaffDialogOpen, setEditStaffDialogOpen] = useState(false);
  const [editStaffData, setEditStaffData] = useState(null);

  const [newVendor, setNewVendor] = useState({
    name: '',
    email: '',
    companyName: '',
    phone: '',
    address: '',
    password: ''
  });

  // Apply arch + foot-type filters
  const filteredByType = users.filter(u => {
    const archOk = archFilter === 'All' || (u.medialArchType || '').toLowerCase() === archFilter.toLowerCase();
    const footOk = footFilter === 'All' || (u.footType || '').toLowerCase() === footFilter.toLowerCase();
    return archOk && footOk;
  });

  // Group by month (last 6 months)
  const scanData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return {
      month: d.toLocaleString('default', { month: 'short' }),
      year: d.getFullYear(),
      scans: 0,
      users: 0
    };
  });

  filteredByType.forEach(u => {
    const dateStr = u.createdAt || u.lastScanAt;
    if (dateStr) {
      const d = new Date(dateStr);
      const mName = d.toLocaleString('default', { month: 'short' });
      const mYear = d.getFullYear();
      const monthObj = scanData.find(m => m.month === mName && m.year === mYear);
      if (monthObj) {
        monthObj.users += 1;
        monthObj.scans += (u.totalScans || 1);
      }
    } else {
      scanData[5].users += 1;
      scanData[5].scans += (u.totalScans || 1);
    }
  });

  const totalScans = users.reduce((sum, user) => sum + (user.totalScans || 0), 0);
  const [editVendorDialogOpen, setEditVendorDialogOpen] = useState(false);
  const [editVendor, setEditVendor] = useState(null);
  const [newVendorPassword, setNewVendorPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const handleUpdateVendor = async (e) => {
    e.preventDefault();
    try {
      const vendorRef = doc(db, "vendors", editVendor.id);
      await updateDoc(vendorRef, {
        name: editVendor.name,
        companyName: editVendor.companyName,
        phone: editVendor.phone,
        address: editVendor.address
      });

      if (newVendorPassword.trim().length > 0) {
        setChangingPassword(true);
        try {
          await sendPasswordResetEmail(auth, editVendor.email.trim().toLowerCase());
          toast.success('Password reset email sent to vendor!');
        } catch (pwErr) {
          console.error('Password reset error:', pwErr);
          toast.error('Could not send password reset: ' + pwErr.message);
        } finally {
          setChangingPassword(false);
        }
      }

      toast.success("Vendor updated successfully!");
      setEditVendorDialogOpen(false);
      setNewVendorPassword('');
      fetchData();
    } catch (error) {
      console.error("Error updating vendor:", error);
      toast.error("Failed to update vendor");
    }
  };

  const handleEditVendor = (vendor) => {
    setEditVendor(vendor);
    setNewVendorPassword('');
    setShowEditPassword(false);
    setEditVendorDialogOpen(true);
  };

  const vendorPerformance = vendors
    .filter(v => !v.isSuperAdmin)
    .map(vendor => {
      const vendorUsers = users.filter(user => user.vendorEmail === vendor.email);
      const totalScans = vendorUsers.reduce((sum, u) => sum + (u.totalScans || 0), 0);
      return {
        name: vendor.companyName || vendor.name,
        scans: totalScans,
        users: vendorUsers.length
      };
    });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) { navigate('/login'); return; }

      const normalizedEmail = currentUser.email.toLowerCase();

      // 1. Check vendors collection
      const vendorQ = query(collection(db, 'vendors'), where('email', '==', normalizedEmail));
      const vendorSnap = await getDocs(vendorQ);
      const myVendorDoc = vendorSnap.empty ? null : vendorSnap.docs[0].data();
      const superAdmin = myVendorDoc?.isSuperAdmin === true;
      setIsSuperAdmin(superAdmin);
      setCurrentVendorEmail(normalizedEmail);

      if (superAdmin) {
        // Super admin: load everything
        const vendorsSnapshot = await getDocs(collection(db, 'vendors'));
        setVendors(vendorsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        const usersSnapshot = await getDocs(collection(db, 'users'));
        setUsers(usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        const staffSnapshot = await getDocs(collection(db, 'staff'));
        setStaffMembers(staffSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setIsStaff(false);
        setCurrentStaffData(null);
      } else if (!vendorSnap.empty) {
        // Regular vendor: load their users and staff
        setVendors([]);
        const usersQ = query(collection(db, 'users'), where('vendorEmail', '==', normalizedEmail));
        const usersSnap = await getDocs(usersQ);
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        const staffQ = query(collection(db, 'staff'), where('vendorEmail', '==', normalizedEmail));
        const staffSnap = await getDocs(staffQ);
        setStaffMembers(staffSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setIsStaff(false);
        setCurrentStaffData(null);
      } else {
        // Check if staff
        const staffQ = query(collection(db, 'staff'), where('email', '==', normalizedEmail));
        const staffSnap = await getDocs(staffQ);
        if (!staffSnap.empty) {
          const staffDoc = { id: staffSnap.docs[0].id, ...staffSnap.docs[0].data() };
          setIsStaff(true);
          setCurrentStaffData(staffDoc);
          setVendors([]);
          setStaffMembers([]);
          // Staff only sees users they scanned (staffEmail == their email)
          const usersQ = query(collection(db, 'users'), where('staffEmail', '==', normalizedEmail));
          const usersSnap = await getDocs(usersQ);
          setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          // Unknown role
          toast.error('Access denied.');
          await auth.signOut();
          navigate('/login');
          return;
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
      setLoading(false);
    }
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();
    if (!newVendor.password || newVendor.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    const normalizedEmail = newVendor.email.trim().toLowerCase();

    const existingQ = query(collection(db, 'vendors'), where('email', '==', normalizedEmail));
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      toast.error('A vendor with this email already exists in the system.');
      return;
    }

    try {
      await setPersistence(secondaryAuth, inMemoryPersistence);

      let authExisted = false;
      try {
        await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, newVendor.password);
        await secondaryAuth.signOut();
      } catch (authError) {
        if (authError.code === 'auth/email-already-in-use') {
          authExisted = true;
          await sendPasswordResetEmail(auth, normalizedEmail);
          toast.warning(
            'This email already had a Firebase account. A password reset email has been sent to the vendor.'
          );
        } else {
          throw authError;
        }
      }

      await addDoc(collection(db, 'vendors'), {
        name: newVendor.name,
        email: normalizedEmail,
        companyName: newVendor.companyName,
        phone: newVendor.phone,
        address: newVendor.address,
        totalScans: 0,
        createdAt: new Date().toISOString(),
        status: 'active'
      });

      if (!authExisted) {
        toast.success('Vendor registered successfully!');
      } else {
        toast.success('Vendor profile created. They must use the password reset email to set their password.');
      }

      setDialogOpen(false);
      setNewVendor({ name: '', email: '', companyName: '', phone: '', address: '', password: '' });
      setShowNewVendorPassword(false);
      fetchData();
    } catch (error) {
      console.error('Error adding vendor:', error);
      toast.error(error.message || 'Failed to register vendor');
    }
  };

  const handleDeleteVendor = async (vendorId) => {
    if (window.confirm('Are you sure you want to delete this vendor?')) {
      try {
        await deleteDoc(doc(db, 'vendors', vendorId));
        toast.success('Vendor deleted successfully');
        fetchData();
      } catch (error) {
        console.error('Error deleting vendor:', error);
        toast.error('Failed to delete vendor');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // ─── Staff Management ───────────────────────────────────────────────────────

  const handleOpenManageStaff = async (vendor) => {
    setSelectedVendorForStaff(vendor);
    setAddStaffForm({ name: '', email: '', phone: '', password: '' });
    setShowStaffPassword(false);
    // Load staff for this vendor
    const staffQ = query(collection(db, 'staff'), where('vendorEmail', '==', vendor.email));
    const staffSnap = await getDocs(staffQ);
    setVendorStaffList(staffSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setManageStaffDialogOpen(true);
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!addStaffForm.password || addStaffForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    const normalizedEmail = addStaffForm.email.trim().toLowerCase();

    // Check if already in staff
    const existingStaffQ = query(collection(db, 'staff'), where('email', '==', normalizedEmail));
    const existingStaffSnap = await getDocs(existingStaffQ);
    if (!existingStaffSnap.empty) {
      toast.error('A staff member with this email already exists.');
      return;
    }

    setAddingStaff(true);
    try {
      await setPersistence(secondaryAuth, inMemoryPersistence);
      let authExisted = false;
      try {
        await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, addStaffForm.password);
        await secondaryAuth.signOut();
      } catch (authError) {
        if (authError.code === 'auth/email-already-in-use') {
          authExisted = true;
          await sendPasswordResetEmail(auth, normalizedEmail);
          toast.warning('Email already had an account. A password reset email was sent.');
        } else {
          throw authError;
        }
      }

      await addDoc(collection(db, 'staff'), {
        name: addStaffForm.name,
        email: normalizedEmail,
        phone: addStaffForm.phone,
        vendorEmail: selectedVendorForStaff.email,
        vendorId: selectedVendorForStaff.id,
        vendorCompanyName: selectedVendorForStaff.companyName || selectedVendorForStaff.name,
        createdAt: new Date().toISOString(),
        status: 'active',
        isStaff: true
      });

      toast.success(`Staff member "${addStaffForm.name}" added successfully!`);
      setAddStaffForm({ name: '', email: '', phone: '', password: '' });
      setShowStaffPassword(false);

      // Refresh staff list in dialog
      const staffQ = query(collection(db, 'staff'), where('vendorEmail', '==', selectedVendorForStaff.email));
      const staffSnap = await getDocs(staffQ);
      setVendorStaffList(staffSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Refresh main data
      fetchData();
    } catch (error) {
      console.error('Error adding staff:', error);
      toast.error(error.message || 'Failed to add staff member');
    } finally {
      setAddingStaff(false);
    }
  };

  const handleDeleteStaff = async (staffId, staffName) => {
    if (window.confirm(`Are you sure you want to delete staff member "${staffName}"?`)) {
      try {
        await deleteDoc(doc(db, 'staff', staffId));
        toast.success('Staff member deleted successfully');
        setVendorStaffList(prev => prev.filter(s => s.id !== staffId));
        fetchData();
      } catch (error) {
        console.error('Error deleting staff:', error);
        toast.error('Failed to delete staff member');
      }
    }
  };

  const handleEditStaff = (staff) => {
    setEditStaffData({ ...staff });
    setEditStaffDialogOpen(true);
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    try {
      const staffRef = doc(db, 'staff', editStaffData.id);
      await updateDoc(staffRef, {
        name: editStaffData.name,
        phone: editStaffData.phone,
        status: editStaffData.status,
      });
      toast.success('Staff member updated successfully!');
      setEditStaffDialogOpen(false);
      // Refresh vendor staff list if dialog is open
      if (manageStaffDialogOpen && selectedVendorForStaff) {
        const staffQ = query(collection(db, 'staff'), where('vendorEmail', '==', selectedVendorForStaff.email));
        const staffSnap = await getDocs(staffQ);
        setVendorStaffList(staffSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      fetchData();
    } catch (error) {
      console.error('Error updating staff:', error);
      toast.error('Failed to update staff member');
    }
  };

  const handleResetStaffPassword = async (staffEmail) => {
    try {
      await sendPasswordResetEmail(auth, staffEmail);
      toast.success(`Password reset email sent to ${staffEmail}`);
    } catch (err) {
      toast.error('Failed to send reset email: ' + err.message);
    }
  };

  // ─── Filters & Search ───────────────────────────────────────────────────────

  const filteredVendors = vendors
    .filter(v => !v.isSuperAdmin)
    .filter(vendor =>
      vendor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const filteredUsers = filteredByType.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStaff = staffMembers.filter(s =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ─── Users pagination ────────────────────────────────────────────────────────
  const USERS_PAGE_SIZE = 10;
  const [usersPage, setUsersPage] = useState(1);

  // Reset to page 1 whenever filters or search change
  useEffect(() => { setUsersPage(1); }, [searchTerm, archFilter, footFilter]);

  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const pagedUsers = filteredUsers.slice(
    (usersPage - 1) * USERS_PAGE_SIZE,
    usersPage * USERS_PAGE_SIZE
  );

  const handleExport = () => {
    const rows = filteredUsers.map(u => ({
      Name: u.name || '',
      Email: u.email || '',
      Phone: u.phone || '',
      VendorEmail: u.vendorEmail || '',
      StaffEmail: u.staffEmail || '',
      'Medial Arch Type': u.medialArchType || '',
      'Foot Type': u.footType || '',
      'Total Scans': u.totalScans || 0,
    }));
    exportToCSV(rows, `kinetiq_users_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const getUsersByVendor = (vendorEmail) => {
    return users.filter(user => user.vendorEmail === vendorEmail);
  };

  const getStaffByVendor = (vendorEmail) => {
    return staffMembers.filter(s => s.vendorEmail === vendorEmail);
  };

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ─── Edit User handlers ───────────────────────────────────────────────────────

  const handleDeleteUser = async (userId) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await deleteDoc(doc(db, "users", userId));
        toast.success("User deleted successfully!");
        fetchData();
      } catch (error) {
        console.error("Error deleting user:", error);
        toast.error("Failed to delete user");
      }
    }
  };

  const handleEditUser = (user) => {
    setEditUser(user);
    setEditUserDialogOpen(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const userRef = doc(db, "users", editUser.id);
      await updateDoc(userRef, {
        name: editUser.name,
        email: editUser.email,
        phone: editUser.phone,
      });
      toast.success("User updated successfully!");
      setEditUserDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    }
  };

  // ─── Role label ──────────────────────────────────────────────────────────────
  const portalLabel = isSuperAdmin
    ? 'Super Admin Portal'
    : isStaff
      ? `Staff Portal${currentStaffData?.vendorCompanyName ? ` — ${currentStaffData.vendorCompanyName}` : ''}`
      : 'Vendor Portal';

  // ─── Tabs config ─────────────────────────────────────────────────────────────
  // Super Admin: vendors | all-users | users-by-vendor | all-staff
  // Vendor: users | my-staff
  // Staff: users (own only)
  const defaultTab = isSuperAdmin ? 'vendors' : 'users';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-purple-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Activity className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent" style={{ fontFamily: 'Space Grotesk, sans-serif' }} data-testid="dashboard-title">
                KINETIQ Dashboard
              </h1>
              <div className="flex items-center gap-1.5">
                {isStaff
                  ? <UserCheck size={12} className="text-blue-500" />
                  : isSuperAdmin
                    ? <Shield size={12} className="text-purple-500" />
                    : <Building2 size={12} className="text-pink-500" />
                }
                <p className="text-xs text-gray-500">{portalLabel}</p>
              </div>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="gap-2 border-purple-200 hover:bg-purple-50 hover:text-purple-700"
            data-testid="logout-button"
          >
            <LogOut size={18} />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {isSuperAdmin && (
            <Card className="bg-white/60 backdrop-blur-sm border-purple-100 hover:shadow-lg transition" data-testid="total-vendors-card">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-600">Total Vendors</CardDescription>
                <CardTitle className="text-3xl font-bold text-purple-600">
                  {vendors.filter(v => !v.isSuperAdmin).length}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <TrendingUp size={16} />
                </div>
              </CardContent>
            </Card>
          )}

          {isSuperAdmin && (
            <Card className="bg-white/60 backdrop-blur-sm border-indigo-100 hover:shadow-lg transition" data-testid="total-staff-card">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-600">Total Staff</CardDescription>
                <CardTitle className="text-3xl font-bold text-indigo-600">{staffMembers.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <TrendingUp size={16} />
                </div>
              </CardContent>
            </Card>
          )}

          {!isSuperAdmin && !isStaff && (
            <Card className="bg-white/60 backdrop-blur-sm border-indigo-100 hover:shadow-lg transition">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-600">My Staff</CardDescription>
                <CardTitle className="text-3xl font-bold text-indigo-600">{staffMembers.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <UserCheck size={16} />
                  <span>Active members</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white/60 backdrop-blur-sm border-pink-100 hover:shadow-lg transition" data-testid="total-users-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-600">
                {isStaff ? 'My Scanned Users' : 'Total Users'}
              </CardDescription>
              <CardTitle className="text-3xl font-bold text-pink-600">{users.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <TrendingUp size={16} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/60 backdrop-blur-sm border-blue-100 hover:shadow-lg transition" data-testid="total-scans-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-600">Total Scans</CardDescription>
              <CardTitle className="text-3xl font-bold text-blue-600">{totalScans}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <TrendingUp size={16} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white/60 backdrop-blur-sm border-purple-100" data-testid="scan-trends-chart">
            <CardHeader>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-800">Scan Trends</CardTitle>
                  <CardDescription>Filtered by arch &amp; foot type</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter size={15} className="text-purple-400" />
                  <select
                    value={archFilter}
                    onChange={e => setArchFilter(e.target.value)}
                    className="text-xs border border-purple-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
                    data-testid="arch-filter"
                  >
                    {ARCH_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <select
                    value={footFilter}
                    onChange={e => setFootFilter(e.target.value)}
                    className="text-xs border border-pink-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-300"
                    data-testid="foot-filter"
                  >
                    {FOOT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={scanData}>
                  <defs>
                    <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9333ea" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Area type="monotone" dataKey="scans" stroke="#9333ea" fillOpacity={1} fill="url(#colorScans)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {isSuperAdmin && (
            <Card className="bg-white/60 backdrop-blur-sm border-pink-100" data-testid="vendor-performance-chart">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-800">Vendor Performance</CardTitle>
                <CardDescription>Top performing vendors</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={vendorPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="scans" fill="#ec4899" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="users" fill="#9333ea" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Management Portal Card ── */}
        <Card className="bg-white/60 backdrop-blur-sm border-purple-100" data-testid="main-content-tabs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-800">Management Portal</CardTitle>
                <CardDescription>
                  {isSuperAdmin
                    ? 'Manage vendors, staff and users'
                    : isStaff
                      ? 'Your scanned users'
                      : 'Manage your staff and scanned users'}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-2 border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                  onClick={handleExport}
                  data-testid="export-csv-button"
                >
                  <Download size={16} />
                  Export CSV
                </Button>
                {isSuperAdmin && (
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" data-testid="add-vendor-button">
                        <Plus size={18} />
                        Add Vendor
                      </Button>
                    </DialogTrigger>
                    <DialogContent data-testid="add-vendor-dialog">
                      <DialogHeader>
                        <DialogTitle>Register New Vendor</DialogTitle>
                        <DialogDescription>Add a new vendor/admin to the system</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddVendor} className="space-y-4">
                        <div>
                          <Label htmlFor="vendor-name">Full Name</Label>
                          <Input
                            id="vendor-name"
                            value={newVendor.name}
                            onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                            placeholder="John Doe"
                            required
                            data-testid="vendor-name-input"
                          />
                        </div>
                        <div>
                          <Label htmlFor="vendor-email">Email</Label>
                          <Input
                            id="vendor-email"
                            type="email"
                            value={newVendor.email}
                            onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                            placeholder="john@example.com"
                            required
                            data-testid="vendor-email-input"
                          />
                        </div>
                        <div>
                          <Label htmlFor="vendor-company">Company Name</Label>
                          <Input
                            id="vendor-company"
                            value={newVendor.companyName}
                            onChange={(e) => setNewVendor({ ...newVendor, companyName: e.target.value })}
                            placeholder="Acme Corp"
                            required
                            data-testid="vendor-company-input"
                          />
                        </div>
                        <div>
                          <Label htmlFor="vendor-phone">Phone</Label>
                          <Input
                            id="vendor-phone"
                            value={newVendor.phone}
                            onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                            placeholder="+1234567890"
                            required
                            data-testid="vendor-phone-input"
                          />
                        </div>
                        <div>
                          <Label htmlFor="vendor-address">Address</Label>
                          <Input
                            id="vendor-address"
                            value={newVendor.address}
                            onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                            placeholder="123 Main St"
                            required
                            data-testid="vendor-address-input"
                          />
                        </div>
                        <div>
                          <Label htmlFor="vendor-password">Password</Label>
                          <div className="relative">
                            <Input
                              id="vendor-password"
                              type={showNewVendorPassword ? 'text' : 'password'}
                              value={newVendor.password}
                              onChange={(e) => setNewVendor({ ...newVendor, password: e.target.value })}
                              placeholder="Min 6 characters"
                              required
                              className="pr-10"
                              data-testid="vendor-password-input"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewVendorPassword(v => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              tabIndex={-1}
                            >
                              {showNewVendorPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                        <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" data-testid="submit-vendor-button">
                          Register Vendor
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>

            {/* Edit Vendor Dialog */}
            <Dialog open={editVendorDialogOpen} onOpenChange={setEditVendorDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Vendor</DialogTitle>
                  <DialogDescription>Modify vendor details and save</DialogDescription>
                </DialogHeader>
                {editVendor && (
                  <form onSubmit={handleUpdateVendor} className="space-y-4">
                    <div>
                      <Label htmlFor="edit-name">Full Name</Label>
                      <Input
                        id="edit-name"
                        value={editVendor.name}
                        onChange={(e) => setEditVendor({ ...editVendor, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-email">Email</Label>
                      <Input id="edit-email" type="email" value={editVendor.email} disabled={true} />
                    </div>
                    <div>
                      <Label htmlFor="edit-company">Company Name</Label>
                      <Input
                        id="edit-company"
                        value={editVendor.companyName}
                        onChange={(e) => setEditVendor({ ...editVendor, companyName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-phone">Phone</Label>
                      <Input
                        id="edit-phone"
                        value={editVendor.phone}
                        onChange={(e) => setEditVendor({ ...editVendor, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-address">Address</Label>
                      <Input
                        id="edit-address"
                        value={editVendor.address || ''}
                        onChange={(e) => setEditVendor({ ...editVendor, address: e.target.value })}
                      />
                    </div>
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center gap-2 mb-1">
                        <KeyRound size={15} className="text-purple-500" />
                        <Label className="text-sm font-semibold text-gray-700">Vendor Password</Label>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        Send a secure password reset email so the vendor can choose their own password.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={changingPassword}
                        onClick={async () => {
                          setChangingPassword(true);
                          try {
                            await sendPasswordResetEmail(auth, editVendor.email.trim().toLowerCase());
                            toast.success('Password reset email sent to ' + editVendor.email);
                          } catch (err) {
                            toast.error('Failed to send reset email: ' + err.message);
                          } finally {
                            setChangingPassword(false);
                          }
                        }}
                        className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 gap-2"
                      >
                        <KeyRound size={15} />
                        {changingPassword ? 'Sending...' : 'Send Password Reset Email'}
                      </Button>
                    </div>
                    <Button type="submit" disabled={changingPassword} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                      {changingPassword ? 'Processing...' : 'Save Changes'}
                    </Button>
                  </form>
                )}
              </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit User</DialogTitle>
                  <DialogDescription>Modify user details and save</DialogDescription>
                </DialogHeader>
                {editUser && (
                  <form onSubmit={handleUpdateUser} className="space-y-4">
                    <div>
                      <Label htmlFor="edit-user-name">Name</Label>
                      <Input
                        id="edit-user-name"
                        value={editUser.name}
                        onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-user-email">Email</Label>
                      <Input
                        id="edit-user-email"
                        type="email"
                        value={editUser.email}
                        onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-user-phone">Phone</Label>
                      <Input
                        id="edit-user-phone"
                        value={editUser.phone}
                        onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                      />
                    </div>
                    <Button type="submit" className="w-full">Save Changes</Button>
                  </form>
                )}
              </DialogContent>
            </Dialog>

            {/* ── Manage Staff Dialog (Super Admin) ── */}
            <Dialog open={manageStaffDialogOpen} onOpenChange={setManageStaffDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UserCheck size={20} className="text-indigo-600" />
                    Manage Staff — {selectedVendorForStaff?.companyName || selectedVendorForStaff?.name}
                  </DialogTitle>
                  <DialogDescription>
                    Add or remove staff members for this vendor. Staff can log in and scan users.
                  </DialogDescription>
                </DialogHeader>

                {/* Add Staff Form */}
                <div className="border border-indigo-100 rounded-xl p-4 bg-indigo-50/50 mb-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Plus size={16} className="text-indigo-600" />
                    Add New Staff Member
                  </h3>
                  <form onSubmit={handleAddStaff} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="staff-name">Full Name</Label>
                        <Input
                          id="staff-name"
                          value={addStaffForm.name}
                          onChange={(e) => setAddStaffForm({ ...addStaffForm, name: e.target.value })}
                          placeholder="Jane Smith"
                          required
                          data-testid="staff-name-input"
                        />
                      </div>
                      <div>
                        <Label htmlFor="staff-phone">Phone</Label>
                        <Input
                          id="staff-phone"
                          value={addStaffForm.phone}
                          onChange={(e) => setAddStaffForm({ ...addStaffForm, phone: e.target.value })}
                          placeholder="+1234567890"
                          data-testid="staff-phone-input"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="staff-email">Email</Label>
                      <Input
                        id="staff-email"
                        type="email"
                        value={addStaffForm.email}
                        onChange={(e) => setAddStaffForm({ ...addStaffForm, email: e.target.value })}
                        placeholder="staff@example.com"
                        required
                        data-testid="staff-email-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="staff-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="staff-password"
                          type={showStaffPassword ? 'text' : 'password'}
                          value={addStaffForm.password}
                          onChange={(e) => setAddStaffForm({ ...addStaffForm, password: e.target.value })}
                          placeholder="Min 6 characters"
                          required
                          className="pr-10"
                          data-testid="staff-password-input"
                        />
                        <button
                          type="button"
                          onClick={() => setShowStaffPassword(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          tabIndex={-1}
                        >
                          {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={addingStaff}
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                      data-testid="add-staff-submit"
                    >
                      {addingStaff ? 'Adding...' : 'Add Staff Member'}
                    </Button>
                  </form>
                </div>

                {/* Staff List */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Users size={16} className="text-indigo-600" />
                    Current Staff ({vendorStaffList.length})
                  </h3>
                  {vendorStaffList.length === 0 ? (
                    <p className="text-center text-gray-400 py-6 border border-dashed border-gray-200 rounded-lg">
                      No staff members yet. Add one above.
                    </p>
                  ) : (
                    <div className="border border-indigo-100 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader className="bg-indigo-50">
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vendorStaffList.map((staff) => (
                            <TableRow key={staff.id}>
                              <TableCell className="font-medium">{staff.name}</TableCell>
                              <TableCell>{staff.email}</TableCell>
                              <TableCell>{staff.phone || '—'}</TableCell>
                              <TableCell>
                                <Badge className={staff.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                                  {staff.status || 'Active'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => handleEditStaff(staff)}
                                    title="Edit staff member"
                                  >
                                    <Edit2 size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                    onClick={() => handleResetStaffPassword(staff.email)}
                                    title="Send password reset email"
                                  >
                                    <KeyRound size={14} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleDeleteStaff(staff.id, staff.name)}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* ── Edit Staff Dialog ── */}
            <Dialog open={editStaffDialogOpen} onOpenChange={setEditStaffDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Edit2 size={18} className="text-blue-600" />
                    Edit Staff Member
                  </DialogTitle>
                  <DialogDescription>Update staff details below.</DialogDescription>
                </DialogHeader>
                {editStaffData && (
                  <form onSubmit={handleUpdateStaff} className="space-y-4">
                    <div>
                      <Label htmlFor="edit-staff-name">Full Name</Label>
                      <Input
                        id="edit-staff-name"
                        value={editStaffData.name}
                        onChange={(e) => setEditStaffData({ ...editStaffData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-staff-email">Email</Label>
                      <Input
                        id="edit-staff-email"
                        type="email"
                        value={editStaffData.email}
                        disabled
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-staff-phone">Phone</Label>
                      <Input
                        id="edit-staff-phone"
                        value={editStaffData.phone || ''}
                        onChange={(e) => setEditStaffData({ ...editStaffData, phone: e.target.value })}
                        placeholder="+1234567890"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-staff-status">Status</Label>
                      <select
                        id="edit-staff-status"
                        value={editStaffData.status || 'active'}
                        onChange={(e) => setEditStaffData({ ...editStaffData, status: e.target.value })}
                        className="w-full mt-1 h-10 border border-gray-300 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center gap-2 mb-1">
                        <KeyRound size={15} className="text-purple-500" />
                        <Label className="text-sm font-semibold text-gray-700">Password</Label>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        Send a password reset email so the staff member can set a new password.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleResetStaffPassword(editStaffData.email)}
                        className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 gap-2"
                      >
                        <KeyRound size={15} />
                        Send Password Reset Email
                      </Button>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      Save Changes
                    </Button>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-purple-200 focus:border-purple-400"
                  data-testid="search-input"
                />
              </div>
            </div>

            {/* ── TABS ── */}
            <Tabs defaultValue={defaultTab} className="w-full" data-testid="management-tabs">
              <TabsList className={`grid w-full bg-purple-100 ${
                isSuperAdmin ? 'grid-cols-4' : isStaff ? 'grid-cols-1' : 'grid-cols-2'
              }`}>
                {isSuperAdmin && (
                  <TabsTrigger value="vendors" data-testid="vendors-tab">
                    <Building2 size={16} className="mr-2" />
                    Vendors ({vendors.filter(v => !v.isSuperAdmin).length})
                  </TabsTrigger>
                )}
                <TabsTrigger value="users" data-testid="users-tab">
                  <Users size={16} className="mr-2" />
                  {isSuperAdmin ? `All Users (${users.length})` : isStaff ? `My Users (${users.length})` : `Users (${users.length})`}
                </TabsTrigger>
                {isSuperAdmin && (
                  <TabsTrigger value="vendor-users" data-testid="vendor-users-tab">
                    <Activity size={16} className="mr-2" />
                    By Vendor
                  </TabsTrigger>
                )}
                {isSuperAdmin && (
                  <TabsTrigger value="all-staff" data-testid="all-staff-tab">
                    <UserCheck size={16} className="mr-2" />
                    All Staff ({staffMembers.length})
                  </TabsTrigger>
                )}
                {!isSuperAdmin && !isStaff && (
                  <TabsTrigger value="my-staff" data-testid="my-staff-tab">
                    <UserCheck size={16} className="mr-2" />
                    My Staff ({staffMembers.length})
                  </TabsTrigger>
                )}
              </TabsList>

              {/* ── Vendors Tab (Super Admin only) ── */}
              <TabsContent value="vendors" className="mt-6" data-testid="vendors-content">
                <div className="border border-purple-100 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-purple-50">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Staff</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Total Scans</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVendors.map((vendor) => (
                        <TableRow key={vendor.id} data-testid={`vendor-row-${vendor.id}`}>
                          <TableCell className="font-medium">{vendor.name}</TableCell>
                          <TableCell>{vendor.email}</TableCell>
                          <TableCell>{vendor.companyName}</TableCell>
                          <TableCell>{vendor.phone}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                              {vendor.status || 'Active'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-indigo-600 font-semibold">
                              {getStaffByVendor(vendor.email).length}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-purple-600 font-semibold">
                              {getUsersByVendor(vendor.email).length}
                            </span>
                          </TableCell>
                          <TableCell>{vendor.totalScans}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                onClick={() => handleOpenManageStaff(vendor)}
                                title="Manage Staff"
                                data-testid={`manage-staff-${vendor.id}`}
                              >
                                <UserCheck size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                onClick={() => handleEditVendor(vendor)}
                                data-testid={`edit-vendor-${vendor.id}`}
                              >
                                <Edit2 size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteVendor(vendor.id)}
                                data-testid={`delete-vendor-${vendor.id}`}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* ── Users Tab ── */}
              <TabsContent value="users" className="mt-6" data-testid="users-content">
                <div className="border border-pink-100 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-pink-50">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        {isSuperAdmin && <TableHead>Vendor Email</TableHead>}
                        {(isSuperAdmin || !isStaff) && <TableHead>Staff Email</TableHead>}
                        <TableHead>Medial Arch Type</TableHead>
                        <TableHead>Foot Type</TableHead>
                        <TableHead>Scans</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedUsers.map((user) => (
                        <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.phone}</TableCell>
                          {isSuperAdmin && <TableCell>{user.vendorEmail}</TableCell>}
                          {(isSuperAdmin || !isStaff) && (
                            <TableCell>
                              {user.staffEmail
                                ? <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">{user.staffEmail}</Badge>
                                : <span className="text-gray-400 text-xs">—</span>}
                            </TableCell>
                          )}
                          <TableCell>
                            {user.medialArchType
                              ? <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">{user.medialArchType}</Badge>
                              : <span className="text-gray-400 text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            {user.footType
                              ? <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100">{user.footType}</Badge>
                              : <span className="text-gray-400 text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                              {user.totalScans || 0} scans
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              {!isStaff && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleEditUser(user)}
                                  data-testid={`edit-user-${user.id}`}
                                >
                                  <Edit2 size={16} />
                                </Button>
                              )}
                              {!isStaff && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteUser(user.id)}
                                  data-testid={`delete-user-${user.id}`}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                            No users found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* ── Pagination Controls ── */}
                {filteredUsers.length > 0 && (
                  <div className="flex items-center justify-between mt-4 px-1">
                    <p className="text-sm text-gray-500">
                      Showing{' '}
                      <span className="font-medium text-gray-700">
                        {Math.min((usersPage - 1) * USERS_PAGE_SIZE + 1, filteredUsers.length)}
                      </span>
                      {' '}–{' '}
                      <span className="font-medium text-gray-700">
                        {Math.min(usersPage * USERS_PAGE_SIZE, filteredUsers.length)}
                      </span>
                      {' '}of{' '}
                      <span className="font-medium text-gray-700">{filteredUsers.length}</span>
                      {' '}users
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-40"
                        onClick={() => setUsersPage(1)}
                        disabled={usersPage === 1}
                      >
                        «
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-40"
                        onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                        disabled={usersPage === 1}
                      >
                        ‹ Prev
                      </Button>

                      {/* Page number pills */}
                      {Array.from({ length: usersTotalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === usersTotalPages || Math.abs(p - usersPage) <= 1)
                        .reduce((acc, p, idx, arr) => {
                          if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === '...' ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-sm">…</span>
                          ) : (
                            <Button
                              key={item}
                              variant={item === usersPage ? 'default' : 'outline'}
                              size="sm"
                              className={`h-8 w-8 p-0 text-xs ${
                                item === usersPage
                                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0'
                                  : 'border-purple-200 text-purple-700 hover:bg-purple-50'
                              }`}
                              onClick={() => setUsersPage(item)}
                            >
                              {item}
                            </Button>
                          )
                        )
                      }

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-40"
                        onClick={() => setUsersPage(p => Math.min(usersTotalPages, p + 1))}
                        disabled={usersPage === usersTotalPages}
                      >
                        Next ›
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-40"
                        onClick={() => setUsersPage(usersTotalPages)}
                        disabled={usersPage === usersTotalPages}
                      >
                        »
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Users by Vendor Tab (Super Admin) ── */}
              <TabsContent value="vendor-users" className="mt-6">
                <div className="space-y-6">
                  {vendors.filter(v => !v.isSuperAdmin).map((vendor) => {
                    const vendorUsers = getUsersByVendor(vendor.email);
                    const vendorStaff = getStaffByVendor(vendor.email);
                    return (
                      <Card key={vendor.id} className="border-purple-100">
                        <CardHeader className="bg-purple-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{vendor.companyName}</CardTitle>
                              <CardDescription>{vendor.email}</CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Badge className="bg-indigo-100 text-indigo-700">
                                {vendorStaff.length} staff
                              </Badge>
                              <Badge className="bg-purple-100 text-purple-700">
                                {vendorUsers.length} users
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          {vendorUsers.length > 0 ? (
                            <div className="max-h-[300px] overflow-y-auto">
                              <Table>
                                <TableHeader className="sticky top-0 bg-white z-10">
                                  <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Staff</TableHead>
                                    <TableHead className="text-right">Total Scans</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {vendorUsers.map((user) => (
                                    <TableRow key={user.id}>
                                      <TableCell className="font-medium">{user.name}</TableCell>
                                      <TableCell>{user.email}</TableCell>
                                      <TableCell>{user.phone || "—"}</TableCell>
                                      <TableCell>
                                        {user.staffEmail
                                          ? <Badge className="bg-indigo-100 text-indigo-700 text-xs">{user.staffEmail}</Badge>
                                          : <span className="text-gray-400 text-xs">Direct</span>}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Badge variant="outline">{user.totalScans || 0}</Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <p className="text-center text-gray-500 py-8">No users found for this vendor</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {/* ── All Staff Tab (Super Admin) ── */}
              <TabsContent value="all-staff" className="mt-6" data-testid="all-staff-content">
                <div className="border border-indigo-100 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-indigo-50">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStaff.map((staff) => (
                        <TableRow key={staff.id} data-testid={`staff-row-${staff.id}`}>
                          <TableCell className="font-medium">{staff.name}</TableCell>
                          <TableCell>{staff.email}</TableCell>
                          <TableCell>{staff.phone || '—'}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{staff.vendorCompanyName || '—'}</p>
                              <p className="text-xs text-gray-400">{staff.vendorEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={staff.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                              {staff.status || 'Active'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {staff.createdAt ? new Date(staff.createdAt).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => handleEditStaff(staff)}
                                title="Edit staff member"
                              >
                                <Edit2 size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                onClick={() => handleResetStaffPassword(staff.email)}
                                title="Send password reset email"
                              >
                                <KeyRound size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteStaff(staff.id, staff.name)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredStaff.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                            No staff members found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* ── My Staff Tab (Vendor only) ── */}
              <TabsContent value="my-staff" className="mt-6" data-testid="my-staff-content">
                {staffMembers.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-indigo-200 rounded-xl">
                    <UserCheck size={40} className="mx-auto text-indigo-300 mb-3" />
                    <p className="text-gray-500 font-medium">No staff members yet</p>
                    <p className="text-gray-400 text-sm mt-1">Ask your Super Admin to add staff members for your account.</p>
                  </div>
                ) : (
                  <div className="border border-indigo-100 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-indigo-50">
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Users Scanned</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStaff.map((staff) => {
                          const staffUsers = users.filter(u => u.staffEmail === staff.email);
                          const staffScans = staffUsers.reduce((sum, u) => sum + (u.totalScans || 0), 0);
                          return (
                            <TableRow key={staff.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                                    <span className="text-indigo-600 font-bold text-xs">
                                      {staff.name?.charAt(0)?.toUpperCase()}
                                    </span>
                                  </div>
                                  {staff.name}
                                </div>
                              </TableCell>
                              <TableCell>{staff.email}</TableCell>
                              <TableCell>{staff.phone || '—'}</TableCell>
                              <TableCell>
                                <Badge className={staff.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'}>
                                  {staff.status || 'Active'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-purple-600">{staffUsers.length}</span>
                                  <span className="text-xs text-gray-400">({staffScans} scans)</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {staff.createdAt ? new Date(staff.createdAt).toLocaleDateString() : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
