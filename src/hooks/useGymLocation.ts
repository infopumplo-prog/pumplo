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

// --- Fast-fix machinery -----------------------------------------------------
// A 200 m radius check doesn't need a fresh high-accuracy GPS fix (cold start
// 5-10 s). Tiered approach: recent cached fix -> instant coarse fix -> full
// GPS only when the coarse result says "outside" (fairness before rejecting).
type Fix = { latitude: number; longitude: number; ts: number };
let lastFix: Fix | null = null;
const FIX_MAX_AGE_MS = 90_000;

async function getPosition(highAccuracy: boolean, timeout: number): Promise<{ latitude: number; longitude: number }> {
  if (Capacitor.isNativePlatform()) {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: highAccuracy,
      timeout,
      maximumAge: FIX_MAX_AGE_MS,
    });
    return pos.coords;
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      reject,
      { enableHighAccuracy: highAccuracy, timeout, maximumAge: FIX_MAX_AGE_MS }
    );
  });
}

// Warm the location cache while the user is still picking a gym — by the time
// they confirm, the fix is usually already here. Never prompts: runs only when
// permission is already granted.
export async function prefetchGymLocation(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') return;
    } else if (navigator.permissions) {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      if (perm.state !== 'granted') return;
    }
    const coords = await getPosition(false, 8000);
    lastFix = { latitude: coords.latitude, longitude: coords.longitude, ts: Date.now() };
  } catch { /* best effort */ }
}

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

      const inside = (c: { latitude: number; longitude: number }) => {
        const dist = distanceMetres(c.latitude, c.longitude, gymLat, gymLng);
        setDistanceFromGym(Math.round(dist));
        return dist <= GYM_RADIUS_METRES;
      };

      // 1) Prefetched/cached fix (instant)
      if (lastFix && Date.now() - lastFix.ts < FIX_MAX_AGE_MS && inside(lastFix)) {
        setStatus('inside');
        return true;
      }

      // 2) Coarse fix — WiFi/cell, typically well under a second
      let coarseFailed = false;
      try {
        const coords = await getPosition(false, 6000);
        lastFix = { latitude: coords.latitude, longitude: coords.longitude, ts: Date.now() };
        if (inside(coords)) {
          setStatus('inside');
          return true;
        }
      } catch { coarseFailed = true; }

      // 3) Looks outside (or coarse failed) — one full-accuracy fix before
      //    rejecting, so nobody standing IN the gym gets blocked by a fuzzy fix.
      const coords = await getPosition(true, 10000);
      lastFix = { latitude: coords.latitude, longitude: coords.longitude, ts: Date.now() };
      if (inside(coords)) {
        setStatus('inside');
        return true;
      }
      setStatus('outside');
      return false;
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
