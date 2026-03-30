import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Mode, HeaderTab } from "./types";
import type { Course } from "@/services/mockApi";
import { useTenant } from "@/contexts/TenantContext";

interface ProfessorHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  selectedCourse: string | null;
  onCourseChange: (course: string) => void;
  selectedMode: Mode;
  onModeChange: (mode: Mode) => void;
  selectedBatch: string;
  selectedTerm: string;
  onTermChange: (term: string) => void;
  courses: Course[];
  onLogout?: () => void;
  onFeedback?: () => void;
  onOpenCourseSelection?: () => void;
  activeTab: HeaderTab;
  onTabChange: (tab: HeaderTab) => void;
  isAdmin: boolean;
}

const modeOptions: {
  value: Mode;
  label: string;
}[] = [{
  value: "Study",
  label: "Study"
}, {
  value: "Quiz",
  label: "Quiz"
}, {
  value: "Notes Creator",
  label: "Notes"
}, {
  value: "Pre-Read",
  label: "Pre-Read"
}];

const TERM_OPTIONS_BY_BATCH: Record<string, { value: string; label: string }[]> = {
  "2029": [
    { value: "term1", label: "Term 1" },
    { value: "term2", label: "Term 2" },
  ],
  "2028": [
    { value: "term3", label: "Term 3" },
    { value: "term4", label: "Term 4" },
  ],
};

export const ProfessorHeader = ({
  sidebarOpen,
  onToggleSidebar,
  selectedCourse,
  onCourseChange,
  selectedMode,
  onModeChange,
  selectedBatch,
  selectedTerm,
  onTermChange,
  courses,
  onLogout,
  onFeedback,
  onOpenCourseSelection,
  activeTab,
  onTabChange,
  isAdmin,
}: ProfessorHeaderProps) => {
  const { brandName } = useTenant();
  const selectedCourseDisplay = courses.find(c => c.id === selectedCourse)?.name;
  const termOptions = TERM_OPTIONS_BY_BATCH[selectedBatch] || [];
  const selectedTermLabel = termOptions.find(t => t.value === selectedTerm)?.label || selectedTerm;

  const getMobileCourseLabel = () => {
    if (!selectedCourseDisplay) return "Select Course";
    const cleanedName = selectedCourseDisplay.replace(/^How to /i, '');
    if (cleanedName.length <= 18) return cleanedName;
    const truncated = cleanedName.substring(0, 18);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 10) return truncated.substring(0, lastSpace) + '...';
    return truncated + '...';
  };

  const tabs: { id: HeaderTab; label: string; adminOnly?: boolean }[] = [
    { id: "chat", label: "Chat" },
    { id: "progress", label: "My Progress" },
    { id: "analytics", label: "Cohort Analytics", adminOnly: true },
    { id: "guardrails", label: "Settings", adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="bg-background border-b border-border/50 shrink-0">
      {/* Mobile/Tablet layout */}
      <div className="flex lg:hidden flex-col gap-2 py-2 px-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="h-9 w-9 shrink-0">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-base font-bold text-primary shrink-0">{brandName}</span>
          <Button
            variant="outline"
            className="flex-1 min-w-0 bg-secondary/50 border-border/50 text-sm h-9 justify-start px-3"
            onClick={onOpenCourseSelection}
          >
            <span className="truncate">{getMobileCourseLabel()}</span>
          </Button>
        </div>
        
        {activeTab === "chat" && (
          <div className="flex items-center gap-2 px-1">
            <Select value={selectedMode} onValueChange={v => onModeChange(v as Mode)}>
              <SelectTrigger className="flex-1 bg-secondary/50 border-border/50 text-sm h-9">
                <SelectValue placeholder="Mode" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {modeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTerm} onValueChange={onTermChange}>
              <SelectTrigger className="flex-1 bg-secondary/50 border-border/50 text-sm h-9">
                <span className="truncate">{selectedTermLabel}</span>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {termOptions.map(term => (
                  <SelectItem key={term.value} value={term.value}>{term.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex items-center gap-2 py-2 px-4">
        <span className="text-lg font-bold text-primary shrink-0">AskTETR</span>
        {activeTab === "chat" && (
          <div className="flex items-center gap-2 flex-1 justify-center max-w-3xl px-4">
            <Button
              variant="outline"
              className="w-[220px] bg-secondary/50 border-border/50 text-sm h-9 justify-start"
              onClick={onOpenCourseSelection}
            >
              <span className="truncate">{selectedCourseDisplay || "Select a course"}</span>
            </Button>
            <Select value={selectedMode} onValueChange={v => onModeChange(v as Mode)}>
              <SelectTrigger className="w-[100px] bg-secondary/50 border-border/50 text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {modeOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTerm} onValueChange={onTermChange}>
              <SelectTrigger className="w-[90px] bg-secondary/50 border-border/50 text-sm h-9">
                <span className="truncate">{selectedTermLabel}</span>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {termOptions.map(term => (
                  <SelectItem key={term.value} value={term.value}>{term.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {activeTab !== "chat" && <div className="flex-1" />}
        <div className="w-[100px]" />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-2 md:px-4 pb-1 overflow-x-auto">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};
