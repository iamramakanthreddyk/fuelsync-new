import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, RefreshCw, Lock, CheckCircle2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { login, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role) {
      const normalizedRole = typeof user.role === 'string' && user.role.replace(/\s+/g, '').toLowerCase();
      if (normalizedRole === 'superadmin' || normalizedRole === 'super_admin') {
        navigate('/superadmin/users', { replace: true });
      } else if (user.role === 'owner') {
        navigate('/owner/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email) errs.email = "Email is required";
    if (!password) errs.password = "Password is required";
    else if (password.length < 6) errs.password = "Password must be at least 6 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await login(email, password);
      toast({
        title: "Login Successful",
        description: "Welcome back!",
        variant: "success",
      });
    } catch (error: unknown) {
      let message = "Invalid credentials. Please check your email and password.";
      if (typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string") {
        message = (error as { message: string }).message;
      }
      toast({
        title: "Login Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-white via-blue-50 to-blue-100 animate-fade-in">
      {/* Mobile: Login Form First */}
      <div className="md:hidden flex flex-col justify-center px-6 py-8 bg-white min-h-screen">
        <div className="w-full max-w-md mx-auto">
          <div className="flex items-center justify-center mb-8">
            <img src="/logo.jpeg" alt="FuelSync Logo" className="h-16 w-16 mr-4 rounded-xl shadow-lg" />
            <span className="text-3xl font-extrabold text-gray-900">
              Fuel<span className="text-green-600">Sync</span>
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-3 text-center">Welcome Back</h1>
          <p className="text-gray-500 text-lg mb-6 text-center">Sign in to your account</p>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="email" className="font-medium text-base">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="username"
                className="w-full mt-2 text-base px-4 py-3"
                aria-label="Email"
                disabled={isLoading}
              />
              {errors.email && <div className="text-red-600 text-sm mt-1">{errors.email}</div>}
            </div>
            <div>
              <Label htmlFor="password" className="font-medium text-base">Password</Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pr-12 text-base px-4 py-3"
                  autoComplete="current-password"
                  aria-label="Password"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </Button>
              </div>
              {errors.password && <div className="text-red-600 text-sm mt-1">{errors.password}</div>}
            </div>
            <div className="flex justify-between items-center mt-2">
              <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">Forgot password?</a>
            </div>
            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-lg py-3 rounded-xl transition-transform duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-green-400"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
          <div className="flex items-center justify-center mt-6 text-sm text-gray-500 gap-2">
            <Lock className="w-4 h-4 text-green-600" />
            Your data is securely encrypted
          </div>
          <div className="text-center text-xs text-gray-400 mt-4">FuelSync v2.3</div>
        </div>
      </div>

      {/* Desktop: Two Column Layout */}
      <div className="hidden md:flex flex-row min-h-screen">
        {/* Left: Info */}
        <div className="flex-1 flex flex-col justify-center px-16 py-20 bg-gradient-to-br from-blue-50 via-white to-blue-100 min-w-[320px]">
          <div className="flex items-center mb-10">
            <img src="/logo.jpeg" alt="FuelSync Logo" className="h-24 w-24 mr-6 rounded-2xl shadow-xl" />
            <span className="text-5xl font-extrabold text-gray-900">
              Fuel<span className="text-green-600">Sync</span>
            </span>
          </div>
          <h2 className="text-4xl font-bold mb-8 text-gray-800 leading-tight">
            Smart Fuel Station Management
          </h2>
          <ul className="space-y-5 text-gray-700 text-xl mb-10">
            <li className="flex items-center gap-3">
              <CheckCircle2 className="text-green-600 w-6 h-6" /> Real-time fuel sales, shift, and cash tracking
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="text-green-600 w-6 h-6" /> Effortless employee, pump, and creditor management
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="text-green-600 w-6 h-6" /> Powerful analytics and daily business insights
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="text-green-600 w-6 h-6" /> Secure, role-based access for owners, managers, and staff
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="text-green-600 w-6 h-6" /> Designed for Indian petrol pumps and global stations
            </li>
          </ul>
          <div className="text-gray-500 text-lg max-w-2xl">
            <span className="font-semibold text-gray-700">FuelSync</span> helps you run your fuel station efficiently, reduce losses, and make smarter decisions—anytime, anywhere.
          </div>
        </div>
        {/* Right: Login Form */}
        <div className="flex-1 flex flex-col justify-center px-16 py-20 bg-white min-w-[320px]">
          <div className="w-full max-w-xl mx-auto">
            <h1 className="text-5xl font-extrabold text-gray-900 mb-4">Welcome Back</h1>
            <p className="text-gray-500 text-xl mb-8">Sign in to your account to continue</p>
            <form onSubmit={handleLogin} className="space-y-7">
              <div>
                <Label htmlFor="email" className="font-medium text-lg">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  autoComplete="username"
                  className="w-full mt-2 text-lg px-4 py-3"
                  aria-label="Email"
                  disabled={isLoading}
                />
                {errors.email && <div className="text-red-600 text-sm mt-1">{errors.email}</div>}
              </div>
              <div>
                <Label htmlFor="password" className="font-medium text-lg">Password</Label>
                <div className="relative mt-2">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pr-12 text-lg px-4 py-3"
                    autoComplete="current-password"
                    aria-label="Password"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                {errors.password && <div className="text-red-600 text-sm mt-1">{errors.password}</div>}
              </div>
              <div className="flex justify-between items-center mt-2">
                <a href="/forgot-password" className="text-base text-blue-600 hover:underline">Forgot password?</a>
              </div>
              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-2xl py-3 rounded-xl transition-transform duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-green-400"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
            <div className="flex items-center justify-center mt-8 text-base text-gray-500 gap-2">
              <Lock className="w-5 h-5 text-green-600" />
              Your data is securely encrypted
            </div>
            <div className="text-center text-sm text-gray-400 mt-8">FuelSync v2.3</div>
          </div>
        </div>
      </div>
      <style>
        {`
          .animate-fade-in {
            animation: fadeIn 0.7s cubic-bezier(.4,0,.2,1) both;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(24px);}
            to { opacity: 1; transform: translateY(0);}
          }
        `}
      </style>
    </div>
  );
}