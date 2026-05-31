import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_type: 'member' | 'trainer' | 'gym_owner';
  sender_id: string | null;
  body: string;
  message_type: 'text' | 'workout_share';
  metadata: {
    plan_id?: string;
    plan_name?: string;
    share_token?: string;
    day_count?: number;
    exercise_count?: number;
  } | null;
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
    const now = new Date().toISOString();

    // Optimistic update — show message immediately
    const optimisticMsg: DirectMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_type: 'member',
      sender_id: user.id,
      body: trimmedBody,
      read_at: null,
      created_at: now,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    // Insert the message
    const { data: inserted, error: msgError } = await supabase
      .from('direct_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'member',
        sender_id: user.id,
        body: trimmedBody,
      })
      .select('*')
      .single();

    if (msgError) {
      console.error('Error sending message:', msgError);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      return;
    }

    // Replace optimistic message with real one
    if (inserted) {
      setMessages(prev => prev.map(m =>
        m.id === optimisticMsg.id ? (inserted as DirectMessage) : m
      ));
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: now })
      .eq('id', conversationId);
  }, [user, conversationId]);

  const sendWorkoutMessage = useCallback(async (planId: string, planName: string, shareToken: string, dayCount: number, exerciseCount: number) => {
    if (!user || !conversationId) return;

    const now = new Date().toISOString();
    const metadata = { plan_id: planId, plan_name: planName, share_token: shareToken, day_count: dayCount, exercise_count: exerciseCount };

    const optimisticMsg: DirectMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_type: 'member',
      sender_id: user.id,
      body: `Sdílím trénink: ${planName}`,
      message_type: 'workout_share',
      metadata,
      read_at: null,
      created_at: now,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const { data: inserted, error } = await supabase
      .from('direct_messages')
      .insert({ conversation_id: conversationId, sender_type: 'member', sender_id: user.id, body: `Sdílím trénink: ${planName}`, message_type: 'workout_share', metadata })
      .select('*')
      .single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      return;
    }
    if (inserted) {
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? (inserted as DirectMessage) : m));
    }
    await supabase.from('conversations').update({ last_message_at: now }).eq('id', conversationId);
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

  return { messages, isLoading, sendMessage, sendWorkoutMessage, markAllRead };
};
