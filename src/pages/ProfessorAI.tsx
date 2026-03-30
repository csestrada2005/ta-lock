import { useState, useEffect } from "react";

import { Loader2 } from "lucide-react";
import { ProfessorTermSelection } from "@/components/professor-ai/ProfessorTermSelection";
import { ProfessorCourseSelection } from "@/components/professor-ai/ProfessorCourseSelection";
import { ProfessorHeader } from "@/components/professor-ai/ProfessorHeader";
import { ProfessorSidebarNew } from "@/components/professor-ai/ProfessorSidebarNew";
import { QuizView } from "@/components/professor-ai/QuizView";
import { ChatView } from "@/components/professor-ai/ChatView";
import { StudentProgressView } from "@/components/professor-ai/StudentProgressView";
import { CohortAnalyticsView } from "@/components/professor-ai/CohortAnalyticsView";
import { GuardrailsView } from "@/components/professor-ai/GuardrailsView";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import type { Mode, Lecture, ExpertiseLevel, HeaderTab } from "@/components/professor-ai/types";
import { useProfessorChat } from "@/hooks/useProfessorChat";
import { useProfessorQuiz } from "@/hooks/useProfessorQuiz";

const ProfessorAI = () => {
  const navigate = useNavigate();
  const { getCourses, getPersona, personas, ready: tenantReady } = useTenant();
  const [mode, setMode] = useState<Mode>("Study");
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(() => {
    return localStorage.getItem("professorSelectedTerm");
  });
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(false);
  const [lecturesError, setLecturesError] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HeaderTab>("chat");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  
  const [expertiseLevel, setExpertiseLevel] = useState<ExpertiseLevel>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const availableCourses = selectedBatch && selectedTerm 
    ? getCourses(selectedBatch, selectedTerm)
    : [];
  
  const filteredLectures = selectedCourse 
    ? lectures.filter(lecture => lecture.class_name === selectedCourse)
    : [];

  const getSelectedCourseDisplayName = () => {
    const course = availableCourses.find(c => c.id === selectedCourse);
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

  const { calibrationRequest, setCalibrationRequest, diagnosticQuiz, setDiagnosticQuiz, submitDiagnostic, isGeneratingDiagnostic } = chat;

  const quiz = useProfessorQuiz(getSelectedCourseDisplayName() || undefined);

  // Track auth session token
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAccessToken(session?.access_token ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const setBatchFromUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let batch = "2029";
      let isAdminUser = false;

      if (user?.email) {
        const email = user.email.toLowerCase();
        if (email.includes("2028")) batch = "2028";
        else if (email.includes("2029")) batch = "2029";
      }

      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (roleData) {
          isAdminUser = true;
          const storedBatch = localStorage.getItem("professorSelectedBatch");
          batch = storedBatch && (storedBatch === "2028" || storedBatch === "2029") ? storedBatch : "2029";
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
    };

    setBatchFromUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedBatch || !accessToken) return;

    const fetchLectures = async () => {
      setLecturesLoading(true);
      setLecturesError(false);
      try {
        const headers: Record<string, string> = {
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "x-cohort-id": selectedBatch,
          "authorization": `Bearer ${accessToken}`,
        };
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-chat?endpoint=lectures&mode=${encodeURIComponent(mode)}`,
          { headers }
        );

        if (response.ok) {
          const data = await response.json();
          const validLectures = (data.lectures || []).filter(
            (lecture: Lecture) => lecture.id && lecture.id.trim() !== ""
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

  const sendMessage = async (content: string, isHidden = false) => {
    if (mode === "Quiz") {
      quiz.generateQuiz(content);
      if (!isHidden) {
        chat.setMessages(prev => [...prev, { role: "user", content }]);
      }
      return;
    }
    chat.sendMessage(content, isHidden);
  };

  const handleCreateNotes = () => {
    if (selectedCourse && selectedLecture) {
      if (mode === "Notes Creator") sendMessage(`Summary of lecture ${selectedLecture}`, true);
      else if (mode === "Pre-Read") sendMessage(`Pre-read summary ${selectedLecture}`, true);
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

  const handleTermSelect = (termId: string) => {
    localStorage.setItem("professorSelectedTerm", termId);
    setSelectedTerm(termId);
    setSelectedCourse(null);
    setSelectedLecture(null);
    chat.resetChat();
    quiz.resetQuiz();
  };

  const handleBackToTermSelection = () => {
    localStorage.removeItem("professorSelectedTerm");
    setSelectedTerm(null);
    setSelectedCourse(null);
    setSelectedLecture(null);
    chat.resetChat();
    quiz.resetQuiz();
  };

  const handleOpenCourseSelection = () => {
    setSelectedCourse(null);
    setSelectedLecture(null);
    chat.resetChat();
    quiz.resetQuiz();
  };

  const handleNewChat = () => {
    chat.resetChat();
    quiz.resetQuiz();
  };

  const handleSelectConversation = async (conversation: { id: string; class_id: string; mode: string; title: string }) => {
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
    navigate("/auth");
  };

  const handleFeedback = () => setFeedbackOpen(true);

  if (!selectedBatch) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!selectedTerm) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <ProfessorTermSelection
          batch={selectedBatch} 
          onTermSelect={handleTermSelect} 
          onBatchChange={(newBatch) => {
            setSelectedBatch(newBatch);
            localStorage.setItem("professorSelectedBatch", newBatch);
          }}
          isDeveloper={isAdmin}
        />
      </div>
    );
  }

  if (!selectedCourse) {
    return (
      <div className="flex h-full items-center justify-center bg-background overflow-y-auto">
        <ProfessorCourseSelection
          batch={selectedBatch}
          term={selectedTerm}
          courses={availableCourses}
          onCourseSelect={handleCourseSelect}
          onBack={handleBackToTermSelection}
        />
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "progress":
        return <StudentProgressView selectedBatch={selectedBatch} />;
      case "analytics":
        return isAdmin ? <CohortAnalyticsView selectedBatch={selectedBatch} /> : null;
      case "guardrails":
        return isAdmin ? <GuardrailsView selectedBatch={selectedBatch} selectedCourse={selectedCourse} /> : null;
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

      <div className={`flex flex-col flex-1 transition-all duration-300 ${sidebarOpen ? "lg:ml-80" : "lg:ml-14"}`}>
        <ProfessorHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          selectedCourse={selectedCourse}
          onCourseChange={handleCourseSelect}
          selectedMode={mode}
          onModeChange={handleModeChange}
          selectedBatch={selectedBatch}
          selectedTerm={selectedTerm}
          onTermChange={handleTermSelect}
          courses={availableCourses}
          onOpenCourseSelection={handleOpenCourseSelection}
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
