// Videa cviků musí hrát pořád dokola (David 17. 10.: „nesmí se stát, že se sama zastaví
// nebo nespustí“). iOS v úsporném režimu nebo před prvním dotykem automatické spuštění
// zablokuje a ukáže vlastní tlačítko play, které přes pointer-events:none nejde stisknout.
//
// Video, které má hrát, nese data-keep-playing="true" (komponenta ho vypne při pauze nebo
// odpočinku). Tady jednou pro celou appku:
//  - každý dotyk/klik kdekoli spustí stojící „keep-playing“ videa (gesto iOS povolí),
//  - když se takové video samo zastaví, zasekne nebo skončí, rozjede se znovu.

const SELECTOR = 'video[data-keep-playing="true"]';

const play = (v: HTMLVideoElement) => {
  if (!v.paused && !v.ended) return;
  v.muted = true;
  const p = v.play();
  if (p) p.catch(() => {});
};

let installed = false;

export function installVideoKeepPlaying(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  const kickAll = () => document.querySelectorAll<HTMLVideoElement>(SELECTOR).forEach(play);
  document.addEventListener('touchstart', kickAll, { capture: true, passive: true });
  document.addEventListener('click', kickAll, { capture: true });

  // Mediální události nebublají, ale capture na dokumentu je zachytí.
  const revive = (e: Event) => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || v.dataset.keepPlaying !== 'true') return;
    window.setTimeout(() => { if (v.isConnected && v.dataset.keepPlaying === 'true') play(v); }, 250);
  };
  for (const type of ['pause', 'stalled', 'suspend', 'ended']) {
    document.addEventListener(type, revive, true);
  }
}
