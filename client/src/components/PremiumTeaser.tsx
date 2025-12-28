import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

interface PremiumTeaserProps {
  title: string;
  description: string;
  ctaText?: string;
  icon?: React.ReactNode;
  className?: string;
}

export default function PremiumTeaser({
  title,
  description,
  ctaText = "Jetzt upgraden",
  icon,
  className = "",
}: PremiumTeaserProps) {
  const [, setLocation] = useLocation();

  return (
    <Card className={`relative overflow-hidden border-2 border-teal-500/30 ${className}`}>
      {/* Gradient border effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-cyan-500/10 to-transparent pointer-events-none" />
      
      {/* Premium badge */}
      <div className="absolute top-4 right-4 z-10">
        <Badge className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white border-0">
          <Sparkles className="w-3 h-3 mr-1" />
          Premium
        </Badge>
      </div>

      <CardContent className="relative p-8 space-y-6">
        {/* Blur effect overlay */}
        <div className="absolute inset-0 backdrop-blur-[2px] bg-background/40 pointer-events-none" />
        
        {/* Content */}
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            {icon || <Lock className="w-8 h-8 text-teal-500" />}
            <h3 className="text-2xl font-bold">{title}</h3>
          </div>
          
          <p className="text-muted-foreground text-lg">
            {description}
          </p>

          <Button
            onClick={() => setLocation("/pricing")}
            size="lg"
            className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            {ctaText}
          </Button>

          <div className="text-sm text-muted-foreground">
            <p>✨ Einmalige Zahlung von CHF 10.00</p>
            <p>🔒 Lebenslanger Zugriff auf alle Premium-Features</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
