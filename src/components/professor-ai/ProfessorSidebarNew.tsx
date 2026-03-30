import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus,
  MessageSquare,
  LogOut,
  MessageCircle,
  Search,
  Pin,
  Archive,
  Menu,
  PanelLeftClose,
  ChevronUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";
import { ChatActionsMenu } from "./ChatActionsMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// personas type - uses Record<string, any> due to mixed modes/cohort structure

interface Conversation {
  id: string;
  title: string;
  class_id: string;
  mode: string;
  updated_at: string;
  is_pinned?: boolean;
  is_archived?: boolean;
}

interface ProfessorSidebarNewProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectConversation?: (conversation: Conversation) => void;
  activeConversationId?: string | null;
  onLogout: () => void;
  onFeedback: () => void;
}

const getDisplayNameFromPersonas = (personas: Record<string, any>, classId: string): string => {
  for (const batchId of Object.keys(personas)) {
    if (batchId === "modes") continue;
    if (personas[batchId]?.[classId]) {
      return personas[batchId][classId].display_name || classId;
    }
  }
  return classId;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

const getInitials = (email: string | undefined, name?: string): string => {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "U";
};

export const ProfessorSidebarNew = ({
  isOpen,
  onToggle,
  onNewChat,
  onSelectConversation,
  activeConversationId,
  onLogout,
  onFeedback,
}: ProfessorSidebarNewProps) => {
  const { personas } = useTenant();
  const getDisplayName = (classId: string) => getDisplayNameFromPersonas(personas, classId);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userName, setUserName] = useState<string | undefined>();

  const [isDesktop, setIsDesktop] = useState(false);

  // Track desktop breakpoint (lg = 1024px) to avoid rendering mobile Sheet overlay on desktop
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const applyUserInfo = useCallback((user: { email?: string; user_metadata?: any } | null) => {
    if (!user) {
      setUserEmail(undefined);
      setUserName(undefined);
      return;
    }

    const email = user.email;
    setUserEmail(email);

    const nameFromMetadata =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.display_name ||
      user.user_metadata?.preferred_username;

    if (nameFromMetadata) {
      setUserName(String(nameFromMetadata));
      return;
    }

    if (email) {
      const emailPrefix = email.split("@")[0];
      const formattedName = emailPrefix
        .replace(/[._-]/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
      setUserName(formattedName || undefined);
      return;
    }

    setUserName(undefined);
  }, []);

  // Load user info and persist across refreshes
  useEffect(() => {
    let alive = true;

    const loadUser = async () => {
      // On refresh, getUser() can temporarily return null while session is being hydrated.
      // getSession() is the reliable source for initial render.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!alive) return;
      applyUserInfo(sessionData.session?.user ?? null);

      // Fallback: if session isn't ready yet, try getUser() once.
      if (!sessionData.session) {
        const { data: userData } = await supabase.auth.getUser();
        if (!alive) return;
        applyUserInfo(userData.user ?? null);
      }
    };

    loadUser();

    // Listen for auth state changes to update user info when refreshed
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      applyUserInfo(session?.user ?? null);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [applyUserInfo]);

  const loadConversations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Subscribe to realtime changes for conversations
  useEffect(() => {
    const channel = supabase
      .channel('sidebar-conversations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        (payload) => {
          console.log('Realtime change detected:', payload.eventType);
          loadConversations();
        }
      )
      .subscribe((status) => {
        console.log('Sidebar realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  // Reload conversations when activeConversationId changes (new conversation created)
  useEffect(() => {
    if (activeConversationId) {
      loadConversations();
    }
  }, [activeConversationId, loadConversations]);

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations.filter((c) => {
      const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getDisplayName(c.class_id).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesArchived = showArchived ? c.is_archived : !c.is_archived;
      return matchesSearch && matchesArchived;
    });

    // Sort: pinned first, then by updated_at
    return filtered.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [conversations, searchQuery, showArchived]);

  const pinnedConversations = filteredConversations.filter(c => c.is_pinned);
  const regularConversations = filteredConversations.filter(c => !c.is_pinned);

  const handleSelectConversation = (conversation: Conversation) => {
    // Prevent re-selecting the same conversation (fixes jumping issue on double-click)
    if (activeConversationId === conversation.id) {
      return;
    }
    if (onSelectConversation) {
      onSelectConversation(conversation);
    }
  };

  const handleRename = async (id: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ title: newTitle })
        .eq("id", id);

      if (error) throw error;
      toast.success("Chat renamed");
      loadConversations();
    } catch (error) {
      console.error("Error renaming conversation:", error);
      toast.error("Failed to rename chat");
    }
  };

  const handlePin = async (id: string, isPinned: boolean) => {
    try {
      const { error } = await supabase
        .from("conversations")
        .update({ is_pinned: isPinned })
        .eq("id", id);

      if (error) throw error;
      toast.success(isPinned ? "Chat pinned" : "Chat unpinned");
      loadConversations();
    } catch (error) {
      console.error("Error pinning conversation:", error);
      toast.error("Failed to update chat");
    }
  };

  const handleArchive = async (id: string) => {
    const conversation = conversations.find(c => c.id === id);
    const newArchiveState = !conversation?.is_archived;

    try {
      const { error } = await supabase
        .from("conversations")
        .update({ is_archived: newArchiveState })
        .eq("id", id);

      if (error) throw error;
      toast.success(newArchiveState ? "Chat archived" : "Chat unarchived");
      loadConversations();
    } catch (error) {
      console.error("Error archiving conversation:", error);
      toast.error("Failed to archive chat");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Chat deleted");
      loadConversations();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Failed to delete chat");
    }
  };

  const renderConversationItem = (conversation: Conversation) => {
    const isActive = activeConversationId === conversation.id;

    return (
      <div
        key={conversation.id}
        className={`
          relative group w-full rounded-lg transition-colors overflow-visible min-w-0
          grid grid-cols-[1fr_auto] items-center
          ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary/70"}
        `}
      >
        {/* Column 1 (1fr): Open chat */}
        <button
          type="button"
          disabled={isActive}
          onClick={() => handleSelectConversation(conversation)}
          className={cn(
            "col-start-1 col-end-2 w-full min-w-0 text-left flex items-center justify-between gap-2 p-3",
            isActive && "cursor-default"
          )}
          aria-current={isActive ? "page" : undefined}
        >
        <div className="flex-1 min-w-0 overflow-hidden w-full">
            <div className="flex items-center gap-1.5 min-w-0">
              {conversation.is_pinned && (
                <Pin
                  className={`h-3 w-3 shrink-0 ${
                    isActive ? "text-primary-foreground/80" : "text-primary"
                  }`}
                />
              )}
              <span className="font-medium text-sm text-ellipsis overflow-hidden whitespace-nowrap block w-full text-left">
                {conversation.title}
              </span>
            </div>
            <div
              className={`text-xs mt-0.5 text-ellipsis overflow-hidden whitespace-nowrap text-left ${
                isActive ? "opacity-80" : "text-muted-foreground"
              }`}
            >
              {getDisplayName(conversation.class_id)} • {formatDate(conversation.updated_at)}
            </div>
          </div>
        </button>

        {/* Column 2 (auto): Menu */}
        <div className="col-start-2 col-end-3 flex items-center justify-center px-2 overflow-visible relative z-50">
          <ChatActionsMenu
            conversationId={conversation.id}
            title={conversation.title}
            isPinned={conversation.is_pinned || false}
            isArchived={conversation.is_archived || false}
            isActive={isActive}
            onRename={handleRename}
            onPin={handlePin}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        </div>
      </div>
    );
  };

  const userInitials = getInitials(userEmail, userName);
  const displayName = userName || (userEmail ? userEmail.split('@')[0] : 'Guest');

  // Sidebar content - shared between mobile and desktop
  const sidebarContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`p-3 border-b border-border flex items-center ${isMobile ? "justify-between" : isOpen ? "justify-between" : "justify-center"}`}>
        {(isMobile || isOpen) ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-xs">{brandName.slice(0, 2).toUpperCase()}</span>
              </div>
              <span className="font-bold text-primary">{brandName}</span>
            </div>
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-8 w-8 hover:bg-secondary"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-10 w-10 hover:bg-secondary"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Open sidebar</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Action buttons */}
      <div className={`p-2 space-y-1 ${(isMobile || isOpen) ? "" : "flex flex-col items-center"}`}>
        {(isMobile || isOpen) ? (
          <>
            <Button
              onClick={onNewChat}
              variant="outline"
              className="w-full justify-start gap-2 bg-secondary/50 hover:bg-secondary border-border/50 h-9"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </Button>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-secondary/30 border-border/50"
              />
            </div>
          </>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onNewChat}
                  className="h-10 w-10 hover:bg-secondary"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>New chat</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="h-10 w-10 hover:bg-secondary"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Search chats</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Conversation History - only when expanded */}
      {(isMobile || isOpen) && (
        <>
          {/* Archive Toggle */}
          <div className="px-2 pb-2">
            <Button
              variant={showArchived ? "secondary" : "ghost"}
              size="sm"
              className="w-full justify-start gap-2 h-8 text-xs"
              onClick={() => setShowArchived(!showArchived)}
            >
              <Archive className="h-3.5 w-3.5" />
              {showArchived ? "Show Active Chats" : "Show Archived"}
            </Button>
          </div>

          <ScrollArea className="flex-1 px-2">
            <div className="py-2 space-y-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Loading...</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchQuery ? "No chats found" : showArchived ? "No archived chats" : "No conversations yet"}
                  </p>
                  {!searchQuery && !showArchived && (
                    <p className="text-xs mt-1">Start a new chat to begin</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Pinned Section */}
                  {pinnedConversations.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-2 flex items-center gap-1">
                        <Pin className="h-3 w-3" /> Pinned
                      </p>
                      <div className="space-y-1">
                        {pinnedConversations.map(renderConversationItem)}
                      </div>
                    </div>
                  )}

                  {/* Regular Chats Section */}
                  {regularConversations.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-2">
                        {showArchived ? "Archived" : "Recent Chats"}
                      </p>
                      <div className="space-y-1">
                        {regularConversations.map(renderConversationItem)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </>
      )}

      {/* User Profile Footer */}
      <div className={`mt-auto p-2 border-t border-border ${(isMobile || isOpen) ? "" : "flex justify-center"}`}>
        {(isMobile || isOpen) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/70 transition-colors text-left">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0">
                  <span className="text-primary-foreground font-semibold text-sm">
                    {userInitials}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {displayName}
                  </p>
                  {userEmail && userName && (
                    <p className="text-xs text-muted-foreground truncate">
                      {userEmail}
                    </p>
                  )}
                </div>
                <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-[calc(100%-1rem)] mb-1">
              <DropdownMenuItem onClick={onFeedback} className="cursor-pointer">
                <MessageCircle className="w-4 h-4 mr-2" />
                Send Feedback
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onLogout} 
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center hover:opacity-90 transition-opacity">
                <span className="text-primary-foreground font-semibold text-sm">
                  {userInitials}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{displayName}</p>
                {userEmail && (
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onFeedback} className="cursor-pointer">
                <MessageCircle className="w-4 h-4 mr-2" />
                Send Feedback
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onLogout} 
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      {/* Mobile/Tablet: Sheet drawer triggered by hamburger in header */}
      {!isDesktop && (
        <Sheet
          open={isOpen}
          onOpenChange={(open) => {
            // only react to state changes on mobile/tablet
            if (open !== isOpen) onToggle();
          }}
        >
          <SheetContent
            side="left"
            className="w-80 p-0 bg-card border-r border-border lg:hidden z-50"
          >
            {sidebarContent(true)}
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop (lg+): Fixed sidebar - z-30 to stay below any modals but visible */}
      <div 
        className={`
          hidden lg:flex
          fixed left-0 top-0 bottom-0 z-30
          bg-card border-r border-border
          flex-col
          transition-all duration-300 ease-in-out
          ${isOpen ? "w-80" : "w-14"}
        `}
      >
        {sidebarContent(false)}
      </div>
    </TooltipProvider>
  );
};
