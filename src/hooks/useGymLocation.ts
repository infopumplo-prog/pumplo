import { useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export type GymLocationStatus = 'idle' | 'checking' | 'inside' | 'outside' | 'permission_denied' | 'error';

// Haversine distance in metres between two lat/lng points
function distanceMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 200 m covers even large gyms (2000 m²) + GPS inaccuracy buffer
const GYM_RADIUS_METRES = 200;

export const useGymLocation = () => {
  const [status, setStatus] = useState<GymLocationStatus>('idle');
  const [distanceFromGym, setDistanceFromGym] = useState<number | null>(null);

  const checkLocation = useCallback(async (gymLat: number, gymLng: number): Promise<boolean> => {
    setStatus('checking');
    setDistanceFromGym(null);

    try {
      // On native (Android/iOS) use Capacitor for native permission dialog
      if (Capacitor.isNativePlatform()) {
        const permResult = await Geolocation.requestPermissions();
        if (permResult.location !== 'granted' && permResult.coarseLocation !== 'granted') {
          setStatus('permission_denied');
          return false;
        }
      } else {
        // Web fallback — check browser permission state (but don't early-return on 'denied'
        // so getCurrentPosition below can still surface a meaningful error or re-prompt)
        if (navigator.permissions) {
          const perm = await navigator.permissions.query({ name: 'geolocation' });
          if (perm.state === 'denied') {
            setStatus('permission_denied');
            return false;
          }
          // state === 'prompt' or 'granted' — proceed to getCurrentPosition
        }
      }

      // Get current position
      let coords: { latitude: number; longitude: number };
      if (Capacitor.isNativePlatform()) {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        coords = pos.coords;
      } else {
        coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve(p.coords),
            reject,
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
      }

      const dist = distanceMetres(coords.latitude, coords.longitude, gymLat, gymLng);
      setDistanceFromGym(Math.round(dist));

      if (dist <= GYM_RADIUS_METRES) {
        setStatus('inside');
        return true;
      } else {
        setStatus('outside');
        return false;
      }
    } catch (err: any) {
      if (err?.code === 1 || err?.message?.includes('denied')) {
        setStatus('permission_denied');
      } else {
        setStatus('error');
      }
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setDistanceFromGym(null);
  }, []);

  return { status, distanceFromGym, checkLocation, reset, GYM_RADIUS_METRES };
};
