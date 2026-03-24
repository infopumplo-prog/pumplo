import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, ArrowLeft, Clock, Dumbbell, Weight, Flame, MapPin, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useUserProfile } from '@/hooks/useUserProfile';
import { estimateCalories } from '@/lib/calorieEstimation';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

interface WorkoutShareCardProps {
  dayLetter: string;
  dayName?: string;
  goalId: string;
  gymName: string;
  totalDuration: number;
  totalSets: number;
  totalWeight: number;
  totalReps: number;
  exerciseCount: number;
  isBonus?: boolean;
  onClose: () => void;
  onFinish: () => void;
  isSaving?: boolean;
}

/* no PhotoInput component - using inline inputs */

export const WorkoutShareCard = ({
  dayLetter,
  dayName,
  goalId,
  gymName,
  totalDuration,
  totalSets,
  totalWeight,
  totalReps,
  exerciseCount,
  isBonus,
  onClose,
  onFinish,
  isSaving,
}: WorkoutShareCardProps) => {
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const cachedBlobRef = useRef<Blob | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { profile } = useUserProfile();

  const estimatedCalories = estimateCalories({
    durationSeconds: totalDuration * 60,
    totalSets,
    goalId,
    weightKg: profile?.weight_kg || 75,
    gender: profile?.gender,
    age: profile?.age,
  });

  const displayTitle = isBonus
    ? 'Bonusový trénink'
    : dayName || `Den ${dayLetter.replace('_EXT', '+')}`;

  const today = new Date();
  const dateStr = format(today, 'd. MMMM yyyy', { locale: cs });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUserPhoto(event.target?.result as string);
      cachedBlobRef.current = null;
      setImageReady(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
      });
    } catch (err) {
      console.error('Chyba při generování obrázku:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsGenerating(true);
      const blob = await generateImage();
      cachedBlobRef.current = blob;
      setImageReady(!!blob);
      setIsGenerating(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [userPhoto, generateImage]);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const handleShare = useCallback(async () => {
    const blob = cachedBlobRef.current;
    if (!blob) return;

    const fileName = `pumplo-trenink-${format(today, 'yyyy-MM-dd')}.png`;
    const shareText = `${displayTitle} dokončen! ${totalWeight} kg | ${totalSets} sérií | ${totalDuration} min`;

    if (Capacitor.isNativePlatform()) {
      try {
        const base64 = await blobToBase64(blob);
        const saved = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: 'Můj trénink na Pumplo',
          text: shareText,
          url: saved.uri,
          dialogTitle: 'Sdílet trénink',
        });
        return;
      } catch (err) {
        if ((err as Error).message?.includes('canceled')) return;
      }
    }

    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.share) {
      try {
        const canShareFiles = navigator.canShare?.({ files: [file] });
        if (canShareFiles) {
          await navigator.share({ files: [file], title: 'Můj trénink na Pumplo', text: shareText });
          return;
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [today, displayTitle, totalWeight, totalSets, totalDuration]);

  const stats = [
    { icon: Clock, color: 'text-cyan-400', value: `${totalDuration}`, unit: 'min' },
    { icon: Weight, color: 'text-emerald-400', value: `${Math.round(totalWeight).toLocaleString('cs')}`, unit: 'kg' },
    { icon: Dumbbell, color: 'text-amber-400', value: `${totalSets}`, unit: '' },
    { icon: Flame, color: 'text-orange-400', value: `${estimatedCalories}`, unit: 'kcal' },
  ];

  const pillBg = userPhoto ? 'bg-black/40 backdrop-blur-md' : 'bg-gray-100';
  const textMain = userPhoto ? 'text-white' : 'text-gray-800';
  const textSub = userPhoto ? 'text-white/60' : 'text-gray-400';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-white flex flex-col"
    >
      {/* Horní lišta */}
      <div className="flex items-center justify-start px-4 pt-3 pb-1 z-10 shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-600 hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6" />
        </Button>
      </div>

      {/* Karta — flexibilní výška, vejde se na obrazovku */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-1">
        <div
          ref={cardRef}
          className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-white h-full"
          style={{ maxHeight: '100%', aspectRatio: '9/16' }}
        >
          {userPhoto ? (
            <img src={userPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100" />
          )}

          {userPhoto && (
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
          )}

          <div className="relative h-full flex flex-col justify-between p-4">
            {/* Nahoře: přidat fotku — VIDITELNÝ input stylovaný přes CSS */}
            {!userPhoto ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="relative rounded-full bg-white shadow-md border border-gray-200 w-14 h-14 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-primary pointer-events-none" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="absolute inset-0 w-full h-full cursor-pointer"
                    style={{ opacity: 0.01 }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {/* Dole: Pumplo + gym + statistiky + název */}
            <div>
              <div className="flex justify-end mb-1.5">
                <div className="flex flex-col gap-1 items-end">
                  <div className={`rounded-lg px-2.5 py-1 ${pillBg}`}>
                    <span style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '-0.3px', color: '#4CC9FF' }}>
                      Pumplo
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 rounded-lg px-2.5 py-1 ${pillBg}`}>
                    <MapPin className={`w-3 h-3 ${userPhoto ? 'text-white/70' : 'text-gray-400'}`} />
                    <span className={`text-[11px] font-medium ${textMain}`}>{gymName}</span>
                  </div>
                  {stats.map((s, i) => (
                    <div key={i} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 ${pillBg}`}>
                      <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                      <span className={`text-xs font-bold ${textMain}`}>{s.value}</span>
                      {s.unit && <span className={`text-[10px] ${textSub}`}>{s.unit}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rounded-xl px-3 py-2 ${pillBg}`}>
                <div className="flex items-end justify-between">
                  <div>
                    <p className={`text-sm font-bold ${textMain}`}>{displayTitle}</p>
                    <p className={`text-[10px] ${textSub}`}>{dateStr}</p>
                  </div>
                  <p className={`text-[9px] ${userPhoto ? 'text-white/40' : 'text-gray-300'}`}>
                    {exerciseCount} cviků &middot; {totalReps} opak.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spodní akce */}
      <div className="px-4 pt-1 pb-4 space-y-2 shrink-0">
        {userPhoto && (
          <div className="relative flex items-center justify-center gap-2 w-full h-9 rounded-md border border-input bg-background text-sm font-medium cursor-pointer hover:bg-accent overflow-hidden">
            <Camera className="w-4 h-4 pointer-events-none" />
            <span className="pointer-events-none">Změnit fotku</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="absolute inset-0 opacity-[0.01] cursor-pointer"
              style={{ fontSize: '200px' }}
            />
          </div>
        )}

        <Button
          size="lg"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center justify-center gap-2"
          onClick={handleShare}
          disabled={isGenerating || !imageReady}
        >
          <Share2 className="w-5 h-5" />
          {isGenerating ? 'Připravuji...' : imageReady ? 'Sdílet trénink' : 'Připravuji obrázek...'}
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="w-full font-semibold"
          onClick={onFinish}
          disabled={isSaving || isGenerating}
        >
          {isSaving ? 'Ukládám...' : 'Dokončit trénink'}
        </Button>
      </div>
    </motion.div>
  );
};
