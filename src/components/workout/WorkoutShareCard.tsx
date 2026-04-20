import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, X, Clock, Dumbbell, Weight, Flame, MapPin, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useUserProfile } from '@/hooks/useUserProfile';
import { estimateCalories } from '@/lib/calorieEstimation';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

interface ExerciseDetail { name: string; sets: { weight: number; reps: number }[]; isCardio?: boolean }

interface WorkoutShareCardProps {
  dayLetter: string; dayName?: string; goalId: string; gymName: string; gymInstagram?: string | null;
  totalDuration: number; totalSets: number; totalWeight: number; totalReps: number;
  exerciseCount: number; exerciseDetails?: ExerciseDetail[];
  isBonus?: boolean; onClose: () => void; onFinish: () => void; isSaving?: boolean;
}

interface Stat { icon: any; color: string; value: string; unit: string }

// ===== TEMPLATES =====

// 1. Dark Blur
const T_DarkBlur = ({ photo, title, gym, gymIg, date, exCount, reps, stats, transform }: TProps) => (
  <>
    <BG photo={photo} gradient="linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" />
    <Overlay photo={photo} />
    <Center>
      <Draggable transform={transform}>
        <Grid2x2 stats={stats} bg="rgba(0,0,0,0.5)" />
        <TitleBar title={title} gym={gym} gymIg={gymIg} date={date} exCount={exCount} reps={reps} bg="rgba(0,0,0,0.5)" />
      </Draggable>
    </Center>
  </>
);

// 2. Minimal Clean
const T_Minimal = ({ photo, title, gym, gymIg, date, exCount, reps, stats, transform }: TProps) => (
  <>
    <BG photo={photo} gradient="#000" />
    {photo && <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />}
    <Center>
      <Draggable transform={transform}>
        <div style={{ maxWidth: '300px', width: '100%' }}>
          <p style={{ color: '#4CC9FF', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Pumplo</p>
          <p style={{ color: '#fff', fontSize: '28px', fontWeight: 800, lineHeight: 1.1, marginBottom: '4px' }}>{title}</p>
          <div className="flex items-center gap-1.5 mb-6">
            <MapPin className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{gym}{gymIg ? ` @${gymIg}` : ''} &middot; {date}</span>
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
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', marginTop: '12px' }}>{exCount} cviku &middot; {reps} opak.</p>
        </div>
      </Draggable>
    </Center>
  </>
);

// 3. Bold Big Number
const T_Bold = ({ photo, title, gym, gymIg, date, exCount, reps, stats, transform }: TProps) => (
  <>
    <BG photo={photo} gradient="linear-gradient(135deg, #0c0c0c 0%, #1c1c1c 100%)" />
    {photo && <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.8) 100%)' }} />}
    <Center>
      <Draggable transform={transform}>
        <div style={{ maxWidth: '320px', width: '100%', textAlign: 'center' }}>
          <span style={{ color: '#4CC9FF', fontSize: '13px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' }}>Pumplo</span>
          <p style={{ color: '#fff', fontSize: '48px', fontWeight: 900, lineHeight: 1, margin: '8px 0' }}>
            {stats[1].value} <span style={{ fontSize: '20px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>kg</span>
          </p>
          <div className="flex items-center justify-center gap-4 mb-6" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
            <span>{stats[0].value} min</span><span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
            <span>{stats[2].value} serii</span><span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
            <span>{stats[3].value} kcal</span>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
            <p style={{ color: '#fff', fontSize: '16px', fontWeight: 700 }}>{title}</p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <MapPin className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{gym}{gymIg ? ` @${gymIg}` : ''} &middot; {date}</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', marginTop: '4px' }}>{exCount} cviku &middot; {reps} opak.</p>
          </div>
        </div>
      </Draggable>
    </Center>
  </>
);

// 4. Exercise List
const T_ExerciseList = ({ photo, title, gym, gymIg, date, exercises, transform }: TProps & { exercises: ExerciseDetail[] }) => (
  <>
    <BG photo={photo} gradient="linear-gradient(135deg, #0d1117 0%, #161b22 100%)" />
    {photo && <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />}
    <Center>
      <Draggable transform={transform}>
        <div style={{ maxWidth: '320px', width: '100%' }}>
          <div className="flex items-center justify-between mb-3">
            <p style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{title}</p>
            <span style={{ color: '#4CC9FF', fontSize: '14px', fontWeight: 800 }}>Pumplo</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {exercises.slice(0, 6).map((ex, i) => {
              const maxW = Math.max(...ex.sets.map(s => s.weight), 0);
              const totalR = ex.sets.reduce((s, set) => s + set.reps, 0);
              const fmtCardio = (sec: number) => { const m = Math.floor(sec / 60); const s = sec % 60; return s > 0 ? `${m}min ${s}s` : `${m} min`; };
              return (
                <div key={i} className="rounded-xl px-4 py-2.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{ex.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{ex.sets.length}x</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {ex.isCardio ? (
                      <span style={{ color: '#22d3ee', fontSize: '12px' }}>{fmtCardio(ex.sets[0]?.reps || 0)}</span>
                    ) : (
                      <>
                        {maxW > 0 && <span style={{ color: '#34d399', fontSize: '12px' }}>{maxW} kg</span>}
                        <span style={{ color: '#fbbf24', fontSize: '12px' }}>{totalR} opak.</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <MapPin className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{gym}{gymIg ? ` @${gymIg}` : ''} &middot; {date}</span>
          </div>
        </div>
      </Draggable>
    </Center>
  </>
);

// 5. Single Exercise Spotlight
const T_SingleExercise = ({ photo, gym, gymIg, date, exercises, transform, selectedEx, onSelectEx }: TProps & { exercises: ExerciseDetail[]; selectedEx: number; onSelectEx: (i: number) => void }) => {
  const ex = exercises[selectedEx] || exercises[0];
  if (!ex) return <BG photo={photo} gradient="#000" />;
  const maxW = Math.max(...ex.sets.map(s => s.weight), 0);
  return (
    <>
      <BG photo={photo} gradient="linear-gradient(135deg, #1a0a2e 0%, #0a0a2e 100%)" />
      {photo && <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} />}
      <Center>
        <Draggable transform={transform}>
          <div style={{ maxWidth: '300px', width: '100%', textAlign: 'center' }}>
            <span style={{ color: '#4CC9FF', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>Pumplo</span>
            <p style={{ color: '#fff', fontSize: '22px', fontWeight: 800, margin: '6px 0 12px' }}>{ex.name}</p>
            {maxW > 0 && (
              <p style={{ color: '#fff', fontSize: '44px', fontWeight: 900, lineHeight: 1 }}>
                {maxW} <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)' }}>kg</span>
              </p>
            )}
            <div className="flex items-center justify-center gap-3 mt-2 mb-4" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
              {ex.sets.map((s, i) => (
                <span key={i} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px 10px', fontSize: '13px', color: '#fff' }}>
                  {s.weight > 0 ? `${s.weight}kg` : ''} x{s.reps}
                </span>
              ))}
            </div>
            {/* Exercise selector arrows */}
            <div className="flex items-center justify-center gap-4 mt-2">
              <button type="button" onClick={(e) => { e.stopPropagation(); onSelectEx((selectedEx - 1 + exercises.length) % exercises.length); }}
                style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', padding: '4px' }}><ChevronLeft className="w-5 h-5" /></button>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{selectedEx + 1}/{exercises.length}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onSelectEx((selectedEx + 1) % exercises.length); }}
                style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', padding: '4px' }}><ChevronRight className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <MapPin className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{gym}{gymIg ? ` @${gymIg}` : ''} &middot; {date}</span>
            </div>
          </div>
        </Draggable>
      </Center>
    </>
  );
};

// ===== SHARED PARTS =====
interface TProps { photo: string | null; title: string; gym: string; gymIg: string | null; date: string; exCount: number; reps: number; stats: Stat[]; transform: string }

const BG = ({ photo, gradient }: { photo: string | null; gradient: string }) => (
  <>
    {photo ? <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
      : <div className="absolute inset-0" style={{ background: gradient }} />}
  </>
);
const Overlay = ({ photo }: { photo: string | null }) => photo ? (
  <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />
) : null;
const Center = ({ children }: { children: React.ReactNode }) => (
  <div className="relative h-full flex flex-col items-center justify-center px-6">{children}</div>
);
const Draggable = ({ transform, children }: { transform: string; children: React.ReactNode }) => (
  <div style={{ transform, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>{children}</div>
);
const Grid2x2 = ({ stats, bg }: { stats: Stat[]; bg: string }) => (
  <div style={{ maxWidth: '320px', width: '100%' }}>
    <div className="grid grid-cols-2 gap-3 mb-3">
      {stats.map((s, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: bg, backdropFilter: 'blur(12px)' }}>
          <s.icon className="w-5 h-5 shrink-0" style={{ color: s.color }} />
          <div>
            <span style={{ color: '#fff', fontSize: '22px', fontWeight: 700 }}>{s.value}</span>
            {s.unit && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginLeft: '4px' }}>{s.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  </div>
);
const TitleBar = ({ title, gym, gymIg, date, exCount, reps, bg }: { title: string; gym: string; gymIg: string | null; date: string; exCount: number; reps: number; bg: string }) => (
  <div className="rounded-2xl px-5 py-4" style={{ background: bg, backdropFilter: 'blur(12px)', maxWidth: '320px', width: '100%' }}>
    <div className="flex items-start justify-between">
      <div>
        <p style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <MapPin className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{gym}</span>
          {gymIg && <span style={{ color: '#4CC9FF', fontSize: '12px', fontWeight: 600 }}>@{gymIg}</span>}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '4px' }}>{date} &middot; {exCount} cviku &middot; {reps} opak.</p>
      </div>
      <span style={{ color: '#4CC9FF', fontSize: '18px', fontWeight: 800 }}>Pumplo</span>
    </div>
  </div>
);

const TEMPLATE_NAMES = ['Dark', 'Minimal', 'Bold', 'Cviky', 'Detail'];

// ===== MAIN COMPONENT =====
export const WorkoutShareCard = ({
  dayLetter, dayName, goalId, gymName, gymInstagram, totalDuration, totalSets, totalWeight, totalReps,
  exerciseCount, exerciseDetails = [], isBonus, onClose, onFinish, isSaving,
}: WorkoutShareCardProps) => {
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const cachedBlobRef = useRef<Blob | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { profile } = useUserProfile();
  const [templateIndex, setTemplateIndex] = useState(0);
  const [selectedEx, setSelectedEx] = useState(0);

  // Drag + pinch
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const pRef = useRef<{ sd: number; os: number } | null>(null);
  const touchOverlayRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const tapStartRef = useRef(0);

  const genImg = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    try {
      const c = await html2canvas(cardRef.current, { scale: 3, useCORS: true, allowTaint: true, backgroundColor: '#000', logging: false });
      return new Promise(r => c.toBlob(b => r(b), 'image/png', 1.0));
    } catch { return null; }
  }, []);

  // Native touch listeners with { passive: false } to actually prevent browser zoom/scroll
  const posRef = useRef(pos);
  const scaleRef = useRef(scale);
  posRef.current = pos;
  scaleRef.current = scale;

  useEffect(() => {
    const el = touchOverlayRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      e.preventDefault(); e.stopPropagation();
      movedRef.current = false;
      tapStartRef.current = Date.now();
      if (e.touches.length === 2) {
        movedRef.current = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        pRef.current = { sd: Math.sqrt(dx*dx+dy*dy), os: scaleRef.current }; dRef.current = null;
      } else if (e.touches.length === 1) {
        dRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, ox: posRef.current.x, oy: posRef.current.y };
      }
    };

    const onMove = (e: TouchEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.touches.length === 2 && pRef.current) {
        movedRef.current = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY;
        setScale(Math.max(0.4, Math.min(2.5, pRef.current.os * (Math.sqrt(dx*dx+dy*dy) / pRef.current.sd))));
      } else if (e.touches.length === 1 && dRef.current) {
        const dx = e.touches[0].clientX - dRef.current.sx;
        const dy = e.touches[0].clientY - dRef.current.sy;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) movedRef.current = true;
        setPos({ x: dRef.current.ox + dx, y: dRef.current.oy + dy });
      }
    };

    const onEnd = () => {
      const wasTap = !movedRef.current && (Date.now() - tapStartRef.current) < 300;
      dRef.current = null; pRef.current = null;

      if (wasTap) {
        // Tap = cycle to next template
        setTemplateIndex(i => (i + 1) % TEMPLATE_NAMES.length);
      }

      cachedBlobRef.current = null; setImageReady(false);
      setTimeout(async () => {
        setIsGenerating(true);
        const blob = await genImg();
        cachedBlobRef.current = blob; setImageReady(!!blob); setIsGenerating(false);
      }, 300);
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); };
  }, [userPhoto, genImg]);

  const kcal = estimateCalories({ durationSeconds: totalDuration * 60, totalSets, goalId, weightKg: profile?.weight_kg || 75, gender: profile?.gender, age: profile?.age });
  const title = isBonus ? 'Bonusovy trenink' : dayName || `Den ${dayLetter.replace('_EXT', '+')}`;
  const today = new Date();
  const dateStr = format(today, 'd. MMMM yyyy', { locale: cs });

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => { setUserPhoto(ev.target?.result as string); cachedBlobRef.current = null; setImageReady(false); setPos({x:0,y:0}); setScale(1); };
    r.readAsDataURL(f); e.target.value = '';
  };

  useEffect(() => {
    cachedBlobRef.current = null; setImageReady(false);
    const t = setTimeout(async () => { setIsGenerating(true); const b = await genImg(); cachedBlobRef.current = b; setImageReady(!!b); setIsGenerating(false); }, 600);
    return () => clearTimeout(t);
  }, [userPhoto, templateIndex, selectedEx, genImg]);

  const b2b = (blob: Blob): Promise<string> => new Promise((res, rej) => { const r = new FileReader(); r.onloadend = () => res((r.result as string).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });

  const handleShare = useCallback(async () => {
    const blob = cachedBlobRef.current; if (!blob) return;
    const fn = `pumplo-trenink-${format(today, 'yyyy-MM-dd')}.png`;
    const igTag = gymInstagram ? ` @${gymInstagram}` : '';
    const txt = `${title} dokoncen! ${Math.round(totalWeight)} kg | ${totalSets} serii | ${totalDuration} min${igTag}`;
    if (Capacitor.isNativePlatform()) {
      try { const b64 = await b2b(blob); const s = await Filesystem.writeFile({ path: fn, data: b64, directory: Directory.Cache }); await Share.share({ title: 'Muj trenink na Pumplo', text: txt, url: s.uri, dialogTitle: 'Sdilet trenink' }); return; }
      catch (e) { if ((e as Error).message?.includes('canceled')) return; }
    }
    const file = new File([blob], fn, { type: 'image/png' });
    if (navigator.share) { try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'Pumplo', text: txt }); return; } } catch (e) { if ((e as Error).name === 'AbortError') return; } }
    const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = fn; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
  }, [today, title, totalWeight, totalSets, totalDuration]);

  const stats: Stat[] = [
    { icon: Clock, color: '#22d3ee', value: `${totalDuration}`, unit: 'min' },
    { icon: Weight, color: '#34d399', value: `${Math.round(totalWeight).toLocaleString('cs')}`, unit: 'kg' },
    { icon: Dumbbell, color: '#fbbf24', value: `${totalSets}`, unit: 'serie' },
    { icon: Flame, color: '#fb923c', value: `${kcal}`, unit: 'kcal' },
  ];

  const tf = `translate(${pos.x}px, ${pos.y}px) scale(${scale})`;
  const tp: TProps = { photo: userPhoto, title, gym: gymName, gymIg: gymInstagram || null, date: dateStr, exCount: exerciseCount, reps: totalReps, stats, transform: tf };

  const renderTemplate = () => {
    switch (templateIndex) {
      case 0: return <T_DarkBlur {...tp} />;
      case 1: return <T_Minimal {...tp} />;
      case 2: return <T_Bold {...tp} />;
      case 3: return <T_ExerciseList {...tp} exercises={exerciseDetails} />;
      case 4: return <T_SingleExercise {...tp} exercises={exerciseDetails} selectedEx={selectedEx} onSelectEx={setSelectedEx} />;
      default: return <T_DarkBlur {...tp} />;
    }
  };

  // Camera button overlay (only without photo, not part of draggable)
  const cameraOverlay = !userPhoto && (
    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 15, pointerEvents: 'none' }}>
      <div className="relative w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', pointerEvents: 'auto', marginBottom: '180px' }}>
        <Camera className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.8)' }} />
        <input type="file" accept="image/*" onChange={handlePhoto} className="absolute inset-0 w-full h-full cursor-pointer" style={{ opacity: 0.01 }} />
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: '#111', width: '100%', height: '100%' }}>

      <div className="shrink-0 flex items-center px-3 pt-2 pb-1">
        <button type="button" onClick={onClose} className="p-2 rounded-full" style={{ color: 'rgba(255,255,255,0.7)' }}><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-3 py-1">
        <div ref={cardRef} className="relative overflow-hidden w-full"
          style={{ background: '#000', aspectRatio: '9/16', maxHeight: '100%' }}>
          {renderTemplate()}
          {cameraOverlay}
          {/* Transparent touch overlay — on top of everything, catches all gestures */}
          <div ref={touchOverlayRef} className="absolute inset-0" style={{ zIndex: 10, touchAction: 'none' }} />
        </div>
      </div>

      <div className="shrink-0 px-4 pb-3 space-y-1.5">
        {userPhoto && (
          <div className="relative flex items-center justify-center gap-2 w-full rounded-xl overflow-hidden" style={{ height: '38px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)' }}>
            <Camera className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.8)' }} />
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: 500 }}>Zmenit fotku</span>
            <input type="file" accept="image/*" onChange={handlePhoto} className="absolute inset-0 cursor-pointer" style={{ opacity: 0.01, fontSize: '200px' }} />
          </div>
        )}
        <button type="button" onClick={handleShare} disabled={isGenerating || !imageReady}
          className="w-full flex items-center justify-center gap-2 rounded-xl disabled:opacity-50"
          style={{ height: '44px', background: '#4CC9FF', color: '#fff', fontSize: '15px', fontWeight: 600, border: 'none' }}>
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
