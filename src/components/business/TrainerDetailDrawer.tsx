import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Facebook, Instagram, MessageCircle } from 'lucide-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConversations } from '@/hooks/useConversations';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { Trainer } from './GymTrainersTab';

interface TrainerDetailDrawerProps {
  trainer: Trainer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TrainerDetailDrawer = ({ trainer, open, onOpenChange }: TrainerDetailDrawerProps) => {
  const navigate = useNavigate();
  const { getOrCreateConversation } = useConversations();
  const { profile } = useUserProfile();
  const [startingChat, setStartingChat] = useState(false);

  const handleStartChat = async () => {
    if (!trainer || !profile?.selected_gym_id) return;
    setStartingChat(true);
    const conversationId = await getOrCreateConversation(trainer.id, profile.selected_gym_id);
    setStartingChat(false);
    if (conversationId) {
      onOpenChange(false);
      navigate(`/messages/chat/${conversationId}`);
    }
  };

  if (!trainer) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[95vh] border-0">
        <div className="overflow-y-auto max-h-[90vh] -mt-6">
          {/* Header with avatar */}
          <div className="relative pt-6 pb-4 px-4">
            {/* Back button */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 left-4 z-10 p-2 rounded-full bg-muted/50 hover:bg-muted shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-3 pt-6">
              {trainer.photo ? (
                <img
                  src={trainer.photo}
                  alt={trainer.name}
                  className="w-28 h-28 rounded-full object-cover border-4 border-background shadow-lg"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl border-4 border-background shadow-lg">
                  {trainer.name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
              <h2 className="text-xl font-bold">{trainer.name}</h2>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 pb-8">
            <p className="text-sm text-muted-foreground mb-4">{trainer.bio}</p>

            {/* Message button */}
            <button
              onClick={handleStartChat}
              disabled={startingChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 mb-4"
            >
              <MessageCircle className="w-4 h-4" />
              {startingChat ? 'Otevírám...' : 'Napsat zprávu'}
            </button>

            {/* Contact icons */}
            <div className="flex items-center gap-3 mb-6">
              {trainer.contact.phone && (
                <a
                  href={`tel:${trainer.contact.phone}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm hover:bg-muted transition-colors"
                >
                  <Phone className="w-4 h-4 text-primary" />
                  <span className="text-xs">{trainer.contact.phone}</span>
                </a>
              )}
              {trainer.contact.email && (
                <a
                  href={`mailto:${trainer.contact.email}`}
                  className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Mail className="w-4 h-4 text-primary" />
                </a>
              )}
            </div>

            {/* Tabs: Certifikace | Ceník */}
            <Tabs defaultValue="certifications" className="w-full">
              <TabsList className="w-full grid grid-cols-2 h-auto p-1">
                <TabsTrigger value="certifications" className="text-xs py-2">Certifikace</TabsTrigger>
                <TabsTrigger value="pricing" className="text-xs py-2">Ceník</TabsTrigger>
              </TabsList>

              {/* Certifications Tab */}
              <TabsContent value="certifications" className="mt-4 space-y-4">
                {/* Specializations */}
                {trainer.specializations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Na co se specializuji?</h4>
                    <ul className="space-y-2">
                      {trainer.specializations.map((spec, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">&#9632;</span>
                          <span>{spec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Certifications list */}
                {trainer.certifications.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Certifikace</h4>
                    <div className="space-y-3">
                      {trainer.certifications.map((cert, i) => (
                        <div key={i} className="border-b border-border/50 pb-3 last:border-0">
                          <p className="text-sm font-medium text-primary">{cert.name}</p>
                          <p className="text-sm text-muted-foreground">{cert.description}</p>
                          <p className="text-xs text-muted-foreground">{cert.date}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Pricing Tab */}
              <TabsContent value="pricing" className="mt-4">
                {trainer.pricing.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Služby</h4>
                    <div className="space-y-0">
                      {trainer.pricing.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
                        >
                          <span className="text-sm">{item.name}</span>
                          <span className="text-sm font-medium whitespace-nowrap">
                            {item.price.toLocaleString('cs-CZ')} Kč
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    Ceník není k dispozici
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default TrainerDetailDrawer;
