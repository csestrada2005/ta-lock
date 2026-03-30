import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./ChatMessage";
import { Loader2, Send, Sparkles, Paperclip, X, FileText, ArrowUp, GraduationCap, Search, Image, Camera, Plus, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { BatchSelection } from "./BatchSelection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
type Source = {
  content: string;
  metadata?: {
    class_name?: string;
    section?: string;
    title?: string;
    source_url?: string;
  };
  similarity?: number;
};
type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};
type Persona = {
  display_name?: string;
  professor_name?: string;
  system_prompt: string;
  initial_message?: string;
};
type BatchPersonas = Record<string, Record<string, Persona> | any>;
type Mode = "balanced" | "study" | "professor" | "socratic";
const MODE_DESCRIPTIONS = {
  balanced: "Balanced tutor - A helpful mix of guidance and explanation",
  study: "Study buddy - Helps you review and reinforce material",
  professor: "Professor mode - Authoritative first-person teaching style",
  socratic: "Socratic method - Guides you to discover answers through questions"
};
interface ChatInterfaceProps {
  onConversationChange?: (conversationId: string | null) => void;
}
export interface ChatInterfaceHandle {
  loadConversation: (conversationId: string) => Promise<void>;
  handleNewChat: () => void;
  activeConversationId: string | null;
}
export const ChatInterface = React.forwardRef<ChatInterfaceHandle, ChatInterfaceProps>(function ChatInterface({
  onConversationChange
}, ref) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedClass, setSelectedClass] = React.useState<string | null>(null);
  const [selectedMode, setSelectedMode] = React.useState<Mode>("balanced");
  const [selectedBatch, setSelectedBatch] = React.useState<string | null>(() => {
    return localStorage.getItem("selectedBatch");
  });
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = React.useState<{
    name: string;
    content: string;
    type: 'text' | 'image';
    imageData?: { media_type: string; data: string };
  } | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [attachMenuOpen, setAttachMenuOpen] = React.useState(false);
  const batchPersonas = (personas as BatchPersonas)[selectedBatch || "2029"] || {};
  const availableClasses = Object.keys(batchPersonas);
  const {
    toast
  } = useToast();
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    // Check if it's an image
    const isImage = file.type.startsWith('image/');
    
    // Check file type for text files
    const allowedTextTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/pdf', 'text/html', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const isTextFile = file.type.startsWith('text/') || allowedTextTypes.includes(file.type) || file.name.endsWith('.md') || file.name.endsWith('.txt');
    
    if (!isTextFile && !isImage) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a text file or image (png, jpg, gif, webp)",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      
      if (isImage) {
        // Extract base64 data from data URL
        const base64Data = result.split(',')[1];
        setUploadedFile({
          name: file.name,
          content: result, // Keep full data URL for preview
          type: 'image',
          imageData: {
            media_type: file.type,
            data: base64Data
          }
        });
      } else {
        setUploadedFile({
          name: file.name,
          content: result,
          type: 'text'
        });
      }
    };
    reader.onerror = () => {
      toast({
        title: "Error reading file",
        description: "Failed to read the file. Please try again.",
        variant: "destructive"
      });
    };
    
    if (isImage) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  const clearUploadedFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  };
  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);
  const loadConversation = React.useCallback(async (conversationId: string) => {
    try {
      setIsLoading(true);
      const {
        data: conversation,
        error: convError
      } = await supabase.from("conversations").select("*").eq("id", conversationId).single();
      if (convError) throw convError;
      const {
        data: messageData,
        error: msgError
      } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", {
        ascending: true
      });
      if (msgError) throw msgError;
      setMessages(messageData.map(msg => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        sources: msg.sources as Source[] | undefined
      })));
      setSelectedClass(conversation.class_id);
      setSelectedMode(conversation.mode as Mode);
      setActiveConversationId(conversationId);
      onConversationChange?.(conversationId);
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [onConversationChange, toast]);
  const handleNewChat = React.useCallback(() => {
    setMessages([]);
    setActiveConversationId(null);
    setInput("");
    onConversationChange?.(null);
  }, [onConversationChange]);
  React.useImperativeHandle(ref, () => ({
    loadConversation,
    handleNewChat,
    activeConversationId
  }), [loadConversation, handleNewChat, activeConversationId]);
  const streamChat = async (userMessage: string, conversationId: string) => {
    // Get the user's session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("You must be logged in to use the chat");
    }

    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-proxy`;
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        messages: [...messages.map(({
          role,
          content
        }) => ({
          role,
          content
        })), {
          role: "user",
          content: userMessage
        }],
        class_id: selectedClass,
        persona: selectedMode,
        cohort_id: selectedBatch,
        file_content: uploadedFile?.type === 'text' ? uploadedFile.content : undefined,
        image_data: uploadedFile?.imageData || undefined
      })
    });
    if (!resp.ok || !resp.body) {
      if (resp.status === 429 || resp.status === 402) {
        const error = await resp.json();
        throw new Error(error.error);
      }
      throw new Error("Failed to start stream");
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;
    let assistantContent = "";
    let sources: Source[] = [];
    while (!streamDone) {
      const {
        done,
        value
      } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, {
        stream: true
      });
      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.sources) {
            sources = parsed.sources || [];
          }
          const content = parsed?.choices?.[0]?.delta?.content || parsed?.content || parsed?.text;
          if (content) {
            assistantContent += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) => i === prev.length - 1 ? {
                  ...m,
                  content: assistantContent,
                  sources
                } : m);
              }
              return [...prev, {
                role: "assistant",
                content: assistantContent,
                sources
              }];
            });
          }
        } catch (e) {
          if (e instanceof Error && e.message !== "Unexpected token") {
            throw e;
          }
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
    if (textBuffer.trim()) {
      const lines = textBuffer.split("\n");
      for (const line of lines) {
        if (line.trim() && line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr !== "[DONE]") {
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.sources && !sources.length) {
                sources = parsed.sources;
              }
              const content = parsed?.choices?.[0]?.delta?.content || parsed?.content || parsed?.text;
              if (content) {
                assistantContent += content;
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") {
                    return prev.map((m, i) => i === prev.length - 1 ? {
                      ...m,
                      content: assistantContent,
                      sources
                    } : m);
                  }
                  return [...prev, {
                    role: "assistant",
                    content: assistantContent,
                    sources
                  }];
                });
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Unexpected token") {
                throw e;
              }
            }
          }
        }
      }
    }

    // Save assistant message to database
    if (assistantContent.trim()) {
      const {
        data: savedMsg
      } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: assistantContent,
        sources: sources.length > 0 ? sources : null
      }).select('id').single();

      // Update the message with its ID
      if (savedMsg) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? {
              ...m,
              id: savedMsg.id
            } : m);
          }
          return prev;
        });
      }
    }
    if (!assistantContent.trim()) {
      throw new Error("The AI didn't send any content. Please try again.");
    }
  };
  const handleSend = async () => {
    if (!input.trim() || isLoading || !selectedClass) return;
    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, {
      role: "user",
      content: userMessage
    }]);
    setIsLoading(true);
    try {
      // Create or get conversation
      let conversationId = activeConversationId;
      if (!conversationId) {
        const {
          data: session
        } = await supabase.auth.getSession();
        if (!session.session) throw new Error("Not authenticated");
        const title = userMessage.length > 50 ? userMessage.substring(0, 50) + "..." : userMessage;
        const {
          data: newConv,
          error: convError
        } = await supabase.from("conversations").insert({
          user_id: session.session.user.id,
          title,
          class_id: selectedClass,
          mode: selectedMode
        }).select().single();
        if (convError) throw convError;
        conversationId = newConv.id;
        setActiveConversationId(conversationId);
        onConversationChange?.(conversationId);
      }

      // Save user message
      const {
        error: userMsgError
      } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: userMessage
      });
      if (userMsgError) throw userMsgError;

      // Increment prompt counter
      await supabase.rpc('increment_prompt_count');
      await streamChat(userMessage, conversationId);

      // Clear uploaded file after sending
      clearUploadedFile();
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive"
      });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  // Show batch selection if not selected
  if (!selectedBatch) {
    return <div className="flex flex-col h-full items-center justify-center bg-background p-4">
          <BatchSelection onBatchSelect={batchId => {
        localStorage.setItem("selectedBatch", batchId);
        setSelectedBatch(batchId);
        setSelectedClass(null); // Reset course when batch changes
      }} />
        </div>;
  }

  // Pre-chat welcome screen
  if (messages.length === 0) {
    return <div className="flex flex-col h-full bg-background">
          {/* Minimal header with controls - mobile responsive */}
          <div className="p-3 md:p-4">
            <div className="max-w-3xl mx-auto space-y-2 md:space-y-0">
              {/* Course selector - full width on mobile */}
              <div className="w-full md:hidden">
                <Select value={selectedClass || ""} onValueChange={setSelectedClass} disabled={!!activeConversationId}>
                  <SelectTrigger className="w-full bg-secondary/50 border-border/50">
                    <span className="truncate text-sm">
                      {selectedClass && batchPersonas[selectedClass] ? batchPersonas[selectedClass].display_name : "Select a course"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="w-[calc(100vw-2rem)] max-w-[320px] bg-popover">
                    {availableClasses.map(classId => {
                      const persona = batchPersonas[classId];
                      return <SelectItem key={classId} value={classId}>
                        <div className="flex flex-col items-start max-w-[280px]">
                          <span className="font-medium text-sm truncate w-full">
                            {persona.display_name || classId}
                          </span>
                          <span className="text-xs text-muted-foreground truncate w-full">
                            {persona.professor_name}
                          </span>
                        </div>
                      </SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Mode and Batch selectors - row on mobile */}
              <div className="flex items-center gap-2 md:hidden">
                <Select value={selectedMode} onValueChange={v => setSelectedMode(v as Mode)}>
                  <SelectTrigger className="flex-1 bg-secondary/50 border-border/50">
                    <span className="capitalize text-sm">{selectedMode}</span>
                  </SelectTrigger>
                  <SelectContent className="w-[calc(100vw-2rem)] max-w-[300px] bg-popover">
                    {(Object.keys(MODE_DESCRIPTIONS) as Mode[]).map(mode => <SelectItem key={mode} value={mode}>
                      <div className="flex flex-col items-start py-1">
                        <span className="font-medium capitalize text-sm">{mode}</span>
                        <span className="text-xs text-muted-foreground max-w-[260px]">
                          {MODE_DESCRIPTIONS[mode]}
                        </span>
                      </div>
                    </SelectItem>)}
                  </SelectContent>
                </Select>
                
                <Select value={selectedBatch || "2029"} onValueChange={value => {
                  localStorage.setItem("selectedBatch", value);
                  setSelectedBatch(value);
                  setSelectedClass(null);
                }}>
                  <SelectTrigger className="flex-1 bg-secondary/50 border-border/50">
                    <span className="text-sm">{selectedBatch} Batch</span>
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="2029">2029 Batch</SelectItem>
                    <SelectItem value="2028">2028 Batch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Desktop layout - all in one row */}
              <div className="hidden md:flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Select value={selectedClass || ""} onValueChange={setSelectedClass} disabled={!!activeConversationId}>
                    <SelectTrigger className="w-[220px] bg-secondary/50 border-border/50">
                      <span className="truncate text-sm">
                        {selectedClass && batchPersonas[selectedClass] ? batchPersonas[selectedClass].display_name : "Select a course"}
                      </span>
                    </SelectTrigger>
                    <SelectContent className="w-[320px] bg-popover">
                      {availableClasses.map(classId => {
                        const persona = batchPersonas[classId];
                        return <SelectItem key={classId} value={classId}>
                          <div className="flex flex-col items-start max-w-[280px]">
                            <span className="font-medium text-sm truncate w-full">
                              {persona.display_name || classId}
                            </span>
                            <span className="text-xs text-muted-foreground truncate w-full">
                              {persona.professor_name}
                            </span>
                          </div>
                        </SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedMode} onValueChange={v => setSelectedMode(v as Mode)}>
                    <SelectTrigger className="w-[120px] bg-secondary/50 border-border/50">
                      <span className="capitalize text-sm">{selectedMode}</span>
                    </SelectTrigger>
                    <SelectContent className="w-[300px] bg-popover">
                      {(Object.keys(MODE_DESCRIPTIONS) as Mode[]).map(mode => <SelectItem key={mode} value={mode}>
                        <div className="flex flex-col items-start py-1">
                          <span className="font-medium capitalize text-sm">{mode}</span>
                          <span className="text-xs text-muted-foreground max-w-[260px]">
                            {MODE_DESCRIPTIONS[mode]}
                          </span>
                        </div>
                      </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                <Select value={selectedBatch || "2029"} onValueChange={value => {
                  localStorage.setItem("selectedBatch", value);
                  setSelectedBatch(value);
                  setSelectedClass(null);
                }}>
                  <SelectTrigger className="w-[100px] bg-secondary/50 border-border/50">
                    <span className="text-sm">{selectedBatch} Batch</span>
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="2029">2029 Batch</SelectItem>
                    <SelectItem value="2028">2028 Batch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Centered welcome content - scrollable on mobile */}
          <div className="flex-1 overflow-y-auto">
            <div className="min-h-full flex flex-col items-center justify-center px-4 py-6 md:py-8">
              <div className="text-center space-y-4 md:space-y-6 max-w-2xl animate-fade-in">
                {/* Gradient icon */}
                <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-lg mx-auto">
                  <Search className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                </div>
                
                {/* Welcome text */}
                <div className="space-y-2">
                  <h1 className="text-2xl md:text-4xl font-semibold text-foreground">
                    What would you like to learn?
                  </h1>
                  <p className="text-muted-foreground text-base md:text-lg px-2">
                    {selectedClass ? `Ready to help you with ${batchPersonas[selectedClass]?.display_name || selectedClass}` : "Select a course to get started"}
                  </p>
                </div>
              </div>
              
              {/* Input area */}
              <div className="w-full max-w-3xl mt-8 md:mt-12">
                {uploadedFile && <div className="flex items-center gap-2 px-4 py-2 mb-3 bg-secondary/50 rounded-xl border border-border/50 mx-2">
                    {uploadedFile.type === 'image' ? (
                      <img src={uploadedFile.content} alt={uploadedFile.name} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                    <span className="text-sm text-foreground truncate flex-1">{uploadedFile.name}</span>
                    <Button variant="ghost" size="sm" onClick={clearUploadedFile} className="h-6 w-6 p-0 hover:bg-destructive/20">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>}
                
                <div className="relative mx-2">
                  <input ref={fileInputRef} type="file" onChange={handleFileUpload} accept=".txt,.md,.csv,.json,.html,.doc,.docx,.pdf,.png,.jpg,.jpeg,.gif,.webp,image/*" className="hidden" />
                  <input ref={galleryInputRef} type="file" onChange={handleFileUpload} accept="image/*" className="hidden" />
                  <input ref={cameraInputRef} type="file" onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />
                  
                  <div className="flex items-center gap-2 bg-secondary/80 rounded-2xl border border-border/50 px-3 md:px-4 py-3 shadow-lg backdrop-blur-sm transition-all focus-within:border-primary/50 focus-within:shadow-[var(--shadow-glow)]">
                    <Popover open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={isLoading || !selectedClass} className="h-8 w-8 p-0 rounded-lg hover:bg-background/50 flex-shrink-0">
                          <Plus className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-1 bg-popover" align="start">
                        <button
                          onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
                        >
                          <Paperclip className="w-4 h-4" />
                          Upload file
                        </button>
                        <button
                          onClick={() => { galleryInputRef.current?.click(); setAttachMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
                        >
                          <ImageIcon className="w-4 h-4" />
                          Photos
                        </button>
                        <button
                          onClick={() => { cameraInputRef.current?.click(); setAttachMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
                        >
                          <Camera className="w-4 h-4" />
                          Camera
                        </button>
                      </PopoverContent>
                    </Popover>
                    
                    <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()} placeholder={selectedClass ? "Ask anything..." : "Select a course first..."} disabled={isLoading || !selectedClass} className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-foreground/60 text-sm min-w-0" />
                    
                    <Button onClick={handleSend} disabled={isLoading || !input.trim() || !selectedClass} size="sm" className="h-8 w-8 p-0 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-30 flex-shrink-0">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                {/* Quick suggestions - improved mobile layout */}
                {selectedClass && <div className="flex flex-wrap justify-center gap-2 mt-4 md:mt-6 px-2 pb-4">
                    {["Explain the key concepts", "Help me study", "Quiz me on this topic"].map(suggestion => <button key={suggestion} onClick={() => setInput(suggestion)} className="px-3 md:px-4 py-2 text-xs md:text-sm rounded-full bg-secondary/50 border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all whitespace-nowrap">
                        {suggestion}
                      </button>)}
                  </div>}
              </div>
            </div>
          </div>
        </div>;
  }

  // Chat mode with messages
  return <div className="flex flex-col h-full bg-background">
        {/* Compact header - mobile responsive */}
        <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm p-3">
          <div className="max-w-3xl mx-auto">
            {/* Mobile layout */}
            <div className="flex md:hidden items-center justify-between gap-2">
              <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-secondary/50 min-w-0 flex-1">
                <GraduationCap className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-xs font-medium truncate">
                  {selectedClass && batchPersonas[selectedClass]?.display_name}
                </span>
              </div>
              
              <Select value={selectedMode} onValueChange={async v => {
                const newMode = v as Mode;
                setSelectedMode(newMode);
                if (activeConversationId) {
                  await supabase.from("conversations").update({
                    mode: newMode
                  }).eq("id", activeConversationId);
                }
              }}>
                <SelectTrigger className="w-auto gap-1 bg-transparent border-none hover:bg-secondary/50 px-2">
                  <span className="capitalize text-xs text-muted-foreground">{selectedMode}</span>
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {(Object.keys(MODE_DESCRIPTIONS) as Mode[]).map(mode => <SelectItem key={mode} value={mode}>
                    <span className="capitalize">{mode}</span>
                  </SelectItem>)}
                </SelectContent>
              </Select>
              
              <Select value={selectedBatch || "2029"} onValueChange={value => {
                localStorage.setItem("selectedBatch", value);
                setSelectedBatch(value);
                setSelectedClass(null);
                setMessages([]);
                setActiveConversationId(null);
                onConversationChange?.(null);
              }}>
                <SelectTrigger className="w-auto gap-1 bg-transparent border-none hover:bg-secondary/50 px-2">
                  <span className="text-xs text-muted-foreground">{selectedBatch}</span>
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="2029">2029 Batch</SelectItem>
                  <SelectItem value="2028">2028 Batch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Desktop layout */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50">
                <GraduationCap className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                  {selectedClass && batchPersonas[selectedClass]?.display_name}
                </span>
              </div>
              
              <Select value={selectedMode} onValueChange={async v => {
                const newMode = v as Mode;
                setSelectedMode(newMode);
                if (activeConversationId) {
                  await supabase.from("conversations").update({
                    mode: newMode
                  }).eq("id", activeConversationId);
                }
              }}>
                <SelectTrigger className="w-auto gap-2 bg-transparent border-none hover:bg-secondary/50 px-3">
                  <span className="capitalize text-sm text-muted-foreground">{selectedMode}</span>
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {(Object.keys(MODE_DESCRIPTIONS) as Mode[]).map(mode => <SelectItem key={mode} value={mode}>
                    <span className="capitalize">{mode}</span>
                  </SelectItem>)}
                </SelectContent>
              </Select>
              
              <div className="flex-1" />
              
              <Select value={selectedBatch || "2029"} onValueChange={value => {
                localStorage.setItem("selectedBatch", value);
                setSelectedBatch(value);
                setSelectedClass(null);
                setMessages([]);
                setActiveConversationId(null);
                onConversationChange?.(null);
              }}>
                <SelectTrigger className="w-auto gap-2 bg-transparent border-none hover:bg-secondary/50 px-3">
                  <span className="text-sm text-muted-foreground">{selectedBatch} Batch</span>
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="2029">2029 Batch</SelectItem>
                  <SelectItem value="2028">2028 Batch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 space-y-6">
            {messages.map((msg, idx) => <ChatMessage key={msg.id || idx} role={msg.role} content={msg.content} sources={msg.sources} messageId={msg.id} />)}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && <div className="flex gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm p-4">
          <div className="max-w-3xl mx-auto">
            {uploadedFile && <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-secondary/50 rounded-xl border border-border/50">
                {uploadedFile.type === 'image' ? (
                  <img src={uploadedFile.content} alt={uploadedFile.name} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                )}
                <span className="text-sm text-foreground truncate flex-1">{uploadedFile.name}</span>
                <Button variant="ghost" size="sm" onClick={clearUploadedFile} className="h-6 w-6 p-0 hover:bg-destructive/20">
                  <X className="w-4 h-4" />
                </Button>
              </div>}
            
            <div className="flex items-center gap-2 bg-secondary/80 rounded-2xl border border-border/50 px-4 py-3 transition-all focus-within:border-primary/50">
              <Popover open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={isLoading} className="h-8 w-8 p-0 rounded-lg hover:bg-background/50">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  <button
                    onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
                  >
                    <Paperclip className="w-4 h-4" />
                    Upload file
                  </button>
                  <button
                    onClick={() => { galleryInputRef.current?.click(); setAttachMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Photos
                  </button>
                  <button
                    onClick={() => { cameraInputRef.current?.click(); setAttachMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    Camera
                  </button>
                </PopoverContent>
              </Popover>
              
              <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()} placeholder={uploadedFile ? "Ask about the file..." : "Ask anything..."} disabled={isLoading} className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-foreground/60 text-sm" />
              
              <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="sm" className="h-8 w-8 p-0 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-30">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>;
});
ChatInterface.displayName = "ChatInterface";