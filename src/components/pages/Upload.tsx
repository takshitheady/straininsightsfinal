import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "../../../supabase/auth";
import { Button } from "../ui/button";
import { UploadCloud, AlertCircle, X, CheckCircle, History, User, Settings, FileText, Check, Star, Sparkles, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Progress } from "../ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Toaster } from "@/components/ui/toaster";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "../../../supabase/supabase";
import { initiateCheckout } from "@/lib/stripeUtils";
import PricingSection from "@/components/home/PricingSection";

// Constants for file uploads
const MAX_FILE_SIZE_MB = 1;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Animation Variants
const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const cardVariants = {
  default: { scale: 1 },
  hover: { scale: 1.03, transition: { duration: 0.2 } },
};

const UploadPage = () => {
  const { user, signOut } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'failed'>('idle');
  const [generatedDescription, setGeneratedDescription] = useState<string>('');
  const [currentLabResultId, setCurrentLabResultId] = useState<string | null>(null);
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);

  // New state for usage tracking
  const [generationsUsed, setGenerationsUsed] = useState<number | null>(null);
  const [generationLimit, setGenerationLimit] = useState<number | null>(null);
  const [currentUserPlanId, setCurrentUserPlanId] = useState<string | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  // Fetch user's usage data from database
  const fetchUsageData = useCallback(async () => {
    if (!user) {
      setIsLoadingUsage(false);
      return;
    }

    setIsLoadingUsage(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('generations_used, generation_limit, current_plan_id')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user usage data:', error);
        toast({ 
          title: "Error", 
          description: "Failed to load usage data. Please refresh or contact support.", 
          variant: "destructive" 
        });
        setIsLoadingUsage(false);
        return;
      }

      if (!data) {
        console.warn('No user data found for current user. User may need profile setup.');
        setIsLoadingUsage(false);
        return;
      }

      console.log('User usage data:', data);
      setGenerationsUsed(data.generations_used || 0);
      setGenerationLimit(data.generation_limit || 0);
      setCurrentUserPlanId(data.current_plan_id || null);
      setIsLoadingUsage(false);
    } catch (err) {
      console.error('Unexpected error during usage data fetch:', err);
      toast({ 
        title: "Error", 
        description: "Failed to load usage data. Please refresh or contact support.", 
        variant: "destructive" 
      });
      setIsLoadingUsage(false);
    }
  }, [user, supabase]);

  // Trigger fetchUsageData on mount and when user changes
  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Don't set dragging state if upload is disabled
    const limitReached = generationsUsed !== null && generationLimit !== null && generationsUsed >= generationLimit;
    const isUploadingOrProcessing = uploadStatus === 'uploading' || uploadStatus === 'processing';
    const isUploadDisabled = isUploadingOrProcessing || isLoadingUsage || limitReached;
    if (!isUploadDisabled) {
    setIsDragging(true);
    }
  }, [generationsUsed, generationLimit, isLoadingUsage, uploadStatus]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError(null);
    setUploadStatus('idle');

    // Check limit before accepting drop
    const limitReached = generationsUsed !== null && generationLimit !== null && generationsUsed >= generationLimit;
    if (limitReached || isLoadingUsage) {
        if (limitReached) {
            setError(`You have reached your generation limit (${generationLimit}). Please upgrade your plan.`);
            toast({ title: "Limit Reached", description: "Upgrade your plan to continue processing files.", variant: "destructive" });
        }
        return; // Exit if disabled
    }


    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf" && droppedFile.size <= MAX_FILE_SIZE_BYTES) {
        setFile(droppedFile);
        toast({
          title: "File selected",
          description: `${droppedFile.name} is ready to be processed.`,
          duration: 3000,
        });
      } else if (droppedFile.type !== "application/pdf") {
        setError("Invalid file type. Please upload a PDF.");
      } else {
        setError(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      }
      e.dataTransfer.clearData();
    }
  }, [toast, generationsUsed, generationLimit, isLoadingUsage]); // Added isLoadingUsage

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setUploadStatus('idle');

    // Check limit before accepting file change
    const limitReached = generationsUsed !== null && generationLimit !== null && generationsUsed >= generationLimit;
    if (limitReached || isLoadingUsage) {
        if (limitReached) {
            setError(`You have reached your generation limit (${generationLimit}). Please upgrade your plan.`);
            toast({ title: "Limit Reached", description: "Upgrade your plan to continue processing files.", variant: "destructive" });
        }
        setFile(null); // Clear selection if limit reached or loading
        if (e.target) e.target.value = ''; // Reset input value
        return; // Exit if disabled
    }

    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf" && selectedFile.size <= MAX_FILE_SIZE_BYTES) {
        setFile(selectedFile);
        toast({
          title: "File selected",
          description: `${selectedFile.name} is ready to be processed.`,
          duration: 3000,
        });
      } else if (selectedFile.type !== "application/pdf") {
        setError("Invalid file type. Please upload a PDF.");
      } else {
        setError(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
      }
    } else {
        setFile(null); // Ensure file is null if no file selected
    }
  };

  const fetchDescription = async (labResultId: string) => {
    if (!labResultId) return;

    setIsLoadingDescription(true);
    try {
      console.log(`Fetching description for lab result ID: ${labResultId}`);

      let attempts = 0;
      const maxAttempts = 15; // Increased attempts slightly
      const pollInterval = 3000; // Poll every 3 seconds
      let pollingTimeoutId: NodeJS.Timeout | null = null; // To potentially clear timeout

      const pollForDescription = async () => {
        if (attempts >= maxAttempts) {
          console.log("Max polling attempts reached");
          toast({ title: "Timeout", description: "Could not retrieve results in time. Please check history later.", variant: "destructive" });
          setIsLoadingDescription(false);
          setUploadStatus('failed'); // Set status to failed on timeout
          return;
        }

        attempts++;
        console.log(`Polling attempt ${attempts}/${maxAttempts}`);

        try {
          const { data, error } = await supabase
            .from('lab_results')
            .select('description, status')
            .eq('id', labResultId)
            .single();

          if (error) {
            console.error("Error fetching description poll:", error);
            // Don't immediately fail on a single poll error, maybe retry?
            // For now, we'll continue polling up to maxAttempts
          }
          
          // Check status explicitly
          if (data?.status === 'completed') {
            if (data.description) {
              console.log("Description found:", data.description);
              setGeneratedDescription(data.description);
              setIsLoadingDescription(false);
              setUploadStatus('complete'); // <<< SET STATUS TO COMPLETE HERE
              toast({ title: "Analysis Complete!", description: "Results are ready.", duration: 5000 });
            } else {
              // Completed but no description? Treat as error/incomplete for now.
              console.error("Processing completed but no description found.");
              toast({ title: "Result Issue", description: "Processing finished, but description is missing.", variant: "destructive" });
              setIsLoadingDescription(false);
              setUploadStatus('failed'); // Or a specific 'incomplete' status?
            }
            // Stop polling once completed (success or missing description)
            return; 
          } else if (data?.status === 'error') {
            console.error("Lab result processing encountered an error in DB");
            toast({ title: "Processing Error", description: "An error occurred during analysis.", variant: "destructive" });
            setIsLoadingDescription(false);
            setUploadStatus('failed'); // <<< SET STATUS TO FAILED HERE
            return; // Stop polling on error
          } else if (data?.status === 'processing' || data?.status === 'pending') { 
            // Continue polling
            console.log("Description not ready yet, polling again...");
            pollingTimeoutId = setTimeout(pollForDescription, pollInterval); 
          } else {
            // Handle unexpected status or null data
            console.log(`Unexpected status (${data?.status ?? 'null'}) or null data, continuing poll...`);
            pollingTimeoutId = setTimeout(pollForDescription, pollInterval); 
          }
        } catch (pollError) {
           console.error("Error inside poll attempt:", pollError);
           // Continue polling even if one attempt throws an error
           pollingTimeoutId = setTimeout(pollForDescription, pollInterval); 
        }
      };

      // Start polling
      await pollForDescription();

    } catch (err) {
      console.error("Error initiating fetchDescription poll:", err);
      setIsLoadingDescription(false);
      setUploadStatus('failed'); // Fail if the initial setup fails
      toast({ title: "Error", description: "Could not start fetching results.", variant: "destructive" });
    }
  };

  // Fetch description when processing starts
  useEffect(() => {
    // Trigger polling when status becomes 'processing' and we have an ID
    if (currentLabResultId && uploadStatus === 'processing') { 
      setGeneratedDescription('');
      setIsLoadingDescription(true); // Set loading true immediately
      fetchDescription(currentLabResultId);
    }

    // Optional: Cleanup polling if component unmounts or dependencies change drastically
    // This might require returning the timeout ID from fetchDescription and clearing it.
    // return () => { /* clear timeout if active */ }; 
  }, [currentLabResultId, uploadStatus]); // Dependencies are correct

  const uploadToSupabase = async (file: File): Promise<{ success: boolean; error?: string; labResultId?: string; }> => {
    if (!user) {
      return { success: false, error: "You must be logged in to upload files." };
    }

    // Double-check limit before upload just in case (though UI should prevent this)
    // Use local calculation for check as state might not be updated yet
    const currentUsageCheck = generationsUsed ?? 0;
    const currentLimitCheck = generationLimit ?? 1; // Use 1 if limit is null
    if (isLoadingUsage) {
        return { success: false, error: "Usage data is still loading. Please wait." };
    }
    if (currentUsageCheck >= currentLimitCheck) {
        return { success: false, error: `Operation limit (${currentLimitCheck}) reached. Please upgrade.` };
    }

    try {
      // Convert file to array buffer
      const fileBuffer = await file.arrayBuffer();

      // Create a unique filename with user ID and timestamp
      const uniqueFileName = `${user.id}/${Date.now()}-${file.name}`;

      // Upload to Supabase Storage
      const { data: storageData, error: uploadError } = await supabase.storage
        .from('labresults')
        .upload(uniqueFileName, fileBuffer, {
          contentType: 'application/pdf',
          upsert: false, // Important: Don't upsert if you rely on unique names for history
        });

      if (uploadError) {
        console.error('Supabase storage upload error:', uploadError);
        return { success: false, error: 'Failed to upload file to storage.' };
      }

      if (!storageData?.path) {
        return { success: false, error: 'Failed to get file path after upload.' };
      }

      const storagePath = storageData.path;

      // Insert record into database with 'pending' status
      const { data: insertData, error: insertError } = await supabase
        .from('lab_results')
        .insert({
          user_id: user.id,
          file_name: file.name,
          storage_path: storagePath,
          status: 'pending', // Start as pending
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Supabase DB insert error:', insertError);
        // Attempt to delete the uploaded file if DB insert fails?
        // await supabase.storage.from('labresults').remove([storagePath]);
        return { success: false, error: 'Failed to save file metadata to database.' };
      }

      if (!insertData?.id) {
        // Attempt to delete the uploaded file if DB insert somehow returns no ID?
        // await supabase.storage.from('labresults').remove([storagePath]);
        return { success: false, error: 'Failed to get record ID after database insert.' };
      }

      const labResultId = insertData.id;
      setCurrentLabResultId(labResultId); // Set ID right after DB insert

      // ----> Increment usage count BEFORE triggering function <----
      // This ensures usage is counted even if the function invocation fails later
      let usageUpdated = false;
      try {
          const currentUsage = generationsUsed ?? 0;
          const { error: updateError } = await supabase
              .from('users')
              .update({ generations_used: currentUsage + 1 })
              .eq('user_id', user.id);

          if (updateError) {
              console.error('Failed to update usage count:', updateError);
              // This is critical - if usage can't be updated, we should probably fail the upload
              // Rollback? Delete the DB record?
              await supabase.from('lab_results').delete().eq('id', labResultId);
              await supabase.storage.from('labresults').remove([storagePath]);
              return { success: false, error: 'Failed to update usage count. Upload cancelled.' };
          } else {
              // Update local state optimistically
              setGenerationsUsed(currentUsage + 1);
              usageUpdated = true;
              console.log('Usage count updated successfully.');
          }
      } catch (usageUpdateError) {
          console.error('Error during usage count update:', usageUpdateError);
           // Rollback? Delete the DB record?
           await supabase.from('lab_results').delete().eq('id', labResultId);
           await supabase.storage.from('labresults').remove([storagePath]);
          return { success: false, error: 'An error occurred updating usage. Upload cancelled.' };
      }
      // ----> End of Increment usage count <----

      // Now, update the status to 'processing' before calling the function
       const { error: statusUpdateError } = await supabase
           .from('lab_results')
           .update({ status: 'processing' })
           .eq('id', labResultId);

       if (statusUpdateError) {
            console.error('Failed to update status to processing:', statusUpdateError);
            // Rollback usage count if status update fails?
            if (usageUpdated) {
                await supabase.from('users').update({ generations_used: generationsUsed ?? 0 }).eq('user_id', user.id);
                setGenerationsUsed(generationsUsed ?? 0); // Revert optimistic update
            }
             await supabase.from('lab_results').delete().eq('id', labResultId);
             await supabase.storage.from('labresults').remove([storagePath]);
            return { success: false, error: 'Failed to update processing status. Upload cancelled.' };
       }

      // Trigger processing via Edge Function
      const { error: functionError } = await supabase.functions.invoke(
        'process-lab-result',
        {
          body: {
            pdfStoragePath: storagePath,
            labResultId: labResultId,
            // Pass other necessary details if needed by the function
            // userId: user.id,
            // fileName: file.name,
          },
        }
      );

      if (functionError) {
        console.error('Supabase function invoke error, status updated to error:', functionError);
        // Return success: true here, as the *upload and trigger* part worked,
        // but the async function failed. Let polling handle the final state.
        return { success: true, labResultId: labResultId }; 
      }

      // Return success result - processing is happening async
      return {
        success: true,
        labResultId: labResultId
      };

    } catch (error: any) { // Added type assertion
      console.error('Unexpected error during upload:', error);
      return { success: false, error: error.message || 'An unexpected error occurred during upload.' };
    }
  };

  const handleUpload = async () => {
    // Check limit before starting upload process
    if (isLoadingUsage) {
        toast({ title: "Please wait", description: "Verifying usage limits...", duration: 2000 });
        return;
    }
    // Use local calculation for check as state might not be updated yet
    const currentUsageCheck = generationsUsed ?? 0;
    const currentLimitCheck = generationLimit ?? 1; // Use 1 if limit is null

    if (currentUsageCheck >= currentLimitCheck) {
        setError(`You have reached your generation limit (${currentLimitCheck}). Please upgrade your plan to process more files.`);
        toast({ title: "Generation Limit Reached", description: "Upgrade your plan to continue.", variant: "destructive" });
        setUploadStatus('failed'); // Set status to failed to show appropriate UI
        return;
    }

    if (!file) {
      setError("Please select a file.");
      return;
    }

    if (!user) { // Keep user check here as well
      setError("You must be logged in to upload files.");
      return;
    }


    setUploadStatus('uploading');
    setUploadProgress(0);
    setError(null);
    setGeneratedDescription('');
    // setCurrentLabResultId(null); // Don't reset here, set in uploadToSupabase

    toast({
      title: "Upload started",
      description: "Uploading your Certificate of Analysis...",
      duration: 3000,
    });

    // Simulate upload progress visually
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress = Math.min(progress + 10, 90); // Simulate progress up to 90%
        setUploadProgress(progress);
        if (progress >= 90) {
            clearInterval(progressInterval);
        }
    }, 150);


    try {
      const uploadResult = await uploadToSupabase(file);

      clearInterval(progressInterval); 

      if (!uploadResult.success || !uploadResult.labResultId) {
        // Failure during the synchronous part (upload, DB insert, usage update)
        setUploadProgress(0); 
        setError(uploadResult.error || "Upload failed before processing could start");
        setUploadStatus('failed');
        toast({
            title: "Upload Failed",
            description: uploadResult.error || "An error occurred before processing.",
            variant: "destructive",
            duration: 5000,
          });
        return; 
      }
      
      // If uploadResult.success is true, it means:
      // 1. File uploaded to storage
      // 2. DB record created (status: processing)
      // 3. Usage count incremented
      // 4. Edge function invoked (might have failed async, but was triggered)
      
      // Now, set frontend status to 'processing' to initiate polling via useEffect
      setUploadProgress(100); // Show upload as complete
      setUploadStatus('processing'); 

      toast({
        title: "Upload successful",
        description: "Processing started. We'll fetch the results shortly.",
        duration: 4000,
      });

      // Polling will handle the final state (complete/failed) and description display

    } catch (err: any) { // Catch unexpected errors in handleUpload itself
      clearInterval(progressInterval);
      setError(err.message || "Upload process failed unexpectedly.");
      setUploadStatus('failed');
        setUploadProgress(0);

      toast({
        title: "Upload failed",
        description: err.message || "There was an unexpected error. Please try again.",
        variant: "destructive",
        duration: 5000,
      });

      console.error("Error in handleUpload:", err);
    }
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    setGeneratedDescription('');
    setCurrentLabResultId(null);
    setIsLoadingDescription(false); // Reset loading state
    // Reset file input visually if needed
    const input = document.getElementById('file-upload-input') as HTMLInputElement;
    if (input) input.value = '';
  };

  // Determine if upload should be disabled
  const limitReached = !isLoadingUsage && generationsUsed !== null && generationLimit !== null && generationsUsed >= generationLimit;
  const isUploadingOrProcessing = uploadStatus === 'uploading' || uploadStatus === 'processing';
  const isUploadDisabled = isLoadingUsage || isUploadingOrProcessing || limitReached;

  // Show upgrade dialog when limit is reached
  useEffect(() => {
    if (limitReached && !isLoadingUsage) { // Ensure usage isn't loading before showing
      const timer = setTimeout(() => {
        setShowUpgradeDialog(true);
      }, 500);
      return () => clearTimeout(timer);
    }
    // Close dialog if limit is no longer reached (e.g., plan updated)
    if (!limitReached && showUpgradeDialog) {
      setShowUpgradeDialog(false);
    }
  }, [limitReached, isLoadingUsage, showUpgradeDialog]);

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
              src="/headylogo.png"
              alt="Heady Logo"
              className="h-12 w-auto"
            />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link to="/upload" className="text-brand-green hover:text-green-500 transition-colors">Upload</Link>
            <Link to="/output-history" className="text-gray-300 hover:text-white transition-colors">History</Link>
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

      {/* Main content area */}
      <main className="container mx-auto px-4 max-w-3xl min-h-[calc(100vh-5rem)] flex flex-col justify-center items-center py-12">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeIn}
          className="w-full"
        >
          <motion.h1
            className="font-serif text-3xl md:text-4xl font-medium text-center text-white mb-8"
            variants={fadeIn}
          >
            Upload Certificate of Analysis
          </motion.h1>

          {/* Display Usage Info */}
          {!isLoadingUsage && generationsUsed !== null && generationLimit !== null && user && (
            <motion.div
              variants={fadeIn}
              className="text-center mb-6 py-2 px-4 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 inline-flex items-center justify-center mx-auto"
            >
              <div className="flex items-center">
                <span className={`text-sm ${limitReached ? 'text-red-400' : 'text-gray-400'}`}>
                  <span className="font-medium text-white">{generationsUsed}</span>
                  <span className="mx-1">/</span>
                  <span className="font-medium text-brand-green">{generationLimit}</span>
                  {" generations used"}
                </span>
                {limitReached && (
                  <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-red-900/40 text-red-400 rounded-full">
                    Limit Reached
                  </span>
                )}
              </div>
            </motion.div>
          )}

          <Card className="bg-white/5 border border-white/10 shadow-xl overflow-hidden backdrop-blur-sm">
            <CardContent className="p-6 md:p-8">
            {error && (
                  <Alert variant="destructive" className="mb-6 bg-red-900/30 border-red-500/30 text-red-300">
                <AlertCircle className="h-4 w-4" />
                  {/* Use specific title if limit reached */}
                  <AlertTitle>{limitReached ? 'Generation Limit Reached' : 'Error'}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

              {/* File Status */}
              {(uploadStatus === 'uploading' || uploadStatus === 'processing' || uploadStatus === 'complete') && file && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2 text-sm">
                    <span className="font-medium text-white truncate pr-4 max-w-[calc(100%-80px)]">{file.name}</span> {/* Added max-width */}
                    {uploadStatus === 'uploading' && <span className="text-gray-400 flex-shrink-0">{uploadProgress}%</span>}
                    {uploadStatus === 'processing' && <span className="text-brand-green animate-pulse flex-shrink-0">Processing...</span>}
                    {uploadStatus === 'complete' && <span className="text-green-400 flex items-center flex-shrink-0"><CheckCircle className="h-4 w-4 mr-1"/>Complete</span>}
                </div>
                  {(uploadStatus === 'uploading' || uploadStatus === 'processing') &&
                    <Progress
                      value={uploadStatus === 'processing' ? 100 : uploadProgress}
                      // Use indeterminate animation for processing? or keep pulse
                      className={`h-2 bg-white/10 [&>*]:bg-brand-green ${uploadStatus === 'processing' ? 'animate-pulse' : ''}`}
                    />
                  }
                </div>
              )}

              {/* Dropzone */}
              {/* Show dropzone if: no file OR upload failed OR upload complete */}
              {(!file || uploadStatus === 'failed' || uploadStatus === 'complete') && !isUploadingOrProcessing && (
                 <motion.div
                    variants={fadeIn}
                    className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors duration-300 ${
                    isUploadDisabled ? 'opacity-50 cursor-not-allowed' : ''
                    } ${
                    isDragging
                        ? 'border-brand-green bg-white/10'
                        : 'border-white/20 hover:border-white/30'
                    }`}
                    onDragOver={!isUploadDisabled ? handleDragOver : undefined}
                    onDragLeave={!isUploadDisabled ? handleDragLeave : undefined}
                    onDrop={!isUploadDisabled ? handleDrop : undefined}
                >
                <input
                  type="file"
                        id="file-upload-input"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept="application/pdf"
                  onChange={handleFileChange}
                        disabled={isUploadDisabled}
                    />
                    <div className="flex flex-col items-center justify-center space-y-5">
                        <div className={`p-4 rounded-full bg-white/5 ${isDragging ? 'bg-white/10' : ''}`}>
                        <UploadCloud className={`h-14 w-14 transition-colors ${isDragging ? 'text-brand-green' : 'text-gray-400'}`} />
                        </div>
                        <div className="space-y-2">
                        <p className="font-medium text-lg text-white">
                            <label htmlFor="file-upload-input" className={`transition-colors ${isUploadDisabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${isDragging ? 'text-brand-green' : 'text-brand-green'}`}>
                            Choose a PDF
                            </label>
                            {" "}or drag and drop
                        </p>
                        <p className="text-sm text-gray-400">PDF files only, max 1MB</p>
                        </div>
                    </div>
                    {/* Display loading usage indicator */}
                    {isLoadingUsage && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                            <p className="text-white animate-pulse">Loading usage data...</p>
                        </div>
                    )}
                    {/* Display disabled overlay if limit reached and not loading */}
                    {limitReached && !isLoadingUsage && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl p-4 z-10">
                            <AlertCircle className="h-10 w-10 text-red-400 mb-3"/>
                            <p className="text-red-400 font-semibold text-lg text-center">Generation Limit Reached</p>
                            <p className="text-sm text-gray-300 mt-1 text-center">Please upgrade your plan to process more files.</p>
                            <Button 
                                className="mt-6 bg-brand-green text-white hover:bg-green-600 font-semibold shadow-lg hover:shadow-brand-green/30" 
                                onClick={() => setShowUpgradeDialog(true)} // Button to open dialog
                            >
                                View Upgrade Options
                            </Button>
                        </div>
                    )}
                </motion.div>
              )}

              {/* File Ready View */}
              {/* Show file ready view if: file selected AND status is idle */}
              {file && uploadStatus === 'idle' && !isUploadingOrProcessing && (
                <motion.div
                  variants={fadeIn}
                  className="border-2 border-white/20 rounded-xl p-6 text-center"
                >
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="p-3 rounded-full bg-brand-green/10">
                      <FileText className="h-10 w-10 text-brand-green" />
                    </div>
                    <div>
                      <p className="font-medium text-white">File Ready to Upload</p>
                      <p className="text-sm text-gray-300 mt-1 break-all max-w-full">{file.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                    <div className="flex gap-3 mt-2">
                      <Button
                        onClick={handleUpload}
                        className="bg-brand-green text-white hover:bg-green-600 font-semibold shadow-lg hover:shadow-brand-green/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isUploadDisabled} // Use the combined disabled state
                      >
                        <UploadCloud className="mr-2 h-5 w-5" />
                        Extract COA Data
                      </Button>
                <Button
                  variant="outline"
                        onClick={clearFile}
                        className="text-gray-300 border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        // Disable clear only if actively uploading/processing
                        disabled={isUploadingOrProcessing}
                >
                        <X className="mr-2 h-5 w-5" />
                        Clear
                </Button>
              </div>
                    {/* Show loading/limit state here too? Maybe not necessary if button is disabled */}
                  </div>
                </motion.div>
              )}

              {/* Progress indicator is shown above */}

            </CardContent>
          </Card>

          {/* Success Message and Generated Description */}
          {uploadStatus === 'complete' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-6 bg-green-900/20 border border-green-500/30 rounded-lg w-full" // Added w-full
            >
              <div className="flex items-center mb-3">
                <CheckCircle className="h-6 w-6 text-green-400 mr-3" />
                <h3 className="font-semibold text-lg text-green-400">Analysis Complete</h3>
            </div>
              <p className="text-gray-300 mb-4">
                Your file <span className="font-medium text-white break-all">{file?.name}</span> has been successfully processed.
              </p>

              {/* Description section */}
              {isLoadingDescription ? (
                <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10 flex items-center justify-center animate-pulse">
                  <FileText className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-gray-400">Loading description...</span>
                </div>
              ) : generatedDescription ? (
                <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
                  <h4 className="text-sm font-medium text-gray-200 mb-2">Generated Description:</h4>
                  <p className="text-sm text-gray-300 whitespace-pre-line">{generatedDescription}</p>
                </div>
              ) : (
                 // Show if not loading and no description (could be due to error or poll timeout)
                 <div className="mb-6 p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/30">
                    <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
                        <p className="text-sm text-yellow-300">Could not load description. It might still be processing or an error occurred.</p>
                    </div>
              </div>
            )}


              <div className="flex flex-wrap gap-4"> {/* Added flex-wrap */}
                <Link to="/output-history">
                  <Button className="bg-brand-green text-white hover:bg-green-600 font-semibold shadow-lg hover:shadow-brand-green/30">
                    <History className="mr-2 h-4 w-4" />
                    View History
                  </Button>
                </Link>
              <Button
                  variant="outline"
                  onClick={clearFile}
                  className="text-gray-300 border-white/20 hover:bg-white/10 hover:text-white"
              >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload Another File
              </Button>
            </div>
            </motion.div>
          )}

          {/* Upgrade Prompt Dialog */}
          <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
            <DialogContent className="bg-white border-none shadow-2xl max-w-4xl rounded-2xl p-0 overflow-hidden">
              <DialogHeader className="p-6 pb-0 z-10 relative">
                <DialogTitle className="text-2xl font-semibold text-gray-900 flex items-center">
                  <Sparkles className="h-6 w-6 text-brand-green mr-2" />
                  Upgrade Your Experience
                </DialogTitle>
                <DialogDescription className="text-gray-600 mt-1 text-base">
                  You've reached the generation limit for your current plan. Choose an option below to continue.
                </DialogDescription>
              </DialogHeader>
              
              <div className="p-6 z-10 relative">
                <PricingSection 
                  theme="light" 
                  checkoutFunction={initiateCheckout} 
                  excludePlanId={currentUserPlanId || undefined} // <<< Pass user's current plan ID to exclude
                  title="" 
                  subtitle="" 
                />
          </div>
              
              <DialogFooter className="bg-gray-50 p-4 flex justify-center border-t border-gray-100">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUpgradeDialog(false)}
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                >
                  Maybe Later
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </motion.div>
        </main>
      <Toaster/>
    </div>
  );
};

export default UploadPage;
