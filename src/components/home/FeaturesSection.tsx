import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Shield,
  Database,
  Code,
  FileText,
  Flask,
  Cpu,
  FileSearch,
} from "lucide-react";

// Feature interface
interface Feature {
  title: string;
  description: string;
  icon: JSX.Element;
}

export default function FeaturesSection() {
  // Sample features data
  const features: Feature[] = [
    {
      title: "PDF Lab Report Extraction",
      description:
        "Upload cannabis lab reports and automatically extract cannabinoid profiles, terpene data, and testing information.",
      icon: <FileSearch className="h-10 w-10 text-black" />,
    },
    {
      title: "AI-Powered Analysis",
      description:
        "Our advanced AI algorithms accurately identify and extract key data points from various lab report formats.",
      icon: <Cpu className="h-10 w-10 text-black" />,
    },
    {
      title: "Terpene Profiling",
      description:
        "Detailed extraction of terpene data to highlight the unique characteristics and potential effects of each strain.",
      icon: <Flask className="h-10 w-10 text-black" />,
    },
    {
      title: "Marketing Content Generation",
      description:
        "Generate customizable product descriptions with different tone and style options for your marketing needs.",
      icon: <FileText className="h-10 w-10 text-black" />,
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-gray-200 text-gray-800 hover:bg-gray-300 border-none">
            Features
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-black">
            Powerful Lab Report Analysis
          </h2>
          <p className="text-gray-600 max-w-[700px] mx-auto">
            StrainInsights AI combines advanced extraction technology with
            intelligent content generation to streamline your cannabis product
            documentation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-md hover:shadow-lg transition-shadow"
            >
              <CardHeader>
                <div className="mb-4">{feature.icon}</div>
                <CardTitle className="text-black">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
