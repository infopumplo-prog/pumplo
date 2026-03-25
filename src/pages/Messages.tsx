import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Inbox, Users, User } from 'lucide-react';
import { useGymMessages } from '@/hooks/useGymMessages';
import { MessageDetailDrawer } from '@/components/messages/MessageDetailDrawer';
import PageTransition from '@/components/PageTransition';

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Právě teď';
  if (diffHours < 24) return `Před ${diffHours}h`;
  if (diffDays === 1) return 'Včera';
  if (diffDays < 7) return `Před ${diffDays} dny`;
  if (diffDays < 30) return `Před ${Math.floor(diffDays / 7)} týd.`;
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
}

const Messages = () => {
  const navigate = useNavigate();
  const { messages, isLoading, markAsRead } = useGymMessages();
  const [selectedMessage, setSelectedMessage] = useState<typeof messages[0] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  const handleOpenMessage = (msg: typeof messages[0]) => {
    setSelectedMessage(msg);
    setDrawerOpen(true);
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">Zprávy</h1>
          </div>
        </div>

        <div className="px-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold text-foreground mb-1">Žádné zprávy</p>
              <p className="text-sm text-muted-foreground">
                Zprávy od vaší posilovny se zobrazí zde
              </p>
            </div>
          ) : (
            <motion.div
              className="space-y-2"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {messages.map((msg) => (
                <motion.button
                  key={msg.id}
                  variants={itemVariants}
                  onClick={() => handleOpenMessage(msg)}
                  className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                    msg.isRead
                      ? 'bg-card border-border'
                      : 'bg-primary/5 border-primary/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Gym logo */}
                    <div className="shrink-0">
                      {msg.gymLogoUrl ? (
                        <div className="relative">
                          <img src={msg.gymLogoUrl} alt="" className="w-10 h-10 rounded-xl object-contain bg-white border border-border" />
                          {!msg.isRead && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                          )}
                        </div>
                      ) : (
                        <div className="relative w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Mail className="w-5 h-5 text-primary" />
                          {!msg.isRead && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-muted-foreground">{msg.gymName || 'Posilovna'}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatRelativeDate(msg.created_at)}
                        </span>
                      </div>
                      <h3 className={`text-sm font-semibold truncate mb-1 ${
                        msg.isRead ? 'text-foreground' : 'text-primary'
                      }`}>
                        {msg.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {msg.body}
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        {msg.target_type === 'all' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            <Users className="w-2.5 h-2.5" /> Všem
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            <User className="w-2.5 h-2.5" /> Pro tebe
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Message Detail Drawer */}
        <MessageDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          message={selectedMessage}
          onMarkAsRead={markAsRead}
        />
      </div>
    </PageTransition>
  );
};

export default Messages;
