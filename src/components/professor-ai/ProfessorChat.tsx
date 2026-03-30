import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, MessageSquare, ArrowUp, Search, Brain, FileText, Paperclip, X, BookOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ProfessorMessage } from "./ProfessorMessage";
import { KnowledgeLevelSelector, type KnowledgeLevel } from "./KnowledgeLevelSelector";
import { DiagnosticQuiz } from "./DiagnosticQuiz";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Mode, Message, Lecture, DiagnosticQuizData, DiagnosticSubmission, SocraticState } from "./types";

interface UploadedFile {
  name: string;
  content: string;
}

interface CalibrationRequest {
  topic: string;
}

interface ProfessorChatProps {
  messages: Message[];
  isLoading: boolean;
  streamingContent?: string;
  selectedLecture: string | null;
  selectedCourse: string | null;
  mode: Mode;
  onSendMessage: (content: string) => void;
  onStartQuiz: () => void;
  onCreateNotes: () => void;
  lectures: Lecture[];
  onLectureChange: (lecture: string) => void;
  lecturesLoading: boolean;
  uploadedFile?: UploadedFile | null;
  onFileUpload?: (file: UploadedFile | null) => void;
  sessionId?: string;
  calibrationRequest?: CalibrationRequest | null;
  onCalibrationSelect?: (level: KnowledgeLevel) => void;
  diagnosticQuiz?: DiagnosticQuizData | null;
  onDiagnosticSubmit?: (payload: DiagnosticSubmission) => Promise<void>;
  onDiagnosticClose?: () => void;
  isGeneratingDiagnostic?: boolean;
  socraticState?: SocraticState | null;
}

const quizSuggestions = [
  "Quiz me on key concepts",
  "Test my understanding of the main topics",
  "Create a quiz on recent lectures",
  "Help me review for an exam",
];

export const ProfessorChat = ({
  messages,
  isLoading,
  streamingContent = "",
  selectedLecture,
  selectedCourse,
  mode,
  onSendMessage,
  onStartQuiz,
  onCreateNotes,
  lectures,
  onLectureChange,
  lecturesLoading,
  uploadedFile,
  onFileUpload,
  sessionId,
  calibrationRequest,
  onCalibrationSelect,
  diagnosticQuiz,
  onDiagnosticSubmit,
  onDiagnosticClose,
  isGeneratingDiagnostic,
  socraticState,
}: ProfessorChatProps) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [lastUserQuery, setLastUserQuery] = useState<string>("");

  // Handle calibration level selection
  const handleCalibrationSelect = (level: KnowledgeLevel) => {
    let message = "";
    switch (level) {
      case "Novice":
        message = "I don't know anything about this topic.";
        break;
      case "Intermediate":
        message = "I have some knowledge about this.";
        break;
      case "Expert":
        message = "I'm an expert on the topic.";
        break;
    }
    // Send the level as a user message
    onSendMessage(message);
    // Notify parent to hide selector
    onCalibrationSelect?.(level);
  };

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Track if user is at bottom
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  // Auto-scroll on new messages
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [messages, isLoading, streamingContent]);

  // ResizeObserver for dynamic content (LaTeX rendering)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        scrollToBottom("auto");
      }
    });

    // Observe the scroll content
    const scrollContent = container.querySelector('.max-w-3xl');
    if (scrollContent) {
      resizeObserver.observe(scrollContent);
    }

    return () => resizeObserver.disconnect();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // For Quiz mode, don't require course selection
    if (mode !== "Quiz" && !selectedCourse) return;
    
    setLastUserQuery(input.trim());
    onSendMessage(input.trim());
    setInput("");
    // Reset textarea height after submit
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onFileUpload) return;

    // Reset input early
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      // Check if it's a simple text file we can read client-side
      const isTextFile = file.type === "text/plain" || 
                         file.name.endsWith(".txt") || 
                         file.name.endsWith(".md") ||
                         file.name.endsWith(".json") ||
                         file.name.endsWith(".py") ||
                         file.name.endsWith(".js") ||
                         file.name.endsWith(".ts") ||
                         file.name.endsWith(".csv");

      if (isTextFile) {
        // Read text files directly on client
        const textContent = await file.text();
        onFileUpload({ name: file.name, content: textContent });
        toast({
          title: "File loaded",
          description: `${file.name} is ready to use as context`,
        });
      } else {
        // Send binary documents to backend for processing
        toast({
          title: "Uploading and processing...",
          description: `Extracting text from ${file.name}`,
        });

        const token = getAuthToken();

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-chat?endpoint=upload`,
          {
            method: "POST",
            headers: {
              "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              "Authorization": `Bearer ${token}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const data = await response.json();
        const extractedContent = data.content || "";

        if (!extractedContent) {
          throw new Error("No content extracted from file");
        }

        onFileUpload({ name: file.name, content: extractedContent });
        toast({
          title: "File processed",
          description: `Successfully extracted text from ${file.name}`,
        });
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        title: "File processing failed",
        description: error instanceof Error ? error.message : "Failed to process file",
        variant: "destructive",
      });
    }
  };

  const handleRemoveFile = () => {
    if (onFileUpload) {
      onFileUpload(null);
    }
  };

  // Study and Quiz modes only need course selection
  // Notes Creator and Pre-Read modes require both course and specific lecture
  const needsLecture = mode === "Notes Creator" || mode === "Pre-Read";
  const hasSpecificLecture = selectedLecture && selectedLecture !== "__all__";
  
  // Quiz mode doesn't require course selection
  // Can chat if: quiz mode OR (course selected AND (not Notes Creator/Pre-Read OR has specific lecture))
  const canChat = mode === "Quiz" || (selectedCourse && (!needsLecture || hasSpecificLecture));
  const isInputDisabled = !canChat || isLoading;

  // Display text for lecture
  const getLectureDisplayText = () => {
    if (!selectedLecture) return "All Lectures";
    if (selectedLecture === "__all__") return "All Lectures";
    return selectedLecture;
  };

  // Pre-chat welcome screen
  if (messages.length === 0 && !streamingContent && !calibrationRequest && !isGeneratingDiagnostic) {
    return (
      <main className="flex-1 flex flex-col h-full bg-background">
        {/* Centered welcome content */}
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full flex flex-col items-center justify-center px-4 py-6 md:py-8">
            <div className="text-center space-y-4 md:space-y-6 max-w-2xl animate-fade-in">
              {/* Gradient icon */}
              <div className="inline-flex items-center justify-center w-14 h-14 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-lg mx-auto">
                {mode === "Notes Creator" ? (
                  <Sparkles className="w-7 h-7 md:w-10 md:h-10 text-primary" />
                ) : mode === "Pre-Read" ? (
                  <BookOpen className="w-7 h-7 md:w-10 md:h-10 text-primary" />
                ) : mode === "Quiz" ? (
                  <Brain className="w-7 h-7 md:w-10 md:h-10 text-primary" />
                ) : (
                  <Search className="w-7 h-7 md:w-10 md:h-10 text-primary" />
                )}
              </div>
              
              {/* Welcome text */}
              <div className="space-y-2">
                <h1 className="text-2xl md:text-4xl font-semibold text-chat-text">
                  {mode === "Quiz"
                    ? "What topic should I quiz you on?"
                    : !selectedCourse
                    ? "What would you like to learn?"
                    : mode === "Notes Creator" && !hasSpecificLecture
                    ? "Select a Lecture for Notes"
                    : mode === "Pre-Read" && !hasSpecificLecture
                    ? "Select a Lecture for Pre-Read Summary"
                    : "What would you like to learn?"}
                </h1>
                <p className="text-chat-text-secondary text-base md:text-lg px-2">
                  {mode === "Quiz"
                    ? "Type any topic and I'll generate a quiz for you"
                    : !selectedCourse
                    ? "Select a course to get started"
                    : mode === "Notes Creator" && !hasSpecificLecture
                    ? "Notes Creator requires a specific lecture selection"
                    : mode === "Pre-Read" && !hasSpecificLecture
                    ? "Pre-Read mode requires a specific lecture selection"
                    : `Ready to help you learn about ${getLectureDisplayText()}`}
                </p>
              </div>

              {/* Lecture selector for Notes Creator and Pre-Read modes */}
              {(mode === "Notes Creator" || mode === "Pre-Read") && selectedCourse && (
                <div className="space-y-4">
                  <div className="max-w-xs mx-auto">
                    <Select
                      value={selectedLecture || ""}
                      onValueChange={onLectureChange}
                      disabled={lecturesLoading}
                    >
                      <SelectTrigger className="w-full bg-secondary/50 border-border/50">
                        {lecturesLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Loading lectures...</span>
                          </div>
                        ) : (
                          <SelectValue placeholder="Select a lecture..." />
                        )}
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border max-h-[300px]">
                        {lectures.length > 0 ? (
                          lectures.map((lecture) => (
                            <SelectItem key={lecture.id} value={lecture.title}>
                              {lecture.title}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                            No lectures found for this course
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Create Notes / Pre-Read button */}
                  {hasSpecificLecture && (
                    <Button
                      onClick={onCreateNotes}
                      disabled={isLoading}
                      size="lg"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 shadow-lg hover:shadow-[var(--shadow-hover)] transition-all"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {mode === "Pre-Read" ? "Creating summary..." : "Creating notes..."}
                        </>
                      ) : (
                        <>
                          {mode === "Pre-Read" ? <BookOpen className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                          {mode === "Pre-Read" ? "Create Pre-Read Summary" : "Create Notes"}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            {/* Input area for Quiz mode and Study mode */}
            {(mode === "Quiz" || canChat) && mode !== "Notes Creator" && mode !== "Pre-Read" && (
              <div className="w-full max-w-3xl mt-6 md:mt-12 px-2">
                <form onSubmit={handleSubmit}>
                  <div className="flex items-end gap-2">
                    {/* File upload button - hidden for now */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {/* Button hidden but logic preserved
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 hover:bg-secondary rounded-full mb-0.5"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                    >
                      <Paperclip className="w-5 h-5" />
                    </Button>
                    */}
                    
                    <div className="relative flex-1">
                      <textarea
                        value={input}
                        onChange={(e) => {
                          setInput(e.target.value);
                          // Auto-resize textarea
                          e.target.style.height = 'auto';
                          e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={mode === "Quiz" ? "What topic should I quiz you on?" : "Ask anything..."}
                        disabled={isLoading}
                        rows={1}
                        className="w-full bg-secondary/60 backdrop-blur-md border border-border/50 rounded-2xl pl-4 pr-12 py-3 text-chat-text placeholder:text-chat-text-secondary text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all resize-none overflow-y-auto max-h-[200px]"
                        style={{ minHeight: '48px' }}
                      />
                      <Button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 p-0 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-30 shadow-md flex items-center justify-center"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowUp className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
                
                {/* Uploaded file indicator - hidden for now
                {uploadedFile && (
                  <div className="flex items-center justify-center gap-2 mt-3 px-3 py-2 bg-secondary/50 rounded-lg border border-border/30 max-w-md mx-auto">
                    <Paperclip className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-chat-text truncate">{uploadedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 hover:bg-destructive/20"
                      onClick={handleRemoveFile}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
                */}
                
                {/* Quick suggestions */}
                <div className="flex flex-wrap justify-center gap-2 mt-4 md:mt-6">
                  {(mode === "Quiz" ? quizSuggestions : ["Explain the key concepts", "Help me understand", "Give me examples"]).map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="px-3 md:px-4 py-2 text-xs md:text-sm rounded-full bg-secondary/40 border border-border/30 text-chat-text-secondary hover:text-chat-text hover:border-primary/30 hover:bg-secondary/60 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Show input placeholder when no course selected (not for Quiz mode) */}
            {!selectedCourse && mode !== "Quiz" && (
              <div className="w-full max-w-3xl mt-8 md:mt-12 px-2">
                <div className="relative">
                  <div className="w-full bg-secondary/40 border border-border/30 rounded-full px-6 py-4 pr-14 opacity-50">
                    <span className="text-chat-text-secondary text-sm">Select a course first...</span>
                  </div>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 p-0 rounded-full bg-primary/30 flex items-center justify-center">
                    <ArrowUp className="w-4 h-4 text-primary-foreground/50" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Chat mode with messages
  return (
    <main className="flex flex-col h-full bg-background overflow-hidden">
      {/* Messages area - flex-1 with min-h-0 ensures stable flex layout during streaming */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden professor-chat-scroll-area"
      >
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-8">
          {messages.map((message, index) => {
            // Find the preceding user message for feedback context
            const precedingUserQuery = message.role === "assistant" 
              ? messages.slice(0, index).reverse().find(m => m.role === "user")?.content || lastUserQuery
              : undefined;
            
            return (
              <ProfessorMessage 
                key={message.id || index} 
                message={message} 
                messageId={message.id}
                sessionId={sessionId}
                userQuery={precedingUserQuery}
              />
            );
          })}
          
          {/* Streaming content display */}
          {streamingContent && (
            <ProfessorMessage 
              message={{ role: "assistant", content: streamingContent }} 
              isStreaming={true}
              sessionId={sessionId}
              userQuery={lastUserQuery}
            />
          )}
          
          {isLoading && !streamingContent && (
            <div className="flex gap-4 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="flex items-center gap-2 text-chat-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">
                  {mode === "Quiz" ? "Generating quiz..." : "Thinking..."}
                </span>
              </div>
            </div>
          )}

          {isGeneratingDiagnostic && (
            <div className="flex items-center space-x-2 text-muted-foreground p-4 bg-secondary/20 rounded-lg animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">🧠 Generating knowledge check...</span>
            </div>
          )}

          {/* Diagnostic Quiz - inline as a chat message */}
          {diagnosticQuiz && onDiagnosticSubmit && (
            <DiagnosticQuiz
              quiz={diagnosticQuiz}
              onSubmit={onDiagnosticSubmit}
              onClose={onDiagnosticClose || (() => {})}
            />
          )}

          <div ref={messagesEndRef} className="h-8" />
        </div>
      </div>

      {/* Calibration Mode - Knowledge Level Selector */}
      {calibrationRequest && !diagnosticQuiz && (
        <div className="shrink-0 border-t border-border/30 bg-background/95 backdrop-blur-xl p-4 md:p-6 w-full">
          <div className="max-w-2xl mx-auto">
            <KnowledgeLevelSelector
              topic={calibrationRequest.topic}
              onSelect={handleCalibrationSelect}
            />
          </div>
        </div>
      )}

      {/* Input area at bottom - uses flex shrink-0 to stay in place */}
      {!calibrationRequest && (
        <div className="shrink-0 border-t border-border/30 bg-background/95 backdrop-blur-xl p-2 md:p-4 safe-area-inset-bottom w-full max-w-full overflow-hidden box-border">
          <div className="max-w-3xl mx-auto space-y-2 w-full box-border overflow-hidden">
            {/* Socratic hint counter */}
            {socraticState && socraticState.max_hints > 0 && (
              <div className="flex items-center justify-center gap-2">
                {socraticState.resolved && socraticState.resolution_type === "hints_exhausted" ? (
                  <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Switching to direct answers
                  </span>
                ) : (
                  <span className="text-xs px-3 py-1 rounded-full bg-secondary border border-border/50 text-muted-foreground">
                    Hint {socraticState.hints_given} of {socraticState.max_hints}
                  </span>
                )}
              </div>
            )}
            {/* Uploaded file indicator - hidden for now
            {uploadedFile && (
              <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg border border-border/30">
                <Paperclip className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-chat-text truncate flex-1">{uploadedFile.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 hover:bg-destructive/20"
                  onClick={handleRemoveFile}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            */}
            
            <form onSubmit={handleSubmit}>
              <div className="flex items-end gap-2">
                {/* File upload button - hidden for now */}
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {/* Button hidden but logic preserved
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 hover:bg-secondary rounded-full mb-0.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                */}
                
                {/* Input container with send button - properly centered */}
                <div className="flex-1 min-w-0 relative flex items-center overflow-hidden">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      // Auto-resize textarea
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      mode === "Quiz"
                        ? "What topic should I quiz you on?"
                        : !selectedCourse
                        ? "Select a course first..."
                        : "Ask anything..."
                    }
                    disabled={isInputDisabled}
                    rows={1}
                    className="w-full bg-secondary/70 backdrop-blur-md border border-border/50 rounded-2xl pl-4 pr-14 py-3 text-chat-text placeholder:text-chat-text-secondary text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 resize-none overflow-y-auto max-h-[200px]"
                    style={{ minHeight: '48px' }}
                  />
                  <Button
                    type="submit"
                    disabled={isInputDisabled || !input.trim()}
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 p-0 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-30 shadow-md flex items-center justify-center flex-shrink-0"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUp className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
