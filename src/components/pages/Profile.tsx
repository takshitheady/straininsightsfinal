import React, { useState, useEffect } from "react";
import { useAuth } from "../../../supabase/auth";
import { supabase } from "../../../supabase/supabase";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { initiateCheckout } from "../../lib/stripeUtils";
import { useToast } from "../ui/use-toast";
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
  Crown,
  Star,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const { toast } = useToast();
  
  // Stripe Price IDs
  const PRICE_IDS = {
    basic: "price_1RTkaDDa07Wwp5KNnZF36GsC",
    pro: "price_1RTka9Da07Wwp5KNiRxFGnsG"
  };

  // Plan features
  const PLAN_FEATURES = {
    basic: ["30 Generations/Month", "1 GB Storage", "Basic Authentication"],
    pro: ["100 Generations/Month", "2 GB Storage", "Authentication + Latest Improvements", "Community Support"]
  };

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

  // Handle plan selection
  const handlePlanSelection = (planType: 'basic' | 'pro') => {
    if (!user) return;
    
    setShowPlanSelector(false);
    
    initiateCheckout({
      priceId: PRICE_IDS[planType],
      user,
      supabase,
      toast,
      setIsLoading: setIsProcessing,
      setError,
      setProcessingPlanId,
      returnUrlPath: '/profile'
    });
  };

  // Handle billing management
  const handleManageBilling = () => {
    if (!subscription || !user) return;
    
    const currentPlan = subscription.plan_name;
    
    if (currentPlan === "Free Plan") {
      // Free users can choose Basic or Pro
      setShowPlanSelector(true);
    } else if (currentPlan === "Basic Plan") {
      // Basic users can upgrade to Pro or manage current plan
      setShowPlanSelector(true);
    } else if (currentPlan === "Pro Plan") {
      // Pro users can renew Pro or downgrade to Basic
      setShowPlanSelector(true);
    } else {
      // For any other plans, open Stripe Customer Portal (when implemented)
      console.log("Opening Stripe Customer Portal for paid user");
      toast({
        title: "Coming Soon",
        description: "Customer portal integration is in development.",
        variant: "default",
      });
    }
  };

  // Fetch user subscription data
  useEffect(() => {
    const fetchSubscriptionData = async () => {
      if (!user) return;

      setLoadingSubscription(true);
      try {
        // 1. Get user data (including current plan ID, usage, and limit)
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('current_plan_id, generations_used, generation_limit')
          .eq('user_id', user.id)
          .single();

        if (userError) throw userError;
        if (!userData) throw new Error("User data not found.");

        const currentPlanId = userData.current_plan_id;
        const generationsUsed = userData.generations_used ?? 0;
        // Get limit directly from user data
        const operationsLimit = userData.generation_limit ?? 1; // Use the limit from users table

        // --- Determine Plan Name from Plan ID ---
        let planName = "Free Plan"; // Default
        if (currentPlanId === 'pro') {
            planName = "Pro Plan";
        } else if (currentPlanId === 'basic') { // Add other plan IDs as needed
            planName = "Basic Plan";
        } else if (currentPlanId === 'free') {
            planName = "Free Plan";
        } else if (currentPlanId) {
            // Handle potential unknown plan IDs if necessary
            planName = currentPlanId; // Or "Unknown Plan"
        }
        // --- End Determine Plan Name ---


        let subscriptionStatus = "active"; // Default status
        let currentPeriodEnd = undefined;

        // 2. Fetch Subscription Status (only for paid plans, not free plan)
        if (currentPlanId && currentPlanId !== 'free') { // Only check for subscription if NOT on free plan
            const { data: subscriptionData, error: subscriptionError } = await supabase
                .from('subscriptions')
                .select('status, current_period_end') // Fetch status and end date
                .eq('user_id', user.id) // Link by user_id ONLY
                .order('created_at', { ascending: false }) // Get the latest subscription for this user
                .maybeSingle(); // Use maybeSingle as user might have cancelled etc.

           if (subscriptionError) {
               console.warn(`Could not fetch subscription status: ${subscriptionError.message}. Assuming 'active'.`);
               // Keep default 'active' status if fetch fails
           } else if (subscriptionData) {
               subscriptionStatus = subscriptionData.status || 'inactive'; // Use fetched status
                if (subscriptionData.current_period_end) {
                    // Format Unix timestamp (assuming it's in seconds)
                   currentPeriodEnd = new Date(subscriptionData.current_period_end * 1000).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric'});
                }
           } else {
                // No subscription record found for paid plan - this means cancelled or expired
                subscriptionStatus = 'inactive';
           }
        } else {
            // User is on free plan, status should be 'inactive' to encourage upgrades
            subscriptionStatus = 'inactive';
        }


        // 3. Set the state
        setSubscription({
          plan_name: planName, // Name derived from plan ID
          operations_limit: operationsLimit, // Limit from users table
          operations_used: generationsUsed, // Usage from users table
          subscription_status: subscriptionStatus, // Status from subscriptions table (or default)
          current_period_end: currentPeriodEnd,
        });

      } catch (error) {
        console.error("Error fetching subscription data:", error);
        setSubscription({
           plan_name: "Error",
           operations_limit: 0,
           operations_used: 0,
           subscription_status: "error",
           current_period_end: undefined,
         });
      } finally {
        setLoadingSubscription(false);
      }
    };

    fetchSubscriptionData();
  }, [user]); // Dependency array

  // Plan Selector Dialog Component
  const PlanSelectorDialog = () => {
    if (!subscription) return null;
    
    const currentPlan = subscription.plan_name;
    const isBasicUser = currentPlan === "Basic Plan";
    const isProUser = currentPlan === "Pro Plan";
    const isFreeUser = currentPlan === "Free Plan";

    return (
      <Dialog open={showPlanSelector} onOpenChange={setShowPlanSelector}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              {isFreeUser && "Choose Your Plan"}
              {isBasicUser && "Manage Your Plan"}
              {isProUser && "Manage Your Plan"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {isFreeUser && "Select a plan to unlock more features and increase your generation limits."}
              {isBasicUser && "Renew your current Basic plan or upgrade to Pro for enhanced features."}
              {isProUser && "Renew your Pro plan or switch to Basic if needed."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Basic Plan Card */}
            {(isFreeUser || isBasicUser || isProUser) && (
              <Card className={`bg-white/5 border ${isBasicUser ? 'border-blue-400/50' : 'border-white/10'} hover:border-white/20 transition-colors ${isBasicUser ? 'relative' : ''}`}>
                {isBasicUser && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white font-semibold px-3 py-1">
                      Current Plan
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-white flex items-center">
                      <Shield className="h-5 w-5 mr-2 text-blue-400" />
                      Basic Plan
                    </CardTitle>
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-white">$39</span>
                    <span className="text-gray-400 ml-1">/month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {PLAN_FEATURES.basic.map((feature, index) => (
                      <li key={index} className="flex items-start text-sm text-gray-300">
                        <Check className="h-4 w-4 mr-2.5 flex-shrink-0 mt-0.5 text-green-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => handlePlanSelection('basic')}
                    disabled={isProcessing}
                  >
                    {isProcessing && processingPlanId === PRICE_IDS.basic ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      isBasicUser ? "Renew Basic Plan" :
                      isProUser ? "Switch to Basic" : "Choose Basic"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Pro Plan Card */}
            <Card className="bg-white/5 border border-brand-green/50 hover:border-brand-green transition-colors relative">
              {!isProUser && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-brand-green text-black font-semibold px-3 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    RECOMMENDED
                  </Badge>
                </div>
              )}
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-white flex items-center">
                    <Crown className="h-5 w-5 mr-2 text-brand-green" />
                    Pro Plan
                  </CardTitle>
                  {isProUser && <Badge className="bg-brand-green text-black">Current</Badge>}
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-white">$99</span>
                  <span className="text-gray-400 ml-1">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {PLAN_FEATURES.pro.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm text-gray-300">
                      <Check className="h-4 w-4 mr-2.5 flex-shrink-0 mt-0.5 text-brand-green" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full bg-brand-green hover:bg-green-600 text-black font-semibold"
                  onClick={() => handlePlanSelection('pro')}
                  disabled={isProcessing}
                >
                  {isProcessing && processingPlanId === PRICE_IDS.pro ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    isProUser ? "Renew Pro Plan" : 
                    isBasicUser ? "Upgrade to Pro" : "Choose Pro"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

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
              src="/straininsightslogo.png"
              alt="StrainInsights Logo"
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
      <main className="container mx-auto px-4 py-12 md:py-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto"
        >
          {loading || loadingSubscription ? (
            <div className="flex justify-center items-center min-h-[300px]">
              <Loader2 className="h-12 w-12 text-brand-green animate-spin" />
            </div>
          ) : user && subscription ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Left Column - User Info & Subscription */}
              <div className="md:col-span-2 space-y-8">
                {/* Account Overview Card */}
                 <motion.div variants={fadeIn}>
                    <Card className="bg-white/5 border border-white/10 shadow-lg backdrop-blur-sm overflow-hidden">
                       <CardHeader className="flex flex-row items-center space-x-4 p-6">
                        <Avatar className="h-16 w-16 ring-2 ring-brand-green/50">
                          <AvatarImage
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                            alt={user.email || "User Avatar"}
                          />
                          <AvatarFallback className="bg-gray-700 text-white text-xl">
                            {user.email?.[0].toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-xl font-semibold text-white">
                            {user.email || "Your Account"}
                          </CardTitle>
                          <CardDescription className="text-gray-400 flex items-center mt-1">
                            <Calendar className="h-4 w-4 mr-1.5" />
                            Member since {formatCreationDate(user.created_at)}
                          </CardDescription>
                        </div>
                      </CardHeader>
                    </Card>
                  </motion.div>

                {/* Subscription Details Card - UPDATED */}
                <motion.div variants={fadeIn}>
                  <Card className="bg-white/5 border border-white/10 shadow-lg backdrop-blur-sm overflow-hidden">
                     <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-medium text-white flex items-center">
                        <CreditCard className="h-5 w-5 mr-2 text-brand-green" />
                        Subscription Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0 pb-6 px-6">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Current Plan</span>
                        <span className="text-white font-medium">{subscription.plan_name}</span>
                      </div>
                      <Separator className="bg-white/10" />
                       <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">Operations Remaining</span>
                          <span className="text-white font-medium">
                            {/* Calculate Remaining Operations */}
                            {Math.max(0, subscription.operations_limit - subscription.operations_used)}
                            <span className="text-gray-500 text-xs ml-1">
                              ({subscription.operations_used} / {subscription.operations_limit})
                            </span>
                          </span>
                        </div>
                      <Separator className="bg-white/10" />
                       <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">Account Status</span>
                           <Badge
                              variant={subscription.subscription_status === 'active' ? 'default' : subscription.subscription_status === 'canceled' || subscription.subscription_status === 'error' || subscription.subscription_status === 'incomplete' || subscription.subscription_status === 'past_due' ? 'destructive' : 'secondary'}
                              className="capitalize"
                          >
                              {subscription.subscription_status}
                          </Badge>
                        </div>
                      {subscription.current_period_end && (
                        <>
                          <Separator className="bg-white/10" />
                           <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">Billing Cycle End</span>
                              <span className="text-white font-medium">{subscription.current_period_end}</span>
                            </div>
                        </>
                      )}
                    </CardContent>
                     <CardFooter className="bg-white/5 border-t border-white/10 px-6 py-4">
                        <Button
                           variant="outline"
                           className={`w-full text-brand-green border-brand-green/50 hover:bg-brand-green/10 hover:text-brand-green ${
                             subscription && subscription.operations_used >= subscription.operations_limit 
                               ? 'animate-pulse ring-2 ring-brand-green/50 bg-brand-green/10 shadow-lg shadow-brand-green/25' 
                               : ''
                           }`}
                            onClick={handleManageBilling}
                            disabled={isProcessing}
                         >
                            {isProcessing ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              subscription && subscription.operations_used >= subscription.operations_limit 
                                ? "Upgrade Plan - No Generations Left!" 
                                : "Manage Billing"
                            )}
                          </Button>
                      </CardFooter>
                  </Card>
                </motion.div>

               {/* Security Card and Team Access Card were here - REMOVED */}

              </div> {/* <<< Closing div for md:col-span-2 */} 

              {/* Right Column - Quick Actions/Settings */} 
              <div className="md:col-span-1 space-y-6"> 
                 <motion.div variants={fadeIn}> 
                   <Card className="bg-white/5 border border-white/10 shadow-lg backdrop-blur-sm"> 
                      <CardHeader> 
                          <CardTitle className="text-base font-medium text-white flex items-center"> 
                              <Settings className="h-4 w-4 mr-2 text-gray-400"/> 
                              Quick Actions 
                          </CardTitle> 
                      </CardHeader> 
                      <CardContent className="flex flex-col space-y-2"> 
                         {/* ... (Quick Action Buttons - unchanged) ... */} 
                         <Button variant="ghost" className="justify-start text-gray-300 hover:text-white hover:bg-white/10">
                              <Edit className="h-4 w-4 mr-2"/> Edit Profile (Coming Soon)
                          </Button>
                          <Link to="/output-history">
                            <Button variant="ghost" className="justify-start text-gray-300 hover:text-white hover:bg-white/10 w-full">
                                <History className="h-4 w-4 mr-2"/> View Generation History
                            </Button>
                          </Link>
                          <Separator className="bg-white/10 my-2" />
                         <Button variant="ghost" className="justify-start text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={() => signOut()}>
                              <LogOut className="h-4 w-4 mr-2"/> Log Out
                          </Button>
                      </CardContent> 
                    </Card> 
                  </motion.div> 
              </div> {/* <<< Closing div for md:col-span-1 */} 
            </div> /* <<< Closing div for the grid */ 
          ) : ( 
            <motion.div variants={fadeIn} className="text-center py-20"> 
              {/* ... (Login prompt - unchanged) ... */}
              <p className="text-gray-400 mb-4">Please log in to view your profile.</p>
              <Link to="/login">
                <Button className="bg-brand-green text-white hover:bg-green-600">Go to Login</Button>
              </Link>
            </motion.div> 
          )} 
        </motion.div> {/* <<< Closing motion.div */} 
      </main> 
      <Toaster /> 
      <PlanSelectorDialog />
    </div> 
  ); 
}; 
 
export default ProfilePage; 