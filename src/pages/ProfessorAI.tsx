import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ProfessorHeader } from "@/components/professor-ai/ProfessorHeader";
import { ProfessorSidebarNew } from "@/components/professor-ai/ProfessorSidebarNew";
import { QuizView } from "@/components/professor-ai/QuizView";
import { ChatView } from "@/components/professor-ai/ChatView";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { supabase } from "@/integrations/supabase/client";
import { useTaLock } from "@/contexts/TaLockContext";
import { getAuthToken } from "@/lib/auth";
import type { Mode, Lecture, ExpertiseLevel } from "@/components/professor-ai/types";
import { useProfessorChat } from "@/hooks/useProfessorChat";
import { useProfessorQuiz } from "@/hooks/useProfessorQuiz";

const ProfessorAI = () => {
  const { courseId, cohortId, term, studentId, brandName } = useTaLock();

  const [mode, setMode] = useState<Mode>("Study");
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(courseId || null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(cohortId || null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [lecturesError, setLecturesError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expertiseLevel, setExpertiseLevel] = useState<ExpertiseLevel>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const filteredLectures = selectedCourse
    ? lectures.filter((l) => l.class_name === selectedCourse)
    : [];

  const chat = useProfessorChat({
    selectedCourse,
    selectedBatch,
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

  const quiz = useProfessorQuiz(selectedCourse || undefined);

  // Sync from LTI context if it changes after mount
  useEffect(() => {
    if (courseId) setSelectedCourse(courseId);
    if (cohortId) setSelectedBatch(cohortId);
  }, [courseId, cohortId]);

  // ── Fetch lectures ──
  useEffect(() => {
    if (!selectedBatch) return;

    const fetchLectures = async () => {
      setLecturesLoading(true);
      setLecturesError(false);
      try {
        const headers: Record<string, string> = {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "x-cohort-id": selectedBatch,
          authorization: `Bearer ${getAuthToken()}`,
        };
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-chat?endpoint=lectures&mode=${encodeURIComponent(mode)}`,
          { headers },
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
  }, [selectedBatch, mode]);

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
    if (selectedCourse && selectedLecture) {
      if (mode === "Notes Creator")
        sendMessage(`Summary of lecture ${selectedLecture}`, true);
      else if (mode === "Pre-Read")
        sendMessage(`Pre-read summary ${selectedLecture}`, true);
    }
  };

  const handleStartQuiz = () => {};

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourse(courseId);
    setSelectedLecture(null);
    setExpertiseLevel(null);
    chat.resetChat(true);
    quiz.resetQuiz();
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
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
      setSelectedCourse(conversation.class_id);
      setMode(conversation.mode as Mode);
      await chat.loadConversation(conversation);
      quiz.resetQuiz();
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const handleFeedback = () => setFeedbackOpen(true);

  // ── Loading state — wait for LMS config to resolve ──
  if (!selectedBatch || !selectedCourse) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
        selectedCourse={selectedCourse}
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
        selectedCourse={selectedCourse}
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
        <ProfessorHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          selectedCourse={selectedCourse}
          selectedMode={mode}
          onModeChange={handleModeChange}
        />

        {renderContent()}

        <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      </div>
    </div>
  );
};

export default ProfessorAI;
