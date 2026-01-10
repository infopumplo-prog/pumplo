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
  const closeTime = closeHour * 60 + closeMin;

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
  const closeTime = closeHour * 60 + closeMin;

  if (currentTime >= openTime && currentTime < closeTime) {
    return closeTime - currentTime;
  }
  
  return null;
};

export const isClosingSoon = (openingHours: OpeningHours, thresholdMinutes: number = 60): boolean => {
  const minutesLeft = getMinutesUntilClose(openingHours);
  return minutesLeft !== null && minutesLeft <= thresholdMinutes;
};

export const getTodayOpeningStatus = (openingHours: OpeningHours): { isOpen: boolean; text: string; closingSoon?: boolean } => {
  const now = new Date();
  const dayKey = DAYS_MAP[now.getDay()];
  const dayHours = openingHours[dayKey];

  if (!dayHours || dayHours.closed) {
    return { isOpen: false, text: 'Dnes zavřeno' };
  }

  const isOpen = isGymCurrentlyOpen(openingHours);
  const minutesLeft = getMinutesUntilClose(openingHours);
  
  if (isOpen && minutesLeft !== null) {
    if (minutesLeft <= 60) {
      return { 
        isOpen: true, 
        text: `Zavírá za ${minutesLeft} min`, 
        closingSoon: true 
      };
    }
    return { isOpen: true, text: `Otevřeno do ${dayHours.close}` };
  } else {
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openHour, openMin] = dayHours.open.split(':').map(Number);
    const openTime = openHour * 60 + openMin;
    
    if (currentTime < openTime) {
      return { isOpen: false, text: `Otevře v ${dayHours.open}` };
    }
    return { isOpen: false, text: 'Dnes zavřeno' };
  }
};
