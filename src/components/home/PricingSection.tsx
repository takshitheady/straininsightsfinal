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
  [key: string]: any;
}

export default function PricingSection() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      // Use the Supabase client to call the Edge Function
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-get-plans",
      );

      if (error) {
        throw error;
      }

      setPlans(data || []);
      setError("");
    } catch (error) {
      console.error("Failed to fetch plans:", error);
      setError("Failed to load plans. Please try again later.");
    }
  };

  // Handle checkout process
  const handleCheckout = async (priceId: string) => {
    if (!user) {
      // Redirect to login if user is not authenticated
      toast({
        title: "Authentication required",
        description: "Please sign in to subscribe to a plan.",
        variant: "default",
      });
      window.location.href = "/login?redirect=pricing";
      return;
    }

    setIsLoading(true);
    setProcessingPlanId(priceId);
    setError("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-create-checkout",
        {
          body: {
            price_id: priceId,
            user_id: user.id,
            return_url: `${window.location.origin}/dashboard`,
          },
          headers: {
            "X-Customer-Email": user.email || "",
          },
        },
      );

      if (error) {
        throw error;
      }

      // Redirect to Stripe checkout
      if (data?.url) {
        toast({
          title: "Redirecting to checkout",
          description:
            "You'll be redirected to Stripe to complete your purchase.",
          variant: "default",
        });
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      setError("Failed to create checkout session. Please try again.");
      toast({
        title: "Checkout failed",
        description:
          "There was an error creating your checkout session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setProcessingPlanId(null);
    }
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

  // Plan features
  const getPlanFeatures = (planType: string) => {
    const basicFeatures = [
      "Core application features",
      "Basic authentication",
      "1GB storage",
      "Community support",
    ];

    const proFeatures = [
      ...basicFeatures,
      "Advanced analytics",
      "Priority support",
      "10GB storage",
      "Custom branding",
    ];

    const enterpriseFeatures = [
      ...proFeatures,
      "Dedicated account manager",
      "Custom integrations",
      "Unlimited storage",
      "SLA guarantees",
    ];

    if (planType.includes("PRO")) return proFeatures;
    if (planType.includes("ENTERPRISE")) return enterpriseFeatures;
    return basicFeatures;
  };

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-gray-200 text-gray-800 hover:bg-gray-300 border-none">
            Pricing
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-black">
            Simple, Transparent Pricing
          </h2>
          <p className="text-gray-600 max-w-[700px] mx-auto">
            Choose the perfect plan for your needs. All plans include access to
            our core features. No hidden fees or surprises.
          </p>
        </div>

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="flex flex-col h-full border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-lg hover:shadow-xl transition-all"
            >
              <CardHeader className="pb-4">
                <CardDescription className="text-sm text-gray-600">
                  {plan.interval_count === 1
                    ? "Monthly"
                    : `Every ${plan.interval_count} ${plan.interval}s`}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-black">
                    {formatCurrency(plan.amount, plan.currency)}
                  </span>
                  <span className="text-gray-600">/{plan.interval}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <Separator className="my-4 bg-gray-200" />
                <ul className="space-y-3">
                  {getPlanFeatures(plan.product).map((feature, index) => (
                    <li key={index} className="flex items-start text-gray-700">
                      <CheckCircle2 className="h-5 w-5 text-black mr-2 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full bg-black text-white hover:bg-gray-800"
                  onClick={() => handleCheckout(plan.id)}
                  disabled={isLoading}
                >
                  {isLoading && processingPlanId === plan.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Subscribe Now
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
