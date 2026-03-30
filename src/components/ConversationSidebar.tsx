import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";

type CohortPersonas = Record<string, { display_name?: string; professor_name?: string }>;


interface Conversation {
  id: string;
  title: string;
  class_id: string;
  mode: string;
  updated_at: string;
}

interface ConversationSidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  onNewChat: () => void;
}

export function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  onNewChat,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadConversations = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadConversations();

    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations]);

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

  return (
    <div className="flex flex-col h-full border-r bg-background">
      <div className="p-4 border-b">
        <Button onClick={onNewChat} className="w-full" variant="default">
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation)}
                className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                  activeConversationId === conversation.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <div className="font-medium truncate text-sm mb-1">
                  {conversation.title}
                </div>
                <div className="text-xs opacity-70">
                  {getDisplayName(conversation.class_id)} • {formatDate(conversation.updated_at)}
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
