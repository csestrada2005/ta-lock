import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import FeatureCard from "@/components/FeatureCard";
import StepCard from "@/components/StepCard";
import VisitorCounter from "@/components/VisitorCounter";
import CountdownTimer from "@/components/CountdownTimer";
import { 
  Download, 
  Sparkles, 
  MessageCircle, 
  Users, 
  Database,
  ArrowRight,
  GraduationCap,
  Zap
} from "lucide-react";
import heroBanner from "@/assets/hero-banner.jpg";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const { logoUrl, brandName } = useTenant();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-subtle)]" />
        
        <div className="relative container mx-auto px-4 sm:px-6 py-12 sm:py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6 sm:space-y-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/30 animate-pulse">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                <span className="text-xs sm:text-sm font-semibold text-primary">Only for TETR Students</span>
              </div>
              
              <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold text-foreground leading-tight">
                Ask TETR: A TETR Way to Study
              </h1>
              
              <p className="text-base sm:text-lg text-muted-foreground">
                By: Juan Pablo Rocha, Alan Ayala and Samuel Estrada
              </p>
              
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl">
                Transform hours of lecture recordings into an AI tutor that knows everything from your classes. Ask questions, get summaries, and study smarter—all powered by your actual course content.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button 
                  size="lg" 
                  className="text-base sm:text-lg px-6 sm:px-10 py-5 sm:py-7 bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 hover:shadow-[var(--shadow-hover)] font-semibold"
                  onClick={async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                      navigate('/professor');
                    } else {
                      navigate('/auth');
                    }
                  }}
                >
                  Start Learning Now
                  <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </div>
              
              <div className="flex flex-col gap-3 sm:gap-4 pt-2 sm:pt-4">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>Free to Start</span>
                </div>
                <VisitorCounter />
                <CountdownTimer />
              </div>
            </div>
            
            <div className="relative animate-fade-in-delay group order-first lg:order-last">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/30 to-primary/10 rounded-3xl blur-3xl group-hover:blur-2xl transition-all" />
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent rounded-2xl" />
              <img 
                src={heroBanner} 
                alt="AI Tutor Interface" 
                className="relative rounded-2xl shadow-2xl w-full border border-primary/20 transition-transform group-hover:scale-[1.02]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="py-12 sm:py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/20 mb-4 sm:mb-6">
              <span className="text-xs sm:text-sm font-semibold text-primary">Built for TETR Students</span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              Study Smarter, Not Harder
            </h2>
            <p className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto px-2">
              We understand the challenges you face. Here's how we help:
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {[
              { pain: "Hours wasted scrubbing through recordings", solved: "Instant answers from your AI tutor" },
              { pain: "Messy transcripts impossible to study from", solved: "Clean, organized course materials" },
              { pain: "Can't remember everything from lectures", solved: "Your entire semester in one chatbot" },
              { pain: "Studying alone with no help", solved: "24/7 AI teaching assistant" }
            ].map((item, index) => (
              <div key={index} className="bg-card rounded-xl p-4 sm:p-6 border border-primary/10 shadow-sm hover:shadow-[var(--shadow-soft)] hover:border-primary/30 transition-all group">
                <p className="text-muted-foreground leading-relaxed mb-2 sm:mb-3 line-through text-xs sm:text-sm">"{item.pain}"</p>
                <p className="text-primary font-semibold flex items-center gap-2 text-sm sm:text-base group-hover:translate-x-1 transition-transform">
                  <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                  {item.solved}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/20 mb-4 sm:mb-6">
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
              <span className="text-xs sm:text-sm font-semibold text-primary">Powered by Advanced AI</span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 sm:mb-6">
              Everything You Need to Excel
            </h2>
            <p className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto px-2">
              Your complete AI-powered learning platform
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-7xl mx-auto">
            <FeatureCard
              icon={MessageCircle}
              title="Intelligent Q&A Chatbot"
              description="Ask anything about your lectures. The AI has processed all content and gives instant, accurate answers with sources."
              benefit="Stop scrubbing through videos—get answers instantly"
            />
            
            <FeatureCard
              icon={Database}
              title="Centralized Knowledge Hub"
              description="All course materials are processed and stored in a searchable knowledge base from your actual lectures."
              benefit="Your ultimate study partner for the entire semester"
            />
            
            <FeatureCard
              icon={GraduationCap}
              title="Exam Preparation Assistant"
              description="Generate summaries, practice questions, and topic reviews from your lectures to ace your exams."
              benefit="Prepare effectively with AI-generated study materials"
            />
          </div>
        </div>
      </section>


      {/* CTA Section */}
      <section className="py-12 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-accent to-primary opacity-5" />
        
        <div className="relative container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
            <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/30 mb-2 sm:mb-4">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs sm:text-sm font-semibold text-primary">Only for TETR Students</span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-6xl font-bold text-foreground px-2">
              Start Learning Smarter Today
            </h2>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
              Your AI tutor is ready. No setup required, no credit card needed. Jump straight into your course materials and start asking questions.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4 sm:pt-6">
              <Button 
                size="lg" 
                className="text-base sm:text-lg px-8 sm:px-12 py-6 sm:py-8 bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 hover:shadow-[var(--shadow-hover)] font-bold sm:text-xl"
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (session) {
                    navigate('/professor');
                  } else {
                    navigate('/auth');
                  }
                }}
              >
                Launch AI Tutor
                <ArrowRight className="ml-2 sm:ml-3 w-5 h-5 sm:w-6 sm:h-6" />
              </Button>
            </div>
            
            <p className="text-xs sm:text-sm text-muted-foreground pt-2 sm:pt-4">
              ✓ Free to start  •  ✓ All TETR courses available  •  ✓ Instant access
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">
            <div className="flex items-center justify-center">
              <img 
                src={logoUrl} 
                alt={brandName} 
                className="h-16 sm:h-24 w-auto"
              />
            </div>
            
            <p className="text-muted-foreground text-center text-xs sm:text-base">
              © 2025 Ask TETR: A TETR Way to Study. Built for TETR College of Business students.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
