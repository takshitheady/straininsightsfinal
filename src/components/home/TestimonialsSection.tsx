import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";

// Testimonial interface
interface Testimonial {
  id: number;
  name: string;
  role: string;
  company: string;
  content: string;
  avatar: string;
}

export default function TestimonialsSection() {
  // Sample testimonials data
  const testimonials: Testimonial[] = [
    {
      id: 1,
      name: "Sarah Johnson",
      role: "Product Manager",
      company: "GreenLeaf Dispensary",
      content:
        "StrainInsights AI has transformed how we create product listings. The lab report extraction is incredibly accurate, and the descriptions it generates perfectly capture each strain's unique qualities.",
      avatar: "sarah",
    },
    {
      id: 2,
      name: "Michael Chen",
      role: "Marketing Director",
      company: "Cannatech Solutions",
      content:
        "The time savings are incredible. What used to take our team hours of manual data entry now happens in seconds. The customizable descriptions have improved our product pages significantly.",
      avatar: "michael",
    },
    {
      id: 3,
      name: "Aisha Patel",
      role: "Compliance Officer",
      company: "Pure Cultivation",
      content:
        "As someone responsible for compliance, I appreciate how StrainInsights AI ensures accuracy in our product information. The extraction is precise and the data is always reliable.",
      avatar: "aisha",
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-gray-200 text-gray-800 hover:bg-gray-300 border-none">
            Testimonials
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-black">
            Trusted by Cannabis Professionals
          </h2>
          <p className="text-gray-600 max-w-[700px] mx-auto">
            See what industry leaders have to say about StrainInsights AI.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.id}
              className="border-gray-200 bg-gradient-to-b from-white to-gray-50 shadow-md"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${testimonial.avatar}`}
                      alt={testimonial.name}
                    />
                    <AvatarFallback>{testimonial.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base text-black">
                      {testimonial.name}
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      {testimonial.role} at {testimonial.company}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-black text-black" />
                  ))}
                </div>
                <p className="text-gray-600">{testimonial.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
