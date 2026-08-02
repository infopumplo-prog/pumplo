import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppMessage } from '@/hooks/useAppMessages';

// Zprávy od Pumpla se rozbalují na místě — na systémovou zprávu se neodpovídá,
// takže drawer s odpovědí jako u zpráv z posilovny by tu nedával smysl.

interface AppMessagesSectionProps {
  messages: AppMessage[];
  onMarkAsRead: (id: string) => void;
  formatDate: (iso: string) => string;
}

const AppMessagesSection = ({ messages, onMarkAsRead, formatDate }: AppMessagesSectionProps) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (messages.length === 0) return null;

  const toggle = (msg: AppMessage) => {
    const opening = expandedId !== msg.id;
    setExpandedId(opening ? msg.id : null);
    if (opening && !msg.isRead) onMarkAsRead(msg.id);
  };

  return (
    <div className="space-y-2 mb-2">
      {messages.map((msg) => {
        const expanded = expandedId === msg.id;
        return (
          <motion.button
            key={msg.id}
            layout
            onClick={() => toggle(msg)}
            className={cn(
              'w-full text-left p-4 rounded-2xl border transition-colors',
              msg.isRead ? 'bg-card border-border' : 'bg-primary/5 border-primary/20',
            )}
          >
            <div className="flex items-start gap-3">
              <div className="relative shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
                {!msg.isRead && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-muted-foreground">Pumplo</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDate(msg.published_at)}</span>
                </div>

                <h3 className={cn('text-sm font-semibold mb-1', msg.isRead ? 'text-foreground' : 'text-primary')}>
                  {msg.title}
                </h3>

                <p className={cn('text-sm text-muted-foreground whitespace-pre-line', !expanded && 'line-clamp-2')}>
                  {msg.body}
                </p>

                <div className="flex items-center gap-1 mt-2">
                  {msg.app_version && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {t('messages.version_label', { version: msg.app_version })}
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform',
                      expanded && 'rotate-180',
                    )}
                  />
                </div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export default AppMessagesSection;
