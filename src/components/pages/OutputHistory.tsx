import React, { useEffect, useState } from "react";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../../../supabase/auth";
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
import { FileText, Calendar, Clock, User, Settings, History, UploadCloud, Search, ArrowLeft, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/toaster";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OutputItem {
  id: string;
  created_at: string;
  file_name: string;
  description: string;
  cannabinoid_profile?: string;
  terpene_data?: string;
  user_id: string;
}

// Animation Variants
const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const OutputHistory = () => {
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, signOut } = useAuth();
  const [selectedOutput, setSelectedOutput] = useState<OutputItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const fetchOutputs = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("lab_results")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setOutputs(data || []);
      } catch (error) {
        console.error("Error fetching output history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOutputs();
  }, [user]);

  const filteredOutputs = outputs.filter(output => 
    output.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (output.description && output.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleViewFullReport = (output: OutputItem) => {
    setSelectedOutput(output);
    setIsDialogOpen(true);
  };

  // Format relative time (e.g., "2 days ago")
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      if (diffInHours === 0) {
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
      }
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    } else if (diffInDays === 1) {
      return "Yesterday";
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // Format normal date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-brand-dark text-gray-300 font-sans">
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
            <Link to="/output-history" className="text-brand-green hover:text-green-500 transition-colors">History</Link>
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

      <div className="container mx-auto px-4 py-12">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="mb-8 flex flex-col md:flex-row justify-between items-center"
        >
          <div>
            <h1 className="font-serif text-3xl md:text-4xl font-medium text-white mb-2">Analysis History</h1>
            <p className="text-gray-400">View your previously analyzed COA reports</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link to="/upload">
              <Button variant="outline" className="bg-white/5 hover:bg-white/10 text-white border-white/20">
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload New COA
              </Button>
            </Link>
          </div>
        </motion.div>
        
        {/* Search bar */}
        <motion.div 
          variants={fadeIn}
          className="relative mb-8"
        >
          <Input
            type="text"
            placeholder="Search by file name or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 py-6 text-base bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:ring-brand-green"
          />
          <Search className="absolute top-1/2 transform -translate-y-1/2 left-3 h-5 w-5 text-gray-500" />
        </motion.div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <FileText className="h-10 w-10 text-brand-green" />
            </motion.div>
            <p className="ml-3 text-gray-400">Loading your analysis history...</p>
            </div>
          ) : outputs.length === 0 ? (
          <motion.div 
            variants={fadeIn}
            className="flex flex-col items-center justify-center h-64 text-center"
          >
            <FileText className="h-16 w-16 text-gray-500 mb-4" />
            <h3 className="text-xl font-medium text-white">
              No analysis found
            </h3>
            <p className="text-gray-400 mt-2 max-w-md">
              You haven't analyzed any COA reports yet. Upload a PDF to get started.
            </p>
            <Link to="/upload" className="mt-6">
              <Button className="bg-brand-green text-white hover:bg-green-600 font-semibold">
                <UploadCloud className="mr-2 h-5 w-5" />
                Upload Your First COA
              </Button>
            </Link>
          </motion.div>
        ) : filteredOutputs.length === 0 ? (
          <motion.div 
            variants={fadeIn}
            className="flex flex-col items-center justify-center h-64 text-center"
          >
            <Search className="h-12 w-12 text-gray-500 mb-4" />
            <h3 className="text-xl font-medium text-white">
              No results found
              </h3>
            <p className="text-gray-400 mt-2 max-w-md">
              We couldn't find any reports matching "{searchQuery}". Try a different search term.
            </p>
            <Button 
              onClick={() => setSearchQuery("")}
              variant="outline" 
              className="mt-4 bg-white/5 hover:bg-white/10 text-white border-white/20"
            >
              Clear Search
            </Button>
          </motion.div>
          ) : (
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {filteredOutputs.map((output) => (
              <motion.div
                  key={output.id}
                variants={fadeIn}
              >
                <Card className="overflow-hidden bg-white/5 border-white/10 shadow-lg transition-all hover:shadow-xl hover:shadow-brand-green/5 hover:border-white/20">
                  <CardHeader className="pb-2 border-b border-white/10">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg text-white">
                      {output.file_name}
                    </CardTitle>
                        <CardDescription className="flex items-center gap-1 text-gray-400">
                          <Clock className="h-3.5 w-3.5" />
                          {getRelativeTime(output.created_at)}
                    </CardDescription>
                      </div>
                      <Badge className="bg-brand-green text-white border-none">
                        COA
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-400 italic">
                      Click "View Full Report" to see the complete analysis
                    </p>
                    
                    <div className="mt-4 flex flex-wrap gap-2">
                      {output.cannabinoid_profile && (
                        <Badge variant="outline" className="text-xs border-blue-400/30 text-blue-400 bg-blue-500/10">
                          Cannabinoid Profile
                        </Badge>
                      )}
                      {output.terpene_data && (
                        <Badge variant="outline" className="text-xs border-green-400/30 text-green-400 bg-green-500/10">
                          Terpene Data
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-white/10 pt-4">
                    <Button 
                      variant="outline" 
                      className="w-full text-sm bg-white/5 hover:bg-white/10 text-white border-white/20"
                      onClick={() => handleViewFullReport(output)}
                    >
                      View Full Report
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
              ))}
          </motion.div>
        )}
      </div>

      {/* Full Report Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-white border border-gray-100 text-gray-800 max-w-3xl max-h-[85vh] overflow-y-auto shadow-xl rounded-xl backdrop-blur-sm">
          {selectedOutput && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-center">
                  <DialogTitle className="text-xl text-gray-900 font-medium">{selectedOutput.file_name}</DialogTitle>
                  <Badge className="bg-brand-green text-white">COA Report</Badge>
                </div>
                <DialogDescription className="text-gray-500">
                  Analyzed on {formatDate(selectedOutput.created_at)}
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-6 space-y-6">
                {/* Description Section */}
                {selectedOutput.description && (
                  <div className="p-6 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Analysis Description</h3>
                    <p className="text-gray-700 whitespace-pre-line leading-relaxed">{selectedOutput.description}</p>
                  </div>
                )}
                
                {/* Cannabinoid Profile */}
                {selectedOutput.cannabinoid_profile && (
                  <div className="p-6 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                      <Badge variant="outline" className="mr-2 border-brand-green/30 text-brand-green bg-brand-green/5">
                        Cannabinoid Profile
                      </Badge>
                    </h3>
                    <div className="text-gray-700">
                      <pre className="whitespace-pre-wrap overflow-x-auto bg-gray-50 p-4 rounded-lg text-sm font-mono border border-gray-100">
                        {selectedOutput.cannabinoid_profile}
                      </pre>
                    </div>
                  </div>
                )}
                
                {/* Terpene Data */}
                {selectedOutput.terpene_data && (
                  <div className="p-6 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                      <Badge variant="outline" className="mr-2 border-brand-green/30 text-brand-green bg-brand-green/5">
                        Terpene Data
                      </Badge>
                    </h3>
                    <div className="text-gray-700">
                      <pre className="whitespace-pre-wrap overflow-x-auto bg-gray-50 p-4 rounded-lg text-sm font-mono border border-gray-100">
                        {selectedOutput.terpene_data}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-end">
                <Button 
                  onClick={() => setIsDialogOpen(false)}
                  className="bg-brand-green hover:bg-green-600 text-white rounded-full px-6"
                >
                  Close
                </Button>
            </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      <Toaster />
    </div>
  );
};

export default OutputHistory;
