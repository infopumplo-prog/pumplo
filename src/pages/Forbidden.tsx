import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldX, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface ForbiddenProps {
  requiredRole?: 'admin' | 'business';
}

const Forbidden = ({ requiredRole }: ForbiddenProps) => {
  const { t } = useTranslation();

  const roleMessages = {
    admin: {
      title: t('misc.forbidden_admin_title'),
      description: t('misc.forbidden_admin_desc'),
    },
    business: {
      title: t('misc.forbidden_business_title'),
      description: t('misc.forbidden_business_desc'),
    },
  };

  const message = requiredRole
    ? roleMessages[requiredRole]
    : { title: t('misc.forbidden_title'), description: t('misc.forbidden_desc') };

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
            {t('misc.back')}
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              {t('misc.home')}
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Forbidden;
