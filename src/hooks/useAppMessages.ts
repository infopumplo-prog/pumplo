import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { fillName } from '@/lib/messageTemplate';

// Systémové zprávy od Pumpla — novinky po vydání a uvítání nového uživatele.
// Na rozdíl od zpráv z posilovny nejsou vázané na vybranou posilovnu, takže je
// vidí i uživatel, který si žádnou nevybral.

export interface AppMessage {
  id: string;
  kind: 'release' | 'welcome';
  title: string;
  body: string;
  app_version: string | null;
  published_at: string;
  isRead: boolean;
}

interface AppMessageRow {
  id: string;
  kind: 'release' | 'welcome';
  title: string;
  body: string;
  title_en: string | null;
  body_en: string | null;
  app_version: string | null;
  published_at: string;
}

export const useAppMessages = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { i18n } = useTranslation();
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isEn = i18n.language === 'en';
  const firstName = (profile?.first_name ?? '').trim();
  const accountCreatedAt = user?.created_at ?? null;

  const fetchMessages = useCallback(async () => {
    if (!user) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    const [{ data: rows }, { data: reads }] = await Promise.all([
      supabase
        .from('app_messages')
        .select('id, kind, title, body, title_en, body_en, app_version, published_at')
        .eq('is_active', true)
        .order('published_at', { ascending: false }),
      supabase.from('app_message_reads').select('message_id').eq('user_id', user.id),
    ]);

    const readIds = new Set((reads ?? []).map((r: { message_id: string }) => r.message_id));

    const mapped: AppMessage[] = ((rows ?? []) as AppMessageRow[])
      // Uvítání patří jen účtům založeným po vydání zprávy — stávající uživatel
      // ho po aktualizaci dostat nemá.
      .filter((r) => r.kind !== 'welcome' || (accountCreatedAt !== null && accountCreatedAt >= r.published_at))
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        title: fillName(isEn && r.title_en ? r.title_en : r.title, firstName),
        body: fillName(isEn && r.body_en ? r.body_en : r.body, firstName),
        app_version: r.app_version,
        published_at: r.published_at,
        isRead: readIds.has(r.id),
      }));

    setMessages(mapped);
    setIsLoading(false);
  }, [user, isEn, firstName, accountCreatedAt]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const markAsRead = useCallback(async (messageId: string) => {
    if (!user) return;
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isRead: true } : m)));
    await supabase
      .from('app_message_reads')
      .upsert({ message_id: messageId, user_id: user.id }, { onConflict: 'message_id,user_id' });
  }, [user]);

  const unreadCount = messages.filter((m) => !m.isRead).length;

  return { messages, isLoading, unreadCount, markAsRead, refetch: fetchMessages };
};
