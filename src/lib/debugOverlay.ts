// TEMP visual debug overlay — paints messages into a fixed DOM element so they
// show on the phone regardless of alert()/console support. Remove once done.
export const dbg = (msg: string) => {
  try {
    let el = document.getElementById('push-debug');
    if (!el) {
      el = document.createElement('div');
      el.id = 'push-debug';
      el.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:rgba(200,0,0,0.95);' +
        'color:#fff;font:12px/1.4 monospace;padding:10px 10px calc(10px + env(safe-area-inset-top));' +
        'white-space:pre-wrap;max-height:60vh;overflow:auto';
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent += msg + '\n';
  } catch { /* noop */ }
};
