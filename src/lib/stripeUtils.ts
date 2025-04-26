import { SupabaseClient, User } from '@supabase/supabase-js';

// Define the shape of the arguments for the function
interface InitiateCheckoutArgs {
  priceId: string;
  user: User | null;
  supabase: SupabaseClient;
  toast: (options: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setProcessingPlanId: (planId: string | null) => void;
  returnUrlPath?: string; // Optional custom return path
}

/**
 * Initiates the Stripe checkout process by calling a Supabase Edge Function.
 */
export const initiateCheckout = async ({
  priceId,
  user,
  supabase,
  toast,
  setIsLoading,
  setError,
  setProcessingPlanId,
  returnUrlPath = '/profile' // Changed default from '/dashboard' to '/profile'
}: InitiateCheckoutArgs) => {
  if (!user) {
    toast({
      title: "Authentication required",
      description: "Please sign in to subscribe to a plan.",
      variant: "default", // Or destructive?
    });
    // Consider redirecting to login here if needed, passing the current path
    // window.location.href = `/login?redirect=${window.location.pathname}`;
    return;
  }

  setIsLoading(true);
  setProcessingPlanId(priceId);
  setError("");

  try {
    // Use the specific Edge Function name used in PricingSection
    const { data, error: functionError } = await supabase.functions.invoke(
      "supabase-functions-create-checkout",
      {
        body: {
          price_id: priceId,
          user_id: user.id,
          return_url: `${window.location.origin}${returnUrlPath}`, // Use dynamic return URL
        },
        // Include email in headers if your function expects it
        headers: {
          "X-Customer-Email": user.email || "",
        },
      }
    );

    if (functionError) {
      throw functionError;
    }

    // Redirect to Stripe checkout URL
    if (data?.url) {
      toast({
        title: "Redirecting to checkout...",
        description: "Please complete your purchase with Stripe.",
        variant: "default",
      });
      window.location.href = data.url;
    } else {
      throw new Error("No checkout URL returned from the function.");
    }
    // No need to setIsLoading(false) here as the page will redirect

  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    const errorMessage = error.message || "Failed to create checkout session. Please try again.";
    setError(errorMessage);
    toast({
      title: "Checkout Error",
      description: errorMessage,
      variant: "destructive",
    });
    // Reset loading states on error
    setIsLoading(false);
    setProcessingPlanId(null);
  }
}; 