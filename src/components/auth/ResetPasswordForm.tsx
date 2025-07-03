import { useState, useEffect } from "react";
import { useAuth } from "../../../supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { Lock, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { AuthError } from "@supabase/supabase-js";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "../../../supabase/supabase";

export default function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [searchParams] = useSearchParams();
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user has a valid password recovery session
    const checkSession = async () => {
      try {
        // Get token_hash from URL parameters
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        
        console.log("URL params:", { tokenHash, type });
        
        if (tokenHash && type === 'recovery') {
          // Verify the recovery session with Supabase
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          
          if (error) {
            console.error("Token verification error:", error);
            setIsValidSession(false);
          } else if (data?.session) {
            console.log("Valid recovery session:", data);
            setIsValidSession(true);
          } else {
            setIsValidSession(false);
          }
        } else {
          // Check if there's already an active session
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error("Session check error:", error);
            setIsValidSession(false);
          } else if (session?.user) {
            setIsValidSession(true);
          } else {
            setIsValidSession(false);
          }
        }
      } catch (error) {
        console.error("Session check error:", error);
        setIsValidSession(false);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();

    // Listen for auth state changes (like password recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change:", event, session);
        if (event === 'PASSWORD_RECOVERY') {
          setIsValidSession(true);
        } else if (session?.user) {
          setIsValidSession(true);
        }
        setCheckingSession(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [searchParams]);

  const getErrorMessage = (error: AuthError): string => {
    // Handle specific error codes for better user experience
    switch (error.message) {
      case "Password should be at least 6 characters":
        return "Password must be at least 6 characters long.";
      case "New password should be different from the old password":
        return "Please choose a different password than your current one.";
      case "Session not found":
        return "Your password reset session has expired. Please request a new password reset link.";
      case "Token has expired or is invalid":
        return "Your password reset link has expired. Please request a new one.";
      default:
        // Handle error codes if available
        if (error.status === 400) {
          return "Invalid request. Please try requesting a new password reset link.";
        }
        if (error.status === 422) {
          return "Password must be at least 6 characters long.";
        }
        if (error.status === 500) {
          return "Server error. Please try again later.";
        }
        
        // Generic fallback
        return error.message || "An error occurred. Please try again.";
    }
  };

  const validateForm = () => {
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match. Please try again.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      await updatePassword(newPassword);
      setSuccess(true);
      
      toast({
        title: "Password updated successfully",
        description: "Your password has been reset. You can now sign in with your new password.",
        variant: "default",
      });

      // Redirect to login after a delay
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      console.error("Password update error:", error);
      
      if (error instanceof AuthError) {
        setError(getErrorMessage(error));
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <AuthLayout>
        <Card className="w-full">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying reset link...</span>
            </div>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  if (!isValidSession) {
    return (
      <AuthLayout>
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" /> Invalid Link
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This password reset link is invalid or has expired.
              </p>
              <p className="text-sm text-muted-foreground">
                Please request a new password reset link.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Link to="/forgot-password" className="w-full">
              <Button className="w-full">
                Request New Reset Link
              </Button>
            </Link>
            <div className="text-sm text-center text-slate-600">
              Remember your password?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </Card>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout>
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" /> Password Updated
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Your password has been successfully updated.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting you to the login page...
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Link to="/login" className="w-full">
              <Button className="w-full">
                Go to Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
            <Lock className="h-5 w-5" /> Set New Password
          </CardTitle>
          <p className="text-sm text-center text-muted-foreground">
            Enter your new password below.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password (min. 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating Password...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Update Password
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-slate-600">
            Remember your password?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
} 