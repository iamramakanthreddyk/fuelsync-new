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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-blue-50 to-blue-100">
      <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row rounded-3xl shadow-2xl overflow-hidden bg-white/95 border border-slate-100 animate-fade-in">
        {/* Left Side: Project Info */}
        <div className="flex-[1.1] flex flex-col justify-center items-start px-10 py-16 bg-gradient-to-br from-blue-50 via-white to-blue-100 relative min-w-[320px]">
          {/* Optional illustration */}
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none hidden md:block">
            <img src="/station-illustration.svg" alt="" className="w-72" />
          </div>
          <div className="max-w-md w-full z-10">
            <div className="flex items-center mb-8">
              <img src="/logo.jpeg" alt="FuelSync Logo" className="h-20 w-20 mr-5 rounded-xl shadow-lg" />
              <span className="text-4xl md:text-5xl font-extrabold text-gray-900">
                Fuel<span className="text-green-600">Sync</span>
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-800 leading-tight">
              Smart Fuel Station Management
            </h2>
            <ul className="space-y-4 text-gray-700 text-lg mb-8">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-green-600 w-5 h-5" /> Real-time fuel sales, shift, and cash tracking
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-green-600 w-5 h-5" /> Effortless employee, pump, and creditor management
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-green-600 w-5 h-5" /> Powerful analytics and daily business insights
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-green-600 w-5 h-5" /> Secure, role-based access for owners, managers, and staff
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="text-green-600 w-5 h-5" /> Designed for Indian petrol pumps and global stations
              </li>
            </ul>
            <div className="text-gray-500 text-base">
              <span className="font-semibold text-gray-700">FuelSync</span> helps you run your fuel station efficiently, reduce losses, and make smarter decisions—anytime, anywhere.
            </div>
          </div>
        </div>
        {/* Right Side: Login Form */}
        <div className="flex-[0.9] flex flex-col items-center justify-center px-8 py-16 bg-white relative min-w-[320px]">
          <div className="w-full max-w-lg space-y-8">
            <div className="flex flex-col items-center mb-2">
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-2">
                Welcome Back
              </h1>
              <p className="text-gray-500 text-lg">Sign in to your account to continue</p>
            </div>
            <Card className="rounded-2xl border border-slate-100 bg-white/95 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold">Login</CardTitle>
                <CardDescription>
                  Enter your credentials below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <Label htmlFor="email" className="font-medium">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      autoComplete="username"
                      className="w-full mt-1"
                      aria-label="Email"
                      disabled={isLoading}
                    />
                    {errors.email && <div className="text-red-600 text-xs mt-1">{errors.email}</div>}
                  </div>
                  <div>
                    <Label htmlFor="password" className="font-medium">Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pr-10"
                        autoComplete="current-password"
                        aria-label="Password"
                        disabled={isLoading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {errors.password && <div className="text-red-600 text-xs mt-1">{errors.password}</div>}
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">Forgot password?</a>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold text-lg py-2 rounded-lg transition-transform duration-150 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-green-400"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
                <div className="flex items-center justify-center mt-6 text-xs text-gray-500 gap-2">
                  <Lock className="w-4 h-4 text-green-600" />
                  Your data is securely encrypted
                </div>
              </CardContent>
            </Card>
            <div className="text-center text-xs text-gray-400 mt-4">FuelSync v2.3</div>
          </div>
        </div>
      </div>
      {/* Fade-in animation */}
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