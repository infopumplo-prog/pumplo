import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_type: 'member' | 'trainer' | 'gym_owner';
  sender_id: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
}

export const useDirectMessages = (conversationId: string | undefined) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Error fetching messages:', error);
      setIsLoading(false);
      return;
    }

    setMessages((data as DirectMessage[]) || []);
    setIsLoading(false);
  }, [conversationId]);

  const sendMessage = useCallback(async (body: string) => {
    if (!user || !conversationId || !body.trim()) return;

    const trimmedBody = body.trim();

    // Insert the message
    const { error: msgError } = await supabase
      .from('direct_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'member',
        sender_id: user.id,
        body: trimmedBody,
      });

    if (msgError) {
      console.error('Error sending message:', msgError);
      return;
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
  }, [user, conversationId]);

  const markAllRead = useCallback(async () => {
    if (!user || !conversationId) return;

    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_type', 'member')
      .is('read_at', null);
  }, [user, conversationId]);

  // Fetch messages on mount / conversation change
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => {
          const newMsg = payload.new as DirectMessage;
          // Avoid duplicates (e.g. if message was already added by optimistic update)
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId]);

  return { messages, isLoading, sendMessage, markAllRead };
};
