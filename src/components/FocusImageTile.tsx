import { useState } from 'react';
import { Check, Dumbbell, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { focusImageFor } from '@/lib/focusImages';

// Dlaždice partie s fotkou, tmavým přechodem a popiskem (feedback 13. 10.).
// Bez fotky (nebo když se nenačte) ukáže ikonu na barvě appky.
interface FocusImageTileProps {
  focusKey: string | null;
  label: string;
  selected?: boolean;
  dimmed?: boolean;
  onClick: () => void;
  className?: string;
  fallbackIcon?: LucideIcon;
}

const FocusImageTile = ({ focusKey, label, selected, dimmed, onClick, className, fallbackIcon: FallbackIcon = Dumbbell }: FocusImageTileProps) => {
  const [failed, setFailed] = useState(false);
  const src = focusImageFor(focusKey);
  const showImage = !!src && !failed;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!selected}
      className={cn(
        'relative min-h-[44px] rounded-2xl overflow-hidden text-left transition-all active:scale-95 active:brightness-90',
        dimmed ? 'opacity-40' : 'opacity-100',
        selected && 'ring-2 ring-offset-2 ring-primary ring-offset-background',
        !showImage && 'bg-primary/15',
        className,
      )}
    >
      {showImage ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center pb-5">
          <FallbackIcon className="w-8 h-8 text-primary" strokeWidth={2.2} />
        </span>
      )}
      {showImage && <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />}
      {selected && (
        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Check className="w-4 h-4" strokeWidth={3} />
        </span>
      )}
      <span className={cn('absolute left-2.5 right-2.5 bottom-2 text-sm font-bold leading-tight', showImage ? 'text-white' : 'text-foreground')}>
        {label}
      </span>
    </button>
  );
};

export default FocusImageTile;
