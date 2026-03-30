import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Mode } from "./types";
import { useTaLock } from "@/contexts/TenantContext";

interface ProfessorHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  /** Read-only course identifier injected by the LMS. */
  selectedCourse: string | null;
  selectedMode: Mode;
  onModeChange: (mode: Mode) => void;
}

const modeOptions: { value: Mode; label: string }[] = [
  { value: "Study",        label: "Study"    },
  { value: "Quiz",         label: "Quiz"     },
  { value: "Notes Creator", label: "Notes"   },
  { value: "Pre-Read",     label: "Pre-Read" },
];

export const ProfessorHeader = ({
  sidebarOpen,
  onToggleSidebar,
  selectedCourse,
  selectedMode,
  onModeChange,
}: ProfessorHeaderProps) => {
  const { brandName, logoUrl } = useTaLock();

  const brandDisplay = logoUrl ? (
    <img src={logoUrl} alt={brandName} className="h-7 object-contain shrink-0" />
  ) : (
    <span className="font-bold text-primary shrink-0">{brandName}</span>
  );

  const modeSelector = (
    <Select value={selectedMode} onValueChange={(v) => onModeChange(v as Mode)}>
      <SelectTrigger className="w-[120px] bg-secondary/50 border-border/50 text-sm h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-popover border-border">
        {modeOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="bg-background border-b border-border/50 shrink-0">
      {/* Mobile/Tablet layout */}
      <div className="flex lg:hidden flex-col gap-2 py-2 px-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="h-9 w-9 shrink-0">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-base">{brandDisplay}</span>
          {selectedCourse && (
            <span className="flex-1 min-w-0 text-sm text-muted-foreground truncate px-1">
              {selectedCourse}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 px-1">
          {modeSelector}
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex items-center gap-3 py-2 px-4">
        <span className="text-lg">{brandDisplay}</span>
        <div className="flex items-center gap-2 flex-1 justify-center max-w-2xl px-4">
          {selectedCourse && (
            <span className="text-sm text-muted-foreground bg-secondary/50 border border-border/50 rounded-md px-3 h-9 flex items-center min-w-0 max-w-[240px] truncate">
              {selectedCourse}
            </span>
          )}
          {modeSelector}
        </div>
      </div>
      {/* Tab bar removed — "chat" is the only view; a single-tab bar is visual noise */}
    </div>
  );
};
