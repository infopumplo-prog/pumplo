import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, ArrowLeft, Clock, Dumbbell, Weight, Flame, MapPin, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface TemplateProps {
  userPhoto: string | null;
  displayTitle: string;
  gymName: string;
  dateStr: string;
  exerciseCount: number;
  totalReps: number;
  stats: { icon: any; color: string; value: string; unit: string }[];
  onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// --- TEMPLATE 1: Dark Blur (default) ---
const TemplateDarkBlur = ({ userPhoto, displayTitle, gymName, dateStr, exerciseCount, totalReps, stats, onPhotoSelect }: TemplateProps) => (
  <>
    {userPhoto ? (
      <img src={userPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
    ) : (
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }} />
    )}
    <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />
    <div className="relative h-full flex flex-col items-center justify-center px-6">
      {!userPhoto && <PhotoButton onPhotoSelect={onPhotoSelect} />}
      <StatsBlock variant="blur" displayTitle={displayTitle} gymName={gymName} dateStr={dateStr} exerciseCount={exerciseCount} totalReps={totalReps} stats={stats} />
    </div>
  </>
);

// --- TEMPLATE 2: Gradient Bold ---
const TemplateGradientBold = ({ userPhoto, displayTitle, gymName, dateStr, exerciseCount, totalReps, stats, onPhotoSelect }: TemplateProps) => (
  <>
    {userPhoto ? (
      <img src={userPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
    ) : (
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)' }} />
    )}
    <div className="absolute inset-0" style={{ background: userPhoto ? 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 40%, rgba(102,126,234,0.7) 100%)' : undefined }} />
    <div className="relative h-full flex flex-col items-center justify-center px-6">
      {!userPhoto && <PhotoButton onPhotoSelect={onPhotoSelect} />}
      <div className="w-full" style={{ maxWidth: '320px' }}>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {stats.map((s, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
              <s.icon className="w-5 h-5 shrink-0" style={{ color: '#fff' }} />
              <div>
                <span style={{ color: '#fff', fontSize: '24px', fontWeight: 800 }}>{s.value}</span>
                {s.unit && <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginLeft: '4px' }}>{s.unit}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl px-5 py-4" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
          <p style={{ color: '#fff', fontSize: '20px', fontWeight: 800 }}>{displayTitle}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.7)' }} />
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>{gymName}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{dateStr} &middot; {exerciseCount} cviku &middot; {totalReps} opak.</p>
            <span style={{ color: '#fff', fontSize: '16px', fontWeight: 800 }}>Pumplo</span>
          </div>
        </div>
      </div>
    </div>
  </>
);

// --- TEMPLATE 3: Minimal Clean ---
const TemplateMinimal = ({ userPhoto, displayTitle, gymName, dateStr, exerciseCount, totalReps, stats, onPhotoSelect }: TemplateProps) => (
  <>
    {userPhoto ? (
      <img src={userPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
    ) : (
      <div className="absolute inset-0" style={{ background: '#000' }} />
    )}
    <div className="absolute inset-0" style={{ background: userPhoto ? 'rgba(0,0,0,0.5)' : undefined }} />
    <div className="relative h-full flex flex-col items-center justify-center px-8">
      {!userPhoto && <PhotoButton onPhotoSelect={onPhotoSelect} />}
      <div className="w-full" style={{ maxWidth: '300px' }}>
        <p style={{ color: '#4CC9FF', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' as const, marginBottom: '8px' }}>Pumplo</p>
        <p style={{ color: '#fff', fontSize: '28px', fontWeight: 800, lineHeight: 1.1, marginBottom: '4px' }}>{displayTitle}</p>
        <div className="flex items-center gap-1.5 mb-6">
          <MapPin className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{gymName} &middot; {dateStr}</span>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '16px' }}>
          {stats.map((s, i) => (
            <div key={i} className="flex items-center justify-between" style={{ marginBottom: i < stats.length - 1 ? '12px' : 0 }}>
              <div className="flex items-center gap-2">
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>{s.unit || 'serie'}</span>
              </div>
              <span style={{ color: '#fff', fontSize: '24px', fontWeight: 700 }}>{s.value}</span>
            </div>
          ))}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', marginTop: '12px' }}>{exerciseCount} cviku &middot; {totalReps} opak.</p>
      </div>
    </div>
  </>
);

// --- TEMPLATE 4: Neon ---
const TemplateNeon = ({ userPhoto, displayTitle, gymName, dateStr, exerciseCount, totalReps, stats, onPhotoSelect }: TemplateProps) => (
  <>
    {userPhoto ? (
      <img src={userPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
    ) : (
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a2e 50%, #0a0a0a 100%)' }} />
    )}
    <div className="absolute inset-0" style={{ background: userPhoto ? 'rgba(0,0,0,0.6)' : undefined }} />
    <div className="relative h-full flex flex-col items-center justify-center px-6">
      {!userPhoto && <PhotoButton onPhotoSelect={onPhotoSelect} />}
      <div className="w-full" style={{ maxWidth: '320px' }}>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {stats.map((s, i) => (
            <div key={i} className="rounded-2xl px-4 py-3" style={{ border: `1px solid ${s.color}40`, background: `${s.color}10` }}>
              <s.icon className="w-4 h-4 mb-1" style={{ color: s.color }} />
              <span style={{ color: '#fff', fontSize: '26px', fontWeight: 800, display: 'block' }}>{s.value}</span>
              {s.unit && <span style={{ color: `${s.color}`, fontSize: '11px', fontWeight: 600 }}>{s.unit}</span>}
            </div>
          ))}
        </div>
        <div className="rounded-2xl px-5 py-4" style={{ border: '1px solid rgba(76,201,255,0.3)', background: 'rgba(76,201,255,0.05)' }}>
          <div className="flex items-start justify-between">
            <div>
              <p style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{displayTitle}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5" style={{ color: '#4CC9FF' }} />
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{gymName}</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '4px' }}>{dateStr} &middot; {exerciseCount} cviku &middot; {totalReps} opak.</p>
            </div>
            <span style={{ color: '#4CC9FF', fontSize: '18px', fontWeight: 800 }}>Pumplo</span>
          </div>
        </div>
      </div>
    </div>
  </>
);

// --- TEMPLATE 5: Big Number ---
const TemplateBigNumber = ({ userPhoto, displayTitle, gymName, dateStr, exerciseCount, totalReps, stats, onPhotoSelect }: TemplateProps) => (
  <>
    {userPhoto ? (
      <img src={userPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
    ) : (
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #0c0c0c 0%, #1c1c1c 100%)' }} />
    )}
    <div className="absolute inset-0" style={{ background: userPhoto ? 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.8) 100%)' : undefined }} />
    <div className="relative h-full flex flex-col items-center justify-center px-6">
      {!userPhoto && <PhotoButton onPhotoSelect={onPhotoSelect} />}
      <div className="w-full" style={{ maxWidth: '320px', textAlign: 'center' as const }}>
        <span style={{ color: '#4CC9FF', fontSize: '13px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' as const }}>Pumplo</span>
        <p style={{ color: '#fff', fontSize: '48px', fontWeight: 900, lineHeight: 1, margin: '8px 0' }}>
          {Math.round(parseInt(stats[1].value.replace(/\s/g, '')))} <span style={{ fontSize: '20px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>kg</span>
        </p>
        <div className="flex items-center justify-center gap-4 mb-6" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
          <span>{stats[0].value} min</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <span>{stats[2].value} serii</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <span>{stats[3].value} kcal</span>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
          <p style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>{displayTitle}</p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <MapPin className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{gymName} &middot; {dateStr}</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', marginTop: '4px' }}>{exerciseCount} cviku &middot; {totalReps} opak.</p>
        </div>
      </div>
    </div>
  </>
);

// --- Shared components ---
const PhotoButton = ({ onPhotoSelect }: { onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
  <div className="relative w-16 h-16 rounded-full flex items-center justify-center mb-10" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
    <Camera className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.8)' }} />
    <input type="file" accept="image/*" onChange={onPhotoSelect} className="absolute inset-0 w-full h-full cursor-pointer" style={{ opacity: 0.01 }} />
  </div>
);

const StatsBlock = ({ variant, displayTitle, gymName, dateStr, exerciseCount, totalReps, stats }: {
  variant: 'blur'; displayTitle: string; gymName: string; dateStr: string; exerciseCount: number; totalReps: number;
  stats: { icon: any; color: string; value: string; unit: string }[];
}) => (
  <div className="w-full" style={{ maxWidth: '320px' }}>
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
    <div className="rounded-2xl px-5 py-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-start justify-between">
        <div>
          <p style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{displayTitle}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{gymName}</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '4px' }}>{dateStr} &middot; {exerciseCount} cviku &middot; {totalReps} opak.</p>
        </div>
        <span style={{ color: '#4CC9FF', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>Pumplo</span>
      </div>
    </div>
  </div>
);

const TEMPLATES = [
  { name: 'Dark', component: TemplateDarkBlur },
  { name: 'Gradient', component: TemplateGradientBold },
  { name: 'Minimal', component: TemplateMinimal },
  { name: 'Neon', component: TemplateNeon },
  { name: 'Bold', component: TemplateBigNumber },
];

export const WorkoutShareCard = ({
  dayLetter, dayName, goalId, gymName, totalDuration, totalSets, totalWeight, totalReps,
  exerciseCount, isBonus, onClose, onFinish, isSaving,
}: WorkoutShareCardProps) => {
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const cachedBlobRef = useRef<Blob | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { profile } = useUserProfile();
  const [templateIndex, setTemplateIndex] = useState(0);

  // Drag + pinch state
  const [overlayPos, setOverlayPos] = useState({ x: 0, y: 0 });
  const [overlayScale, setOverlayScale] = useState(1);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; origScale: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { startDist: Math.sqrt(dx * dx + dy * dy), origScale: overlayScale };
      dragRef.current = null;
    } else if (e.touches.length === 1) {
      dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, origX: overlayPos.x, origY: overlayPos.y };
    }
  }, [overlayPos, overlayScale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setOverlayScale(Math.max(0.5, Math.min(2, pinchRef.current.origScale * (dist / pinchRef.current.startDist))));
    } else if (e.touches.length === 1 && dragRef.current) {
      setOverlayPos({ x: dragRef.current.origX + (e.touches[0].clientX - dragRef.current.startX), y: dragRef.current.origY + (e.touches[0].clientY - dragRef.current.startY) });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragRef.current = null; pinchRef.current = null;
    cachedBlobRef.current = null; setImageReady(false);
    setTimeout(async () => {
      setIsGenerating(true);
      const blob = await generateImage();
      cachedBlobRef.current = blob; setImageReady(!!blob); setIsGenerating(false);
    }, 300);
  }, []);

  const estimatedCalories = estimateCalories({
    durationSeconds: totalDuration * 60, totalSets, goalId,
    weightKg: profile?.weight_kg || 75, gender: profile?.gender, age: profile?.age,
  });

  const displayTitle = isBonus ? 'Bonusovy trenink' : dayName || `Den ${dayLetter.replace('_EXT', '+')}`;
  const today = new Date();
  const dateStr = format(today, 'd. MMMM yyyy', { locale: cs });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUserPhoto(event.target?.result as string);
      cachedBlobRef.current = null; setImageReady(false);
      setOverlayPos({ x: 0, y: 0 }); setOverlayScale(1);
    };
    reader.readAsDataURL(file); e.target.value = '';
  };

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 3, useCORS: true, allowTaint: true, backgroundColor: '#000', logging: false });
      return new Promise((resolve) => { canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0); });
    } catch { return null; }
  }, []);

  useEffect(() => {
    cachedBlobRef.current = null; setImageReady(false);
    const timer = setTimeout(async () => {
      setIsGenerating(true);
      const blob = await generateImage();
      cachedBlobRef.current = blob; setImageReady(!!blob); setIsGenerating(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [userPhoto, templateIndex, generateImage]);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => { const r = new FileReader(); r.onloadend = () => resolve((r.result as string).split(',')[1]); r.onerror = reject; r.readAsDataURL(blob); });

  const handleShare = useCallback(async () => {
    const blob = cachedBlobRef.current; if (!blob) return;
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
      try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Muj trenink na Pumplo', text: shareText }); return; } }
      catch (err) { if ((err as Error).name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }, [today, displayTitle, totalWeight, totalSets, totalDuration]);

  const stats = [
    { icon: Clock, color: '#22d3ee', value: `${totalDuration}`, unit: 'min' },
    { icon: Weight, color: '#34d399', value: `${Math.round(totalWeight).toLocaleString('cs')}`, unit: 'kg' },
    { icon: Dumbbell, color: '#fbbf24', value: `${totalSets}`, unit: 'serie' },
    { icon: Flame, color: '#fb923c', value: `${estimatedCalories}`, unit: 'kcal' },
  ];

  const TemplateComponent = TEMPLATES[templateIndex].component;
  const templateProps: TemplateProps = { userPhoto, displayTitle, gymName, dateStr, exerciseCount, totalReps, stats, onPhotoSelect: handlePhotoSelect };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: '#111', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}>

      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-3 pt-2 pb-1">
        <button type="button" onClick={onClose} className="p-2 rounded-full" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        {/* Template name */}
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 500 }}>{TEMPLATES[templateIndex].name}</span>
        <div className="w-9" />
      </div>

      {/* Card preview */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-3 py-1">
        <div ref={cardRef} className="relative overflow-hidden w-full" style={{ background: '#000', aspectRatio: '9/16', maxHeight: '100%' }}
          onTouchStart={userPhoto ? handleTouchStart : undefined}
          onTouchMove={userPhoto ? handleTouchMove : undefined}
          onTouchEnd={userPhoto ? handleTouchEnd : undefined}
        >
          <TemplateComponent {...templateProps} />
        </div>
      </div>

      {/* Template selector — swipeable dots */}
      <div className="shrink-0 flex items-center justify-center gap-3 py-2">
        <button type="button" onClick={() => setTemplateIndex(i => (i - 1 + TEMPLATES.length) % TEMPLATES.length)} style={{ color: 'rgba(255,255,255,0.5)' }}>
          <ChevronLeft className="w-5 h-5" />
        </button>
        {TEMPLATES.map((t, i) => (
          <button key={i} type="button" onClick={() => setTemplateIndex(i)}
            style={{ width: i === templateIndex ? '24px' : '8px', height: '8px', borderRadius: '4px', background: i === templateIndex ? '#4CC9FF' : 'rgba(255,255,255,0.3)', transition: 'all 0.2s' }}
          />
        ))}
        <button type="button" onClick={() => setTemplateIndex(i => (i + 1) % TEMPLATES.length)} style={{ color: 'rgba(255,255,255,0.5)' }}>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom actions */}
      <div className="shrink-0 px-4 pb-3 space-y-2">
        {userPhoto && (
          <div className="relative flex items-center justify-center gap-2 w-full rounded-xl overflow-hidden" style={{ height: '40px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)' }}>
            <Camera className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.8)' }} />
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontWeight: 500 }}>Zmenit fotku</span>
            <input type="file" accept="image/*" onChange={handlePhotoSelect} className="absolute inset-0 cursor-pointer" style={{ opacity: 0.01, fontSize: '200px' }} />
          </div>
        )}
        <button type="button" onClick={handleShare} disabled={isGenerating || !imageReady}
          className="w-full flex items-center justify-center gap-2 rounded-xl disabled:opacity-50"
          style={{ height: '44px', background: '#4CC9FF', color: '#fff', fontSize: '15px', fontWeight: 600 }}>
          <Share2 className="w-4 h-4" />
          {isGenerating ? 'Pripravuji...' : imageReady ? 'Sdilet trenink' : 'Pripravuji...'}
        </button>
        <button type="button" onClick={onFinish} disabled={isSaving || isGenerating}
          className="w-full flex items-center justify-center rounded-xl disabled:opacity-50"
          style={{ height: '44px', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '15px', fontWeight: 600, background: 'transparent' }}>
          {isSaving ? 'Ukladam...' : 'Dokoncit trenink'}
        </button>
      </div>
    </motion.div>
  );
};
