import React, { useState } from "react";
import { useAuth } from "../../../supabase/auth";
import TopNavigation from "../dashboard/layout/TopNavigation";
import Sidebar from "../dashboard/layout/Sidebar";
import { Button } from "../ui/button";
import { Upload, FileUp, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Progress } from "../ui/progress";

const UploadPage = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
        setError(null);
      } else {
        setError("Please upload a PDF file");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
        setError(null);
      } else {
        setError("Please upload a PDF file");
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return prev + 5;
      });
    }, 200);

    try {
      // TODO: Implement actual file upload to Supabase storage
      // This is a placeholder for the actual implementation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      clearInterval(interval);
      setUploadProgress(100);
      setSuccess(true);

      // Reset after showing success
      setTimeout(() => {
        setFile(null);
        setUploadProgress(0);
        setIsUploading(false);
        setSuccess(false);
      }, 3000);
    } catch (err) {
      clearInterval(interval);
      setError("Failed to upload file. Please try again.");
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNavigation />

      <div className="flex pt-16">
        <Sidebar />

        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              Upload Lab Report
            </h1>
            <p className="text-gray-600">
              Upload your cannabis lab report PDF for AI analysis and
              description generation.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mb-4 bg-green-50 border-green-200">
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>
                  Your lab report has been uploaded and is being processed.
                </AlertDescription>
              </Alert>
            )}

            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"} ${isUploading ? "opacity-75" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="bg-gray-100 p-4 rounded-full">
                  <Upload className="h-10 w-10 text-gray-500" />
                </div>

                <div>
                  <h3 className="text-lg font-medium">
                    Drag and drop your PDF file here
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    or click to browse from your computer
                  </p>
                </div>

                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />

                <Button
                  variant="outline"
                  onClick={() =>
                    document.getElementById("file-upload")?.click()
                  }
                  disabled={isUploading}
                >
                  Browse Files
                </Button>
              </div>

              {file && (
                <div className="mt-6 p-4 bg-gray-50 rounded-md">
                  <div className="flex items-center">
                    <FileUp className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({Math.round(file.size / 1024)} KB)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {isUploading && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="flex items-center"
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? "Uploading..." : "Upload Lab Report"}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default UploadPage;
