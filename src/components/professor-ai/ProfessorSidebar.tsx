import { BookOpen, Brain, GraduationCap, FileText, Loader2, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Mode, Lecture } from "./types";
import type { Course } from "@/services/mockApi";

interface ProfessorSidebarProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
  selectedLecture: string | null;
  setSelectedLecture: (lecture: string) => void;
  selectedCourse: string | null;
  setSelectedCourse: (course: string) => void;
  selectedBatch: string;
  setSelectedBatch: (batchId: string) => void;
  courses: Course[];
  lectures: Lecture[];
  lecturesLoading: boolean;
  lecturesError: boolean;
}

const modeConfig = [
  {
    value: "Notes Creator" as Mode,
    label: "Notes Creator",
    icon: FileText,
    emoji: "📝",
    description: "Auto-generate lecture summaries",
  },
  {
    value: "Quiz" as Mode,
    label: "Quiz",
    icon: Brain,
    emoji: "🧠",
    description: "Test your knowledge",
  },
  {
    value: "Study" as Mode,
    label: "Study",
    icon: GraduationCap,
    emoji: "🎓",
    description: "Socratic learning mode",
  },
  {
    value: "Pre-Read" as Mode,
    label: "Pre-Read",
    icon: BookOpen,
    emoji: "📖",
    description: "Summarize reading materials",
  },
];

export const ProfessorSidebar = ({
  mode,
  setMode,
  selectedLecture,
  setSelectedLecture,
  selectedCourse,
  setSelectedCourse,
  selectedBatch,
  setSelectedBatch,
  courses,
  lectures,
  lecturesLoading,
  lecturesError,
}: ProfessorSidebarProps) => {
  const hasLectures = lectures.length > 0;
  const hasCourses = courses.length > 0;
  const isLectureDisabled = lecturesLoading || !selectedCourse;
  
  const getLecturePlaceholderText = () => {
    if (!selectedCourse) return "Select a course first";
    if (lecturesLoading) return "Loading lectures...";
    if (lecturesError) return "Failed to load lectures";
    return "Select a Lecture...";
  };

  // Check if a specific lecture is selected (not "All Lectures")
  const hasSpecificLecture = selectedLecture && selectedLecture !== "__all__";

  return (
    <aside className="w-72 min-w-72 h-full bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Professor AI</h1>
            <p className="text-xs text-muted-foreground">Your Academic Assistant</p>
          </div>
        </div>
      </div>

      {/* Batch Selector */}
      <div className="p-4 border-b border-border/50">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block font-medium">
          Batch
        </Label>
        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
          <SelectTrigger className="w-full bg-secondary/50 border-border/50 text-foreground hover:bg-secondary/70 transition-colors">
            <SelectValue placeholder="Select Batch..." />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="2029">2029 Batch</SelectItem>
            <SelectItem value="2028">2028 Batch</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Course Selector */}
      <div className="p-4 border-b border-border/50">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block font-medium">
          Course
        </Label>
        <Select 
          value={selectedCourse || ""} 
          onValueChange={setSelectedCourse}
          disabled={!hasCourses}
        >
          <SelectTrigger className="w-full bg-secondary/50 border-border/50 text-foreground hover:bg-secondary/70 transition-colors">
            <SelectValue placeholder={hasCourses ? "Select a Course..." : "No courses available"} />
          </SelectTrigger>
          {hasCourses && (
            <SelectContent className="bg-popover border-border max-h-[300px]">
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  <span className="text-sm">{course.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          )}
        </Select>
      </div>

      {/* Lecture Selector */}
      <div className="p-4 border-b border-border/50">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block font-medium">
          Lecture
        </Label>
        <Select 
          value={selectedLecture || ""} 
          onValueChange={setSelectedLecture}
          disabled={isLectureDisabled}
        >
          <SelectTrigger className="w-full bg-secondary/50 border-border/50 text-foreground hover:bg-secondary/70 transition-colors">
            {lecturesLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <SelectValue placeholder={getLecturePlaceholderText()} />
            )}
          </SelectTrigger>
          {selectedCourse && (
            <SelectContent className="bg-popover border-border max-h-[300px]">
              {/* All Lectures option */}
              <SelectItem value="__all__">
                <span className="text-sm font-medium">All Lectures</span>
              </SelectItem>
              
              {/* Individual lectures */}
              {hasLectures ? (
                lectures.map((lecture) => (
                  <SelectItem key={lecture.id} value={lecture.title}>
                    <span className="text-sm">{lecture.title}</span>
                  </SelectItem>
                ))
              ) : (
                !lecturesLoading && !lecturesError && (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                    No specific sessions found for this course
                  </div>
                )
              )}
            </SelectContent>
          )}
        </Select>

        {/* Transcript indicator for Notes Creator mode */}
        {mode === "Notes Creator" && hasSpecificLecture && (
          <div className="mt-3 flex items-center gap-2 text-xs bg-green-500/10 text-green-500 px-3 py-2 rounded-lg border border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-medium">Transcript Available</span>
          </div>
        )}
      </div>

      {/* Mode Selector */}
      <div className="p-4 flex-1 overflow-y-auto">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block font-medium">
          Learning Mode
        </Label>
        <RadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as Mode)}
          className="space-y-2"
        >
          {modeConfig.map((item) => (
            <label
              key={item.value}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                mode === item.value
                  ? "bg-primary/15 border border-primary/40 shadow-[var(--shadow-soft)]"
                  : "bg-secondary/30 border border-transparent hover:bg-secondary/50 hover:border-border/50"
              }`}
            >
              <RadioGroupItem
                value={item.value}
                id={item.value}
                className="border-border text-primary"
              />
              <div className="flex items-center gap-2 flex-1">
                <span className="text-lg">{item.emoji}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Powered by RAG Technology</span>
        </div>
      </div>
    </aside>
  );
};
