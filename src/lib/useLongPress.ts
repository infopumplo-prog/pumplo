import { useRef } from 'react';

// Press-and-hold helper. Spread the returned handlers onto a button and guard
// its onClick with wasLongPress() so a hold doesn't also fire the tap action.
export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  return {
    handlers: {
      onPointerDown: () => { fired.current = false; clear(); timer.current = setTimeout(() => { fired.current = true; onLongPress(); }, ms); },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
    },
    wasLongPress: () => fired.current,
  };
}
