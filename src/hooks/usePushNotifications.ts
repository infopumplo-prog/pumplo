import { useState, useCallback, useEffect } from 'react';
import { useUserProfile } from './useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// VAPID public key - generated for production push notifications
// This MUST match the VAPID_PUBLIC_KEY secret in Supabase
const VAPID_PUBLIC_KEY = 'BOnDHrq6aLfju20O4y-3XNnP0tfY9eCJbpuL-9t9ej6eAte-4AKU23mQ2Syn-PVkyMu4yipAmIvhazty-pBLfV4';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const { profile, updateProfile } = useUserProfile();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);
      
      if (supported && 'serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const existingSub = await registration.pushManager.getSubscription();
          if (existingSub) {
            setSubscription(existingSub);
            setIsSubscribed(true);
          }
        } catch (error) {
          console.error('Error checking push subscription:', error);
        }
      }
    };
    
    checkSupport();
  }, []);

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    
    try {
      // First request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return false;
      }
      
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
      });
      
      // Save subscription to database
      if (user) {
        const subscriptionJSON = pushSubscription.toJSON();
        await updateProfile({
          push_subscription: subscriptionJSON as Record<string, unknown>
        });
      }
      
      setSubscription(pushSubscription);
      setIsSubscribed(true);
      
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    }
  }, [isSupported, user, updateProfile]);

  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!subscription) return false;
    
    try {
      await subscription.unsubscribe();
      
      // Remove subscription from database
      if (user) {
        await updateProfile({
          push_subscription: null
        });
      }
      
      setSubscription(null);
      setIsSubscribed(false);
      
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      return false;
    }
  }, [subscription, user, updateProfile]);

  // Notification preferences
  const notificationPreferences = {
    morningReminder: profile?.notification_morning_reminder ?? true,
    missedWorkout: profile?.notification_missed_workout ?? true,
    closingSoon: profile?.notification_closing_soon ?? true,
    onboardingShown: profile?.notification_onboarding_shown ?? false
  };

  // Update individual notification preference
  const updateNotificationPreference = useCallback(async (
    type: 'morning_reminder' | 'missed_workout' | 'closing_soon',
    enabled: boolean
  ): Promise<boolean> => {
    const key = `notification_${type}` as const;
    const result = await updateProfile({
      [key]: enabled
    });
    return result.success;
  }, [updateProfile]);

  // Mark onboarding as shown
  const markOnboardingShown = useCallback(async (): Promise<void> => {
    await updateProfile({
      notification_onboarding_shown: true
    });
  }, [updateProfile]);

  return {
    isSupported,
    isSubscribed,
    subscription,
    subscribeToPush,
    unsubscribeFromPush,
    notificationPreferences,
    updateNotificationPreference,
    markOnboardingShown
  };
};
