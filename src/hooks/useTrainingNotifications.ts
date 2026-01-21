import { useEffect, useState, useCallback } from 'react';
import { useUserProfile } from './useUserProfile';
import { useWorkoutPlan } from './useWorkoutPlan';
import { useStreak } from './useStreak';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getMinutesUntilClose } from '@/lib/gymUtils';
import type { OpeningHours } from '@/hooks/useGym';

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

// Notification message templates
const MORNING_MESSAGES = [
  { title: '🏋️ Připraven na trénink?', body: 'Dnes máš naplánovaný {workout}. Jdeme do toho!' },
  { title: '💪 Čas na trénink!', body: '{workout} čeká. Jsi připraven?' },
  { title: '🔥 Tvůj trénink čeká!', body: 'Dnes je na řadě {workout}. Nezapomeň!' },
  { title: '⚡ Aktivuj se!', body: '{workout} - tvůj dnešní program. Tak do toho!' },
  { title: '🎯 Tvůj cíl čeká!', body: 'Dnes máš {workout}. Každý trénink se počítá!' },
];

const MISSED_WORKOUT_MESSAGES = [
  { title: '👋 Chyběl jsi nám!', body: 'Minulý trénink nevyšel. Dnes to dohníme s {workout}!' },
  { title: '🔄 Nový den, nová šance!', body: 'Předchozí trénink jsi vynechal. Dnes {workout} zvládneš!' },
  { title: '💪 Pojďme zpátky do rytmu!', body: 'Poslední trénink ses nedostavil. Dnes je ideální příležitost!' },
  { title: '🌟 Každý den je nový start!', body: 'Předchozí workout neproběhl, ale dnes můžeš. {workout} čeká!' },
];

const CLOSING_SOON_MESSAGES = [
  { title: '⏰ Posilovna brzy zavírá!', body: 'Tvoje posilovna zavírá za {time}. Stihneš ještě trénink!' },
  { title: '🏃 Ještě můžeš stihnout!', body: 'Zbývá {time} do zavírání. {workout} čeká!' },
  { title: '⚡ Poslední šance dnes!', body: 'Posilovna zavírá za {time}. Jdi do toho!' },
];

const CLOSING_SOON_STREAK_MESSAGES = [
  { title: '🔥 Neztrať svůj streak!', body: 'Máš sérii {streak} dní! Posilovna zavírá za {time}.' },
  { title: '💪 {streak} dní v řadě!', body: 'Neztrácej momentum! Zavírá se za {time}.' },
  { title: '🏆 Drž svůj streak!', body: '{streak} dní série! Zbývá {time} do zavírání.' },
];

type MessageTemplate = { title: string; body: string };

// Helper to get notification hour based on preferred_time
const getNotificationHour = (preferredTime: string | null): number => {
  switch (preferredTime) {
    case 'morning': return 6;
    case 'late_morning': return 10;
    case 'afternoon': return 14;
    case 'evening': return 18;
    default: return 9;
  }
};

// Helper to get random message from array
const getRandomMessage = (messages: MessageTemplate[]): MessageTemplate => {
  return messages[Math.floor(Math.random() * messages.length)];
};

// Helper to format minutes as human-readable time
const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} hod`;
  return `${hours} hod ${mins} min`;
};

// Get weekday name from Date
const getWeekdayFromDate = (date: Date): string => {
  const dayIndex = date.getDay();
  return dayIndex === 0 ? 'sunday' : DAY_ORDER[dayIndex - 1];
};

export const useTrainingNotifications = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { plan } = useWorkoutPlan();
  const { currentStreak, isStreakActive } = useStreak();
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

  // Get last scheduled training day (before today)
  const getLastScheduledTrainingDay = useCallback((trainingDays: string[]): Date | null => {
    const today = new Date();
    
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dayName = getWeekdayFromDate(checkDate);
      
      if (trainingDays.includes(dayName)) {
        return checkDate;
      }
    }
    return null;
  }, []);

  // Check if user worked out on a specific date
  const checkWorkoutOnDate = useCallback(async (date: Date): Promise<boolean> => {
    if (!user) return false;
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', user.id)
      .gte('started_at', startOfDay.toISOString())
      .lte('started_at', endOfDay.toISOString())
      .not('completed_at', 'is', null)
      .limit(1);
    
    if (error) {
      console.error('Error checking workout on date:', error);
      return false;
    }
    
    return (data?.length ?? 0) > 0;
  }, [user]);

  // Check if user worked out today
  const checkWorkedOutToday = useCallback(async (): Promise<boolean> => {
    return checkWorkoutOnDate(new Date());
  }, [checkWorkoutOnDate]);

  // Check if user missed their previous scheduled training day
  const checkMissedPreviousTraining = useCallback(async (): Promise<boolean> => {
    if (!profile?.training_days || profile.training_days.length === 0) return false;
    
    const lastTrainingDay = getLastScheduledTrainingDay(profile.training_days);
    if (!lastTrainingDay) return false;
    
    const workedOut = await checkWorkoutOnDate(lastTrainingDay);
    return !workedOut;
  }, [profile?.training_days, getLastScheduledTrainingDay, checkWorkoutOnDate]);

  // Get gym opening hours for closing soon check
  const getSelectedGymOpeningHours = useCallback(async () => {
    if (!profile?.selected_gym_id) return null;
    
    const { data, error } = await supabase
      .from('gyms')
      .select('opening_hours')
      .eq('id', profile.selected_gym_id)
      .single();
    
    if (error || !data) return null;
    return data.opening_hours;
  }, [profile?.selected_gym_id]);

  // Send test notification (for admin)
  const sendTestNotification = useCallback(async (type: 'morning' | 'missed' | 'closing') => {
    const workoutName = plan?.allDays?.find(d => d.dayLetter === plan.currentDayLetter)?.dayName || `Den ${plan?.currentDayLetter || 'A'}`;
    
    let message: MessageTemplate;
    
    switch (type) {
      case 'morning':
        message = getRandomMessage(MORNING_MESSAGES);
        break;
      case 'missed':
        message = getRandomMessage(MISSED_WORKOUT_MESSAGES);
        break;
      case 'closing':
        message = isStreakActive && currentStreak > 0
          ? getRandomMessage(CLOSING_SOON_STREAK_MESSAGES)
          : getRandomMessage(CLOSING_SOON_MESSAGES);
        break;
    }
    
    const title = message.title
      .replace('{streak}', String(currentStreak));
    const body = message.body
      .replace('{workout}', workoutName)
      .replace('{streak}', String(currentStreak))
      .replace('{time}', '2 hodiny');
    
    sendNotification(title, { body, tag: `test-${type}` });
  }, [plan, currentStreak, isStreakActive, sendNotification]);

  // Check and schedule reminder for today's training
  useEffect(() => {
    if (!profile?.training_days || !plan || notificationPermission !== 'granted') return;

    const checkAndNotifyMorning = async () => {
      const now = new Date();
      const currentDay = getWeekdayFromDate(now);
      
      // Check if today is a training day
      if (!profile.training_days.includes(currentDay)) return;
      
      const notificationKey = `training_notification_${now.toDateString()}`;
      const alreadyNotified = localStorage.getItem(notificationKey);
      
      if (alreadyNotified) return;
      
      // Get the day template name
      const dayTemplate = plan.allDays?.find(d => d.dayLetter === plan.currentDayLetter);
      const workoutName = dayTemplate?.dayName || `Den ${plan.currentDayLetter}`;
      
      // Check if user missed previous training
      const missedPrevious = await checkMissedPreviousTraining();
      
      const messages = missedPrevious ? MISSED_WORKOUT_MESSAGES : MORNING_MESSAGES;
      const message = getRandomMessage(messages);
      
      const title = message.title;
      const body = message.body.replace('{workout}', workoutName);
      
      sendNotification(title, {
        body,
        tag: 'training-reminder',
        requireInteraction: false
      });
      
      localStorage.setItem(notificationKey, 'true');
    };

    // Schedule morning notification based on preferred_time
    const scheduleMorningNotification = () => {
      const now = new Date();
      const targetHour = getNotificationHour(profile.preferred_time || null);
      
      let nextCheck = new Date(now);
      nextCheck.setHours(targetHour, 0, 0, 0);
      
      if (now >= nextCheck) {
        // Already past the time today, check if we should notify now (within 5 min window)
        const minutesPast = (now.getTime() - nextCheck.getTime()) / 60000;
        if (minutesPast < 5) {
          checkAndNotifyMorning();
        }
        // Schedule for tomorrow
        nextCheck.setDate(nextCheck.getDate() + 1);
      }
      
      const msUntilCheck = nextCheck.getTime() - now.getTime();
      
      return setTimeout(() => {
        checkAndNotifyMorning();
        scheduleMorningNotification();
      }, msUntilCheck);
    };

    // Check on mount
    checkAndNotifyMorning();

    const morningTimeoutId = scheduleMorningNotification();
    
    return () => clearTimeout(morningTimeoutId);
  }, [profile?.training_days, profile?.preferred_time, plan, notificationPermission, sendNotification, checkMissedPreviousTraining]);

  // Closing soon notification (2 hours before gym closes)
  useEffect(() => {
    if (!profile?.training_days || !profile?.selected_gym_id || notificationPermission !== 'granted') return;

    const checkClosingSoon = async () => {
      const now = new Date();
      const currentDay = getWeekdayFromDate(now);
      
      // Only notify if today is a training day
      if (!profile.training_days.includes(currentDay)) return;
      
      const closingKey = `closing_notification_${now.toDateString()}`;
      const alreadyNotified = localStorage.getItem(closingKey);
      
      if (alreadyNotified) return;
      
      // Check if user already worked out today
      const workedOutToday = await checkWorkedOutToday();
      if (workedOutToday) return;
      
      // Get gym opening hours
      const openingHours = await getSelectedGymOpeningHours();
      if (!openingHours) return;
      
      const minutesUntilClose = getMinutesUntilClose(openingHours as OpeningHours);
      if (minutesUntilClose === null || minutesUntilClose > 120) return;
      
      // Get workout name
      const dayTemplate = plan?.allDays?.find(d => d.dayLetter === plan?.currentDayLetter);
      const workoutName = dayTemplate?.dayName || `Den ${plan?.currentDayLetter || 'A'}`;
      
      // Choose message based on streak
      const messages = isStreakActive && currentStreak > 0 
        ? CLOSING_SOON_STREAK_MESSAGES 
        : CLOSING_SOON_MESSAGES;
      const message = getRandomMessage(messages);
      
      const timeString = formatMinutes(minutesUntilClose);
      
      const title = message.title.replace('{streak}', String(currentStreak));
      const body = message.body
        .replace('{workout}', workoutName)
        .replace('{streak}', String(currentStreak))
        .replace('{time}', timeString);
      
      sendNotification(title, {
        body,
        tag: 'closing-soon',
        requireInteraction: false
      });
      
      localStorage.setItem(closingKey, 'true');
    };

    // Check every 15 minutes for closing soon
    const intervalId = setInterval(checkClosingSoon, 15 * 60 * 1000);
    
    // Initial check
    checkClosingSoon();
    
    return () => clearInterval(intervalId);
  }, [profile?.training_days, profile?.selected_gym_id, plan, notificationPermission, currentStreak, isStreakActive, sendNotification, checkWorkedOutToday, getSelectedGymOpeningHours]);

  // Get next training day info
  const getNextTrainingDay = useCallback(() => {
    if (!profile?.training_days || profile.training_days.length === 0) return null;
    
    const now = new Date();
    const currentDayIndex = now.getDay(); // 0 = Sunday
    const currentDay = currentDayIndex === 0 ? 'sunday' : DAY_ORDER[currentDayIndex - 1];
    
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
    sendTestNotification,
    getNextTrainingDay
  };
};
