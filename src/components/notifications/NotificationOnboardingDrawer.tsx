import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Bell, BellRing, Clock, Flame, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

interface NotificationOnboardingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
}

const NotificationOnboardingDrawer = ({
  open,
  onOpenChange,
  onAccept,
  onDecline
}: NotificationOnboardingDrawerProps) => {
  const { t } = useTranslation();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleAccept = async () => {
    setIsRequesting(true);
    await onAccept();
    setIsRequesting(false);
    onOpenChange(false);
  };

  const handleDecline = () => {
    onDecline();
    onOpenChange(false);
  };

  const features = [
    {
      icon: Clock,
      title: t('notifications.morning_title'),
      description: t('notifications.morning_desc'),
    },
    {
      icon: Flame,
      title: t('notifications.streak_title'),
      description: t('notifications.streak_desc'),
    },
    {
      icon: MapPin,
      title: t('notifications.closing_title'),
      description: t('notifications.closing_desc'),
    },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <BellRing className="w-8 h-8 text-primary" />
          </div>
          <DrawerTitle className="text-2xl">{t('notifications.drawer_title')}</DrawerTitle>
          <p className="text-muted-foreground mt-2">
            {t('notifications.drawer_desc')}
          </p>
        </DrawerHeader>

        <div className="px-6 py-4 space-y-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start gap-4 p-3 bg-muted/50 rounded-xl"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{feature.title}</p>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="px-6 pb-8 pt-4 space-y-3">
          <Button
            onClick={handleAccept}
            disabled={isRequesting}
            className="w-full h-12 text-base"
          >
            {isRequesting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                {t('notifications.allowing')}
              </>
            ) : (
              <>
                <Bell className="w-5 h-5 mr-2" />
                {t('notifications.allow_btn')}
              </>
            )}
          </Button>
          <Button
            onClick={handleDecline}
            variant="ghost"
            className="w-full h-12 text-base text-muted-foreground"
          >
            {t('notifications.not_now')}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default NotificationOnboardingDrawer;
