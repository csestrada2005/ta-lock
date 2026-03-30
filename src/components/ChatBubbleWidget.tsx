import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";

interface ChatBubbleWidgetProps {
  children: React.ReactNode;
  /** Start expanded (standalone page mode) vs collapsed (embed mode) */
  defaultOpen?: boolean;
}

/**
 * Embeddable widget wrapper. Renders children inside a contained panel
 * that can be toggled via a floating chat bubble.
 *
 * - Standalone (`defaultOpen=true`): fills 100% of parent, no bubble shown.
 * - Embed (`defaultOpen=false`): floating bubble in bottom-right; click to
 *   open a fixed-size dialog that contains the full app.
 */
export const ChatBubbleWidget = ({ children, defaultOpen = true }: ChatBubbleWidgetProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { brandName } = useTenant();

  // Standalone mode — just render children in a full-size container
  if (defaultOpen && isOpen) {
    return <div className="h-full w-full">{children}</div>;
  }

  return (
    <>
      {/* Floating chat bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "fixed bottom-6 right-6 z-[9999]",
            "flex items-center justify-center",
            "h-14 w-14 rounded-full",
            "bg-primary text-primary-foreground",
            "shadow-lg shadow-primary/30",
            "hover:scale-110 active:scale-95 transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          )}
          aria-label={`Open ${brandName}`}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Expanded panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Dialog container */}
          <div
            className={cn(
              "fixed z-[9999] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden",
              "flex flex-col",
              // Mobile: almost full screen
              "inset-3 sm:inset-auto",
              // Desktop: bottom-right positioned, fixed dimensions
              "sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[680px] lg:w-[480px] lg:h-[720px]",
            )}
          >
            {/* Close bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/30 shrink-0">
              <span className="text-sm font-semibold text-foreground">{brandName}</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content — fills remaining space */}
            <div className="flex-1 min-h-0 w-full">
              {children}
            </div>
          </div>
        </>
      )}
    </>
  );
};
