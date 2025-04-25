import React, { useEffect, useState } from "react";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../../../supabase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Calendar, User } from "lucide-react";

interface OutputItem {
  id: string;
  created_at: string;
  file_name: string;
  description: string;
  cannabinoid_profile?: string;
  terpene_data?: string;
  user_id: string;
}

const OutputHistory = () => {
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchOutputs = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("lab_reports")
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

  return (
    <div className="min-h-screen bg-white">
      <div className="flex pt-16">
        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Output History</h1>
            <p className="text-gray-600">
              View your previously generated lab report descriptions.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">Loading your output history...</p>
            </div>
          ) : outputs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FileText className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                No outputs found
              </h3>
              <p className="text-gray-500 mt-2 max-w-md">
                You haven't generated any lab report descriptions yet. Upload a
                PDF to get started.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {outputs.map((output) => (
                <Card
                  key={output.id}
                  className="overflow-hidden hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">
                      {output.file_name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(output.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-4">
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {output.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {output.cannabinoid_profile && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                          Cannabinoid Profile
                        </span>
                      )}
                      {output.terpene_data && (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                          Terpene Data
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default OutputHistory;
