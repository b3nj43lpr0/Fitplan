// FitPlan · Registro de actividad (pestaña Actividad de Entrenar)
'use strict';

// ---------- Cronómetro de cardio ----------
// Se guarda en este dispositivo para que siga corriendo aunque cambies de pantalla o cierres la app
const CARDIO_KEY = 'fitplan-cardio';
const CARDIO_ACTS = ['caminarrapido', 'trotar', 'correr', 'bici', 'biciestatica', 'spinning', 'eliptica', 'remo', 'natacion', 'trekking', 'cuerda', 'stepper'];
function cardioState() { try { return JSON.parse(localStorage.getItem(CARDIO_KEY)) || null; } catch (e) { return null; } }
function storeCardio(c) { try { c ? localStorage.setItem(CARDIO_KEY, JSON.stringify(c)) : localStorage.removeItem(CARDIO_KEY); } catch (e) { /* ignorar */ } }
const cardioMs = c => c.acc + (c.running ? Date.now() - c.start : 0);
const fmtClock = ms => { const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sec = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0'); };
const fmtPace = minPerKm => { const m = Math.floor(minPerKm), sec = Math.round((minPerKm - m) * 60); return `${m}:${String(sec === 60 ? 59 : sec).padStart(2, '0')}`; };
// Mantiene la pantalla encendida mientras corre el cronómetro (si el teléfono lo permite)
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* sin permiso */ }
}
document.addEventListener('visibilitychange', () => { const c = cardioState(); if (document.visibilityState === 'visible' && c && c.running) keepAwake(true); });
function cardioCard() {
  const c = cardioState();
  const act = ACTIVITIES.find(a => a.id === (c ? c.act : ui.cardioAct || 'trotar')) || ACTIVITIES[0];
  if (!c) return `<div class="card cardio">
    <h2>⏱️ Cronómetro de cardio</h2>
    <div class="chips scroll-x">${CARDIO_ACTS.map(id => ACTIVITIES.find(a => a.id === id)).filter(Boolean).map(a => `<button class="chip ${a.id === act.id ? 'active' : ''}" data-cardio-act="${a.id}">${ACT_ICO[a.id] || '🏅'} ${esc(a.name)}</button>`).join('')}</div>
    <button class="btn burn" id="cdStart" style="width:100%">▶ Iniciar ${esc(act.name.toLowerCase())}</button>
  </div>`;
  const ms = cardioMs(c);
  return `<div class="card cardio on">
    <div class="row"><h2>${ACT_ICO[act.id] || '🏅'} ${esc(act.name)}</h2><span class="muted small">${c.running ? 'en curso' : 'en pausa'}</span></div>
    <div class="cd-clock" id="cdT">${fmtClock(ms)}</div>
    <div class="cd-kcal">🔥 <b id="cdK">${r0(burnedKcal(act.met, ms / 60000))}</b> kcal</div>
    <div class="btn-row two">
      ${c.running ? '<button class="btn ghost" id="cdPause">⏸ Pausa</button>' : '<button class="btn ghost" id="cdResume">▶ Seguir</button>'}
      <button class="btn burn" id="cdStop">⏹ Terminar</button>
    </div>
    ${c.running ? '' : '<button class="see" id="cdDiscard" style="color:var(--danger);margin-top:8px">Descartar</button>'}
  </div>`;
}
setInterval(() => {
  const c = cardioState(), t = document.getElementById('cdT');
  if (!c || !c.running || !t) return;
  const ms = cardioMs(c), a = ACTIVITIES.find(x => x.id === c.act);
  t.textContent = fmtClock(ms);
  const k = document.getElementById('cdK'); if (k && a) k.textContent = r0(burnedKcal(a.met, ms / 60000));
}, 1000);
function bindCardio() {
  $$('[data-cardio-act]').forEach(b => b.addEventListener('click', () => { ui.cardioAct = b.dataset.cardioAct; render(); }));
  const st = $('#cdStart');
  if (st) st.addEventListener('click', () => { storeCardio({ act: ui.cardioAct || 'trotar', start: Date.now(), acc: 0, running: true }); keepAwake(true); tap(); render(); });
  const pa = $('#cdPause');
  if (pa) pa.addEventListener('click', () => { const c = cardioState(); storeCardio({ ...c, acc: cardioMs(c), running: false }); keepAwake(false); render(); });
  const re = $('#cdResume');
  if (re) re.addEventListener('click', () => { const c = cardioState(); storeCardio({ ...c, start: Date.now(), running: true }); keepAwake(true); render(); });
  const di = $('#cdDiscard');
  if (di) di.addEventListener('click', () => { if (confirm('¿Descartar esta sesión?')) { storeCardio(null); render(); } });
  const sp = $('#cdStop');
  if (sp) sp.addEventListener('click', () => {
    const c = cardioState(), ms = cardioMs(c), a = ACTIVITIES.find(x => x.id === c.act);
    storeCardio({ ...c, acc: ms, running: false }); keepAwake(false);
    const min = ms / 60000;
    openModal(`<h2>${ACT_ICO[a.id] || '🏅'} ${esc(a.name)}</h2>
      <div class="minis" style="grid-template-columns:1fr 1fr"><div class="mini"><b>${fmtClock(ms)}</b><span>tiempo</span></div><div class="mini"><b>${r0(burnedKcal(a.met, min))}</b><span>kcal</span></div></div>
      <div class="field"><label for="cdKm">Distancia en km (opcional)</label><input id="cdKm" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Ej: 5,2"></div>
      <div class="result-box" id="cdPace" hidden></div>
      <button class="btn burn" id="cdSave" style="width:100%">Guardar en el día</button>`, m => {
      const km = () => Number(String(m.querySelector('#cdKm').value).replace(',', '.')) || 0;
      m.querySelector('#cdKm').addEventListener('input', () => {
        const box = m.querySelector('#cdPace'), d = km();
        box.hidden = !d;
        if (d) box.innerHTML = `Ritmo <b>${fmtPace(min / d)} min/km</b> · velocidad <b>${r1(d / (min / 60)).toLocaleString('es')} km/h</b>`;
      });
      m.querySelector('#cdSave').addEventListener('click', () => {
        if (min < 1) return toast('La sesión duró menos de un minuto');
        const d = km();
        day(todayKey()).exercises.push({ id: uid(), name: a.name + (d ? ` · ${d.toLocaleString('es')} km · ${fmtPace(min / d)} min/km` : ''), minutes: Math.round(min), kcal: burnedKcal(a.met, min), km: d || undefined });
        storeCardio(null); save(); closeModal(); render(); confetti(30);
        toast(`✓ ${a.name}: ${Math.round(min)} min · ${r0(burnedKcal(a.met, min))} kcal`);
      });
    });
  });
}

// ---------- Vista: Ejercicio ----------
function viewEjercicio() {
  const d = peekDay(currentDate);
  const t = totals(d);
  return `
    ${dateBar()}
    ${cardioCard()}
    <div class="grid g2">
      <div class="card">
        <h2>Agregar actividad</h2>
        <input type="hidden" id="act" value="${ACTIVITIES[0].id}">
        <div class="act-grid" role="radiogroup" aria-label="Actividad">${ACTIVITIES.map((a, i) => `<button class="act ${i === 0 ? 'sel' : ''}" data-act="${a.id}" role="radio" aria-checked="${i === 0}"><span class="ae">${ACT_ICO[a.id] || '🏅'}</span>${esc(a.name)}</button>`).join('')}</div>
        <label for="mins">Duración (minutos)</label>
        <div class="chips">${[15, 30, 45, 60, 90].map(m => `<button class="chip ${m === 30 ? 'active' : ''}" data-min="${m}">${m} min</button>`).join('')}</div>
        <div class="field"><input id="mins" type="number" min="1" value="30" inputmode="numeric" aria-label="Minutos"></div>
        <div class="result-box" id="burnPrev"></div>
        <button class="btn burn" id="addEx" style="width:100%">Registrar</button>
        <hr class="sep">
        <h3>¿Tu reloj ya te dio las calorías?</h3>
        <div class="grid g2" style="gap:8px">
          <div class="field"><label for="mxName">Actividad</label><input id="mxName" placeholder="Ej: Clase de spinning"></div>
          <div class="field"><label for="mxKcal">kcal quemadas</label><input id="mxKcal" type="number" min="0"></div>
        </div>
        <button class="btn ghost" id="mxAdd">Agregar</button>
      </div>
      <div class="card">
        <div class="row"><h2>Actividad del día</h2><b style="color:var(--burn)">${r0(t.burned)} kcal</b></div>
        <div class="list">${d.exercises.length ? d.exercises.map(e => `
          <div class="item">
            <div class="info"><div class="name">${esc(e.name)}</div><div class="muted small">${e.minutes ? e.minutes + ' min' : 'manual'}</div></div>
            <span class="kcal" style="color:var(--burn)">−${r0(e.kcal)}</span>
            <button class="icon-btn" data-del-ex="${e.id}" aria-label="Eliminar">✕</button>
          </div>`).join('') : '<div class="empty">Nada registrado todavía.</div>'}</div>
        <p class="muted small">Las calorías del ejercicio se suman a tu presupuesto del día: si quemas 300 kcal, puedes comer 300 kcal más y mantener tu objetivo. Calculado con tu peso (${r1(currentWeight())} kg).</p>
      </div>
    </div>`;
}
bind.ejercicio = () => {
  bindDateBar();
  bindCardio();
  const upd = () => {
    const a = ACTIVITIES.find(x => x.id === $('#act').value);
    const m = Number($('#mins').value) || 0;
    $('#burnPrev').innerHTML = `<b style="font-size:22px;color:var(--burn)">🔥 ${r0(burnedKcal(a.met, m))} kcal</b> <span class="muted small">${esc(a.name)} · ${m} min</span>`;
  };
  $$('[data-act]').forEach(b => b.addEventListener('click', () => {
    $('#act').value = b.dataset.act;
    $$('[data-act]').forEach(x => { x.classList.toggle('sel', x === b); x.setAttribute('aria-checked', x === b); });
    upd();
  }));
  $$('[data-min]').forEach(b => b.addEventListener('click', () => {
    $('#mins').value = b.dataset.min;
    $$('[data-min]').forEach(x => x.classList.toggle('active', x === b));
    upd();
  }));
  $('#mins').addEventListener('input', () => { $$('[data-min]').forEach(x => x.classList.toggle('active', x.dataset.min === $('#mins').value)); upd(); });
  upd();
  $('#addEx').addEventListener('click', () => {
    const a = ACTIVITIES.find(x => x.id === $('#act').value);
    const m = Number($('#mins').value);
    if (!(m > 0)) return toast('Ingresa los minutos');
    day().exercises.push({ id: uid(), name: a.name, minutes: m, kcal: burnedKcal(a.met, m) });
    save(); toast('Ejercicio registrado 💪'); render();
  });
  $('#mxAdd').addEventListener('click', () => {
    const k = Number($('#mxKcal').value);
    if (!(k > 0)) return toast('Ingresa las calorías');
    day().exercises.push({ id: uid(), name: $('#mxName').value.trim() || 'Actividad', minutes: 0, kcal: k });
    save(); toast('Ejercicio registrado 💪'); render();
  });
  $$('[data-del-ex]').forEach(b => b.addEventListener('click', () => {
    removeWithUndo(day().exercises, e => e.id === b.dataset.delEx, 'Actividad eliminada');
  }));
};
