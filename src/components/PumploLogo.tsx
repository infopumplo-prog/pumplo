import pumploWordmark from '@/assets/pumplo-wordmark.png';
import { cn } from '@/lib/utils';

interface PumploLogoProps {
  /** Výška loga — šířka se dopočítá z poměru stran PNG (692 × 184). */
  className?: string;
}

/**
 * Logo Pumplo v barvě appky (David 8. 10.): tvar se bere z PNG jako maska, barva z --primary,
 * takže se při volbě barvy v dotazníku nebo v Nastavení přebarví spolu s celou appkou.
 */
const PumploLogo = ({ className }: PumploLogoProps) => (
  <span
    role="img"
    aria-label="Pumplo"
    className={cn('block h-10 aspect-[692/184] bg-primary transition-colors duration-300', className)}
    style={{
      WebkitMaskImage: `url(${pumploWordmark})`,
      maskImage: `url(${pumploWordmark})`,
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
    }}
  />
);

export default PumploLogo;
