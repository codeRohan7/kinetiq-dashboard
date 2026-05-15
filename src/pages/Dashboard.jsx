import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { collection, getDocs, addDoc, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { Users, Building2, Activity, TrendingUp, LogOut, Plus, Search, Edit2, Trash2, Eye } from 'lucide-react';
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

const Dashboard = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  
  const [newVendor, setNewVendor] = useState({
    name: '',
    email: '',
    companyName: '',
    phone: '',
    password: 'password123'
  });

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    vendorEmail: ''
  });

 const scanData = [
  { month: 'Total', scans: users.reduce((s,u)=>s+(u.totalScans||0),0), users: users.length }
];

const totalScans = users.reduce((sum, user) => sum + (user.totalScans || 0), 0);
const [editVendorDialogOpen, setEditVendorDialogOpen] = useState(false);
const [editVendor, setEditVendor] = useState(null);
const handleUpdateVendor = async (e) => {
  e.preventDefault();
  try {
    const vendorRef = doc(db, "vendors", editVendor.id);
    await updateDoc(vendorRef, {
      name: editVendor.name,
      email: editVendor.email,
      companyName: editVendor.companyName,
      phone: editVendor.phone,
      Address: editVendor.Address
    });

    toast.success("Vendor updated successfully!");
    setEditVendorDialogOpen(false);
    fetchData();
  } catch (error) {
    console.error("Error updating vendor:", error);
    toast.error("Failed to update vendor");
  }
};

const handleEditVendor = (vendor) => {
  setEditVendor(vendor);
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
      const vendorsSnapshot = await getDocs(collection(db, 'vendors'));
      const vendorsData = vendorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVendors(vendorsData);

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
      setLoading(false);
    }
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, newVendor.email, newVendor.password);
      
      await addDoc(collection(db, 'vendors'), {
        name: newVendor.name,
        email: newVendor.email,
        companyName: newVendor.companyName,
        phone: newVendor.phone,
        totalScans: 0,
        createdAt: new Date().toISOString(),
        status: 'active'
      });

      toast.success('Vendor registered successfully!');
      setDialogOpen(false);
      setNewVendor({ name: '', email: '', companyName: '', phone: '', Address: '', password: 'password123' });
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

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );
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
              <p className="text-xs text-gray-500">Super Admin Portal</p>
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
              <CardTitle className="text-lg font-semibold text-gray-800">Scan Trends</CardTitle>
              <CardDescription>Monthly scan and user growth</CardDescription>
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
        </div>

        <Card className="bg-white/60 backdrop-blur-sm border-purple-100" data-testid="main-content-tabs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-800">Management Portal</CardTitle>
                <CardDescription>Manage vendors and users</CardDescription>
              </div>
              <div className="flex gap-2">
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
                        <Input
                          id="vendor-password"
                          type="password"
                          value={newVendor.password}
                          onChange={(e) => setNewVendor({...newVendor, password: e.target.value})}
                          placeholder="Default: password123"
                          required
                          data-testid="vendor-password-input"
                        />
                      </div>
                      <Button type="submit" className="w-full" data-testid="submit-vendor-button">Register Vendor</Button>
                    </form>
                  </DialogContent>
                </Dialog>

                
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
          <Label htmlFor="edit-company">Address</Label>
          <Input
            id="edit-company"
            value={editVendor.Address}
            onChange={(e) => setEditVendor({ ...editVendor, Address: e.target.value })}
          />
        </div>

        <Button type="submit" className="w-full">Save Changes</Button>
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

            <Tabs defaultValue="vendors" className="w-full" data-testid="management-tabs">
              <TabsList className="grid w-full grid-cols-3 bg-purple-100">
                <TabsTrigger value="vendors" data-testid="vendors-tab">
                  <Building2 size={16} className="mr-2" />
                  Vendors ({vendors.length})
                </TabsTrigger>
                <TabsTrigger value="users" data-testid="users-tab">
                  <Users size={16} className="mr-2" />
                  All Users ({users.length})
                </TabsTrigger>
                <TabsTrigger value="vendor-users" data-testid="vendor-users-tab">
                  <Activity size={16} className="mr-2" />
                  Users by Vendor
                </TabsTrigger>
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
                        <TableHead>Vendor Email</TableHead>
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
                          <TableCell>{user.vendorEmail}</TableCell>
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
