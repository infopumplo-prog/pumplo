import { useState, useEffect } from 'react';

/**
 * Hook to detect if the app is running as an installed PWA
 */
export const useIsPWA = () => {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (installed PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // iOS Safari specific check
    const isIOSStandalone = (window.navigator as any).standalone === true;
    
    // Check if running in fullscreen mode
    const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
    
    setIsPWA(isStandalone || isIOSStandalone || isFullscreen);

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handler = (e: MediaQueryListEvent) => {
      setIsPWA(e.matches || isIOSStandalone);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isPWA;
};
