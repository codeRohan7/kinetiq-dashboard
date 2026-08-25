import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Activity, LayoutDashboard, Settings, LogOut, Shield, Building2, UserCheck,
  Menu, X,
} from 'lucide-react';
import { auth } from '../config/firebase';
import { useRole } from '../contexts/RoleContext';
import { Button } from './ui/button';

/**
 * Shell for every signed-in screen: a fixed left sidebar plus the page body.
 *
 * The existing dashboard keeps its own in-page tabs untouched — this only adds
 * navigation *around* it, so nothing that works today changes behaviour.
 */

const navItemClass = ({ isActive }) => [
  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition',
  isActive
    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
    : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700',
].join(' ');

const DashboardLayout = ({ children }) => {
  const navigate = useNavigate();
  const { role, vendor, staffDoc, isSuperAdmin, isStaff } = useRole();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const portalLabel = isSuperAdmin
    ? 'Super Admin Portal'
    : isStaff
      ? `Staff Portal${staffDoc?.vendorCompanyName ? ` — ${staffDoc.vendorCompanyName}` : ''}`
      : 'Vendor Portal';

  const RoleIcon = isStaff ? UserCheck : isSuperAdmin ? Shield : Building2;
  const roleIconClass = isStaff
    ? 'text-blue-500'
    : isSuperAdmin ? 'text-purple-500' : 'text-pink-500';

  // Super admins manage branding per-vendor from the vendor table, not here,
  // so Vendor Settings is hidden for them. Staff see it read-only.
  const showVendorSettings = role === 'vendor' || role === 'staff';

  const nav = (
    <nav className="flex flex-col gap-1">
      <NavLink to="/dashboard" className={navItemClass} onClick={() => setMobileOpen(false)}>
        <LayoutDashboard size={18} />
        Dashboard
      </NavLink>

      {showVendorSettings && (
        <NavLink
          to="/vendor/settings"
          className={navItemClass}
          onClick={() => setMobileOpen(false)}
          data-testid="nav-vendor-settings"
        >
          <Settings size={18} />
          Vendor Settings
        </NavLink>
      )}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shrink-0">
        <Activity className="text-white" size={24} />
      </div>
      <div className="min-w-0">
        <h1
          className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent truncate"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          KINETIQ
        </h1>
        <div className="flex items-center gap-1.5">
          <RoleIcon size={12} className={roleIconClass} />
          <p className="text-[11px] text-gray-500 truncate">{portalLabel}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-white/80 backdrop-blur-md border-r border-purple-100 px-4 py-5 z-40">
        {brand}

        <div className="mt-8 flex-1">{nav}</div>

        {vendor && (
          <div className="mb-3 px-3 py-2.5 rounded-xl bg-purple-50/60 border border-purple-100">
            <p className="text-[11px] uppercase tracking-wide text-purple-500 font-semibold">
              {isStaff ? 'Clinic' : 'Signed in as'}
            </p>
            <p className="text-sm font-medium text-gray-800 truncate">
              {vendor.companyName || vendor.name}
            </p>
            <p className="text-[11px] text-gray-500 truncate">{vendor.email}</p>
          </div>
        )}

        <Button
          onClick={handleLogout}
          variant="outline"
          className="gap-2 w-full border-purple-200 hover:bg-purple-50 hover:text-purple-700"
          data-testid="logout-button"
        >
          <LogOut size={18} />
          Logout
        </Button>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-purple-100 px-4 py-3 flex items-center justify-between">
        {brand}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="p-2 rounded-lg hover:bg-purple-50 text-purple-700"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden sticky top-[61px] z-40 bg-white/95 backdrop-blur-md border-b border-purple-100 px-4 py-3">
          {nav}
          <Button
            onClick={handleLogout}
            variant="outline"
            className="gap-2 w-full mt-3 border-purple-200 hover:bg-purple-50 hover:text-purple-700"
          >
            <LogOut size={18} />
            Logout
          </Button>
        </div>
      )}

      {/* ── Page body ── */}
      <div className="lg:pl-64">{children}</div>
    </div>
  );
};

export default DashboardLayout;
