import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, setPersistence, inMemoryPersistence, sendPasswordResetEmail } from 'firebase/auth';
import { collection, getDocs, addDoc, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Users, Building2, Activity, TrendingUp, LogOut, Plus, Search, Edit2, Trash2, Eye, EyeOff, KeyRound, Filter, Download } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showNewVendorPassword, setShowNewVendorPassword] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentVendorEmail, setCurrentVendorEmail] = useState(null);
  // Chart & table filters
  const [archFilter, setArchFilter] = useState('All');
  const [footFilter, setFootFilter] = useState('All');

  const [newVendor, setNewVendor] = useState({
    name: '',
    email: '',
    companyName: '',
    phone: '',
    address: '',
    password: ''
  });

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    vendorEmail: ''
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
      // fallback to current month if no date
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

    // If Send Reset Email was triggered
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

 const vendorPerformance = vendors.map(vendor => {
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

      // Detect role
      const vendorQ = query(collection(db, 'vendors'), where('email', '==', currentUser.email));
      const vendorSnap = await getDocs(vendorQ);
      const myVendorDoc = vendorSnap.empty ? null : vendorSnap.docs[0].data();
      const superAdmin = myVendorDoc?.isSuperAdmin === true;
      setIsSuperAdmin(superAdmin);
      setCurrentVendorEmail(currentUser.email);

      if (superAdmin) {
        const vendorsSnapshot = await getDocs(collection(db, 'vendors'));
        setVendors(vendorsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        const usersSnapshot = await getDocs(collection(db, 'users'));
        setUsers(usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        // Vendor-scoped: only their own users
        setVendors([]);
        const usersQ = query(collection(db, 'users'), where('vendorEmail', '==', currentUser.email));
        const usersSnap = await getDocs(usersQ);
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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

    // Check if this vendor email already exists in Firestore
    const existingQ = query(collection(db, 'vendors'), where('email', '==', normalizedEmail));
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      toast.error('A vendor with this email already exists in the system.');
      return;
    }

    try {
      // Ensure inMemoryPersistence before creating — isolates secondary auth from admin session
      await setPersistence(secondaryAuth, inMemoryPersistence);

      let authExisted = false;
      try {
        // Use secondary app so the admin is never signed out
        await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, newVendor.password);
        await secondaryAuth.signOut();
      } catch (authError) {
        if (authError.code === 'auth/email-already-in-use') {
          // Auth account from a previous failed attempt — its password is unknown.
          // Send a reset email so the vendor can set a fresh password and log in.
          authExisted = true;
          await sendPasswordResetEmail(auth, normalizedEmail);
          toast.warning(
            'This email already had a Firebase account (from a previous attempt). ' +
            'A password reset email has been sent to the vendor so they can set their login password.'
          );
        } else {
          throw authError;
        }
      }

      // Write the Firestore vendor document regardless
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
        toast.success('Vendor registered successfully! They can now log in with the password you set.');
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

  const filteredVendors = vendors.filter(vendor => 
    vendor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = filteredByType.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    const rows = filteredUsers.map(u => ({
      Name: u.name || '',
      Email: u.email || '',
      Phone: u.phone || '',
      VendorEmail: u.vendorEmail || '',
      'Medial Arch Type': u.medialArchType || '',
      'Foot Type': u.footType || '',
      'Total Scans': u.totalScans || 0,
    }));
    exportToCSV(rows, `kinetiq_users_${new Date().toISOString().slice(0,10)}.csv`);
  };
const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
const [editUser, setEditUser] = useState(null);

  const getUsersByVendor = (vendorEmail) => {
    return users.filter(user => user.vendorEmail === vendorEmail);
  };

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
// Delete a user
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

// Edit user
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


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-purple-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Activity className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent" style={{fontFamily: 'Space Grotesk, sans-serif'}} data-testid="dashboard-title">
                KINETIQ Dashboard
              </h1>
              <p className="text-xs text-gray-500">{isSuperAdmin ? 'Super Admin Portal' : 'Vendor Portal'}</p>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {isSuperAdmin && (
            <Card className="bg-white/60 backdrop-blur-sm border-purple-100 hover:shadow-lg transition" data-testid="total-vendors-card">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-600">Total Vendors</CardDescription>
                <CardTitle className="text-3xl font-bold text-purple-600">{vendors.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <TrendingUp size={16} />
                  {/* <span>+12% from last month</span> */}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white/60 backdrop-blur-sm border-pink-100 hover:shadow-lg transition" data-testid="total-users-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-600">Total Users</CardDescription>
              <CardTitle className="text-3xl font-bold text-pink-600">{users.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <TrendingUp size={16} />
                {/* <span>+18% from last month</span> */}
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
                {/* <span>+24% from last month</span> */}
              </div>
            </CardContent>
          </Card>

          {/* <Card className="bg-white/60 backdrop-blur-sm border-green-100 hover:shadow-lg transition" data-testid="active-vendors-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-600">Active Today</CardDescription>
              <CardTitle className="text-3xl font-bold text-green-600">24</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Activity size={16} />
                <span>Real-time activity</span>
              </div>
            </CardContent>
          </Card> */}
        </div>

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
                      <stop offset="5%" stopColor="#9333ea" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
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

        <Card className="bg-white/60 backdrop-blur-sm border-purple-100" data-testid="main-content-tabs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-800">Management Portal</CardTitle>
                <CardDescription>{isSuperAdmin ? 'Manage vendors and users' : 'Your scanned users'}</CardDescription>
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
                          onChange={(e) => setNewVendor({...newVendor, name: e.target.value})}
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
                          onChange={(e) => setNewVendor({...newVendor, email: e.target.value})}
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
                          onChange={(e) => setNewVendor({...newVendor, companyName: e.target.value})}
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
                          onChange={(e) => setNewVendor({...newVendor, phone: e.target.value})}
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
                          onChange={(e) => setNewVendor({...newVendor, address: e.target.value})}
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
                            onChange={(e) => setNewVendor({...newVendor, password: e.target.value})}
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
                      <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" data-testid="submit-vendor-button">Register Vendor</Button>
                    </form>
                  </DialogContent>
                 </Dialog>
                )}
              </div>
            </div>

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
          <Input
            id="edit-email"
            type="email"
            value={editVendor.email}
            disabled={true}
            onChange={(e) => setEditVendor({ ...editVendor, email: e.target.value })}
          />
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
            You cannot directly set a vendor's password. Click below to send them a secure password reset email so they can choose their own password.
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


          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  placeholder="Search vendors or users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-purple-200 focus:border-purple-400"
                  data-testid="search-input"
                />
              </div>
            </div>

            <Tabs defaultValue={isSuperAdmin ? "vendors" : "users"} className="w-full" data-testid="management-tabs">
              <TabsList className={`grid w-full bg-purple-100 ${isSuperAdmin ? 'grid-cols-3' : 'grid-cols-1'}`}>
                {isSuperAdmin && (
                  <TabsTrigger value="vendors" data-testid="vendors-tab">
                    <Building2 size={16} className="mr-2" />
                    Vendors ({vendors.length})
                  </TabsTrigger>
                )}
                <TabsTrigger value="users" data-testid="users-tab">
                  <Users size={16} className="mr-2" />
                  {isSuperAdmin ? `All Users (${users.length})` : `My Users (${users.length})`}
                </TabsTrigger>
                {isSuperAdmin && (
                  <TabsTrigger value="vendor-users" data-testid="vendor-users-tab">
                    <Activity size={16} className="mr-2" />
                    Users by Vendor
                  </TabsTrigger>
                )}
              </TabsList>

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
                            <span className="text-purple-600 font-semibold">
                              {getUsersByVendor(vendor.email).length}
                            </span>
                            
                          </TableCell>
                          <TableCell>{vendor.totalScans}</TableCell>

                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                            
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

              <TabsContent value="users" className="mt-6" data-testid="users-content">
                <div className="border border-pink-100 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-pink-50">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        {isSuperAdmin && <TableHead>Vendor Email</TableHead>}
                        <TableHead>Medial Arch Type</TableHead>
                        <TableHead>Foot Type</TableHead>
                        <TableHead>Scans</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.phone}</TableCell>
                          {isSuperAdmin && <TableCell>{user.vendorEmail}</TableCell>}
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
                            <Button
  variant="ghost"
  size="sm"
  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
  onClick={() => handleEditUser(user)}
  data-testid={`edit-user-${user.id}`}
>
  <Edit2 size={16} />
</Button>

<Button
  variant="ghost"
  size="sm"
  className="text-red-600 hover:text-red-700 hover:bg-red-50"
  onClick={() => handleDeleteUser(user.id)}
  data-testid={`delete-user-${user.id}`}
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

           <TabsContent value="vendor-users" className="mt-6">
  <div className="space-y-6">

    {vendors.map((vendor) => {
      const vendorUsers = getUsersByVendor(vendor.email);

      return (
        <Card key={vendor.id} className="border-purple-100">
          <CardHeader className="bg-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{vendor.companyName}</CardTitle>
                <CardDescription>{vendor.email}</CardDescription>
              </div>
              <Badge className="bg-purple-100 text-purple-700">
                {vendorUsers.length} users
              </Badge>
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
                      <TableHead className="text-right">Total Scans</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {vendorUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.phone || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">
                            {user.totalScans || 0}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                No users found for this vendor
              </p>
            )}
          </CardContent>
        </Card>
      );
    })}

  </div>
</TabsContent>

            </Tabs>
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default Dashboard;
