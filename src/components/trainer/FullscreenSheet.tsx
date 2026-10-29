import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Celá obrazovka jako u osobního check-inu (vaul Drawer se v iOS s klávesnicí rozjížděl).
const FullscreenSheet = ({ open, onClose, closeLabel, labelledBy, children }: {
  open: boolean;
  onClose: () => void;
  closeLabel: string;
  labelledBy: string;
  children: ReactNode;
}) => {
  if (!open) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-[150] bg-background overflow-y-auto overscroll-contain"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="absolute right-3 z-10 w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground active:scale-95 active:bg-muted"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <X className="w-5 h-5" />
      </button>
      <div className="w-full px-5 pt-14">{children}</div>
    </div>,
    document.body,
  );
};

export default FullscreenSheet;
