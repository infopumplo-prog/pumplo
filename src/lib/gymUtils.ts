import { OpeningHours } from '@/hooks/useGym';

const DAYS_MAP: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export const isGymCurrentlyOpen = (openingHours: OpeningHours): boolean => {
  const now = new Date();
  const dayKey = DAYS_MAP[now.getDay()];
  const dayHours = openingHours[dayKey];

  if (!dayHours || dayHours.closed) {
    return false;
  }

  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [openHour, openMin] = dayHours.open.split(':').map(Number);
  const [closeHour, closeMin] = dayHours.close.split(':').map(Number);
  
  const openTime = openHour * 60 + openMin;
  let closeTime = closeHour * 60 + closeMin;
  // 00:00 means midnight (end of day)
  if (closeTime === 0) closeTime = 24 * 60;

  return currentTime >= openTime && currentTime < closeTime;
};

export const getMinutesUntilClose = (openingHours: OpeningHours): number | null => {
  const now = new Date();
  const dayKey = DAYS_MAP[now.getDay()];
  const dayHours = openingHours[dayKey];

  if (!dayHours || dayHours.closed) {
    return null;
  }

  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [openHour, openMin] = dayHours.open.split(':').map(Number);
  const [closeHour, closeMin] = dayHours.close.split(':').map(Number);
  
  const openTime = openHour * 60 + openMin;
  let closeTime = closeHour * 60 + closeMin;
  if (closeTime === 0) closeTime = 24 * 60;

  if (currentTime >= openTime && currentTime < closeTime) {
    return closeTime - currentTime;
  }
  
  return null;
};

export const isClosingSoon = (openingHours: OpeningHours, thresholdMinutes: number = 60): boolean => {
  const minutesLeft = getMinutesUntilClose(openingHours);
  return minutesLeft !== null && minutesLeft <= thresholdMinutes;
};

export type OpeningStatusKey =
  | { key: 'map.gym_closed_today'; params?: undefined }
  | { key: 'map.gym_open_until'; params: { time: string } }
  | { key: 'map.gym_closes_soon'; params: { min: number } }
  | { key: 'map.gym_opens_at'; params: { time: string } };

export interface GymOpeningStatus {
  isOpen: boolean;
  i18n: OpeningStatusKey;
  closingSoon?: boolean;
  /** @deprecated use i18n + t() at call site */
  text?: string;
}

export const getTodayOpeningStatus = (openingHours: OpeningHours): GymOpeningStatus => {
  const now = new Date();
  const dayKey = DAYS_MAP[now.getDay()];
  const dayHours = openingHours[dayKey];

  if (!dayHours || dayHours.closed) {
    return { isOpen: false, i18n: { key: 'map.gym_closed_today' } };
  }

  const isOpen = isGymCurrentlyOpen(openingHours);
  const minutesLeft = getMinutesUntilClose(openingHours);

  if (isOpen && minutesLeft !== null) {
    if (minutesLeft <= 60) {
      return {
        isOpen: true,
        i18n: { key: 'map.gym_closes_soon', params: { min: minutesLeft } },
        closingSoon: true,
      };
    }
    const displayClose = dayHours.close === '00:00' ? '24:00' : dayHours.close;
    return { isOpen: true, i18n: { key: 'map.gym_open_until', params: { time: displayClose } } };
  } else {
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openHour, openMin] = dayHours.open.split(':').map(Number);
    const openTime = openHour * 60 + openMin;

    if (currentTime < openTime) {
      return { isOpen: false, i18n: { key: 'map.gym_opens_at', params: { time: dayHours.open } } };
    }
    return { isOpen: false, i18n: { key: 'map.gym_closed_today' } };
  }
};
