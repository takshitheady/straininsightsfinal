import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  User,
  Shield,
  Database,
  Code,
  CheckCircle2,
  ArrowRight,
  Star,
  ChevronRight,
  Github,
  Loader2,
  Twitter,
  Instagram,
  X,
  UploadCloud,
  FileCheck,
  TrendingUp,
  FlaskConical,
  Clock,
  BarChart,
  DollarSign,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../supabase/auth";
import { useEffect, useState } from "react";
import { supabase } from "../../../supabase/supabase";
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
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { motion, AnimatePresence } from "framer-motion";

// Define the Plan type
interface Plan {
  id: string;
  object: string;
  active: boolean;
  amount: number;
  currency: string;
  interval: string;
  interval_count: number;
  product: { // Product is now an object due to expand in Edge Function
    id: string;
    name: string;
    metadata?: Record<string, any>; 
    [key: string]: any; 
  } | string; // Or string as fallback
  created: number;
  livemode: boolean;
  [key: string]: any;
}

// Testimonial interface
interface Testimonial {
  id: number;
  name: string;
  role: string;
  company: string;
  content: string;
  avatar: string;
}

// Feature interface
interface Feature {
  title: string;
  description: string;
  icon: JSX.Element;
}

// New interface for Hero Stats
interface HeroStat {
  title: string;
  value: string;
  comparison: string;
  imageSrc: string; // New field for image source
}

// Animation Variants for Framer Motion
const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 1 }, // Container itself doesn't fade
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15, // Time delay between children animating
    },
  },
};

const slideInLeft = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

const slideInRight = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
};

// Add this function at the top level, after the interfaces but before the component
const CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export default function LandingPage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0); // State for carousel

  // Custom plan names mapping - this can be a fallback or removed
  const planNames = {
    'SC9FWWIFZ7QDCM': 'Premium Plan', // Example new Premium ID (if different from Stripe product name)
    'SC9FJQGAEZLGH5': 'Basic Plan',    // Example new Basic ID (if different from Stripe product name)
    'price_1RRwv8DCXlQWdJgdtLj4Xjlr': 'Basic Plan', // Current $39 Price ID
    'price_1RRwuODCXlQWdJgd5P6bAID9': 'Premium Plan', // Current $99 Price ID
    // Adding old IDs as requested by user for home.tsx display
    'PRICE_1RHLLPDCXLQWDJGDS7S5K7O7': 'Basic Plan', 
    'PRICE_1RHLMCDCXLQWDJGDVON9UQZP': 'Premium Plan'
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      // Check if we have cached pricing data
      const cachedData = localStorage.getItem('pricingPlans');
      const cachedTimestamp = localStorage.getItem('pricingPlansTimestamp');
      
      if (cachedData && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp);
        const now = Date.now();
        
        // If the cache is still valid (less than 24 hours old)
        if (now - timestamp < CACHE_EXPIRY_TIME) {
          const parsedData = JSON.parse(cachedData);
          setPlans(parsedData);
          console.log("Plans from cache:", parsedData);
          setIsLoading(false);
          return;
        }
      }
      
      // Cache miss or expired, fetch from API
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-get-plans",
      );

      if (error) {
        throw error;
      }

      // Cache the results
      if (data) {
        console.log("Plans from API:", data);
        localStorage.setItem('pricingPlans', JSON.stringify(data));
        localStorage.setItem('pricingPlansTimestamp', Date.now().toString());
      }

      setPlans(data || []);
      setError("");
    } catch (error) {
      console.error("Failed to fetch plans:", error);
      setError("Failed to load plans. Please try again later.");
    } finally {
      setIsLoading(false);
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
            return_url: `${window.location.origin}/profile`,
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

  // Updated features data to match screenshot
  const features: Feature[] = [
    {
      title: "Instant Data Extraction",
      description:
        "AI automatically pulls key data points like cannabinoids, terpenes, contaminants, and more from your COA PDFs in seconds.",
      icon: <UploadCloud className="h-8 w-8 text-brand-green" />,
    },
    {
      title: "SEO-Ready Content",
      description:
        "Generate SEO-friendly descriptions ready to use on your website, social media, and marketing materials. Boost your online presence instantly.",
      icon: <FileCheck className="h-8 w-8 text-brand-green" />,
    },
    {
      title: "Unlock Insights",
      description:
        "Analyze trends across batches, suppliers, and strains. Optimize your products and processes with actionable data.",
      icon: <TrendingUp className="h-8 w-8 text-brand-green" />,
    },
  ];

  // New data for Hero statistics cards
  const heroStats: HeroStat[] = [
    {
      title: "Accuracy Improvement",
      value: "99.5%",
      comparison: "↑ vs Manual Entry",
      imageSrc: "/accuracyimage.png",
    },
    {
      title: "Time Saved per COA",
      value: "5 mins",
      comparison: "↑ Average User",
      imageSrc: "/timeimage.png",
    },
    {
      title: "SEO Engagement Boost",
      value: "75%",
      comparison: "↑ Click-Through Rate",
      imageSrc: "/seoimage.png",
    },
  ];

  // useEffect for auto-sliding carousel
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentHeroSlide((prevSlide) =>
        prevSlide === heroStats.length - 1 ? 0 : prevSlide + 1
      );
    }, 5000); // Change slide every 5 seconds
    return () => clearTimeout(timer);
  }, [currentHeroSlide, heroStats.length]);

  // Sample testimonials data
  const testimonials: Testimonial[] = [
    {
      id: 1,
      name: "Alex Chen",
      role: "Marketing Lead",
      company: "GreenLeaf Marketing",
      content:
        "StrainInsights has been a game-changer for our content team. We used to spend hours manually pulling data from COAs for website updates. Now, we get accurate, ready-to-post descriptions in minutes!",
      avatar: "alex", // Keep avatar or update if new ones are provided
    },
    {
      id: 2,
      name: "Maria Rodriguez",
      role: "Dispensary Owner",
      company: "BuddingSuccess Retail",
      content:
        "Keeping our online product listings fresh and informative was a constant struggle with PDF COAs. StrainInsights transformed that. The ability to generate website-ready content directly is a huge time saver and boosts our SEO.",
      avatar: "maria",
    },
    {
      id: 3,
      name: "Samira Khan",
      role: "E-commerce Manager",
      company: "CannaClicks Online",
      content:
        "The biggest hurdle for our product pages was getting consistent, detailed info from PDFs. StrainInsights automates this beautifully. Our descriptions are now richer, and we can update them so much faster.",
      avatar: "samira",
    },
  ];

  // Plan features
  const getPlanFeatures = (planType: string) => {
    // Plan features for specific plan IDs
    if (planType === 'SC9FWWIFZ7QDCM') {
      return [
        "100 Generations/Month",
        "1 GB Storage",
        "Basic Authentication"
      ];
    } else if (planType === 'SC9FJQGAEZLGH5') {
      return [
        "500 Generations/Month",
        "2 GB Storage",
        "Authentication + Latest Improvements",
        "Community Support"
      ];
    }
    
    // Default fallback features
    const basicFeatures = [
      "100 Generations/Month",
      "1 GB Storage",
      "Basic Authentication"
    ];

    const proFeatures = [
      "500 Generations/Month",
      "2 GB Storage",
      "Authentication + Latest Improvements",
      "Community Support"
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
    <div className="min-h-screen bg-brand-dark text-gray-300 font-sans">
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 50, damping: 15 }}
        className="sticky top-0 z-50 w-full h-32 border-b border-white/10 bg-brand-dark/90 backdrop-blur-md"
      >
        <div className="container mx-auto px-4 flex h-full items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img
              src="/straininsightslogo.png"
              alt="StrainInsights Logo"
              className="h-24 w-auto"
            />
          </Link>

          {/* Navigation (Optional - adapt as needed) */}
          <nav className="hidden md:flex items-center space-x-16 text-lg font-medium">
            <Link to="/upload" className="text-gray-300 hover:text-white transition-colors">Upload</Link>
            <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</a>
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
                  className="bg-brand-green text-white hover:bg-green-600 border-brand-green font-semibold text-base px-6 py-3 transition-colors shadow-lg hover:shadow-brand-green/30"
                  >
                    Sign In
                  </Button>
                </Link>
              // Optional: Add Sign Up button if needed
              // <Link to="/signup">
              //   <Button className="bg-brand-green text-white hover:bg-green-600 font-semibold">Sign Up</Button>
              // </Link>
            )}
          </div>
        </div>
      </motion.header>

      <main>
        {/* Hero Section */}
        <section className="relative py-24 md:py-32 lg:py-40 bg-brand-dark text-white overflow-hidden">
          {/* Adjusted subtle gradient overlay, avoiding blue tones */}
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-brand-dark via-brand-dark to-brand-dark/80 opacity-75"></div>
          <div className="container mx-auto px-4 z-10 relative">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left Content */}
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-8 text-center lg:text-left"
              >
                <motion.h1
                  variants={fadeIn}
                  className="font-serif font-medium text-5xl md:text-6xl lg:text-7xl tracking-tight"
                >
                  Get AI-Powered Generated Content from <span className="text-brand-green">Lab Results</span>
                </motion.h1>
                <motion.p
                  variants={fadeIn}
                  className="text-lg md:text-xl text-gray-300 leading-relaxed"
                >
                  Bring your lab result PDFs and get SEO-ready content generated instantly. Our AI is expertly trained on extracting COA data to streamline your workflow and boost your online presence.
                </motion.p>
                <motion.div variants={fadeIn} className="flex justify-center lg:justify-start">
                  <Link to="/upload">
                    <Button
                      size="lg"
                      className="bg-brand-green text-white hover:bg-green-600 font-semibold text-2xl px-12 py-6 transition-transform hover:scale-105 shadow-lg hover:shadow-brand-green/30"
                    >
                      Upload your PDF
                      <ArrowRight className="ml-3 h-7 w-7" />
                    </Button>
                  </Link>
                </motion.div>
                <motion.div
                  variants={fadeIn}
                  className="pt-6 text-sm text-gray-400"
                >
                  <span className="font-semibold uppercase tracking-wider text-white text-base">Trusted By:</span>
                  <div className="flex justify-center lg:justify-start space-x-8 mt-6 opacity-90">
                    {/* Replace with actual logos if available */}
                    <span className="text-gray-200 font-medium text-lg hover:text-white transition-colors">nuEra</span>
                    <span className="text-gray-200 font-medium text-lg hover:text-white transition-colors">RawGarden</span>
                    <span className="text-gray-200 font-medium text-lg hover:text-white transition-colors">HighHaven</span>
                    <span className="text-gray-200 font-medium text-lg hover:text-white transition-colors">Binske&Oni</span>
                  </div>
                </motion.div>
              </motion.div>

              {/* Right Metrics Cards - Now a Carousel */}
              <motion.div
                className="relative w-full max-w-sm md:max-w-md mx-auto h-[400px] md:h-[480px] overflow-hidden" // Adjusted height
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <AnimatePresence initial={false} custom={currentHeroSlide}>
                  {heroStats.map(
                    (stat, index) =>
                      index === currentHeroSlide && (
                        <motion.div
                          key={stat.title}
                          custom={currentHeroSlide}
                          initial={{ x: "100%", opacity: 0 }}
                          animate={{ x: "0%", opacity: 1 }}
                          exit={{ x: "-100%", opacity: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          className="absolute w-full h-full"
                        >
                          <Card className="h-full flex flex-col items-center justify-center p-6 bg-white/5 backdrop-blur-sm border border-white/10 shadow-xl text-center">
                            <img
                              src={stat.imageSrc}
                              alt={stat.title}
                              className="w-auto h-48 md:h-56 object-contain mb-3" // Increased image height, w-auto, reduced mb
                            />
                            <CardTitle className="text-xl md:text-2xl font-semibold text-white mb-1">
                              {stat.title}
                            </CardTitle>
                            <div className="text-3xl md:text-4xl font-bold text-brand-green mb-1">
                              {stat.value}
                            </div>
                            <p className="text-sm md:text-base text-gray-400">
                              {stat.comparison}
                            </p>
                          </Card>
                        </motion.div>
                      )
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 md:py-28 lg:py-32 bg-brand-dark">
          <div className="container mx-auto px-4">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5 }}
              variants={fadeIn}
              className="text-center mb-16 lg:mb-20"
            >
              <h2 className="font-serif font-medium text-4xl md:text-5xl lg:text-6xl tracking-tight text-white mb-4">
                The Proven Choice For Cannabis Data Extraction
              </h2>
              {/* Optional: Add subtitle if needed */}
              {/* <p className="text-lg text-gray-600 max-w-2xl mx-auto">Brief description of features.</p> */}
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12"
            >
              {features.map((feature) => (
                <motion.div
                  key={feature.title}
                  variants={fadeIn}
                  whileHover={{ scale: 1.03, y: -5, transition: { type: "spring", stiffness: 300, damping: 15 } }}
                  className="text-center p-8 bg-white/5 rounded-xl shadow-xl border border-white/10 cursor-pointer backdrop-blur-sm"
                >
                  <div className="inline-flex items-center justify-center p-3 bg-brand-green/10 rounded-full mb-6 shadow-sm">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">
                      {feature.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* Optional: Button below features */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              variants={fadeIn}
              className="text-center mt-16 lg:mt-20"
            >
              <Link to="/upload">
                <Button
                  size="lg"
                  className="bg-brand-green text-white hover:bg-green-600 font-semibold text-base px-8 py-3 transition-transform hover:scale-105 shadow-lg hover:shadow-brand-green/30"
                >
                  Go to Upload
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Updated Pricing Section */}
        <section id="pricing" className="py-20 md:py-28 lg:py-32 bg-brand-dark">
          <div className="container mx-auto px-4">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5 }} variants={fadeIn} className="text-center mb-16 lg:mb-20">
              <Badge className="mb-4 bg-white/10 text-brand-green border-none font-semibold px-3 py-1">Pricing</Badge>
              <h2 className="font-serif font-medium text-4xl md:text-5xl lg:text-6xl tracking-tight text-white mb-4">Simple, Transparent Pricing</h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">Choose the perfect plan. No hidden fees.</p>
            </motion.div>

            {error && (
              <div className="bg-red-900/50 border border-red-500/30 text-red-300 px-4 py-3 rounded relative mb-8 text-center" role="alert">
                <span>{error}</span>
              </div>
            )}

            <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {isLoading ? (
                // Prettier loading state with skeleton cards
                Array.from({ length: 3 }).map((_, index) => (
                  <motion.div key={`skeleton-${index}`} variants={fadeIn}>
                    <Card className="flex flex-col h-full bg-white/5 backdrop-blur-sm border border-white/10 shadow-xl overflow-hidden animate-pulse">
                      <CardHeader className="pb-4">
                        <div className="h-4 w-24 bg-white/10 rounded mb-4"></div>
                        <div className="mt-4">
                          <div className="h-8 w-32 bg-white/10 rounded"></div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <Separator className="my-4 bg-white/10" />
                        <div className="space-y-3">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-start">
                              <div className="h-5 w-5 rounded-full bg-white/10 mr-2 flex-shrink-0"></div>
                              <div className="h-4 w-full bg-white/10 rounded"></div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter className="mt-4">
                        <div className="h-10 w-full bg-white/10 rounded"></div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))
              ) : plans.length > 0 ? plans.map((plan) => (
                <motion.div key={plan.id} variants={fadeIn}>
                  <Card className="flex flex-col h-full bg-white/5 backdrop-blur-sm border border-white/10 shadow-xl hover:border-white/20 transition-colors">
                  <CardHeader className="pb-4">
                      <CardDescription className="text-sm text-gray-400 uppercase tracking-wider">
                        {
                          (plan.product && typeof plan.product === 'object' && plan.product.name) 
                            ? plan.product.name  // Primary: Stripe Product Name
                            : planNames[plan.id] // Secondary: Local planNames map by Price ID
                              ? planNames[plan.id]
                              : plan.nickname // Tertiary: Stripe Nickname
                                ? plan.nickname 
                                : plan.id // Last resort: Price ID (or original amount-based logic if preferred for specific cases)
                        }
                    </CardDescription>
                    <div className="mt-4">
                        <span className="text-4xl font-bold text-white">
                          {plan.amount === 1500
                            ? "$39.00"
                            : plan.amount === 3500
                              ? "$99.00"
                              : formatCurrency(plan.amount, plan.currency)}
                        </span>
                        <span className="ml-1 text-sm text-gray-400">/{plan.interval}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow">
                      <Separator className="my-4 bg-white/10" />
                    <ul className="space-y-3">
                      {( (plan.product && typeof plan.product === 'object' && (plan.product.name?.toLowerCase().includes('pro') || plan.product.name?.toLowerCase().includes('premium'))) || plan.amount === 9900 ? [
                        "100 Generations/Month",
                        "2 GB Storage",
                        "Authentication + Latest Improvements",
                        "Community Support"
                      ] : [
                        "30 Generations/Month",
                        "1 GB Storage",
                        "Basic Authentication"
                      ]).map((feature, index) => (
                          <li key={index} className="flex items-start text-gray-300">
                            <CheckCircle2 className="h-5 w-5 text-brand-green mr-2 flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                    <CardFooter className="mt-4">
                    <Button
                        className={`w-full font-semibold ${ (plan.product && typeof plan.product === 'object' && (plan.product.name?.toLowerCase().includes('pro') || plan.product.name?.toLowerCase().includes('premium'))) || plan.amount === 9900 || plan.amount === 3900 ? 'bg-brand-green text-white hover:bg-green-600 shadow-lg hover:shadow-brand-green/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
                      onClick={() => handleCheckout(plan.id)}
                        disabled={isLoading && processingPlanId === plan.id}
                    >
                        {isLoading && processingPlanId === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : ((plan.product && typeof plan.product === 'object' && (plan.product.name?.toLowerCase().includes('pro') || plan.product.name?.toLowerCase().includes('premium'))) || plan.amount === 9900 ? 'Get Started' : 'Choose Plan')}
                    </Button>
                  </CardFooter>
                </Card>
                </motion.div>
              )) : (
                <p className="text-center text-gray-400 md:col-span-2 lg:col-span-3">No pricing plans available at this time.</p>
              )}

              {/* Static Enterprise Plan Card - only show if not loading and plans are fetched (or even if no plans are fetched) */} 
              {!isLoading && (
                <motion.div variants={fadeIn}>
                  <Card className="flex flex-col h-full bg-white/5 backdrop-blur-sm border border-white/10 shadow-xl hover:border-white/20 transition-colors">
                    <CardHeader className="pb-4">
                        <CardDescription className="text-sm text-gray-400 uppercase tracking-wider">
                          Enterprise Plan
                      </CardDescription>
                      <div className="mt-4">
                          <span className="text-4xl font-bold text-white">
                            Custom
                          </span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <Separator className="my-4 bg-white/10" />
                      <ul className="space-y-3">
                        {[
                          "Bulk Processing of Lab Results: via PDF or via CSV",
                          "Integration with Lab Results Database",
                          "Custom Pricing",
                          "Direct Team Support"
                        ].map((feature, index) => (
                            <li key={index} className="flex items-start text-gray-300">
                              <CheckCircle2 className="h-5 w-5 text-brand-green mr-2 flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                      <CardFooter className="mt-4">
                      <Button
                          className={`w-full font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-blue-600/30`}
                        onClick={() => window.location.href = 'https://calendly.com/naughton-by-nature/30min'}
                      >
                          Contact Us
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-20 md:py-28 lg:py-32 bg-brand-dark">
          <div className="container mx-auto px-4">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5 }} variants={fadeIn} className="text-center mb-16 lg:mb-20">
              <Badge className="mb-4 bg-white/10 text-brand-green border-none font-semibold px-3 py-1">Testimonials</Badge>
              <h2 className="font-serif font-medium text-4xl md:text-5xl lg:text-6xl tracking-tight text-white mb-4">Trusted by Industry Leaders</h2>
            </motion.div>

            <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((testimonial) => (
                <motion.div key={testimonial.id} variants={fadeIn}>
                  <Card className="h-full bg-white/5 backdrop-blur-sm border border-white/10 shadow-lg p-6">
                    <CardHeader className="pb-4 px-0 pt-0">
                      <div className="flex items-center gap-4 mb-4">
                        <Avatar className="ring-2 ring-white/10">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${testimonial.name}`} alt={testimonial.name} />
                          <AvatarFallback className="bg-gray-700 text-gray-300">{testimonial.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                          <CardTitle className="text-base font-semibold text-white">{testimonial.name}</CardTitle>
                          <CardDescription className="text-gray-400 text-sm">{testimonial.role} at {testimonial.company}</CardDescription>
                        </div>
                      </div>
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                    </div>
                  </CardHeader>
                    <CardContent className="px-0 pb-0">
                      <p className="text-gray-300 italic before:content-['\201C'] after:content-['\201D']">{testimonial.content}</p>
                  </CardContent>
                </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-28 lg:py-32 bg-brand-dark">
          <div className="container mx-auto px-4">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.6 }} variants={fadeIn} className="bg-white/5 backdrop-blur-sm rounded-2xl p-10 md:p-16 shadow-xl border border-white/10 text-center">
              <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-medium mb-6 text-white">Ready to Streamline Your Lab Results?</h2>
              <p className="text-lg md:text-xl mb-10 text-gray-300 max-w-2xl mx-auto">Start leveraging AI for faster, more accurate COA analysis today.</p>
              <Link to="/upload">
                <Button size="lg" className="bg-brand-green text-white hover:bg-green-600 font-semibold text-2xl px-16 py-5 transition-transform hover:scale-105 shadow-lg hover:shadow-brand-green/30">
                  Upload
                    </Button>
                  </Link>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-brand-dark border-t border-white/10 py-12 text-gray-400">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Column 1: Logo & Socials */}
            <div>
              <Link to="/" className="flex items-center mb-4">
                <img src="/straininsightslogo.png" alt="StrainInsights Logo" className="h-9 w-auto opacity-90" />
              </Link>
              <p className="text-sm mb-4 pr-4">AI-Powered COA analysis for the cannabis industry.</p>
            </div>
            {/* Spacer to push Product and Company sections to the right on md+ screens */}
            <div className="hidden md:block"></div>
            {/* Product and Company Links */}
            <div>
              <h3 className="font-semibold text-sm text-white uppercase tracking-wider mb-4">Product</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                {/* Add more links */}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white uppercase tracking-wider mb-4">Company</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="https://useheady.com/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="https://useheady.com/contact" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Contact</a></li>
                {/* Add more links */}
              </ul>
            </div>
          </div>
          {/* Bottom Footer */}
          <Separator className="my-8 bg-white/10" />
          <div className="flex flex-col md:flex-row justify-between items-center text-sm">
            <p className="text-center md:text-left">
              © 2025 The Heady Collective, LLC · All Rights Reserved · HEADY™ and HEADY COLLECTIVE™ are trademarks of The Heady Collective, LLC.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link to="#" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="#" className="hover:text-white transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
      {/* Toaster should remain outside footer if it's globally positioned */}
      <Toaster />
    </div>
  );
}
