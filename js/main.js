// FitPlan · Gestos e inicio de la app
'use strict';

// ---------- Gestos: deslizar para cambiar de día ----------
(function swipeDays() {
  let x0 = null, y0 = 0, t0 = 0;
  const main = $('#main');
  main.addEventListener('touchstart', e => {
    const dayView = view === 'hoy' || view === 'comidas' || (view === 'rutinas' && ui.rutTab === 'actividad');
    if (!dayView || $('.modal-back')) { x0 = null; return; }
    if (e.target.closest('input, select, textarea, .scroll-x, .chips, .list.scroll, .act-grid')) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
  }, { passive: true });
  main.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - t0 > 600) return;
    const next = shiftKey(currentDate, dx < 0 ? 1 : -1);
    if (next > todayKey()) return toast('No puedes ir al futuro 😉');
    currentDate = next;
    render();
    main.classList.remove('slide-l', 'slide-r'); void main.offsetWidth;
    main.classList.add(dx < 0 ? 'slide-l' : 'slide-r');
    setTimeout(() => main.classList.remove('slide-l', 'slide-r'), 400);
  }, { passive: true });
})();

// ---------- Inicio ----------
render();
animateEnter();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
