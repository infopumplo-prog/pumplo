import { useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Mail, Users, User } from 'lucide-react';

interface MessageDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: {
    id: string;
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
  // Mark as read when drawer opens
  useEffect(() => {
    if (open && message && !message.isRead) {
      onMarkAsRead(message.id);
    }
  }, [open, message?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

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
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {message.body}
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
