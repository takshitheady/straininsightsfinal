import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, ChevronRight, Loader2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../../../supabase/auth";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";
import { initiateCheckout } from "@/lib/stripeUtils"; // Import the new function

// Define the Plan type
interface Plan {
  id: string;
  object: string;
  active: boolean;
  amount: number;
  currency: string;
  interval: string;
  interval_count: number;
  product: string;
  created: number;
  livemode: boolean;
  nickname?: string;
  [key: string]: any;
}

// Props for the PricingSection component
interface PricingSectionProps {
  title?: string;
  subtitle?: string;
  plansToShow?: string[]; // Array of Stripe Price IDs to display (optional)
  planFeatures?: Record<string, string[]>; // Map Price ID to features array (optional)
  theme?: 'light' | 'dark'; // Optional theme prop
  checkoutFunction?: typeof initiateCheckout; // Allow passing the checkout function
  excludePlanId?: string; // <<< Add new optional prop
}

// Custom plan names mapping - SC9FWWIFZ7QDCM, SC9FJQGAEZLGH5
const planNames = {
  'SC9FWWIFZ7QDCM': 'Premium Plan',
  'SC9FJQGAEZLGH5': 'Basic Plan'
};

// Updated default features with the new requested items
const defaultPlanFeatures = {
  basic: [
    "100 Generations/Month",
    "1 GB Storage",
    "Basic Authentication"
  ],
  pro: [
    "500 Generations/Month",
    "2 GB Storage",
    "Authentication + Latest Improvements",
    "Community Support"
  ],
  enterprise: [
    "All Pro features",
    "Dedicated support",
    "Custom integrations",
    "SLA guarantees",
  ],
};

export default function PricingSection({
  title = "Simple, Transparent Pricing",
  subtitle = "Choose the perfect plan for your needs. All plans include access to our core features. No hidden fees or surprises.",
  plansToShow,
  planFeatures: overridePlanFeatures, // Rename prop for clarity
  theme = 'light', // Default to light theme
  checkoutFunction = initiateCheckout, // Use imported function by default
  excludePlanId // <<< Destructure the new prop
}: PricingSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [allPlans, setAllPlans] = useState<Plan[]>([]); // Store all fetched plans
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setIsLoading(true); // Set loading true for fetching plans
    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-get-plans",
      );
      if (error) throw error;
      console.log("Plans data in PricingSection:", data);
      setAllPlans(data || []);
      setError("");
    } catch (error) {
      console.error("Failed to fetch plans:", error);
      setError("Failed to load plans. Please try again later.");
    } finally {
      setIsLoading(false); // Set loading false after fetching plans
    }
  };

  // --- Updated Filtering Logic --- 
  const displayedPlans = allPlans.filter(plan => {
    // Condition 1: Must not be the excluded plan ID
    const isExcluded = excludePlanId && plan.id === excludePlanId;
    if (isExcluded) return false;

    // Condition 2: If plansToShow is provided, it must be in that list
    const includedInShowList = !plansToShow || plansToShow.includes(plan.id);
    return includedInShowList;
  });
  // --- End Updated Filtering Logic --- 

  // Use passed checkout function
  const handleCheckout = (priceId: string) => {
    checkoutFunction({
      priceId,
      user,
      supabase,
      toast,
      setIsLoading, // Pass state setters for button state
      setError,
      setProcessingPlanId,
      // Default return path is /profile in initiateCheckout
    });
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    });

    return formatter.format(amount / 100);
  };

  // Determine features to display
  const getFeaturesForPlan = (planId: string, planProduct: string) => {
    // Prioritize override features if provided
    if (overridePlanFeatures && overridePlanFeatures[planId]) {
      return overridePlanFeatures[planId];
    }
    
    // Use price-based determination to ensure consistency
    const plan = allPlans.find(p => p.id === planId);
    if (plan?.amount === 1500) {
      return defaultPlanFeatures.basic; // $15 plan (Basic)
    } else if (plan?.amount === 3500) {
      return defaultPlanFeatures.pro; // $35 plan (Premium)
    }
    
    // For our specific plan IDs as fallback
    if (planId === 'SC9FJQGAEZLGH5') {
      return defaultPlanFeatures.basic; // Basic Plan
    } else if (planId === 'SC9FWWIFZ7QDCM') {
      return defaultPlanFeatures.pro; // Premium Plan
    }
    
    // Fallback to default features based on product name
    if (planProduct.toLowerCase().includes("enterprise")) return defaultPlanFeatures.enterprise;
    if (planProduct.toLowerCase().includes("pro")) return defaultPlanFeatures.pro;
    return defaultPlanFeatures.basic; // Default to basic
  };

  // --- Refined Theme Styles --- 
  const sectionClasses = theme === 'light' ? "bg-white text-gray-800" : "bg-transparent text-gray-300";
  // Lighter border, softer shadow for light cards
  const cardClasses = theme === 'light' ? "border border-gray-100 bg-white shadow-md hover:shadow-lg rounded-xl" : "bg-white/5 backdrop-blur-sm border border-white/10 shadow-xl hover:border-white/20 rounded-lg"; 
  // Slightly softer title black for light theme
  const titleClasses = theme === 'light' ? "text-gray-900" : "text-white"; 
  const subtitleClasses = theme === 'light' ? "text-gray-500" : "text-gray-400"; 
  const featureTextClasses = theme === 'light' ? "text-gray-700" : "text-gray-300";
  // Use brand green for checkmarks in light theme
  const featureIconClasses = theme === 'light' ? "text-brand-green" : "text-brand-green"; 
  // Lighter separator for light theme
  const separatorClasses = theme === 'light' ? "bg-gray-100" : "bg-white/10"; 
  
  // Modernized Button Styles for Light Theme
  const buttonClasses = (planId: string) => {
    const plan = allPlans.find(p => p.id === planId);
    const isPro = plan?.product.toLowerCase().includes('pro'); // Check if it's the Pro plan (adjust if needed)

    if (theme === 'light') {
      // Primary button (Pro plan): Brand green
      if (isPro) {
        return "bg-brand-green text-white hover:bg-green-600 shadow-sm hover:shadow-md";
      }
      // Secondary button (Other plans): Light gray / subtle
      return "bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200 shadow-sm";
    } else {
      // Keep existing dark theme logic (or refine if needed)
      return isPro 
        ? 'bg-brand-green text-white hover:bg-green-600 shadow-lg hover:shadow-brand-green/30' 
        : 'bg-white/10 text-white hover:bg-white/20';
    }
  };
  // --- End Refined Theme Styles --- 

  return (
    // Removed outer py- padding, let the dialog handle padding
    <section className={`${sectionClasses}`}>
      {/* Removed container and text-center block, assuming dialog provides structure */}
      {/* 
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
          <h2 className={`text-3xl md:text-4xl font-bold tracking-tight mb-4 ${titleClasses}`}>
            {title} 
          </h2>
          <p className={`max-w-[700px] mx-auto ${subtitleClasses}`}>
            {subtitle}
          </p>
        </div>
      */}

        {error && (
          <div
            className="bg-red-100 border border-red-200 text-red-800 px-4 py-3 rounded relative mb-6"
            role="alert"
          >
            <span className="block sm:inline">{error}</span>
            <button
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
              onClick={() => setError("")}
            >
              <span className="sr-only">Dismiss</span>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {isLoading && displayedPlans.length === 0 && (
            <div className="flex justify-center items-center h-40">
                <Loader2 className={`h-8 w-8 animate-spin ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`} />
            </div>
        )}

        {!isLoading && displayedPlans.length === 0 && !error && (
             <p className={`text-center ${subtitleClasses}`}>No pricing plans available at this time.</p>
        )}

        {/* Adjusted grid columns for dialog context (often looks better with fewer cols) */} 
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayedPlans.map((plan) => (
            <Card
              key={plan.id}
              // Added rounded-xl to match common dialog styles
              className={`flex flex-col h-full transition-all ${cardClasses}`}>
              <CardHeader className="pb-4 pt-6 px-6">
                <CardDescription className={`text-sm font-medium ${subtitleClasses}`}>
                  {/* Use price-based determination for plan names */}
                  {plan.amount === 1500 ? "Basic Plan" : plan.amount === 3500 ? "Premium Plan" : planNames[plan.id] || plan.nickname || plan.product?.split('_').pop()?.replace(' Plan', '').toUpperCase() || 'Plan'}
                </CardDescription>
                <div className="mt-2">
                  <span className={`text-4xl font-bold ${titleClasses}`}>
                    {formatCurrency(plan.amount, plan.currency)}
                  </span>
                  <span className={`text-sm ml-1 ${subtitleClasses}`}>/{plan.interval}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-grow px-6">
                <Separator className={`my-4 ${separatorClasses}`} />
                <ul className="space-y-3">
                  {getFeaturesForPlan(plan.id, plan.product).map((feature, index) => (
                    <li key={index} className={`flex items-start text-sm ${featureTextClasses}`}>
                      <CheckCircle2 className={`h-4 w-4 mr-2.5 flex-shrink-0 mt-0.5 ${featureIconClasses}`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="px-6 pb-6 mt-4">
                <Button
                  className={`w-full font-semibold py-3 rounded-lg ${buttonClasses(plan.id)}`}
                  onClick={() => handleCheckout(plan.id)}
                  disabled={isLoading || (processingPlanId !== null && processingPlanId !== plan.id)}
                >
                  {isLoading && processingPlanId === plan.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                     // Simple button text 
                    'Choose Plan' 
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      {/* Removed closing container div */}
      {/* </div> */}
    </section>
  );
}
