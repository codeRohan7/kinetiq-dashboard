import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
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
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const vendorsRef = collection(db, 'vendors');
      const q = query(vendorsRef, 
        where('email', '==', email),
        where('isSuperAdmin', '==', true)
        // where('companyName', '==', companyName)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast.error('Invalid email for this account');
        await auth.signOut();
        setLoading(false);
        return;
      }

      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="w-1/2 bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2" style={{fontFamily: 'Space Grotesk, sans-serif'}} data-testid="login-title">
             Super Admin Log In
            </h1>
            <p className="text-gray-500 text-sm" data-testid="login-subtitle">Welcome back! Please enter your details</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-gray-700 font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                placeholder="Enter your email"
                required
                data-testid="login-email-input"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
              <div className="relative mt-1">
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

            <div>
              <Label htmlFor="company" className="text-gray-700 font-medium">Company Name</Label>
              <Input
                id="company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1 h-12 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                placeholder="Enter your company name"
                required
                data-testid="login-company-input"
              />
            </div>

            {/* <button
              type="button"
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              data-testid="forgot-password-link"
            >
              Forgot password?
            </button> */}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg"
              data-testid="login-submit-button"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
           
            </div>

           
          </form>

        
        </div>
      </div>

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
            <h2 className="text-white text-3xl font-bold mb-2" style={{fontFamily: 'Space Grotesk, sans-serif'}}>KINETIQ</h2>
            <p className="text-white/90 text-sm">Advanced Foot Sole Scanning Technology</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
