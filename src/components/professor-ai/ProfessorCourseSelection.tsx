import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Course } from "@/services/mockApi";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CourseGroup {
  name: string;
  courses: Course[];
}

interface ProfessorCourseSelectionProps {
  batch: string;
  term: string;
  courses: Course[];
  onCourseSelect: (courseId: string) => void;
  onBack: () => void;
}

const TERM_NAMES: Record<string, string> = {
  term1: "Term 1 - Dubai",
  term2: "Term 2 - India",
  term3: "Term 3 - Singapore/Malaysia",
  term4: "Term 4 - Ghana",
};

// Course groupings by batch and term
const COURSE_GROUPS: Record<string, Record<string, CourseGroup[]>> = {
  "2029": {
    "term1": [
      {
        name: "Quantitative Tools for Business",
        courses: [
          { id: "AIML", name: "How do machines see, hear or speak" },
          { id: "Calculus", name: "Calculus" },
          { id: "Statistics", name: "How to use statistics to build a better business" },
          { id: "Excel", name: "How to use excel" },
        ],
      },
      {
        name: "Management Accounting",
        courses: [
          { id: "FinanceBasics", name: "How to understand basic financial terminology" },
        ],
      },
      {
        name: "Management Project - I",
        courses: [
          { id: "Dropshipping", name: "Dropshipping" },
          { id: "DRP101", name: "How to build a dropshipping business" },
          { id: "Startup", name: "How to validate, shape, and launch a startup" },
          { id: "OOP", name: "OOP" },
        ],
      },
      {
        name: "Microeconomics",
        courses: [
          { id: "LA101", name: "How to decode global trends and navigate economic transformations" },
        ],
      },
      {
        name: "Marketing Strategies",
        courses: [
          { id: "MarketAnalysis", name: "How to read market for better decision making" },
          { id: "MarketGaps", name: "How to identify gaps in the market" },
          { id: "MetaMarketing", name: "How to execute digital marketing on Meta" },
          { id: "CRO", name: "How to execute CRO and increase AOV" },
        ],
      },
      {
        name: "Communication Skills",
        courses: [
          { id: "PublicSpeaking", name: "How to own a stage" },
          { id: "Networking", name: "How to network effortlessly" },
        ],
      },
    ],
    "term2": [
      {
        name: "Career Labs",
        courses: [
          { id: "CareerLabs", name: "Career Labs" },
        ],
      },
      {
        name: "Management Project - II",
        courses: [
          { id: "OfflineMarket", name: "How to Crack the offline Market" },
          { id: "GlobalStartupEcon", name: "How to understand the Economics for Global Start-up ecosystem" },
          { id: "D2CBusiness", name: "How to build a D2C Business" },
          { id: "CapstoneHours", name: "Capstone Hours" },
        ],
      },
      {
        name: "Managerial Accounting",
        courses: [
          { id: "BusinessMetrics", name: "How to use Business Metrics to Enhance Efficiency and Drive Innovation" },
          { id: "TaxesCompliance", name: "How to understand Taxes and Compliances" },
        ],
      },
      {
        name: "Global Macroeconomics",
        courses: [
          { id: "EconomicForces", name: "How to understand Economics Forces that Shape the World" },
        ],
      },
      {
        name: "Organisational Behaviour",
        courses: [
          { id: "WorldCultures", name: "How to Connect World Cultures With Business Practices for Competitive Advantage" },
        ],
      },
      {
        name: "Consumer Behaviour",
        courses: [
          { id: "AIMarketing", name: "How can AI improve Marketing Strategies" },
          { id: "BillionDollarBrand", name: "How to Influence Consumers to Build a Billion Dollar Brand" },
        ],
      },
    ],
  },
  "2028": {
    "term3": [
      {
        name: "Management Project - III",
        courses: [
          { id: "KickstarterCampaign", name: "How to build a Kickstarter campaign?" },
          { id: "ProductDesignKickstarter", name: "How to develop and design a product for kickstarter success?" },
          { id: "FundraisingVideo", name: "How to craft a fundraising video that converts?" },
          { id: "CapstoneHours", name: "Capstone Hours" },
          { id: "PublicSpeakingLevel2", name: "How to own a stage – Level 2" },
          { id: "CopywritingSells", name: "How to craft compelling copy that sells and builds trust" },
        ],
      },
      {
        name: "Entrepreneurship, Innovation and Design",
        courses: [
          { id: "Web3Innovation", name: "How to leverage web3 for entrepreneurial innovation" },
          { id: "BusinessMetrics", name: "How to use business metrics to enhance efficiency and drive innovation" },
          { id: "FundraisingStartups", name: "How can founders raise money for their start-ups" },
          { id: "IPProtection", name: "How to protect your ideas and innovations" },
          { id: "AIPython", name: "How to design AI-powered solutions with Python" },
        ],
      },
      {
        name: "Global Dynamics",
        courses: [
          { id: "SingaporePolicy", name: "Understanding modern Southeast Asia through Singaporean public policy" },
          { id: "EconomicForces", name: "How to understand economic forces that shape the world" },
        ],
      },
      {
        name: "Management Strategy",
        courses: [
          { id: "CompetitiveStrategy", name: "How can my business win against the competition" },
          { id: "NUSImmersion", name: "Strategy and innovation immersion at NUS" },
        ],
      },
      {
        name: "Market Research",
        courses: [
          { id: "CustomerInsights", name: "How to uncover what customers really want" },
        ],
      },
    ],
    "term4": [
      {
        name: "Behavioral Economics",
        courses: [
          { id: "NudgeBehavior", name: "How to Nudge to understand human behaviour" },
          { id: "SustainableNudges", name: "How to use nudges to promote sustainable and healthy behaviors" },
        ],
      },
      {
        name: "Corporate Finance",
        courses: [
          { id: "FinancialModels", name: "How to build Financial Models?" },
          { id: "ImpactInvestor", name: "How to Think Like an Impact Investor: Risk, Return, and SROI" },
        ],
      },
      {
        name: "Human Resources Management",
        courses: [
          { id: "TalentManagement", name: "How to attract, manage, and retain talent" },
          { id: "CrossCulturalLeadership", name: "How to negotiate and lead across diverse cultures and stakeholders" },
        ],
      },
      {
        name: "Management Project - IV",
        courses: [
          { id: "NonProfitBrand", name: "How to position & market your non-profit brand" },
        ],
      },
      {
        name: "Operations and Performance Management",
        courses: [
          { id: "SocialImpactVentures", name: "How to design and scale ventures delivering social impact with limited resources?" },
        ],
      },
    ],
  },
};

export const ProfessorCourseSelection = ({
  batch,
  term,
  onCourseSelect,
  onBack,
}: ProfessorCourseSelectionProps) => {
  const batchName = batch === "2029" ? "2029 Batch" : "2028 Batch";
  const termName = TERM_NAMES[term] || term;
  const courseGroups = COURSE_GROUPS[batch]?.[term] || [];

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  return (
    <div className="w-full max-w-4xl px-4 py-6 md:py-8 overflow-y-auto max-h-[calc(100vh-60px)]">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Term Selection
        </Button>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Subjects
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-card border-border text-muted-foreground px-4 py-1.5">
            {batchName}
          </Badge>
          <Badge variant="outline" className="bg-card border-border text-muted-foreground px-4 py-1.5">
            {termName.split(" - ")[0]}
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {courseGroups.map((group) => (
          <Collapsible
            key={group.name}
            open={expandedGroups.has(group.name)}
            onOpenChange={() => toggleGroup(group.name)}
          >
            <CollapsibleTrigger asChild>
              <div className="w-full bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <span className="text-lg font-medium text-foreground group-hover:text-primary transition-colors">
                      {group.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {group.courses.length} {group.courses.length === 1 ? "subject" : "subjects"}
                    </span>
                    {expandedGroups.has(group.name) ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3 pl-4">
                {group.courses.map((course) => (
                  <div
                    key={course.id}
                    className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:border-primary hover:shadow-lg transition-all group"
                    onClick={() => onCourseSelect(course.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-0">
                        {group.name.split(" ")[0]}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-medium text-foreground leading-snug mb-3">
                      {course.name}
                    </h3>
                    <Button className="w-full" variant="outline" size="sm">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
};
