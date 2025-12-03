
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, CheckCircle, RefreshCw } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      toast({
        title: "Login Successful",
        description: "Welcome back!",
        variant: "success",
      });
    } catch (error: unknown) {
      console.error('Login error:', error);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-indigo-100 to-blue-200 relative overflow-hidden p-4">
      {/* Decorative SVG background */}
      <svg className="absolute left-0 top-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="400" cy="300" rx="340" ry="180" fill="#60A5FA" />
        <ellipse cx="600" cy="100" rx="120" ry="60" fill="#6366F1" />
        <ellipse cx="200" cy="500" rx="100" ry="40" fill="#818CF8" />
      </svg>
      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {/* Modern fuel station SVG illustration */}
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="24" width="28" height="28" rx="4" fill="#2563EB"/>
              <rect x="18" y="32" width="12" height="12" rx="2" fill="#FBBF24"/>
              <rect x="44" y="28" width="10" height="24" rx="3" fill="#F87171"/>
              <rect x="48" y="20" width="4" height="8" rx="2" fill="#60A5FA"/>
              <rect x="12" y="20" width="24" height="4" rx="2" fill="#6366F1"/>
              <circle cx="24" cy="44" r="2" fill="#1E293B"/>
              <circle cx="28" cy="44" r="2" fill="#1E293B"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">FuelSync</h1>
          <p className="text-gray-600">Fuel Station Management System</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  autoComplete="username"
                  className="w-full"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pr-10"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full" 
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
          </CardContent>
        </Card>
        <div className="mt-4 text-center">
          <span className="text-sm text-gray-600">Don't have an account? </span>
          <a href="/signup" className="text-blue-600 hover:underline">Sign Up</a>
        </div>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center space-x-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">No Email Confirmation Required</span>
            </div>
            <p className="text-xs text-green-700 mt-1">
              New users can log in immediately after signing up.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}