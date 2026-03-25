import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Mail, Users, User, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';

interface MessageDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: {
    id: string;
    gym_id?: string;
    title: string;
    body: string;
    target_type: 'all' | 'individual';
    created_at: string;
    isRead: boolean;
    gymName?: string | null;
    gymLogoUrl?: string | null;
  } | null;
  onMarkAsRead: (messageId: string) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Dnes';
  if (diffDays === 1) return 'Včera';
  if (diffDays < 7) return `Před ${diffDays} dny`;
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const MessageDetailDrawer = ({
  open,
  onOpenChange,
  message,
  onMarkAsRead,
}: MessageDetailDrawerProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [replying, setReplying] = useState(false);

  // Mark as read when drawer opens
  useEffect(() => {
    if (open && message && !message.isRead) {
      onMarkAsRead(message.id);
    }
  }, [open, message?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleReply = async () => {
    if (!user || !message || !profile?.selected_gym_id) return;
    setReplying(true);

    const gymId = message.gym_id || profile.selected_gym_id;

    // Find or create a conversation with the gym (no trainer - gym_owner type)
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_user_id', user.id)
      .eq('gym_id', gymId)
      .is('trainer_id', null)
      .eq('participant_type', 'user')
      .limit(1)
      .single();

    let conversationId = existing?.id;
    let isNew = false;

    if (!conversationId) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({
          gym_id: gymId,
          participant_user_id: user.id,
          participant_type: 'user',
          trainer_id: null,
        })
        .select('id')
        .single();
      conversationId = created?.id;
      isNew = true;
    }

    // Send context message referencing the original announcement
    if (conversationId && isNew) {
      await supabase.from('direct_messages').insert({
        conversation_id: conversationId,
        sender_type: 'member',
        sender_id: user.id,
        body: `📢 Odpověď na oznámení "${message.title}":\n\n„${message.body.slice(0, 200)}${message.body.length > 200 ? '...' : ''}"`,
      });
      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString(),
      }).eq('id', conversationId);
    }

    setReplying(false);
    if (conversationId) {
      onOpenChange(false);
      navigate(`/messages/chat/${conversationId}`);
    }
  };

  if (!message) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            {message.gymLogoUrl ? (
              <img src={message.gymLogoUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-white border border-border" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail className="w-4 h-4 text-primary" />
              </div>
            )}
            {message.gymName && (
              <span className="text-sm font-medium text-foreground">{message.gymName}</span>
            )}
            <Badge variant="secondary" className="text-xs">
              {message.target_type === 'all' ? (
                <><Users className="w-3 h-3 mr-1" /> Všem</>
              ) : (
                <><User className="w-3 h-3 mr-1" /> Pro tebe</>
              )}
            </Badge>
          </div>
          <DrawerTitle className="text-lg">{message.title}</DrawerTitle>
          <p className="text-xs text-muted-foreground">{formatDate(message.created_at)}</p>
        </DrawerHeader>
        <div className="px-4 pb-6 overflow-y-auto">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed mb-4">
            {message.body}
          </p>

          {/* Reply button */}
          <button
            onClick={handleReply}
            disabled={replying}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4" />
            {replying ? 'Otevírám...' : 'Odpovědět'}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
