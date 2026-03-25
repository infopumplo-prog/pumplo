import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';

export interface Conversation {
  id: string;
  gym_id: string;
  participant_user_id: string;
  participant_type: 'trainer' | 'user';
  trainer_id: string | null;
  other_user_id: string | null;
  last_message_at: string;
  created_at: string;
  // Joined data
  trainerName?: string;
  trainerPhotoUrl?: string;
  lastMessagePreview?: string;
  unreadCount?: number;
}

export const useConversations = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadDMCount, setUnreadDMCount] = useState(0);

  const fetchConversations = useCallback(async () => {
    if (!user || !profile?.selected_gym_id) {
      setConversations([]);
      setUnreadDMCount(0);
      setIsLoading(false);
      return;
    }

    // Fetch conversations for this user
    const { data: convos, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('participant_user_id', user.id)
      .eq('gym_id', profile.selected_gym_id)
      .order('last_message_at', { ascending: false });

    if (convError) {
      console.error('Error fetching conversations:', convError);
      setIsLoading(false);
      return;
    }

    if (!convos || convos.length === 0) {
      setConversations([]);
      setUnreadDMCount(0);
      setIsLoading(false);
      return;
    }

    // Collect trainer IDs for joined data
    const trainerIds = convos
      .map((c: any) => c.trainer_id)
      .filter((id: string | null): id is string => id !== null);

    // Fetch trainer info
    let trainerMap: Record<string, { name: string; photo_url: string | null }> = {};
    if (trainerIds.length > 0) {
      const { data: trainers } = await supabase
        .from('gym_trainers')
        .select('id, name, photo_url')
        .in('id', trainerIds);

      if (trainers) {
        for (const t of trainers as any[]) {
          trainerMap[t.id] = { name: t.name, photo_url: t.photo_url };
        }
      }
    }

    // Fetch last message preview and unread count for each conversation
    const convoIds = convos.map((c: any) => c.id);

    // Get last message per conversation
    const { data: lastMessages } = await supabase
      .from('direct_messages')
      .select('conversation_id, body, created_at')
      .in('conversation_id', convoIds)
      .order('created_at', { ascending: false });

    // Build a map: conversation_id -> last message body
    const lastMsgMap: Record<string, string> = {};
    if (lastMessages) {
      for (const msg of lastMessages as any[]) {
        // Only take the first (most recent) message per conversation
        if (!lastMsgMap[msg.conversation_id]) {
          lastMsgMap[msg.conversation_id] = msg.body;
        }
      }
    }

    // Count unread messages per conversation (messages not sent by member, where read_at IS NULL)
    const { data: unreadMessages } = await supabase
      .from('direct_messages')
      .select('conversation_id')
      .in('conversation_id', convoIds)
      .neq('sender_type', 'member')
      .is('read_at', null);

    const unreadMap: Record<string, number> = {};
    let totalUnread = 0;
    if (unreadMessages) {
      for (const msg of unreadMessages as any[]) {
        unreadMap[msg.conversation_id] = (unreadMap[msg.conversation_id] || 0) + 1;
        totalUnread++;
      }
    }

    // Assemble enriched conversations
    const enriched: Conversation[] = convos.map((c: any) => ({
      id: c.id,
      gym_id: c.gym_id,
      participant_user_id: c.participant_user_id,
      participant_type: c.participant_type,
      trainer_id: c.trainer_id,
      other_user_id: c.other_user_id,
      last_message_at: c.last_message_at,
      created_at: c.created_at,
      trainerName: c.trainer_id ? trainerMap[c.trainer_id]?.name : undefined,
      trainerPhotoUrl: c.trainer_id ? trainerMap[c.trainer_id]?.photo_url ?? undefined : undefined,
      lastMessagePreview: lastMsgMap[c.id] || undefined,
      unreadCount: unreadMap[c.id] || 0,
    }));

    setConversations(enriched);
    setUnreadDMCount(totalUnread);
    setIsLoading(false);
  }, [user, profile?.selected_gym_id]);

  const getOrCreateConversation = useCallback(async (
    trainerId: string,
    gymId: string
  ): Promise<string | null> => {
    if (!user) return null;

    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_user_id', user.id)
      .eq('trainer_id', trainerId)
      .eq('gym_id', gymId)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    // Create new conversation
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({
        gym_id: gymId,
        participant_user_id: user.id,
        participant_type: 'user',
        trainer_id: trainerId,
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }

    // Refetch conversations list
    await fetchConversations();

    return created.id;
  }, [user, fetchConversations]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Refetch on tab focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchConversations();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchConversations]);

  return {
    conversations,
    isLoading,
    unreadDMCount,
    getOrCreateConversation,
    refetch: fetchConversations,
  };
};
