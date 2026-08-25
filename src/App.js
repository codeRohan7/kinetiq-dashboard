import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RoleProvider } from './contexts/RoleContext';
import { Toaster } from './components/ui/sonner';
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VendorSettings from './pages/VendorSettings';
import Report from './pages/Report';
import './App.css';

const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
};

/**
 * Signed-in screens share the sidebar shell. RoleProvider sits inside
 * PrivateRoute so the role lookup only runs for an authenticated session.
 */
const Shell = ({ children }) => (
  <PrivateRoute>
    <RoleProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </RoleProvider>
  </PrivateRoute>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Shell><Dashboard /></Shell>} />
          <Route path="/vendor/settings" element={<Shell><VendorSettings /></Shell>} />
          {/* Patient-facing report portal — public, no auth. The desktop app
              distributes this link and its QR code after a scan. */}
          <Route path="/report/:id" element={<Report />} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
