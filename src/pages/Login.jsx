import React, { useState } from 'react';
import { Eye, EyeOff, Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Forgot-password state
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      await signInWithEmailAndPassword(auth, normalizedEmail, password);

      // 1. Check if super admin / vendor
      const vendorsRef = collection(db, 'vendors');
      const vendorQ = query(vendorsRef, where('email', '==', normalizedEmail));
      const vendorSnap = await getDocs(vendorQ);

      if (!vendorSnap.empty) {
        const vendorData = vendorSnap.docs[0].data();

        // Deleting an account from Vendor Settings is a soft delete — the
        // Firebase Auth login survives, so the status flag is what stops them
        // signing back in. Super admins are exempt so they can still get in to
        // sort out a mis-flagged account.
        if (!vendorData.isSuperAdmin
            && (vendorData.status === 'deleted' || vendorData.status === 'inactive')) {
          toast.error('This account has been deleted. Contact KinetiQ support to restore it.');
          await auth.signOut();
          setLoading(false);
          return;
        }

        // It's a vendor or super admin — proceed to dashboard
        toast.success('Login successful!');
        navigate('/dashboard');
        return;
      }

      // 2. Check if staff member
      const staffRef = collection(db, 'staff');
      const staffQ = query(staffRef, where('email', '==', normalizedEmail));
      const staffSnap = await getDocs(staffQ);

      if (!staffSnap.empty) {
        const staffDoc = staffSnap.docs[0].data();
        if (staffDoc.status === 'inactive') {
          toast.error('Your staff account has been deactivated. Contact your vendor.');
          await auth.signOut();
          setLoading(false);
          return;
        }
        toast.success('Login successful!');
        navigate('/dashboard');
        return;
      }

      // 3. No match — deny access
      toast.error('Access denied. This email is not registered in the system.');
      await auth.signOut();
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error('Please enter your email address.');
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSent(true);
      toast.success('Password reset link sent! Check your inbox.');
    } catch (error) {
      console.error('Reset error:', error);
      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email address.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Please enter a valid email address.');
      } else {
        toast.error(error.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowForgot(false);
    setResetEmail('');
    setResetSent(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="w-1/2 bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-12">
        <div className="w-full max-w-md">

          {/* ───── FORGOT PASSWORD PANEL ───── */}
          {showForgot ? (
            <div>
              {/* Back button */}
              <button
                type="button"
                onClick={handleBackToLogin}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-purple-600 mb-8 transition-colors"
                data-testid="back-to-login-btn"
              >
                <ArrowLeft size={16} />
                Back to login
              </button>

              {!resetSent ? (
                <>
                  {/* Header */}
                  <div className="mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-5 shadow-lg shadow-purple-200">
                      <KeyRound size={26} className="text-white" />
                    </div>
                    <h1
                      className="text-3xl font-bold text-gray-800 mb-2"
                      style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                      data-testid="forgot-password-title"
                    >
                      Forgot Password?
                    </h1>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      Enter your email address and we'll send you a password reset link.
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    <div>
                      <Label htmlFor="reset-email" className="text-gray-700 font-medium">
                        Email Address
                      </Label>
                      <div className="relative mt-1">
                        <Mail
                          size={18}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                        <Input
                          id="reset-email"
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500 pl-10"
                          placeholder="Enter your email"
                          required
                          data-testid="reset-email-input"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg"
                      data-testid="send-reset-link-btn"
                    >
                      {resetLoading ? 'Sending link…' : 'Send Reset Link'}
                    </Button>
                  </form>
                </>
              ) : (
                /* ── Success state ── */
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-200">
                    <Mail size={36} className="text-white" />
                  </div>
                  <h2
                    className="text-2xl font-bold text-gray-800 mb-3"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    data-testid="reset-sent-title"
                  >
                    Check your inbox
                  </h2>
                  <p className="text-gray-500 text-sm leading-relaxed mb-2">
                    A password reset link has been sent to
                  </p>
                  <p className="font-semibold text-purple-600 mb-6 break-all">{resetEmail}</p>
                  <p className="text-xs text-gray-400 mb-8">
                    Didn't receive it? Check your spam folder or{' '}
                    <button
                      type="button"
                      className="text-purple-600 hover:underline font-medium"
                      onClick={() => setResetSent(false)}
                      data-testid="resend-link-btn"
                    >
                      try again
                    </button>
                    .
                  </p>
                  <Button
                    type="button"
                    onClick={handleBackToLogin}
                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg"
                    data-testid="back-to-login-btn-success"
                  >
                    Back to Login
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* ───── NORMAL LOGIN PANEL ───── */
            <>
              <div className="mb-8">
                {/* Logo / icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-5 shadow-lg shadow-purple-200">
                  <span className="text-white font-bold text-xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>K</span>
                </div>
                <h1
                  className="text-4xl font-bold text-gray-800 mb-2"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                  data-testid="login-title"
                >
                  Log In
                </h1>
                <p className="text-gray-500 text-sm" data-testid="login-subtitle">
                  Welcome back! Please enter your credentials to continue.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <Label htmlFor="email" className="text-gray-700 font-medium">
                    Email
                  </Label>
                  <div className="relative mt-1">
                    <Mail
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500 pl-10"
                      placeholder="Enter your email"
                      required
                      data-testid="login-email-input"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="password" className="text-gray-700 font-medium">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowForgot(true)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
                      data-testid="forgot-password-link"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500 pr-10"
                      placeholder="Enter your password"
                      required
                      data-testid="login-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      data-testid="toggle-password-visibility"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg"
                  data-testid="login-submit-button"
                >
                  {loading ? 'Logging in...' : 'Log in'}
                </Button>
              </form>

              {/* Role hint */}
              <p className="text-center text-xs text-gray-400 mt-6">
                Works for Super Admins, Vendors &amp; Staff
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-1/2 bg-gradient-to-br from-purple-500 via-purple-400 to-pink-400 flex items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20"></div>
        <img
          src="https://images.unsplash.com/photo-1612626944109-55dd90f573b3?w=800&q=80"
          alt="Man holding shoe"
          className="relative z-10 rounded-3xl shadow-2xl max-w-md object-cover"
          data-testid="login-hero-image"
        />
        <div className="absolute bottom-12 left-12 z-20">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <h2
              className="text-white text-3xl font-bold mb-2"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              KINETIQ
            </h2>
            <p className="text-white/90 text-sm">Advanced Foot Sole Scanning Technology</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
