import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDirectMessages, DirectMessage } from '@/hooks/useDirectMessages';
import { supabase } from '@/integrations/supabase/client';
import PageTransition from '@/components/PageTransition';

interface TrainerInfo {
  name: string;
  photoUrl: string | null;
}

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Dnes';
  if (diffDays === 1) return 'Včera';
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
}

function shouldShowTimestamp(current: DirectMessage, previous: DirectMessage | null): boolean {
  if (!previous) return true;
  const gap = new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
  return gap > 30 * 60 * 1000; // 30 minutes
}

const ChatThread = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { messages, isLoading, sendMessage, markAllRead } = useDirectMessages(conversationId);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [trainerInfo, setTrainerInfo] = useState<TrainerInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch trainer info from conversation
  const fetchTrainerInfo = useCallback(async () => {
    if (!conversationId) return;

    const { data: conv } = await supabase
      .from('conversations')
      .select('trainer_id')
      .eq('id', conversationId)
      .single();

    if (!conv || !(conv as any).trainer_id) return;

    const { data: trainer } = await supabase
      .from('gym_trainers')
      .select('name, photo_url')
      .eq('id', (conv as any).trainer_id)
      .single();

    if (trainer) {
      setTrainerInfo({
        name: (trainer as any).name,
        photoUrl: (trainer as any).photo_url || null,
      });
    }
  }, [conversationId]);

  useEffect(() => {
    fetchTrainerInfo();
  }, [fetchTrainerInfo]);

  // Mark all messages as read on mount
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  // Auto-scroll to bottom on mount and new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    const text = inputText;
    setInputText('');
    setIsSending(true);

    await sendMessage(text);
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
  };

  const bubbleVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background safe-top flex flex-col">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate('/messages')}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {trainerInfo ? (
              <div className="flex items-center gap-3">
                {trainerInfo.photoUrl ? (
                  <img
                    src={trainerInfo.photoUrl}
                    alt={trainerInfo.name}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {trainerInfo.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                )}
                <h1 className="text-lg font-bold">{trainerInfo.name}</h1>
              </div>
            ) : (
              <h1 className="text-lg font-bold">Konverzace</h1>
            )}
          </div>
        </div>

        {/* Message area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 pb-24"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">
                Zatím žádné zprávy. Napište první!
              </p>
            </div>
          ) : (
            <motion.div
              className="space-y-1"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {messages.map((msg, index) => {
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const showTimestamp = shouldShowTimestamp(msg, prevMsg);
                const isMember = msg.sender_type === 'member';

                return (
                  <div key={msg.id}>
                    {/* Timestamp separator */}
                    {showTimestamp && (
                      <div className="flex justify-center my-4">
                        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                          {formatDateSeparator(msg.created_at)}{' '}
                          {formatMessageTime(msg.created_at)}
                        </span>
                      </div>
                    )}

                    {/* Message bubble */}
                    <motion.div
                      variants={bubbleVariants}
                      className={`flex ${isMember ? 'justify-end' : 'justify-start'} mb-1`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed ${
                          isMember
                            ? 'bg-primary text-white rounded-2xl rounded-br-md'
                            : 'bg-muted rounded-2xl rounded-bl-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        {!showTimestamp && (
                          <p
                            className={`text-[10px] mt-1 ${
                              isMember ? 'text-white/60' : 'text-muted-foreground'
                            }`}
                          >
                            {formatMessageTime(msg.created_at)}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </motion.div>
          )}
        </div>

        {/* Fixed bottom input bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-4 py-3 safe-bottom z-10">
          <div className="flex items-center gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Napsat zprávu..."
              className="flex-1 h-11 rounded-xl"
              disabled={isSending}
            />
            <Button
              onClick={handleSend}
              disabled={!inputText.trim() || isSending}
              size="icon"
              className="h-11 w-11 rounded-xl shrink-0"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default ChatThread;
