import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, ArrowLeft, Clock, Dumbbell, Weight, Flame, MapPin, Share2 } from 'lucide-react';
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

  // Drag + pinch state for stats overlay
  const [overlayPos, setOverlayPos] = useState({ x: 0, y: 0 });
  const [overlayScale, setOverlayScale] = useState(1);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; origScale: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { startDist: Math.sqrt(dx * dx + dy * dy), origScale: overlayScale };
      dragRef.current = null;
    } else if (e.touches.length === 1) {
      dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, origX: overlayPos.x, origY: overlayPos.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const newScale = Math.max(0.5, Math.min(2, pinchRef.current.origScale * (dist / pinchRef.current.startDist)));
      setOverlayScale(newScale);
    } else if (e.touches.length === 1 && dragRef.current) {
      const dx = e.touches[0].clientX - dragRef.current.startX;
      const dy = e.touches[0].clientY - dragRef.current.startY;
      setOverlayPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    }
  };

  const handleTouchEnd = () => {
    dragRef.current = null;
    pinchRef.current = null;
    // Regenerate share image after repositioning
    cachedBlobRef.current = null;
    setImageReady(false);
    setTimeout(async () => {
      setIsGenerating(true);
      const blob = await generateImage();
      cachedBlobRef.current = blob;
      setImageReady(!!blob);
      setIsGenerating(false);
    }, 300);
  };

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
      setOverlayPos({ x: 0, y: 0 });
      setOverlayScale(1);
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
        backgroundColor: '#111111',
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
        const saved = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        await Share.share({ title: 'Muj trenink na Pumplo', text: shareText, url: saved.uri, dialogTitle: 'Sdilet trenink' });
        return;
      } catch (err) { if ((err as Error).message?.includes('canceled')) return; }
    }
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.share) {
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Muj trenink na Pumplo', text: shareText });
          return;
        }
      } catch (err) { if ((err as Error).name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [today, displayTitle, totalWeight, totalSets, totalDuration]);

  const stats = [
    { icon: Clock, color: '#22d3ee', value: `${totalDuration}`, unit: 'min' },
    { icon: Weight, color: '#34d399', value: `${Math.round(totalWeight).toLocaleString('cs')}`, unit: 'kg' },
    { icon: Dumbbell, color: '#fbbf24', value: `${totalSets}`, unit: 'serie' },
    { icon: Flame, color: '#fb923c', value: `${estimatedCalories}`, unit: 'kcal' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#111' }}
    >
      {/* Top bar — outside the captured card */}
      <div className="shrink-0 flex items-center px-3 pt-2 pb-1">
        <button type="button" onClick={onClose} className="p-2 rounded-full" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Captured card — 9:16, limited height so buttons stay visible */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-3 py-1">
      <div
        ref={cardRef}
        className="relative overflow-hidden w-full"
        style={{ background: '#111', aspectRatio: '9/16', maxHeight: '100%' }}
      >
        {/* Background */}
        {userPhoto ? (
          <img src={userPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }} />
        )}
        {/* Overlay for readability */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />

        {/* Content */}
        <div className="relative h-full flex flex-col items-center justify-center px-6">
          {/* Camera button — only without photo */}
          {!userPhoto && (
            <div className="relative w-16 h-16 rounded-full flex items-center justify-center mb-10" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <Camera className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.8)' }} />
              <input type="file" accept="image/*" onChange={handlePhotoSelect} className="absolute inset-0 w-full h-full cursor-pointer" style={{ opacity: 0.01 }} />
            </div>
          )}

          {/* Stats overlay — draggable + pinch-to-zoom when photo exists */}
          <div
            className="w-full"
            style={{
              maxWidth: '320px',
              transform: userPhoto ? `translate(${overlayPos.x}px, ${overlayPos.y}px) scale(${overlayScale})` : undefined,
              touchAction: userPhoto ? 'none' : undefined,
              cursor: userPhoto ? 'grab' : undefined,
            }}
            onTouchStart={userPhoto ? handleTouchStart : undefined}
            onTouchMove={userPhoto ? handleTouchMove : undefined}
            onTouchEnd={userPhoto ? handleTouchEnd : undefined}
          >
            <div className="grid grid-cols-2 gap-3 mb-3">
              {stats.map((s, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
                  <s.icon className="w-5 h-5 shrink-0" style={{ color: s.color }} />
                  <div>
                    <span style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>{s.value}</span>
                    {s.unit && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginLeft: '4px' }}>{s.unit}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Title + branding */}
            <div className="rounded-2xl px-5 py-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{displayTitle}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{gymName}</span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '4px' }}>
                    {dateStr} &middot; {exerciseCount} cviku &middot; {totalReps} opak.
                  </p>
                </div>
                <span style={{ color: '#4CC9FF', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>
                  Pumplo
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Bottom actions — outside the captured card */}
      <div className="shrink-0 px-4 pt-2 pb-4 space-y-2" style={{ background: '#111' }}>
        {userPhoto && (
          <div className="relative flex items-center justify-center gap-2 w-full rounded-xl overflow-hidden" style={{ height: '44px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)' }}>
            <Camera className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.8)' }} />
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontWeight: 500 }}>Zmenit fotku</span>
            <input type="file" accept="image/*" onChange={handlePhotoSelect} className="absolute inset-0 cursor-pointer" style={{ opacity: 0.01, fontSize: '200px' }} />
          </div>
        )}

        <button
          type="button"
          onClick={handleShare}
          disabled={isGenerating || !imageReady}
          className="w-full flex items-center justify-center gap-2 rounded-xl disabled:opacity-50"
          style={{ height: '48px', background: '#4CC9FF', color: '#fff', fontSize: '16px', fontWeight: 600 }}
        >
          <Share2 className="w-5 h-5" />
          {isGenerating ? 'Pripravuji...' : imageReady ? 'Sdilet trenink' : 'Pripravuji obrazek...'}
        </button>

        <button
          type="button"
          onClick={onFinish}
          disabled={isSaving || isGenerating}
          className="w-full flex items-center justify-center rounded-xl disabled:opacity-50"
          style={{ height: '48px', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '16px', fontWeight: 600, background: 'transparent' }}
        >
          {isSaving ? 'Ukladam...' : 'Dokoncit trenink'}
        </button>
      </div>
    </motion.div>
  );
};
