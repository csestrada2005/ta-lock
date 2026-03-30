import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ProfessorHeader } from "@/components/professor-ai/ProfessorHeader";
import { ProfessorSidebarNew } from "@/components/professor-ai/ProfessorSidebarNew";
import { QuizView } from "@/components/professor-ai/QuizView";
import { ChatView } from "@/components/professor-ai/ChatView";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import type { Mode, Lecture, ExpertiseLevel, HeaderTab } from "@/components/professor-ai/types";
import { useProfessorChat } from "@/hooks/useProfessorChat";
import { useProfessorQuiz } from "@/hooks/useProfessorQuiz";

const ProfessorAI = () => {
  const { getCourses, getPersona, personas, ready: tenantReady, externalConfig } = useTenant();

  // ── Derive batch / term / course from LMS config or user email ──
  const [mode, setMode] = useState<Mode>("Study");
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(() =>
    localStorage.getItem("professorSelectedTerm"),
  );
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [lecturesError, setLecturesError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HeaderTab>("chat");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [expertiseLevel, setExpertiseLevel] = useState<ExpertiseLevel>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const availableCourses =
    selectedBatch && selectedTerm ? getCourses(selectedBatch, selectedTerm) : [];

  const filteredLectures = selectedCourse
    ? lectures.filter((l) => l.class_name === selectedCourse)
    : [];

  const getSelectedCourseDisplayName = () => {
    const course = availableCourses.find((c) => c.id === selectedCourse);
    return course?.name || selectedCourse;
  };

  const chat = useProfessorChat({
    selectedCourse,
    selectedBatch,
    selectedLecture,
    mode,
    expertiseLevel,
    onExpertiseLevelChange: setExpertiseLevel,
    personas,
  });

  const {
    calibrationRequest,
    setCalibrationRequest,
    diagnosticQuiz,
    setDiagnosticQuiz,
    submitDiagnostic,
    isGeneratingDiagnostic,
  } = chat;

  const quiz = useProfessorQuiz(getSelectedCourseDisplayName() || undefined);

  // ── Auth session tracking ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAccessToken(session?.access_token ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ── Resolve batch + course from LMS config or user email ──
  useEffect(() => {
    const init = async () => {
      // If LMS config provides courseId, we can skip user-email heuristics
      if (externalConfig?.courseId) {
        const batch = "2029"; // default; LMS could extend this later
        const term = "term1";
        setSelectedBatch(batch);
        setSelectedTerm(term);
        setSelectedCourse(externalConfig.courseId);
        localStorage.setItem("professorSelectedBatch", batch);
        localStorage.setItem("professorSelectedTerm", term);
        return;
      }

      // Fallback: derive from authenticated user email
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let batch = "2029";
      let isAdminUser = false;

      if (user?.email) {
        const email = user.email.toLowerCase();
        if (email.includes("2028")) batch = "2028";
        else if (email.includes("2029")) batch = "2029";
      }

      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (roleData) {
          isAdminUser = true;
          const storedBatch = localStorage.getItem("professorSelectedBatch");
          batch =
            storedBatch && (storedBatch === "2028" || storedBatch === "2029")
              ? storedBatch
              : "2029";
        }
      }

      setIsAdmin(isAdminUser);

      const storedBatch = localStorage.getItem("professorSelectedBatch");
      if (!isAdminUser && storedBatch && storedBatch !== batch) {
        localStorage.removeItem("professorSelectedTerm");
        setSelectedTerm(null);
        setSelectedCourse(null);
        setSelectedLecture(null);
        chat.resetChat();
        quiz.resetQuiz();
      }

      setSelectedBatch(batch);
      localStorage.setItem("professorSelectedBatch", batch);

      // Auto-select term if stored
      const storedTerm = localStorage.getItem("professorSelectedTerm");
      if (storedTerm) setSelectedTerm(storedTerm);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalConfig?.courseId]);

  // ── Fetch lectures ──
  useEffect(() => {
    if (!selectedBatch || !accessToken) return;

    const fetchLectures = async () => {
      setLecturesLoading(true);
      setLecturesError(false);
      try {
        const headers: Record<string, string> = {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "x-cohort-id": selectedBatch,
          authorization: `Bearer ${accessToken}`,
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
  }, [selectedBatch, mode, accessToken]);

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
      setActiveTab("chat");
      await chat.loadConversation(conversation);
      quiz.resetQuiz();
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleFeedback = () => setFeedbackOpen(true);

  // ── Loading state — wait for batch + course to resolve ──
  if (!selectedBatch || !selectedCourse) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "progress":
      case "analytics":
      case "guardrails":
        return null;
      default:
        return mode === "Quiz" ? (
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
    }
  };

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden">
      <ProfessorSidebarNew
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        activeConversationId={chat.activeConversationId}
        onLogout={handleLogout}
        onFeedback={handleFeedback}
      />

      <div
        className={`flex flex-col flex-1 transition-all duration-300 ${sidebarOpen ? "lg:ml-80" : "lg:ml-14"}`}
      >
        <ProfessorHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          selectedCourse={selectedCourse}
          onCourseChange={handleCourseSelect}
          selectedMode={mode}
          onModeChange={handleModeChange}
          selectedBatch={selectedBatch}
          selectedTerm={selectedTerm || "term1"}
          onTermChange={() => {}}
          courses={availableCourses}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isAdmin={isAdmin}
        />

        {renderTabContent()}

        <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      </div>
    </div>
  );
};

export default ProfessorAI;
