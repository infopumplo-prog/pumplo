import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquarePlus } from 'lucide-react';
import { FeedbackModal } from './FeedbackModal';

export const FeedbackButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Hide during active workout - feedback is accessible via info button there
  if (location.pathname.startsWith('/custom-workout/') || location.pathname === '/training') return null;

  return (
    <>
      <motion.button
        className="fixed bottom-24 right-4 z-[60] bg-primary text-primary-foreground rounded-full p-3 shadow-lg"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        aria-label="Feedback"
      >
        <MessageSquarePlus className="w-5 h-5" />
      </motion.button>
      
      <FeedbackModal open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
};
