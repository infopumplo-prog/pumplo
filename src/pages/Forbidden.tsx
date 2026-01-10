import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldX, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ForbiddenProps {
  requiredRole?: 'admin' | 'business';
}

const Forbidden = ({ requiredRole }: ForbiddenProps) => {
  const roleMessages = {
    admin: {
      title: 'Přístup pouze pro administrátory',
      description: 'Tato sekce je vyhrazena pro administrátory aplikace. Pokud si myslíte, že byste měli mít přístup, kontaktujte správce.',
    },
    business: {
      title: 'Přístup pouze pro firmy',
      description: 'Tato sekce je vyhrazena pro majitele posiloven. Pro přístup potřebujete firemní účet.',
    },
  };

  const message = requiredRole 
    ? roleMessages[requiredRole] 
    : { title: 'Přístup odepřen', description: 'Nemáte oprávnění pro přístup k této stránce.' };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <ShieldX className="w-12 h-12 text-destructive" />
        </motion.div>
        
        <h1 className="text-6xl font-bold text-foreground mb-2">403</h1>
        <h2 className="text-xl font-semibold text-foreground mb-2">{message.title}</h2>
        <p className="text-muted-foreground mb-8">
          {message.description}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Domů
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Forbidden;
