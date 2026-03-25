import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Inbox, Users, User, MessageCircle } from 'lucide-react';
import { useGymMessages } from '@/hooks/useGymMessages';
import { useConversations } from '@/hooks/useConversations';
import { MessageDetailDrawer } from '@/components/messages/MessageDetailDrawer';
import PageTransition from '@/components/PageTransition';
import { cn } from '@/lib/utils';

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
  const { messages, isLoading: gymLoading, markAsRead, unreadCount: gymUnread } = useGymMessages();
  const { conversations, isLoading: convLoading, unreadDMCount } = useConversations();
  const [selectedMessage, setSelectedMessage] = useState<typeof messages[0] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'gym' | 'conversations'>('gym');

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

          {/* Tabs */}
          <div className="flex gap-1 px-4 border-b border-border">
            <button
              onClick={() => setActiveTab('gym')}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === 'gym'
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              )}
            >
              <Mail className="w-3.5 h-3.5" />
              Od posilovny
              {gymUnread > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">{gymUnread}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('conversations')}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === 'conversations'
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              )}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Konverzace
              {unreadDMCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">{unreadDMCount}</span>
              )}
            </button>
          </div>
        </div>

        <div className="px-4 py-4">
          {/* GYM MESSAGES TAB */}
          {activeTab === 'gym' && (
            <>
              {gymLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                    <Inbox className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-semibold text-foreground mb-1">Žádné zprávy</p>
                  <p className="text-sm text-muted-foreground">Zprávy od vaší posilovny se zobrazí zde</p>
                </div>
              ) : (
                <motion.div className="space-y-2" variants={containerVariants} initial="hidden" animate="visible">
                  {messages.map((msg) => (
                    <motion.button
                      key={msg.id}
                      variants={itemVariants}
                      onClick={() => handleOpenMessage(msg)}
                      className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                        msg.isRead ? 'bg-card border-border' : 'bg-primary/5 border-primary/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0">
                          {msg.gymLogoUrl ? (
                            <div className="relative">
                              <img src={msg.gymLogoUrl} alt="" className="w-10 h-10 rounded-xl object-contain bg-white border border-border" />
                              {!msg.isRead && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />}
                            </div>
                          ) : (
                            <div className="relative w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Mail className="w-5 h-5 text-primary" />
                              {!msg.isRead && <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-muted-foreground">{msg.gymName || 'Posilovna'}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground shrink-0">{formatRelativeDate(msg.created_at)}</span>
                          </div>
                          <h3 className={`text-sm font-semibold truncate mb-1 ${msg.isRead ? 'text-foreground' : 'text-primary'}`}>
                            {msg.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">{msg.body}</p>
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
            </>
          )}

          {/* CONVERSATIONS TAB */}
          {activeTab === 'conversations' && (
            <>
              {convLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4">
                    <MessageCircle className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-semibold text-foreground mb-1">Žádné konverzace</p>
                  <p className="text-sm text-muted-foreground">
                    Napište trenérovi z jeho profilu a konverzace se zobrazí zde
                  </p>
                </div>
              ) : (
                <motion.div className="space-y-2" variants={containerVariants} initial="hidden" animate="visible">
                  {conversations.map((conv) => (
                    <motion.button
                      key={conv.id}
                      variants={itemVariants}
                      onClick={() => navigate(`/messages/chat/${conv.id}`)}
                      className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                        (conv.unreadCount || 0) > 0 ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {conv.trainerPhotoUrl ? (
                          <img src={conv.trainerPhotoUrl} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-6 h-6 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h3 className="text-sm font-semibold truncate">{conv.trainerName || 'Trenér'}</h3>
                            <span className="text-xs text-muted-foreground shrink-0 ml-2">
                              {formatRelativeDate(conv.last_message_at)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessagePreview || 'Žádné zprávy'}
                          </p>
                        </div>
                        {(conv.unreadCount || 0) > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-white shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </>
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
