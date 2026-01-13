import { useEffect, useState, useCallback } from 'react';
import { useUserProfile } from './useUserProfile';
import { useWorkoutPlan } from './useWorkoutPlan';

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DAY_NAMES_CZ: Record<string, string> = {
  monday: 'pondělí',
  tuesday: 'úterý',
  wednesday: 'středu',
  thursday: 'čtvrtek',
  friday: 'pátek',
  saturday: 'sobotu',
  sunday: 'neděli'
};

export const useTrainingNotifications = () => {
  const { profile } = useUserProfile();
  const { plan } = useWorkoutPlan();
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  // Check if notifications are supported
  useEffect(() => {
    setIsSupported('Notification' in window);
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;
    
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  // Send notification
  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || notificationPermission !== 'granted') return;
    
    try {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, [isSupported, notificationPermission]);

  // Check and schedule reminder for today's training
  useEffect(() => {
    if (!profile?.training_days || !plan || notificationPermission !== 'granted') return;

    const checkAndNotify = () => {
      const now = new Date();
      const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
      
      // Check if today is a training day
      if (profile.training_days.includes(currentDay)) {
        const notificationKey = `training_notification_${now.toDateString()}`;
        const alreadyNotified = localStorage.getItem(notificationKey);
        
        if (!alreadyNotified) {
          // Get the day template name
          const dayTemplate = plan.allDays?.find(d => d.dayLetter === plan.currentDayLetter);
          const workoutName = dayTemplate?.dayName || `Den ${plan.currentDayLetter}`;
          
          sendNotification('🏋️ Čas na trénink!', {
            body: `Dnes máš na plánu: ${workoutName}. Jsi připraven?`,
            tag: 'training-reminder',
            requireInteraction: false
          });
          
          localStorage.setItem(notificationKey, 'true');
        }
      }
    };

    // Check on mount
    checkAndNotify();

    // Also set up a check at a specific time (e.g., 9 AM)
    const scheduleCheck = () => {
      const now = new Date();
      const targetHour = 9; // 9 AM
      
      let nextCheck = new Date(now);
      nextCheck.setHours(targetHour, 0, 0, 0);
      
      if (now >= nextCheck) {
        // Already past 9 AM today, schedule for tomorrow
        nextCheck.setDate(nextCheck.getDate() + 1);
      }
      
      const msUntilCheck = nextCheck.getTime() - now.getTime();
      
      return setTimeout(() => {
        checkAndNotify();
        // Schedule next check
        scheduleCheck();
      }, msUntilCheck);
    };

    const timeoutId = scheduleCheck();
    
    return () => clearTimeout(timeoutId);
  }, [profile?.training_days, plan, notificationPermission, sendNotification]);

  // Get next training day info
  const getNextTrainingDay = useCallback(() => {
    if (!profile?.training_days || profile.training_days.length === 0) return null;
    
    const now = new Date();
    const currentDayIndex = now.getDay(); // 0 = Sunday
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDayIndex];
    
    // Sort training days by day order
    const sortedDays = [...profile.training_days].sort(
      (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)
    );
    
    // Find next training day
    const currentDayOrder = DAY_ORDER.indexOf(currentDay);
    
    // First check if today is a training day
    if (sortedDays.includes(currentDay)) {
      return {
        day: currentDay,
        dayName: DAY_NAMES_CZ[currentDay],
        isToday: true,
        daysUntil: 0
      };
    }
    
    // Find the next training day after today
    for (const day of sortedDays) {
      const dayOrder = DAY_ORDER.indexOf(day);
      if (dayOrder > currentDayOrder) {
        return {
          day,
          dayName: DAY_NAMES_CZ[day],
          isToday: false,
          daysUntil: dayOrder - currentDayOrder
        };
      }
    }
    
    // Wrap around to next week
    const firstDay = sortedDays[0];
    const firstDayOrder = DAY_ORDER.indexOf(firstDay);
    return {
      day: firstDay,
      dayName: DAY_NAMES_CZ[firstDay],
      isToday: false,
      daysUntil: 7 - currentDayOrder + firstDayOrder
    };
  }, [profile?.training_days]);

  return {
    isSupported,
    notificationPermission,
    requestPermission,
    sendNotification,
    getNextTrainingDay
  };
};
