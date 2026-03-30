import { useState, useRef, useEffect, useCallback, MutableRefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Mode, Message, ExpertiseLevel, DiagnosticQuizData, DiagnosticSubmission, SystemEvent, SocraticState } from "@/components/professor-ai/types";

const NO_MATERIALS_FALLBACK_PHRASES = [
  "couldn't find relevant materials",
  "no relevant materials found",
  "content hasn't been uploaded yet",
];

// Pattern to detect expertise level set by AI in response
const EXPERTISE_LEVEL_PATTERN = /USER LEVEL SET:\s*\[?(Novice|Intermediate|Expert)\]?/i;

// Pattern to detect calibration request
const CALIBRATION_REQUEST_PATTERN = /CALIBRATION_REQUEST:\s*(\{.*?\})/;

// Pattern to detect diagnostic quiz event - greedy match to capture full nested JSON
const DIAGNOSTIC_EVENT_PATTERN = /DIAGNOSTIC_EVENT:\s*(\{[\s\S]*\})$/;

// Pattern to detect system events (e.g., persona shift)
const SYSTEM_EVENT_PATTERN = /SYSTEM_EVENT:\s*(\{[\s\S]*?\})(?:\s|$)/;

// Pattern to detect inline bloom_level JSON objects emitted by the backend
const BLOOM_LEVEL_PATTERN = /\{"type"\s*:\s*"bloom_level"[^}]*\}/g;

interface UseProfessorChatProps {
  selectedCourse: string | null;
  selectedBatch: string | null;
  selectedLecture: string | null;
  mode: Mode;
  expertiseLevel: ExpertiseLevel;
  onExpertiseLevelChange?: (level: ExpertiseLevel) => void;
}

export const useProfessorChat = ({
  selectedCourse,
  selectedBatch,
  selectedLecture,
  mode,
  expertiseLevel,
  onExpertiseLevelChange,
}: UseProfessorChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
  const [calibrationRequest, setCalibrationRequest] = useState<{ topic: string } | null>(null);
  const [diagnosticQuiz, setDiagnosticQuiz] = useState<DiagnosticQuizData | null>(null);
  const [isGeneratingDiagnostic, setIsGeneratingDiagnostic] = useState(false);
  const [socraticState, setSocraticState] = useState<SocraticState | null>(null);

  // Session ID for chat persistence - persists for the duration of the user's visit
  const sessionIdRef = useRef<string>(crypto.randomUUID());


  // Clear chat when mode or lecture changes
  useEffect(() => {
    setMessages([]);
    setStreamingContent("");
  }, [mode, selectedLecture]);

  const checkForNoMaterialsFallback = (content: string): boolean => {
    const lowerContent = content.toLowerCase();
    return NO_MATERIALS_FALLBACK_PHRASES.some(phrase => lowerContent.includes(phrase));
  };

  // Parse AI response for expertise level auto-detection and strip the tag
  const parseAndStripExpertiseLevel = useCallback((content: string): string => {
    const match = content.match(EXPERTISE_LEVEL_PATTERN);
    if (match && onExpertiseLevelChange) {
      const detectedLevel = match[1] as ExpertiseLevel;
      console.log("Auto-detected expertise level:", detectedLevel);
      onExpertiseLevelChange(detectedLevel);
    }
    // Strip the tag from the content for display
    return content.replace(EXPERTISE_LEVEL_PATTERN, '').trim();
  }, [onExpertiseLevelChange]);

  // Parse AI response for calibration request and strip the tag
  const parseAndStripCalibrationRequest = useCallback((content: string): string => {
    const match = content.match(CALIBRATION_REQUEST_PATTERN);
    if (match) {
      try {
        const jsonStr = match[1];
        const data = JSON.parse(jsonStr);
        if (data.topic) {
          console.log("Detected calibration request:", data);
          setCalibrationRequest({ topic: data.topic });
        }
      } catch (e) {
        console.error("Failed to parse calibration request:", e);
      }
      return content.replace(CALIBRATION_REQUEST_PATTERN, '').trim();
    }
    return content;
  }, []);

  // Parse AI response for diagnostic quiz event and strip the tag
  const parseAndStripDiagnosticEvent = useCallback((content: string): string => {
    const match = content.match(DIAGNOSTIC_EVENT_PATTERN);
    if (match && match[1]) {
      try {
        const jsonStr = match[1].trim();
        const data = JSON.parse(jsonStr);
        const cleanResponse = content.replace(DIAGNOSTIC_EVENT_PATTERN, '').trim();

        // Handle both new (Object) and old (Array) formats
        if (data.questions && Array.isArray(data.questions)) {
          // Format A: Already has topic_slug and questions structure
          console.log("Detected diagnostic quiz event (object format):", data);
          setDiagnosticQuiz(data as DiagnosticQuizData);
        } else if (Array.isArray(data)) {
          // Format B: Raw array of questions - wrap in object
          console.log("Detected diagnostic quiz event (array format):", data);
          setDiagnosticQuiz({
            topic_slug: "general-review",
            title: "Knowledge Check",
            questions: data,
          });
        }
        return cleanResponse;
      } catch (e) {
        console.error("Failed to parse diagnostic event:", e);
        // If parsing fails, return original content to avoid losing data
        return content;
      }
    }
    return content;
  }, []);

  // Parse AI response for system events (e.g., persona shift) and strip the tag
  const parseAndStripSystemEvent = useCallback((content: string): string => {
    const match = content.match(SYSTEM_EVENT_PATTERN);
    if (match) {
      try {
        const jsonStr = match[1];
        const data = JSON.parse(jsonStr) as SystemEvent;
        console.log("Detected system event:", data);
        
        if (data.type === "persona_shift") {
          const personaName = data.persona || "Adaptive Mode";
          toast({
            title: `Switching to ${personaName} 🧠`,
            description: data.message || "Adjusting teaching style based on your responses.",
          });
        }
      } catch (e) {
        console.error("Failed to parse system event:", e);
      }
      return content.replace(SYSTEM_EVENT_PATTERN, '').trim();
    }
    return content;
  }, []);

  const saveConversationAndMessage = async (userContent: string, assistantContent: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;

      const userId = session.session.user.id;
      let conversationId = activeConversationId;

      // Create conversation if it doesn't exist
      if (!conversationId) {
        const title = userContent.slice(0, 50) + (userContent.length > 50 ? "..." : "");
        const { data: newConversation, error: convError } = await supabase
          .from("conversations")
          .insert({
            user_id: userId,
            title,
            class_id: selectedCourse || "",
            mode,
          })
          .select()
          .single();

        if (convError) throw convError;
        conversationId = newConversation.id;
        setActiveConversationId(conversationId);
      }

      // Save user message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: userContent,
      });

      // Save assistant message and get its ID
      const { data: assistantMsg, error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          content: assistantContent,
        })
        .select()
        .single();

      if (msgError) throw msgError;
      return assistantMsg.id;
    } catch (error) {
      console.error("Error saving conversation:", error);
      return null;
    }
  };

  const sendMessage = async (content: string, isHidden = false) => {
    if (!selectedCourse) return;

    // Keep message content as pure user query (file context sent separately)
    const messageContent = content;

    const userMessage: Message = { role: "user", content };

    // Only show user message if not hidden
    if (!isHidden) {
      setMessages(prev => [...prev, userMessage]);
    }

    setIsLoading(true);
    setStreamingContent("");
    setCalibrationRequest(null);
    setIsGeneratingDiagnostic(false);

    try {
      // Fetch authenticated user ID and session token for backend
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id || null;
      const token = sessionData.session?.access_token || "";

      // Send selectedLecture as null or empty string if "All Lectures" is selected or not selected
      const lectureToSend = selectedLecture === "__all__" ? null : selectedLecture;

      // Create the message with file context for the API
      const apiUserMessage: Message = { role: "user", content: messageContent };

      // Resolve course display name for the backend
      const cohortPersonas = (personasData as any)[selectedBatch || "2029"] || {};
      const courseInfo = cohortPersonas[selectedCourse || ""];
      const courseDisplayName = courseInfo?.display_name || selectedCourse;

      // Limit history to last 20 messages to keep requests bounded
      const recentMessages = messages.slice(-20);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${token}`,
            "x-cohort-id": selectedBatch || "2029",
          },
          body: JSON.stringify({
            messages: [...recentMessages, apiUserMessage],
            mode,
            selectedCourse: selectedCourse,
            course_key: selectedCourse, // Alias for backend compatibility
            courseDisplayName, // Human-readable course name
            selectedLecture: lectureToSend, // The lecture title or null
            session_id: sessionIdRef.current, // Session ID for backend chat persistence
            cohort_id: selectedBatch,
            expertise_level: expertiseLevel, // Adaptive learning - user's expertise level
            user_id: userId, // Authenticated user ID for persistent memory
            file_context: uploadedFile ? `[CONTEXT FROM FILE: ${uploadedFile.name}]\n${uploadedFile.content}` : null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      // Check if streaming response
      const contentType = response.headers.get("content-type");

      if (contentType?.includes("text/event-stream") || contentType?.includes("text/plain")) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let sseBuffer = "";

        // RAF-debounced display updater to batch renders
        let rafHandle: number | undefined;
        let pendingDisplay = "";

        const updateDisplayContent = (accumulated: string) => {
          // Check for diagnostic event start
          if (accumulated.includes("DIAGNOSTIC_EVENT:")) {
            setIsGeneratingDiagnostic(true);
          }

          // Strip all event tags for display during streaming
          let displayContent = accumulated.replace(EXPERTISE_LEVEL_PATTERN, '').trim();
          displayContent = displayContent.replace(CALIBRATION_REQUEST_PATTERN, '').trim();

          // Special handling for diagnostic event to hide partial JSON
          if (displayContent.includes("DIAGNOSTIC_EVENT:")) {
            const index = displayContent.indexOf("DIAGNOSTIC_EVENT:");
            displayContent = displayContent.substring(0, index).trim();
          } else {
            displayContent = displayContent.replace(DIAGNOSTIC_EVENT_PATTERN, '').trim();
          }

          displayContent = displayContent.replace(SYSTEM_EVENT_PATTERN, '').trim();
          displayContent = displayContent.replace(BLOOM_LEVEL_PATTERN, '').trim();

          pendingDisplay = displayContent;
          if (rafHandle === undefined) {
            rafHandle = requestAnimationFrame(() => {
              setStreamingContent(pendingDisplay);
              rafHandle = undefined;
            });
          }
        };

        const processSSELine = (line: string) => {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const msgContent = parsed.choices?.[0]?.delta?.content || parsed.content || parsed.chunk || data;
              if (typeof msgContent === 'string') {
                accumulatedContent += msgContent;
                updateDisplayContent(accumulatedContent);
              }
            } catch {
              // If not valid JSON, treat as raw text only if it doesn't look like partial SSE JSON
              if (data.trim() && data !== '[DONE]' && !data.startsWith('{')) {
                accumulatedContent += data;
                updateDisplayContent(accumulatedContent);
              }
            }
          } else if (line.trim() && !line.startsWith(':') && !line.startsWith('{')) {
            // Handle non-SSE text chunks, but skip raw JSON fragments
            accumulatedContent += line;
            updateDisplayContent(accumulatedContent);
          }
        };

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });

            // Split by double newline to get complete SSE messages
            const messages = sseBuffer.split('\n\n');
            // Keep the last element as it may be incomplete
            sseBuffer = messages.pop() || "";

            for (const message of messages) {
              const lines = message.split('\n');
              for (const line of lines) {
                processSSELine(line);
              }
            }
          }

          // Process any remaining buffered data
          if (sseBuffer.trim()) {
            const lines = sseBuffer.split('\n');
            for (const line of lines) {
              processSSELine(line);
            }
          }
        }

        // Finalize streaming message
        setIsGeneratingDiagnostic(false);
        if (accumulatedContent) {
          // Parse for expertise level, calibration, diagnostic, and system events, strip tags from content
          let cleanedContent = parseAndStripExpertiseLevel(accumulatedContent);
          cleanedContent = parseAndStripCalibrationRequest(cleanedContent);
          cleanedContent = parseAndStripDiagnosticEvent(cleanedContent);
          cleanedContent = parseAndStripSystemEvent(cleanedContent);
          cleanedContent = cleanedContent.replace(BLOOM_LEVEL_PATTERN, '').trim();

          // Check for no materials fallback
          if (checkForNoMaterialsFallback(cleanedContent)) {
            toast({
              title: "No materials found",
              description: `Check if you're in the correct cohort (currently: ${selectedBatch}). Try switching between 2028 and 2029.`,
              variant: "destructive",
            });
          }

          // Save cleaned content to database and get message ID
          const messageId = await saveConversationAndMessage(content, cleanedContent);

          setMessages(prev => [
            ...prev,
            { id: messageId || undefined, role: "assistant", content: cleanedContent },
          ]);

          // Update socratic state after AI response in Study mode
          if (mode === "Study") {
            updateSocraticState(content);
          }
        }
        setStreamingContent("");
      } else {
        // Handle JSON response
        const data = await response.json();
        const responseContent = data.response || data.content || "No response received.";

        // Parse for expertise level, calibration, diagnostic, and system events, strip tags from content
        let cleanedContent = parseAndStripExpertiseLevel(responseContent);
        cleanedContent = parseAndStripCalibrationRequest(cleanedContent);
        cleanedContent = parseAndStripDiagnosticEvent(cleanedContent);
        cleanedContent = parseAndStripSystemEvent(cleanedContent);

        // Also check if backend returned expertise_level in metadata
        if (data.expertise_level && onExpertiseLevelChange) {
          console.log("Backend returned expertise level:", data.expertise_level);
          onExpertiseLevelChange(data.expertise_level as ExpertiseLevel);
        }

        // Check for no materials fallback
        if (checkForNoMaterialsFallback(cleanedContent)) {
          toast({
            title: "No materials found",
            description: `Check if you're in the correct cohort (currently: ${selectedBatch}). Try switching between 2028 and 2029.`,
            variant: "destructive",
          });
        }

        // Save cleaned content to database and get message ID
        const messageId = await saveConversationAndMessage(content, cleanedContent);

        const assistantMessage: Message = {
          id: messageId || undefined,
          role: "assistant",
          content: cleanedContent,
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Update socratic state after AI response in Study mode
        if (mode === "Study") {
          updateSocraticState(content);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
    }
  };

  const loadConversation = async (conversation: { id: string; class_id: string; mode: string }) => {
    try {
      setActiveConversationId(conversation.id);

      const { data: messagesData, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const loadedMessages: Message[] = (messagesData || []).map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      setMessages(loadedMessages);
      setStreamingContent("");
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive",
      });
    }
  };

  const resetChat = (regenerateSession = false) => {
    setMessages([]);
    setStreamingContent("");
    setActiveConversationId(null);
    setDiagnosticQuiz(null); // Clear diagnostic quiz state
    setCalibrationRequest(null); // Clear calibration request
    
    // Regenerate session ID when switching courses for expertise isolation
    if (regenerateSession) {
      sessionIdRef.current = crypto.randomUUID();
    }
  };

  const handleFileUpload = (file: { name: string; content: string } | null) => {
    setUploadedFile(file);
    if (file) {
      toast({
        title: "File loaded",
        description: `${file.name} is ready to use as context`,
      });
    }
  };

  // Submit diagnostic quiz results to backend
  const submitDiagnostic = async (payload: DiagnosticSubmission) => {
    try {
      // Fetch authenticated user ID and session token for backend
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id || null;
      const token = sessionData.session?.access_token || "";

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${token}`,
            "x-cohort-id": selectedBatch || "2029",
          },
          body: JSON.stringify({
            endpoint: "submit-diagnostic",
            session_id: sessionIdRef.current,
            cohort_id: selectedBatch,
            diagnostic_results: payload,
            user_id: userId, // Authenticated user ID for persistent memory
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to submit diagnostic quiz");
      }

      const data = await response.json();
      
      // Check for system event in response (persona shift)
      if (data.system_event) {
        const event = data.system_event as SystemEvent;
        if (event.type === "persona_shift") {
          const personaName = event.persona || "Adaptive Mode";
          toast({
            title: `Switching to ${personaName} 🧠`,
            description: event.message || "Adjusting teaching style based on your responses.",
          });
        }
      }

      // If there's a follow-up message from the AI, add it
      if (data.response) {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: data.response },
        ]);
      }

      // Close the diagnostic quiz
      setDiagnosticQuiz(null);

      toast({
        title: "Quiz submitted",
        description: "Your responses have been analyzed.",
      });
    } catch (error) {
      console.error("Error submitting diagnostic quiz:", error);
      toast({
        title: "Submission failed",
        description: "Failed to submit quiz. Please try again.",
        variant: "destructive",
      });
      throw error; // Re-throw to let DiagnosticQuiz handle loading state
    }
  };

  // Call socratic update after AI response in Study mode
  const updateSocraticState = async (userMessage: string) => {
    if (mode !== "Study") return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id || null;
      const token = sessionData.session?.access_token || "";

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-chat?endpoint=socratic-update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
            "x-cohort-id": selectedBatch || "2029",
          },
          body: JSON.stringify({
            user_id: userId,
            session_id: sessionIdRef.current,
            concept: userMessage.slice(0, 100),
            student_attempt: userMessage,
            was_correct: false,
            course_key: selectedCourse,
          }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        setSocraticState(data);
      }
    } catch (e) {
      console.error("Socratic update failed:", e);
    }
  };

  return {
    messages,
    setMessages,
    isLoading,
    streamingContent,
    sessionId: sessionIdRef.current,
    activeConversationId,
    sendMessage,
    loadConversation,
    resetChat,
    uploadedFile,
    handleFileUpload,
    calibrationRequest,
    setCalibrationRequest,
    diagnosticQuiz,
    setDiagnosticQuiz,
    submitDiagnostic,
    isGeneratingDiagnostic,
    socraticState,
    updateSocraticState,
  };
};
