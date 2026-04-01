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
    ? 'Bonusovy trenink'
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
        backgroundColor: '#000000',
        logging: false,
      });
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
      });
    } catch (err) {
      console.error('Error generating image:', err);
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
    const shareText = `${displayTitle} dokoncen! ${Math.round(totalWeight)} kg | ${totalSets} serii | ${totalDuration} min`;

    if (Capacitor.isNativePlatform()) {
      try {
        const base64 = await blobToBase64(blob);
        const saved = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: 'Muj trenink na Pumplo',
          text: shareText,
          url: saved.uri,
          dialogTitle: 'Sdilet trenink',
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
          await navigator.share({ files: [file], title: 'Muj trenink na Pumplo', text: shareText });
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
    { icon: Clock, color: '#22d3ee', value: `${totalDuration}`, unit: 'min' },
    { icon: Weight, color: '#34d399', value: `${Math.round(totalWeight).toLocaleString('cs')}`, unit: 'kg' },
    { icon: Dumbbell, color: '#fbbf24', value: `${totalSets}`, unit: '' },
    { icon: Flame, color: '#fb923c', value: `${estimatedCalories}`, unit: 'kcal' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center px-4 pt-3 pb-1 z-10 shrink-0 safe-top">
        <button type="button" onClick={onClose} className="p-2 rounded-full text-white/70 hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Card preview — fills available space, 9:16 */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div
          ref={cardRef}
          className="relative overflow-hidden bg-black"
          style={{ width: '100%', maxWidth: '420px', aspectRatio: '9/16' }}
        >
          {/* Background */}
          {userPhoto ? (
            <img src={userPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

          {/* Content — vertically CENTERED so it works for Story, Post (1:1 crop), and Reels */}
          <div className="relative h-full flex flex-col items-center justify-center px-6">
            {/* Camera button — only without photo, above stats */}
            {!userPhoto && (
              <div className="relative rounded-full bg-white/10 backdrop-blur-md border border-white/20 w-16 h-16 flex items-center justify-center mb-8">
                <Camera className="w-7 h-7 text-white/80 pointer-events-none" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="absolute inset-0 w-full h-full cursor-pointer"
                  style={{ opacity: 0.01 }}
                />
              </div>
            )}

            {/* Stats block — centered, always visible even in 1:1 crop */}
            <div className="w-full max-w-xs">
              {/* 2x2 grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                {stats.map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-black/50 backdrop-blur-md rounded-2xl px-4 py-3">
                    <s.icon className="w-5 h-5 shrink-0" style={{ color: s.color }} />
                    <div className="flex items-baseline gap-1">
                      <span className="text-white text-xl font-bold">{s.value}</span>
                      {s.unit && <span className="text-white/50 text-sm">{s.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Title + branding */}
              <div className="bg-black/50 backdrop-blur-md rounded-2xl px-5 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-white text-lg font-bold leading-tight">{displayTitle}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-white/50" />
                      <span className="text-white/70 text-sm">{gymName}</span>
                    </div>
                    <p className="text-white/40 text-xs mt-1">{dateStr} &middot; {exerciseCount} cviku &middot; {totalReps} opak.</p>
                  </div>
                  <span className="text-lg font-extrabold tracking-tight shrink-0 ml-3" style={{ color: '#4CC9FF' }}>
                    Pumplo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-4 pt-2 pb-4 space-y-2 shrink-0 safe-bottom">
        {userPhoto && (
          <div className="relative flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-white/20 bg-white/5 text-sm font-medium text-white/80 cursor-pointer hover:bg-white/10 overflow-hidden">
            <Camera className="w-4 h-4 pointer-events-none" />
            <span className="pointer-events-none">Zmenit fotku</span>
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
          type="button"
          size="lg"
          className="w-full h-12 bg-[#4CC9FF] hover:bg-[#3bb8ee] text-white font-semibold text-base flex items-center justify-center gap-2 rounded-xl"
          onClick={handleShare}
          disabled={isGenerating || !imageReady}
        >
          <Share2 className="w-5 h-5" />
          {isGenerating ? 'Pripravuji...' : imageReady ? 'Sdilet trenink' : 'Pripravuji obrazek...'}
        </Button>

        <Button
          type="button"
          size="lg"
          variant="outline"
          className="w-full h-12 font-semibold text-base border-white/20 text-white hover:bg-white/10 rounded-xl"
          onClick={onFinish}
          disabled={isSaving || isGenerating}
        >
          {isSaving ? 'Ukladam...' : 'Dokoncit trenink'}
        </Button>
      </div>
    </motion.div>
  );
};
