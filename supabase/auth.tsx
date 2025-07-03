import { createContext, useContext, useEffect, useState } from "react";
import { User, AuthError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state (signed in, signed out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string): Promise<void> => {
    try {
      console.log("Attempting signup with:", { email, fullName });
      
      const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
      
      if (error) {
        // Only log unexpected errors to console, not user input errors
        const expectedErrors = ["User already registered", "Email rate limit exceeded"];
        if (!expectedErrors.includes(error.message)) {
          console.error("Supabase auth signUp error:", error);
        }
        throw error;
      }
      
      // Check if user is created but in email confirmation state
      if (data?.user?.identities?.length === 0) {
        throw new Error("This email is already registered. Please log in instead.");
      }

      console.log("Signup successful:", data);
    } catch (error) {
      // Only log unexpected errors to console
      const expectedErrors = ["User already registered", "Email rate limit exceeded", "This email is already registered. Please log in instead."];
      if (error instanceof AuthError && !expectedErrors.includes(error.message)) {
        console.error("Error in signUp function:", error);
      } else if (!(error instanceof AuthError) && !(error instanceof Error && expectedErrors.includes(error.message))) {
        console.error("Error in signUp function:", error);
      }
      throw error;
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        // Only log unexpected errors to console, not user input errors
        if (error.message !== "Invalid login credentials") {
          console.error("Supabase auth signIn error:", error);
        }
        throw error;
      }
      
      console.log("Sign in successful:", data);
    } catch (error) {
      // Only log unexpected errors to console
      if (error instanceof AuthError && error.message !== "Invalid login credentials") {
        console.error("Error in signIn function:", error);
      }
      throw error;
    }
  };

  const signInWithGoogle = async (): Promise<void> => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/upload`,
        },
      });
      
      if (error) {
        console.error("Supabase auth signInWithGoogle error:", error);
        throw error;
      }
      
      console.log("Google sign in initiated:", data);
    } catch (error) {
      console.error("Error in signInWithGoogle function:", error);
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Supabase auth signOut error:", error);
        throw error;
      }
      
      console.log("Sign out successful");
    } catch (error) {
      console.error("Error in signOut function:", error);
      throw error;
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        throw error;
      }
      
      console.log("Password reset email sent successfully");
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw error;
    }
  };

  const updatePassword = async (newPassword: string): Promise<void> => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (error) {
        console.error("Supabase auth updatePassword error:", error);
        throw error;
      }
      
      console.log("Password updated successfully:", data);
    } catch (error) {
      console.error("Error in updatePassword function:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
