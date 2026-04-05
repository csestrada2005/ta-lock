import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { apiFetch } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfessorSidebarNew } from "@/components/professor-ai/ProfessorSidebarNew";
import { QuizView } from "@/components/professor-ai/QuizView";
import { ChatView } from "@/components/professor-ai/ChatView";
import { FeedbackDialog } from "@/components/FeedbackDialog";

import { useTaLock } from "@/contexts/TaLockContext";
import type { Mode, Lecture } from "@/components/professor-ai/types";
import { useProfessorChat } from "@/hooks/useProfessorChat";
import { useProfessorQuiz } from "@/hooks/useProfessorQuiz";
import type { ExpertiseLevel } from "@/components/professor-ai/types";
import { X } from "lucide-react";

const modeOptions: { value: Mode; label: string }[] = [
  { value: "Study",         label: "Study"    },
  { value: "Quiz",          label: "Quiz"     },
  { value: "Notes Creator", label: "Notes"    },
  { value: "Pre-Read",      label: "Pre-Read" },
];

const ProfessorAI = () => {
  const { courseId, studentId, brandName, userRole, sessionExpiringSoon, dismissExpiryWarning } = useTaLock();

  const [mode, setMode] = useState<Mode>("Study");
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [lecturesError, setLecturesError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expertiseLevel, setExpertiseLevel] = useState<ExpertiseLevel>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const filteredLectures = lectures.filter((l) => l.class_name === courseId);

  const chat = useProfessorChat({
    selectedCourse: courseId,
    selectedLecture,
    mode,
    expertiseLevel,
    onExpertiseLevelChange: setExpertiseLevel,
  });

  const {
    calibrationRequest,
    setCalibrationRequest,
    diagnosticQuiz,
    setDiagnosticQuiz,
    submitDiagnostic,
    isGeneratingDiagnostic,
  } = chat;

  const quiz = useProfessorQuiz(courseId || undefined);

  // ── Fetch lectures ──
  useEffect(() => {
    if (!courseId) return;

    const fetchLectures = async () => {
      setLecturesLoading(true);
      setLecturesError(false);
      try {
        const response = await apiFetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-chat?endpoint=lectures&mode=${encodeURIComponent(mode)}`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          const validLectures = (data.lectures || []).filter(
            (lecture: Lecture) => lecture.id && lecture.id.trim() !== "",
          );
          setLectures(validLectures);
        } else {
          setLecturesError(true);
          setLectures([]);
        }
      } catch {
        setLecturesError(true);
        setLectures([]);
      } finally {
        setLecturesLoading(false);
      }
    };

    fetchLectures();
  }, [courseId, mode]);

  // ── Handlers ──
  const sendMessage = async (content: string, isHidden = false) => {
    if (mode === "Quiz") {
      quiz.generateQuiz(content);
      if (!isHidden) {
        chat.setMessages((prev) => [...prev, { role: "user", content }]);
      }
      return;
    }
    chat.sendMessage(content, isHidden);
  };

  const handleCreateNotes = () => {
    if (courseId && selectedLecture) {
      if (mode === "Notes Creator")
        sendMessage(`Summary of lecture ${selectedLecture}`, true);
      else if (mode === "Pre-Read")
        sendMessage(`Pre-read summary ${selectedLecture}`, true);
    }
  };

  const handleStartQuiz = () => {};

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setSelectedLecture(null);
    chat.resetChat();
    quiz.resetQuiz();
  };

  const handleNewChat = () => {
    chat.resetChat();
    quiz.resetQuiz();
  };

  const handleSelectConversation = async (conversation: {
    id: string;
    class_id: string;
    mode: string;
    title: string;
  }) => {
    try {
      setMode(conversation.mode as Mode);
      await chat.loadConversation(conversation);
      quiz.resetQuiz();
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const handleFeedback = () => setFeedbackOpen(true);

  const renderContent = () =>
    mode === "Quiz" ? (
      <QuizView
        quizLoading={quiz.quizLoading}
        quizResults={quiz.quizResults}
        currentQuiz={quiz.currentQuiz}
        onRetry={quiz.handleRetryQuiz}
        onNewQuiz={handleNewChat}
        onComplete={quiz.handleQuizComplete}
        onClose={quiz.handleQuizClose}
        messages={chat.messages}
        isLoading={chat.isLoading || quiz.quizLoading}
        streamingContent={chat.streamingContent}
        selectedLecture={selectedLecture}
        selectedCourse={courseId}
        mode={mode}
        onSendMessage={sendMessage}
        onStartQuiz={handleStartQuiz}
        onCreateNotes={handleCreateNotes}
        lectures={filteredLectures}
        onLectureChange={(lecture) => setSelectedLecture(lecture)}
        lecturesLoading={lecturesLoading}
        uploadedFile={chat.uploadedFile}
        onFileUpload={chat.handleFileUpload}
        sessionId={chat.sessionId}
        calibrationRequest={calibrationRequest}
        onCalibrationSelect={() => setCalibrationRequest(null)}
        diagnosticQuiz={diagnosticQuiz}
        onDiagnosticSubmit={submitDiagnostic}
        onDiagnosticClose={() => setDiagnosticQuiz(null)}
        isGeneratingDiagnostic={isGeneratingDiagnostic}
      />
    ) : (
      <ChatView
        messages={chat.messages}
        isLoading={chat.isLoading}
        streamingContent={chat.streamingContent}
        selectedLecture={selectedLecture}
        selectedCourse={courseId}
        mode={mode}
        onSendMessage={sendMessage}
        onStartQuiz={handleStartQuiz}
        onCreateNotes={handleCreateNotes}
        lectures={filteredLectures}
        onLectureChange={(lecture) => setSelectedLecture(lecture)}
        lecturesLoading={lecturesLoading}
        uploadedFile={chat.uploadedFile}
        onFileUpload={chat.handleFileUpload}
        sessionId={chat.sessionId}
        calibrationRequest={calibrationRequest}
        onCalibrationSelect={() => setCalibrationRequest(null)}
        diagnosticQuiz={diagnosticQuiz}
        onDiagnosticSubmit={submitDiagnostic}
        onDiagnosticClose={() => setDiagnosticQuiz(null)}
        isGeneratingDiagnostic={isGeneratingDiagnostic}
        socraticState={chat.socraticState}
      />
    );

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
      <ProfessorSidebarNew
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        activeConversationId={chat.activeConversationId}
        studentId={studentId}
        brandName={brandName}
        onFeedback={handleFeedback}
      />

      <div
        className={`flex flex-col flex-1 transition-all duration-300 ${sidebarOpen ? "lg:ml-80" : "lg:ml-14"}`}
      >
        {/* Session Expiry Warning Banner */}
        <div
          className={`overflow-hidden transition-all duration-500 ease-in-out bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-700 dark:text-yellow-500 flex items-center justify-between px-4 ${
            sessionExpiringSoon ? "max-h-16 py-2 opacity-100" : "max-h-0 py-0 opacity-0 border-transparent"
          }`}
        >
          <p className="text-sm font-medium">
            Your session will expire soon. Save your work and relaunch TaLock from Canvas to continue.
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={dismissExpiryWarning}
            className="h-6 w-6 text-yellow-700 hover:text-yellow-900 hover:bg-yellow-500/20 dark:text-yellow-500 dark:hover:text-yellow-400 dark:hover:bg-yellow-500/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Inline header — course locked from JWT, no logout */}
        <div className="bg-background border-b border-border/50 shrink-0">
          {/* Mobile layout */}
          <div className="flex lg:hidden items-center gap-2 py-2 px-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-9 w-9 shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-bold text-primary shrink-0">{brandName}</span>
            {courseId && (
              <span className="flex-1 min-w-0 text-sm text-muted-foreground truncate px-1">
                {courseId}
              </span>
            )}
            <Select value={mode} onValueChange={(v) => handleModeChange(v as Mode)}>
              <SelectTrigger className="w-[110px] bg-secondary/50 border-border/50 text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {modeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop layout */}
          <div className="hidden lg:flex items-center gap-3 py-2 px-4">
            <span className="font-bold text-primary shrink-0">{brandName}</span>
            {userRole === "instructor" && (
              <span className="text-xs font-semibold text-primary-foreground bg-primary px-2 py-0.5 rounded-full shrink-0">
                Instructor View
              </span>
            )}
            <div className="flex items-center gap-2 flex-1 justify-center max-w-2xl px-4">
              {courseId && (
                <span className="text-sm text-muted-foreground bg-secondary/50 border border-border/50 rounded-md px-3 h-9 flex items-center min-w-0 max-w-[240px] truncate">
                  {courseId}
                </span>
              )}
              <Select value={mode} onValueChange={(v) => handleModeChange(v as Mode)}>
                <SelectTrigger className="w-[120px] bg-secondary/50 border-border/50 text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {modeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {renderContent()}

        <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      </div>
    </div>
  );
};

export default ProfessorAI;
