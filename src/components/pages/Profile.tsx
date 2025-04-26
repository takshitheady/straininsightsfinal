import React, { useState, useEffect } from "react";
import { useAuth } from "../../../supabase/auth";
import { supabase } from "../../../supabase/supabase";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  User,
  Settings,
  History,
  Mail,
  Edit,
  Calendar,
  Shield,
  Key,
  CreditCard,
  ChevronRight,
  LogOut,
  Lock,
  Check,
  Users,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/toaster";

// Animation Variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const slideIn = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

// Add new interfaces
interface UserSubscription {
  plan_name: string;
  operations_limit: number;
  operations_used: number;
  subscription_status: string;
  current_period_end?: string;
}

const ProfilePage = () => {
  const { user, loading, signOut } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  
  // Format account creation date
  const formatCreationDate = (timestamp: number | string | null) => {
    if (!timestamp) return "Unknown";
    const date = typeof timestamp === 'number' 
      ? new Date(timestamp * 1000) // Convert seconds to milliseconds
      : new Date(timestamp);
    return date.toLocaleDateString("en-US", { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  };

  // Fetch user subscription data
  useEffect(() => {
    const fetchSubscriptionData = async () => {
      if (!user) return;
      
      setLoadingSubscription(true);
      try {
        // Get user's subscription from database
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('current_plan_id, generation_limit, generations_used')
          .eq('user_id', user.id)
          .single();
          
        if (userError) throw userError;
        
        // Get subscription details if exists
        let planName = "Free Plan";
        let operationsLimit = userData?.generation_limit || 1;
        let operationsUsed = userData?.generations_used || 0;
        let subscriptionStatus = "active";
        let currentPeriodEnd = undefined;
        
        if (userData?.current_plan_id) {
          const { data: subscriptionData, error: subscriptionError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('stripe_id', userData.current_plan_id)
            .single();
            
          if (subscriptionError) throw subscriptionError;
          
          // Set plan details based on subscription
          if (subscriptionData) {
            // Extract plan name from product ID or metadata
            if (subscriptionData.metadata?.product_name) {
              planName = subscriptionData.metadata.product_name;
            } else if (subscriptionData.price_id) {
              // Parse from price ID if needed
              if (subscriptionData.price_id.includes('basic')) {
                planName = "Basic Plan";
                operationsLimit = 100;
              } else if (subscriptionData.price_id.includes('pro')) {
                planName = "Pro Plan";
                operationsLimit = 500;
              }
            }
            
            subscriptionStatus = subscriptionData.status;
            if (subscriptionData.current_period_end) {
              currentPeriodEnd = new Date(subscriptionData.current_period_end * 1000).toLocaleDateString();
            }
          }
        }
        
        setSubscription({
          plan_name: planName,
          operations_limit: operationsLimit,
          operations_used: operationsUsed,
          subscription_status: subscriptionStatus,
          current_period_end: currentPeriodEnd,
        });
      } catch (error) {
        console.error("Error fetching subscription data:", error);
      } finally {
        setLoadingSubscription(false);
      }
    };
    
    fetchSubscriptionData();
  }, [user]);

  return (
    <div className="min-h-screen bg-brand-dark text-gray-200 font-sans">
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 50, damping: 15 }}
        className="sticky top-0 z-50 w-full h-20 border-b border-white/10 bg-brand-dark/90 backdrop-blur-md"
      >
        <div className="container mx-auto px-4 flex h-full items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img
              src="/headylogo.png"
              alt="Heady Logo"
              className="h-12 w-auto"
            />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link to="/upload" className="text-gray-300 hover:text-white transition-colors">Upload</Link>
            <Link to="/output-history" className="text-gray-300 hover:text-white transition-colors">History</Link>
            <Link to="/profile" className="text-brand-green hover:text-green-500 transition-colors">Profile</Link>
          </nav>

          {/* Auth Buttons/User Menu */}
          <div className="flex items-center space-x-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="focus:outline-none"
                  >
                    <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-white/20">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                        alt={user.email || "User Avatar"}
                      />
                      <AvatarFallback className="bg-gray-700 text-white">
                        {user.email?.[0].toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-white">
                  <DropdownMenuLabel className="font-medium">My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                    <User className="mr-2 h-4 w-4" /> 
                    <Link to="/profile" className="w-full">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer">
                    <History className="mr-2 h-4 w-4" /> 
                    <Link to="/output-history">View History</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem
                    onSelect={() => signOut()}
                    className="hover:bg-gray-700 focus:bg-gray-700 cursor-pointer text-red-400 focus:text-red-400"
                  >
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/login">
                <Button
                  variant="outline"
                  className="text-white bg-white/10 border-white/20 hover:bg-white/20 transition-colors text-sm font-semibold"
                >
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      <div className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="flex justify-center items-center h-[70vh]">
            <div className="relative w-16 h-16">
              <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-200 rounded-full"></div>
              <div className="absolute top-0 left-0 w-full h-full border-4 border-t-brand-green rounded-full animate-spin"></div>
            </div>
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center h-[70vh] text-center">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-6">
              <User className="h-10 w-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-semibold mb-4 text-white">Please sign in to view your profile</h2>
            <p className="text-gray-400 mb-8 max-w-md">Sign in to access your profile information, account settings, and analysis history.</p>
            <Link to="/login">
              <Button className="bg-brand-green hover:bg-green-600 text-white">
                Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Header Section */}
            <motion.div variants={fadeIn} className="mb-12">
              <div className="flex flex-col md:flex-row md:items-end justify-between">
                <div className="flex items-center mb-6 md:mb-0">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="relative mr-6"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/30 to-gray-700/30 rounded-full blur-lg transform -translate-x-1 -translate-y-1"></div>
                    <Avatar className="h-24 w-24 ring-4 ring-white/10 relative">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                        alt={user.email || "User Avatar"}
                      />
                      <AvatarFallback className="bg-gray-700 text-white text-2xl">
                        {user.email?.[0].toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 bg-brand-green rounded-full p-1 ring-4 ring-brand-dark">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  </motion.div>
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-1">{user.user_metadata?.full_name || "User"}</h1>
                    <div className="flex items-center text-gray-400">
                      <Mail className="h-4 w-4 mr-2 text-gray-500" /> 
                      <span>{user.email}</span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <Button 
                    variant="outline"
                    className="border-gray-700 bg-white/5 hover:bg-white/10 text-white"
                  >
                    <Edit className="h-4 w-4 mr-2" /> 
                    Edit Profile
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => signOut()}
                    className="bg-white/5 hover:bg-white/10 border border-red-500/40 text-red-400 hover:text-red-300"
                  >
                    <LogOut className="h-4 w-4 mr-2" /> 
                    Sign Out
                  </Button>
                </div>
              </div>
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-lg py-3 px-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Member Since</p>
                  <p className="text-white font-medium mt-1 flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-brand-green" />
                    {formatCreationDate(user.created_at)}
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg py-3 px-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Account Status</p>
                  <p className="text-white font-medium mt-1 flex items-center">
                    <Badge className="bg-green-600/20 text-green-400 hover:bg-green-600/30 border-0">Active</Badge>
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg py-3 px-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Subscription</p>
                  <p className="text-white font-medium mt-1 flex items-center">
                    {loadingSubscription ? (
                      <div className="flex items-center">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin text-gray-400" />
                        <span className="text-gray-400">Loading...</span>
                      </div>
                    ) : (
                      <Badge className={
                        subscription?.plan_name === "Free Plan" ? "bg-gray-600/20 text-gray-400 hover:bg-gray-600/30 border-0" :
                        subscription?.plan_name === "Basic Plan" ? "bg-teal-600/20 text-teal-400 hover:bg-teal-600/30 border-0" :
                        "bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border-0"
                      }>
                        {subscription?.plan_name || "Free Plan"}
                      </Badge>
                    )}
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg py-3 px-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Operations Used</p>
                  <p className="text-white font-medium mt-1 flex items-center">
                    {loadingSubscription ? (
                      <div className="flex items-center">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin text-gray-400" />
                        <span className="text-gray-400">Loading...</span>
                      </div>
                    ) : (
                      <>
                        <div className="h-1.5 w-24 bg-gray-700 rounded-full mr-2 overflow-hidden">
                          <div 
                            className="h-full bg-brand-green rounded-full"
                            style={{ 
                              width: `${Math.min(100, (subscription?.operations_used || 0) / (subscription?.operations_limit || 1) * 100)}%`
                            }}
                          ></div>
                        </div>
                        <span>
                          {subscription?.operations_used || 0}/{subscription?.operations_limit || 1}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Sidebar - Vertical Navigation */}
              <motion.div 
                variants={slideIn}
                className="lg:col-span-3"
              >
                <Card className="bg-white/5 border-white/10 shadow-lg overflow-hidden">
                  <CardContent className="p-0">
                    <nav className="space-y-1">
                      <div className="border-l-2 border-brand-green bg-white/5">
                        <a href="#account" className="flex items-center py-3 px-4 text-white font-medium">
                          <User className="h-5 w-5 mr-3 text-brand-green" /> 
                          Account
                        </a>
                      </div>
                      <div className="border-l-2 border-transparent hover:border-gray-600 hover:bg-white/5 transition-colors">
                        <a href="#security" className="flex items-center py-3 px-4 text-gray-300 hover:text-white">
                          <Shield className="h-5 w-5 mr-3 text-gray-500" /> 
                          Security
                        </a>
                      </div>
                      <div className="border-l-2 border-transparent hover:border-gray-600 hover:bg-white/5 transition-colors">
                        <a href="#billing" className="flex items-center py-3 px-4 text-gray-300 hover:text-white">
                          <CreditCard className="h-5 w-5 mr-3 text-gray-500" /> 
                          Subscription
                        </a>
                      </div>
                      <div className="border-l-2 border-transparent hover:border-gray-600 hover:bg-white/5 transition-colors">
                        <a href="#analytics" className="flex items-center py-3 px-4 text-gray-300 hover:text-white">
                          <Users className="h-5 w-5 mr-3 text-gray-500" /> 
                          Team Access
                        </a>
                      </div>
                    </nav>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Content Area */}
              <motion.div 
                variants={fadeIn}
                className="lg:col-span-9 space-y-8"
              >
                {/* Account Info Section */}
                <Card id="account" className="bg-white/5 border-white/10 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl text-white">Account Information</CardTitle>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription className="text-gray-400">Manage your personal account details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-white/5 border border-white/5">
                        <div>
                          <h3 className="text-sm font-medium text-gray-300">Full Name</h3>
                          <p className="text-white mt-1">{user.user_metadata?.full_name || "Not provided"}</p>
                        </div>
                        <ChevronRight className="hidden sm:block h-5 w-5 text-gray-500" />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-white/5 border border-white/5">
                        <div>
                          <h3 className="text-sm font-medium text-gray-300">Email Address</h3>
                          <p className="text-white mt-1">{user.email}</p>
                        </div>
                        <Badge className="mt-2 sm:mt-0 self-start sm:self-auto bg-gray-700/60 text-gray-300 border-0">Verified</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Security Section */}
                <Card id="security" className="bg-white/5 border-white/10 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl text-white">Security</CardTitle>
                    </div>
                    <CardDescription className="text-gray-400">Manage your account security settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-white/5 border border-white/5">
                        <div className="flex-grow">
                          <div className="flex items-center">
                            <Lock className="h-5 w-5 mr-3 text-gray-500" />
                            <h3 className="text-sm font-medium text-gray-300">Password</h3>
                          </div>
                          <p className="text-gray-400 text-sm mt-1 ml-8">Last changed never</p>
                        </div>
                        <Button variant="outline" size="sm" className="mt-3 sm:mt-0 border-gray-700 bg-white/5 hover:bg-white/10 text-white">
                          Change Password
                        </Button>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-white/5 border border-white/5">
                        <div className="flex-grow">
                          <div className="flex items-center">
                            <Key className="h-5 w-5 mr-3 text-gray-500" />
                            <h3 className="text-sm font-medium text-gray-300">Two-Factor Authentication</h3>
                          </div>
                          <p className="text-gray-400 text-sm mt-1 ml-8">Add an extra layer of security to your account</p>
                        </div>
                        <Button variant="outline" size="sm" className="mt-3 sm:mt-0 border-gray-700 bg-white/5 hover:bg-white/10 text-white">
                          Enable
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Billing Section */}
                <Card id="billing" className="bg-white/5 border-white/10 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl text-white">Subscription</CardTitle>
                    </div>
                    <CardDescription className="text-gray-400">Manage your subscription and operations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingSubscription ? (
                      <div className="flex justify-center py-8">
                        <div className="flex flex-col items-center">
                          <Loader2 className="h-8 w-8 mb-2 animate-spin text-brand-green" />
                          <p className="text-gray-400">Loading subscription data...</p>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-6 border rounded-lg bg-gradient-to-r 
                        ${subscription?.plan_name === "Free Plan" ? "border-gray-600/20 from-gray-700/10" : 
                         subscription?.plan_name === "Basic Plan" ? "border-teal-600/20 from-teal-700/10" : 
                         "border-purple-600/20 from-purple-700/10"} to-transparent`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge className={
                              subscription?.plan_name === "Free Plan" ? "bg-gray-600/20 text-gray-400 border-0 mb-2" :
                              subscription?.plan_name === "Basic Plan" ? "bg-teal-600/20 text-teal-400 border-0 mb-2" :
                              "bg-purple-600/20 text-purple-400 border-0 mb-2"
                            }>
                              Current Plan
                            </Badge>
                            <h3 className="text-lg font-medium text-white">{subscription?.plan_name || "Free Plan"}</h3>
                            <p className="text-gray-400 mt-1 text-sm">
                              {subscription?.current_period_end ? 
                                `Renews on ${subscription.current_period_end}` : 
                                subscription?.plan_name !== "Free Plan" ? 
                                  "Active subscription" : "Limited features"}
                            </p>
                          </div>
                          <Link to="/#pricing">
                            <Button className="bg-brand-green hover:bg-green-600 text-white">
                              {subscription?.plan_name === "Free Plan" ? "Upgrade Plan" : "Manage Plan"}
                            </Button>
                          </Link>
                        </div>
                        
                        <div className="mt-6 pt-6 border-t border-white/10">
                          <h4 className="text-sm font-medium text-gray-300 mb-3">Operations Usage:</h4>
                          <div className="mb-3">
                            <div className="flex justify-between mb-1">
                              <span className="text-sm text-gray-400">
                                {subscription?.operations_used || 0} of {subscription?.operations_limit || 1} operations used
                              </span>
                              <span className="text-sm text-gray-400">
                                {Math.min(100, Math.round((subscription?.operations_used || 0) / (subscription?.operations_limit || 1) * 100))}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  subscription?.plan_name === "Free Plan" ? "bg-gray-500" :
                                  subscription?.plan_name === "Basic Plan" ? "bg-teal-500" :
                                  "bg-purple-500"
                                }`}
                                style={{ 
                                  width: `${Math.min(100, (subscription?.operations_used || 0) / (subscription?.operations_limit || 1) * 100)}%`
                                }}
                              ></div>
                            </div>
                          </div>

                          <h4 className="text-sm font-medium text-gray-300 mb-3">Plan Includes:</h4>
                          <ul className="space-y-2">
                            <li className="flex items-start">
                              <Check className="h-5 w-5 mr-2 text-brand-green flex-shrink-0 mt-0.5" />
                              <span className="text-gray-300">
                                {subscription?.plan_name === "Free Plan" ? "1 upload per day" :
                                 subscription?.plan_name === "Basic Plan" ? "100 operations per month" :
                                 "500 operations per month"}
                              </span>
                            </li>
                            <li className="flex items-start">
                              <Check className="h-5 w-5 mr-2 text-brand-green flex-shrink-0 mt-0.5" />
                              <span className="text-gray-300">
                                {subscription?.plan_name === "Free Plan" ? "Basic analysis features" :
                                 subscription?.plan_name === "Basic Plan" ? "Standard analysis features" :
                                 "Advanced analysis features"}
                              </span>
                            </li>
                            <li className="flex items-start">
                              <Check className="h-5 w-5 mr-2 text-brand-green flex-shrink-0 mt-0.5" />
                              <span className="text-gray-300">
                                {subscription?.plan_name === "Free Plan" ? "Community support" :
                                 subscription?.plan_name === "Basic Plan" ? "Email support" :
                                 "Priority support"}
                              </span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        )}
      </div>
      <Toaster />
    </div>
  );
};

export default ProfilePage; 