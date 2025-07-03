import { useState } from "react";
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
import { Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { Mail, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { AuthError } from "@supabase/supabase-js";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const getErrorMessage = (error: AuthError): string => {
    // Handle specific error codes for better user experience
    switch (error.message) {
      case "User not found":
        return "No account found with this email address.";
      case "Email rate limit exceeded":
        return "Too many password reset requests. Please wait before trying again.";
      case "Invalid email":
        return "Please enter a valid email address.";
      default:
        // Handle error codes if available
        if (error.status === 422) {
          return "Please enter a valid email address.";
        }
        if (error.status === 429) {
          return "Too many requests. Please wait a few minutes before trying again.";
        }
        if (error.status === 500) {
          return "Server error. Please try again later.";
        }
        
        // Generic fallback
        return error.message || "An error occurred. Please try again.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    
    try {
      await resetPassword(email);
      setSuccess(true);
      
      toast({
        title: "Password reset email sent",
        description: "Please check your email for instructions to reset your password.",
        variant: "default",
      });
    } catch (error) {
      console.error("Password reset error:", error);
      
      if (error instanceof AuthError) {
        setError(getErrorMessage(error));
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" /> Email Sent
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                We've sent a password reset link to:
              </p>
              <p className="font-medium">{email}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Please check your email and click the link to reset your password.
              </p>
              <p className="text-xs text-muted-foreground">
                Don't see the email? Check your spam folder or try again.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              variant="outline"
              onClick={() => {
                setSuccess(false);
                setEmail("");
              }}
              className="w-full"
            >
              Send Another Email
            </Button>
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

  return (
    <AuthLayout>
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
            <Mail className="h-5 w-5" /> Reset Password
          </CardTitle>
          <p className="text-sm text-center text-muted-foreground">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Reset Email
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