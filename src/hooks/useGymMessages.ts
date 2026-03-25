import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';

interface GymMessage {
  id: string;
  gym_id: string;
  sender_id: string;
  title: string;
  body: string;
  target_type: 'all' | 'individual';
  target_user_id: string | null;
  created_at: string;
}

interface GymMessageWithRead extends GymMessage {
  isRead: boolean;
}

export const useGymMessages = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [messages, setMessages] = useState<GymMessageWithRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchMessages = useCallback(async () => {
    if (!user || !profile?.selected_gym_id) {
      setMessages([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    const gymId = profile.selected_gym_id;

    // Fetch messages for this gym (broadcast + targeted at user)
    const { data: msgs } = await supabase
      .from('gym_messages')
      .select('*')
      .eq('gym_id', gymId)
      .or(`target_type.eq.all,target_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    // Fetch read receipts for this user
    const { data: reads } = await supabase
      .from('gym_message_reads')
      .select('message_id')
      .eq('user_id', user.id);

    const readIds = new Set((reads || []).map(r => r.message_id));

    const messagesWithRead: GymMessageWithRead[] = (msgs || []).map(m => ({
      ...m,
      isRead: readIds.has(m.id),
    }));

    setMessages(messagesWithRead);
    setUnreadCount(messagesWithRead.filter(m => !m.isRead).length);
    setIsLoading(false);
  }, [user, profile?.selected_gym_id]);

  const markAsRead = useCallback(async (messageId: string) => {
    if (!user) return;

    // Optimistic update
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, isRead: true } : m
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));

    await supabase
      .from('gym_message_reads')
      .upsert({
        message_id: messageId,
        user_id: user.id,
      }, { onConflict: 'message_id,user_id' });
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Refetch on tab focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchMessages();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchMessages]);

  return { messages, unreadCount, isLoading, markAsRead, refetch: fetchMessages };
};
