import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Lightweight hook that only fetches unread gym message count.
 * Used in BottomNav and Profile for badges without loading full messages.
 */
export const useUnreadMessageCount = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    // Get user's gym
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('selected_gym_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.selected_gym_id) {
      setUnreadCount(0);
      return;
    }

    // Count all messages for this gym targeted at user
    const { data: msgs } = await supabase
      .from('gym_messages')
      .select('id')
      .eq('gym_id', profile.selected_gym_id)
      .or(`target_type.eq.all,target_user_id.eq.${user.id}`);

    if (!msgs || msgs.length === 0) {
      setUnreadCount(0);
      return;
    }

    // Count read messages
    const { data: reads } = await supabase
      .from('gym_message_reads')
      .select('message_id')
      .eq('user_id', user.id);

    const readIds = new Set((reads || []).map(r => r.message_id));
    const msgIds = msgs.map(m => m.id);
    const gymUnread = msgIds.filter(id => !readIds.has(id)).length;

    // Also count unread DMs
    let dmUnread = 0;
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_user_id', user.id);

    if (convs && convs.length > 0) {
      const convIds = convs.map(c => c.id);
      const { count } = await supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('sender_type', 'member')
        .is('read_at', null);
      dmUnread = count || 0;
    }

    setUnreadCount(gymUnread + dmUnread);
  }, [user]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Refetch on tab focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchCount]);

  return { unreadCount, refetch: fetchCount };
};
