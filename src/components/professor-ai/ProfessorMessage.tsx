import { Sparkles, Copy, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import type { Message } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FeedbackModal } from "./FeedbackModal";
import { MermaidDiagram } from "./MermaidDiagram";

/** Convert markdown to clean plain text for clipboard copying. */
function markdownToPlainText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')                          // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')                       // bold
    .replace(/\*(.+?)\*/g, '$1')                           // italic
    .replace(/```[\s\S]*?```/g, (m) =>                     // code blocks → keep content
      m.replace(/```\w*\n?/g, '').trim()
    )
    .replace(/`(.+?)`/g, '$1')                             // inline code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')                    // links
    .replace(/\$\$(.+?)\$\$/gs, '$1')                      // block LaTeX
    .replace(/\$(.+?)\$/g, '$1')                           // inline LaTeX
    .replace(/^\s*[-*+]\s/gm, '• ')                        // bullets
    .replace(/\n{3,}/g, '\n\n')                            // excess newlines
    .trim();
}

/** Pre-process markdown to fix malformed GFM tables so remark-gfm can parse them. */
function fixMalformedTables(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    // Detect start of a table block (consecutive lines starting with |)
    if (lines[i].trimStart().startsWith('|')) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        block.push(lines[i]);
        i++;
      }

      if (block.length >= 2) {
        // Count columns per row
        const colCounts = block.map(line => {
          const stripped = line.trim().replace(/^\|/, '').replace(/\|$/, '');
          return stripped.split('|').length;
        });
        const maxCols = Math.max(...colCounts);

        // Check if there's a separator row (index 1 ideally)
        const isSep = (line: string) => /^\|[\s\-:|]+(\|[\s\-:|]+)*\|?\s*$/.test(line.trim());

        let sepIndex = block.findIndex(isSep);

        if (sepIndex === -1) {
          // No separator — insert one after the first row
          const sep = '| ' + Array(maxCols).fill('---').join(' | ') + ' |';
          block.splice(1, 0, sep);
        } else {
          // Separator exists but may have wrong column count — rebuild it
          const sep = '| ' + Array(maxCols).fill('---').join(' | ') + ' |';
          block[sepIndex] = sep;
        }

        // Pad any rows that have fewer columns
        for (let j = 0; j < block.length; j++) {
          if (isSep(block[j])) continue;
          const stripped = block[j].trim().replace(/^\|/, '').replace(/\|$/, '');
          const cells = stripped.split('|').map(c => c.trim());
          while (cells.length < maxCols) cells.push('');
          block[j] = '| ' + cells.join(' | ') + ' |';
        }

        result.push(...block);
      } else {
        result.push(...block);
      }
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join('\n');
}

interface ProfessorMessageProps {
  message: Message;
  isStreaming?: boolean;
  messageId?: string;
  sessionId?: string;
  userQuery?: string;
}

// Module-level markdown components — no dynamic dependencies, created once
const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-xl font-semibold text-primary mt-6 mb-3">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-lg font-semibold text-primary mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-base font-semibold text-chat-text mt-4 mb-2">{children}</h3>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-primary">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-chat-text-secondary">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-3 ml-1 space-y-2">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-3 ml-1 space-y-2 list-none counter-reset-item">{children}</ol>
  ),
  li: ({ children, ...props }: { children?: React.ReactNode; ordered?: boolean }) => {
    const isOrdered = props.ordered;
    return (
      <li className="relative pl-6 leading-relaxed text-chat-text">
        <span className={cn(
          "absolute left-0 top-0 flex items-start",
          isOrdered ? "text-primary font-medium" : ""
        )}>
          {isOrdered ? null : (
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
          )}
        </span>
        {children}
      </li>
    );
  },
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isCodeBlock = !!className;
    const isMermaid = className === 'language-mermaid';

    if (isMermaid && children) {
      return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
    }

    if (isCodeBlock) {
      return (
        <pre className="bg-secondary/60 border border-border/50 p-4 rounded-lg my-4 overflow-x-auto max-w-full">
          <code className="text-sm font-mono text-chat-text break-words">{children}</code>
        </pre>
      );
    }
    return (
      <code className="bg-secondary/80 px-1.5 py-0.5 rounded text-sm font-mono text-primary break-words">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => <div className="overflow-x-auto max-w-full">{children}</div>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-primary/50 pl-4 my-4 text-chat-text-secondary italic">
      {children}
    </blockquote>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a 
      href={href} 
      className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors" 
      target="_blank" 
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-4 w-full overflow-x-auto max-w-full rounded-lg border border-border/50">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-secondary/50 text-left">{children}</thead>,
  tbody: ({ children }: { children?: React.ReactNode }) => <tbody className="bg-background">{children}</tbody>,
  tr: ({ children }: { children?: React.ReactNode }) => <tr className="border-b border-border/50 last:border-0">{children}</tr>,
  th: ({ children }: { children?: React.ReactNode }) => <th className="px-4 py-3 font-semibold text-primary">{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td className="px-4 py-3 text-chat-text align-top">{children}</td>,
  details: ({ children }: { children?: React.ReactNode }) => (
    <details className="my-4 rounded-lg border border-border/50 bg-secondary/20 px-4 py-3 open:bg-secondary/30">
      {children}
    </details>
  ),
  summary: ({ children }: { children?: React.ReactNode }) => (
    <summary className="cursor-pointer font-medium text-primary hover:text-primary/80 select-none">
      {children}
    </summary>
  ),
};

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex, rehypeRaw];

export const ProfessorMessage = ({ message, isStreaming = false, messageId, sessionId, userQuery }: ProfessorMessageProps) => {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  // Load existing feedback on mount
  useEffect(() => {
    if (!messageId || isUser) return;

    const loadFeedback = async () => {
      try {
        const userId = window.TaLockConfig?.studentId ?? "";
        if (!userId) return;

        const { data } = await supabase
          .from("message_feedback")
          .select("feedback_type")
          .eq("message_id", messageId)
          .eq("user_id", userId)
          .maybeSingle();

        if (data) {
          const ratingFromType = data.feedback_type === 'up' ? 5 : data.feedback_type === 'down' ? 1 : null;
          if (ratingFromType) setFeedbackRating(ratingFromType);
        }
      } catch (error) {
        console.error("Error loading feedback:", error);
      }
    };

    loadFeedback();
  }, [messageId, isUser]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdownToPlainText(message.content));
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenFeedbackModal = () => {
    setFeedbackModalOpen(true);
  };

  const handleSubmitFeedback = async (rating: number, comment: string) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          query: userQuery || "",
          response: message.content,
          rating,
          comment: comment || undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit feedback");

      setFeedbackRating(rating);
      setFeedbackModalOpen(false);
      toast.success("Thanks for your feedback!");

      if (messageId) {
        const userId = window.TaLockConfig?.studentId ?? "";
        if (userId) {
          const feedbackType = rating >= 4 ? 'up' : rating <= 2 ? 'down' : 'up';
          await supabase
            .from("message_feedback")
            .upsert(
              {
                message_id: messageId,
                user_id: userId,
                feedback_type: feedbackType,
              },
              { onConflict: "message_id,user_id" }
            );
        }
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  // User message
  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[85%] md:max-w-[75%] overflow-hidden">
          <div className="bg-foreground text-background px-4 py-3 rounded-2xl rounded-br-sm shadow-md overflow-hidden max-w-full">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
              {message.content}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // AI message — single unified ReactMarkdown pass
  return (
    <div className="flex gap-4 animate-fade-in group max-w-full overflow-hidden">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shadow-lg shadow-primary/20">
        <Sparkles className="w-4 h-4 text-primary-foreground" />
      </div>
      
      <div className="flex-1 min-w-0 space-y-1 overflow-hidden max-w-full">
        <div className="text-[15px] leading-7 text-chat-text break-words overflow-hidden max-w-full [overflow-wrap:anywhere] professor-message-bubble">
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={markdownComponents}
          >
            {fixMalformedTables(message.content)}
          </ReactMarkdown>
          {isStreaming && (
            <span className="inline-block w-0.5 h-5 bg-primary ml-0.5 animate-blink align-middle" />
          )}
        </div>
        
        {!isStreaming && message.content.length > 0 && (
          <div className="flex items-center gap-0.5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-muted-foreground hover:text-foreground hover:bg-secondary/80 rounded-lg"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            
            {sessionId && (
              <>
                <div className="w-px h-4 bg-border mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 px-2.5 rounded-lg gap-1",
                    feedbackRating 
                      ? "text-yellow-500" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  )}
                  onClick={handleOpenFeedbackModal}
                  disabled={isSubmitting}
                >
                  <Star className={cn("h-4 w-4", feedbackRating && "fill-yellow-400")} />
                  {feedbackRating && <span className="text-xs">{feedbackRating}/5</span>}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        onSubmit={handleSubmitFeedback}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};
