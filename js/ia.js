// FitPlan · Funciones con IA: foto del plato, registrar comida o ejercicio escribiendo, armar una comida y revisión semanal
'use strict';

const aiReady = () => { const S = window.FitSync && window.FitSync.state; return !!(S && S.enabled && S.user && window.FitSync.ask); };
const AI_LOGIN = '<div class="hint-box">🔐 Para usar la IA, inicia sesión con Google en <b>Perfil → Sincronización</b>. Es gratis.</div><button class="btn" data-go-login style="width:100%">Ir a Perfil</button>';
function bindLogin(m) { const b = m.querySelector('[data-go-login]'); if (b) b.addEventListener('click', () => { closeModal(); go('perfil'); }); }

// Pide a la IA una respuesta en JSON y la convierte en objeto
async function aiJSON(prompt, { system, image, maxTokens = 2048 } = {}) {
  const txt = await window.FitSync.ask({ message: prompt, system, image, json: true, maxTokens });
  const s = String(txt).replace(/^```(?:json)?|```$/gm, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  try { return JSON.parse(a >= 0 ? s.slice(a, b + 1) : s); } catch (e) { throw Object.assign(new Error('La IA respondió algo que no pude leer'), { code: 'parse' }); }
}
const num = (v, max = 5000) => { const n = Number(String(v ?? '').replace(',', '.')); return isFinite(n) && n > 0 ? Math.min(n, max) : 0; };
function aiFail(e) {
  console.warn('IA:', e);
  return `<div class="hint-box">⚠️ ${esc(coachErrorText(e).replace(/ ?(Mientras|Te dejo).*$/, ''))}${e && e.code !== 'auth' ? `<br><span class="muted small">Detalle técnico: ${esc(String(e.message || e).slice(0, 200))}</span>` : ''}</div>`;
}
const spinner = txt => `<div class="ai-wait"><span class="msg model typing"><span></span><span></span><span></span></span><span class="muted small">${esc(txt)}</span></div>`;

// ---------- Comida: lista editable de alimentos estimados por la IA ----------
// Si el nombre coincide exacto con un alimento de la base, se usan sus valores (más confiables)
function aiFoodEntry(it) {
  const grams = num(it.grams, 3000);
  const n = norm(it.name || '').trim();
  const f = n && allFoods().find(x => norm(x.name) === n || x.name.split('/').some(v => norm(v.replace(/\(.*?\)/g, '')).trim() === n));
  if (f && grams) return { foodId: f.id, name: f.name, grams, ...nutrition(f, grams) };
  return { name: String(it.name || 'Alimento').slice(0, 80), grams, kcal: num(it.kcal), p: num(it.p, 500), c: num(it.c, 800), g: num(it.g, 500) };
}
const FOOD_SYSTEM = `Eres un nutricionista experto en comida chilena y latinoamericana. Estimas porciones y nutrientes de forma realista.
Responde SOLO con JSON con esta forma:
{"items":[{"name":"Marraqueta","grams":100,"kcal":270,"p":8.5,"c":56,"g":1.5}],"meal":"desayuno|almuerzo|cena|snack|null","note":"comentario breve en español de Chile o vacío"}
- Un item por alimento o bebida. kcal, p (proteína), c (carbohidratos) y g (grasas) son para la cantidad indicada en grams, NO por 100 g.
- Usa nombres comunes en Chile (palta, marraqueta, porotos, quesillo, completo, once).
- Si no dicen la cantidad, usa una porción típica. Si algo es dudoso, dilo en note.
- meal: la comida del día si la mencionan; si no, null.`;
function openAIFood(mode = 'texto') {
  if (!aiReady()) return openModal(`<h2>${mode === 'foto' ? '📸 Foto del plato' : '💬 Cuéntame qué comiste'}</h2>${AI_LOGIN}`, bindLogin);
  const speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  openModal(`<h2>${mode === 'foto' ? '📸 Foto del plato' : '💬 Cuéntame qué comiste'}</h2>
    <p class="muted small" style="margin-top:-6px">${mode === 'foto' ? 'Saca una foto a tu comida y la IA estima qué es y cuánto tiene. Siempre puedes corregirlo antes de guardar.' : 'Escribe o dicta como hablas: "almorcé arroz con pollo, una ensalada y una Coca-Cola Zero".'}</p>
    ${mode === 'foto' ? `<label class="btn ghost label-btn" style="width:100%">📷 Sacar o elegir foto<input type="file" id="afPhoto" accept="image/*" capture="environment" hidden></label>
      <img id="afPrev" class="ai-photo" alt="" hidden>` : ''}
    <div class="field" style="margin-top:10px"><label for="afText">${mode === 'foto' ? 'Detalle opcional (ej: "era media porción", "con mayo")' : 'Lo que comiste'}</label>
      <div class="search-row"><textarea id="afText" rows="${mode === 'foto' ? 2 : 3}" placeholder="${mode === 'foto' ? 'Opcional' : 'Ej: 2 huevos revueltos, una marraqueta con palta y café con leche'}"></textarea>${speech ? '<button class="round-btn" id="afMic" type="button" aria-label="Dictar">🎙️</button>' : ''}</div></div>
    <button class="btn" id="afGo" style="width:100%">${mode === 'foto' ? '🔎 Analizar foto' : '🔎 Calcular'}</button>
    <div id="afOut"></div>`, m => {
    const q = s => m.querySelector(s);
    let image = null;
    if (mode === 'foto') q('#afPhoto').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      const url = await shrinkImage(f, 1024);
      image = { data: url.split(',')[1], mimeType: 'image/jpeg' };
      q('#afPrev').src = url; q('#afPrev').hidden = false;
      run();
    });
    if (speech) bindMic(q('#afMic'), q('#afText'), speech);
    const run = async () => {
      const text = q('#afText').value.trim();
      if (mode === 'foto' && !image) return toast('Primero saca una foto');
      if (mode !== 'foto' && !text) return toast('Cuéntame qué comiste');
      q('#afGo').disabled = true;
      q('#afOut').innerHTML = spinner(mode === 'foto' ? 'Mirando tu plato…' : 'Calculando…');
      try {
        const r = await aiJSON(mode === 'foto'
          ? `Identifica los alimentos de esta foto y estima la cantidad de cada uno.${text ? ' Detalle de la persona: ' + text : ''}`
          : `Esto comí: ${text}`, { system: FOOD_SYSTEM, image: mode === 'foto' ? image : undefined });
        const items = (Array.isArray(r.items) ? r.items : []).map(aiFoodEntry).filter(x => x.kcal > 0);
        if (!items.length) { q('#afOut').innerHTML = '<div class="hint-box">No reconocí alimentos. Prueba describiéndolo con más detalle.</div>'; return; }
        aiFoodReview(q('#afOut'), items, MEALS.some(x => x.id === r.meal) ? r.meal : ui.meal, r.note);
      } catch (e) { q('#afOut').innerHTML = aiFail(e); }
      finally { q('#afGo').disabled = false; }
    };
    q('#afGo').addEventListener('click', run);
  });
}
function bindMic(btn, input, Speech) {
  let rec = null;
  btn.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    rec = new Speech();
    rec.lang = 'es-CL'; rec.interimResults = true;
    const before = input.value ? input.value.trim() + ' ' : '';
    rec.onresult = ev => { input.value = before + [...ev.results].map(x => x[0].transcript).join(''); };
    rec.onend = () => { rec = null; btn.classList.remove('rec'); };
    rec.onerror = () => toast('No pude usar el micrófono. Puedes usar el dictado del teclado.');
    btn.classList.add('rec'); rec.start();
  });
}
// Revisión antes de guardar: se puede cambiar gramos (escala todo), quitar alimentos y elegir la comida
function aiFoodReview(box, items, meal, note) {
  const paint = () => {
    const tot = k => items.filter(x => x.on !== false).reduce((a, x) => a + x[k], 0);
    box.innerHTML = `<div class="ai-result">
      <div class="list">${items.map((x, i) => `<div class="item ai-item ${x.on === false ? 'off' : ''}">
        <input type="checkbox" data-ai-on="${i}" ${x.on === false ? '' : 'checked'} aria-label="Incluir ${esc(x.name)}">
        <span class="fi sm">${entryIcon(x)}</span>
        <div class="info"><div class="name">${esc(x.name)}${x.foodId ? ' <span class="muted small">· de la base</span>' : ''}</div><div class="muted small">P ${r0(x.p)} · C ${r0(x.c)} · G ${r0(x.g)}</div></div>
        <div class="field ai-g"><input type="number" min="1" inputmode="decimal" value="${r0(x.grams) || ''}" data-ai-g="${i}" aria-label="Gramos"><span class="unit-in">g</span></div>
        <span class="kcal">${r0(x.kcal)}</span></div>`).join('')}</div>
      <div class="result-box"><b>${r0(tot('kcal'))} kcal</b> · P ${r0(tot('p'))} g · C ${r0(tot('c'))} g · G ${r0(tot('g'))} g</div>
      ${note ? `<p class="muted small">💡 ${esc(note)}</p>` : ''}
      <div class="meal-pick small-pick">${MEALS.map(x => `<button class="${x.id === meal ? 'on' : ''}" data-ai-meal="${x.id}">${MEAL_ICO[x.id]} ${x.name}</button>`).join('')}</div>
      <button class="btn" id="aiSave" style="width:100%">Agregar ${items.filter(x => x.on !== false).length} a ${MEALS.find(x => x.id === meal).name.toLowerCase()}</button></div>`;
    box.querySelectorAll('[data-ai-on]').forEach(c => c.addEventListener('change', () => { items[c.dataset.aiOn].on = c.checked; paint(); }));
    box.querySelectorAll('[data-ai-g]').forEach(inp => inp.addEventListener('change', () => {
      const x = items[inp.dataset.aiG], g = num(inp.value, 3000);
      if (!g) return;
      const k = x.grams ? g / x.grams : 1;
      ['kcal', 'p', 'c', 'g'].forEach(f => { x[f] = x[f] * k; });
      // Se redibuja después: el cambio puede venir del blur de un toque en otro botón
      x.grams = g; setTimeout(paint);
    }));
    box.querySelectorAll('[data-ai-meal]').forEach(b => b.addEventListener('click', () => { meal = b.dataset.aiMeal; paint(); }));
    box.querySelector('#aiSave').addEventListener('click', () => {
      const add = items.filter(x => x.on !== false);
      if (!add.length) return toast('Marca al menos un alimento');
      day().foods.push(...add.map(({ on, ...x }) => ({ ...x, id: uid(), meal, ai: true })));
      ui.meal = meal;
      save(); closeModal(); render(); tap();
      toast(`✓ ${add.length} ${add.length === 1 ? 'alimento' : 'alimentos'} · ${r0(add.reduce((a, x) => a + x.kcal, 0))} kcal`);
    });
  };
  paint();
}

// ---------- Ejercicio: "hice press banca 3x10 con 60 kg y 20 min de trote" ----------
// Ejercicios de la biblioteca parecidos a un nombre, del más al menos parecido
function exerciseCandidates(name, max = 6) {
  const n = norm(name).replace(/[^a-z0-9 ]/g, ' ').trim();
  const words = n.split(/\s+/).filter(w => w.length > 2 && !['con', 'del', 'los', 'las', 'para', 'una'].includes(w));
  if (!words.length) return [];
  return exDB().map(e => {
    const en = norm(e.n), hit = words.filter(w => en.includes(w)).length / words.length;
    return { e, s: en === n ? 2 : hit - Math.max(0, en.split(/\s+/).length - words.length - 1) * 0.08 };
  }).filter(x => x.s >= 0.5).sort((a, b) => b.s - a.s).slice(0, max).map(x => x.e);
}
function matchExercise(name) {
  const n = norm(name).trim();
  return exDB().find(e => norm(e.n) === n) || null;
}
function exerciseSystem() {
  const mine = [...new Set([...state.workouts.slice(-30).flatMap(w => w.ex.map(x => x.id)), ...(state.routine ? state.routine.days.flatMap(d => d.exercises.map(x => x.ex)) : [])])]
    .map(exById).filter(Boolean).map(e => `${e.id}: ${e.n}`).join('\n');
  return `Conviertes lo que la persona cuenta de su entrenamiento en datos. Responde SOLO con JSON:
{"strength":[{"id":"id de la lista o null","name":"nombre en español","sets":[{"kg":60,"reps":10}]}],"cardio":[{"act":"id de actividad","minutes":20,"km":null}],"minutes":null,"note":""}
- strength: TODOS los ejercicios de fuerza que nombren, aunque no digan series ni peso. "3x10 con 60" = 3 series de 10 repeticiones con 60 kg. Sin peso (dominadas, flexiones) usa kg 0. Si dicen distintos pesos por serie, una entrada por serie. Si no dicen series ni repeticiones, usa "sets": [] (no inventes números).
- Si una frase junta dos ejercicios ("press militar en máquina con elevación de mancuernas"), sepáralos en dos.
- id: elige el ejercicio de la BIBLIOTECA que corresponda (prefiere los de "SUS EJERCICIOS" si calzan). "Sentadilla con barra" = squat, "press banca" = bench-press, "peso muerto" = deadlift, etc. Si ninguno calza, null y escribe el nombre más común en español.
- cardio y otras actividades con tiempo: act es uno de estos ids: ${ACTIVITIES.map(a => `${a.id} (${a.name})`).join(', ')}.
- minutes: duración total de las pesas si la dicen; si no, null.
- note: algo breve si te falta un dato importante, o vacío.
SUS EJERCICIOS:
${mine || '(ninguno todavía)'}
BIBLIOTECA (id: nombre):
${exDB().filter(e => e.cat !== 'estiramiento' && e.cat !== 'cardio').map(e => `${e.id}: ${e.n}`).join('\n')}`;
}
function openAIExercise() {
  if (!aiReady()) return openModal(`<h2>💬 Cuéntame qué entrenaste</h2>${AI_LOGIN}`, bindLogin);
  const speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  openModal(`<h2>💬 Cuéntame qué entrenaste</h2>
    <p class="muted small" style="margin-top:-6px">Escribe o dicta: ejercicio, series, repeticiones, peso y tiempo. Ej: "press banca 3x10 con 60 kg, sentadilla 4x8 con 80 y 20 minutos de trote".</p>
    <div class="field"><div class="search-row"><textarea id="aeText" rows="3" placeholder="¿Qué hiciste hoy?"></textarea>${speech ? '<button class="round-btn" id="aeMic" type="button" aria-label="Dictar">🎙️</button>' : ''}</div></div>
    <button class="btn burn" id="aeGo" style="width:100%">🔎 Leer entrenamiento</button>
    <div id="aeOut"></div>`, m => {
    const q = s => m.querySelector(s);
    if (speech) bindMic(q('#aeMic'), q('#aeText'), speech);
    q('#aeGo').addEventListener('click', async () => {
      const text = q('#aeText').value.trim();
      if (!text) return toast('Cuéntame qué hiciste');
      q('#aeGo').disabled = true;
      q('#aeOut').innerHTML = spinner('Leyendo tu entrenamiento…');
      try {
        await loadExercises();
        const r = await aiJSON(`Mi entrenamiento: ${text}`, { system: exerciseSystem() });
        const strength = (Array.isArray(r.strength) ? r.strength : []).map(x => {
          const e = (x.id && exById(x.id)) || matchExercise(x.name || '');
          const sets = (Array.isArray(x.sets) ? x.sets : []).map(z => ({ kg: r1(num(z.kg, 1000)), reps: Math.round(num(z.reps, 500)) })).filter(z => z.reps);
          const name = String(x.name || (e && e.n) || 'Ejercicio').slice(0, 60);
          return { e, name: e ? e.n : name, said: name, sets };
        });
        const cardio = (Array.isArray(r.cardio) ? r.cardio : []).map(x => ({ a: ACTIVITIES.find(a => a.id === x.act), minutes: Math.round(num(x.minutes, 600)), km: num(x.km, 300) })).filter(x => x.a && x.minutes);
        if (!strength.length && !cardio.length) { q('#aeOut').innerHTML = '<div class="hint-box">No entendí ejercicios. Prueba con el nombre, las series y el peso, o los minutos.</div>'; return; }
        aiExerciseReview(q('#aeOut'), strength, cardio, num(r.minutes, 600), r.note);
      } catch (e) { q('#aeOut').innerHTML = aiFail(e); }
      finally { q('#aeGo').disabled = false; }
    });
  });
}
function aiExerciseReview(box, strength, cardio, minutes, note) {
  const nSets = strength.reduce((a, x) => a + x.sets.length, 0);
  const missing = strength.some(x => !x.sets.length);
  let mins = Math.round(minutes || nSets * 2.5);
  const prevOf = x => (x.e ? bestE1rm(x.e.id) : 0);
  const paint = () => {
    const kcalW = strength.length ? burnedKcal(gymMet(strength.map(x => ({ id: x.e && x.e.id, sets: x.sets }))), mins) : 0;
    const kcalC = cardio.reduce((a, x) => a + burnedKcal(x.a.met, x.minutes), 0);
    box.innerHTML = `<div class="ai-result">
      ${strength.length ? `<h3>🏋️ Pesas</h3><div class="list">${strength.map((x, i) => {
        const top = x.sets.filter(z => z.kg).reduce((a, z) => Math.max(a, e1rm(z)), 0), prev = prevOf(x);
        const opts = [...new Map([x.e, ...exerciseCandidates(x.said), ...exerciseCandidates(x.name)].filter(Boolean).map(e => [e.id, e])).values()];
        return `<div class="item"><div class="info">
          <select class="ex-pick" data-ae-ex="${i}" aria-label="Ejercicio">${opts.map(e => `<option value="${e.id}" ${x.e && x.e.id === e.id ? 'selected' : ''}>${esc(e.n)}</option>`).join('')}<option value="" ${x.e ? '' : 'selected'}>➕ Nuevo: ${esc(x.said)}</option></select>
          <div class="muted small">${x.sets.length ? x.sets.map(z => (z.kg ? z.kg + ' kg × ' : '') + z.reps).join(' · ') : '<span class="warn-txt">Sin series: las completas en el siguiente paso</span>'}${top && prev && top > prev ? ' <span class="pr-tag">🏆 Récord</span>' : ''}</div></div></div>`;
      }).join('')}</div>
      ${missing ? '' : `<div class="field"><label for="aeMin">Duración de las pesas (min)</label><input id="aeMin" type="number" min="1" inputmode="numeric" value="${mins}"></div>`}` : ''}
      ${cardio.length ? `<h3>🏃 Cardio y actividad</h3><div class="list">${cardio.map(x => `<div class="item"><span class="fi sm">${ACT_ICO[x.a.id] || '🏅'}</span><div class="info"><div class="name">${esc(x.a.name)}</div><div class="muted small">${x.minutes} min${x.km ? ' · ' + x.km.toLocaleString('es') + ' km' : ''}</div></div><span class="kcal" style="color:var(--burn)">−${r0(burnedKcal(x.a.met, x.minutes))}</span></div>`).join('')}</div>` : ''}
      ${missing ? '' : `<div class="result-box">🔥 <b>${r0(kcalW + kcalC)} kcal</b> quemadas${nSets ? ` · ${nSets} series` : ''}</div>`}
      ${note ? `<p class="muted small">💡 ${esc(note)}</p>` : ''}
      ${strength.length ? '<p class="muted small">Si algún ejercicio no es el correcto, cámbialo en la lista. Los "Nuevo" se crean en tu biblioteca.</p>' : ''}
      ${missing ? `<button class="btn burn" id="aeEdit" style="width:100%">Completar series (kg y reps) →</button>`
        : `<button class="btn burn" id="aeSave" style="width:100%">Guardar en ${currentDate === todayKey() ? 'hoy' : shortDate(currentDate)}</button>
          ${strength.length ? '<button class="see" id="aeEdit" style="margin-top:8px">✏️ Ajustar series antes de guardar</button>' : ''}`}</div>`;
    box.querySelectorAll('[data-ae-ex]').forEach(sel => sel.addEventListener('change', () => {
      const x = strength[sel.dataset.aeEx];
      x.e = sel.value ? exById(sel.value) : null;
      x.name = x.e ? x.e.n : x.said;
      setTimeout(paint);
    }));
    const mi = box.querySelector('#aeMin');
    if (mi) mi.addEventListener('change', () => { mins = Math.max(1, Math.round(num(mi.value, 600)) || mins); setTimeout(paint); });
    const sv = box.querySelector('#aeSave');
    if (sv) sv.addEventListener('click', save2);
    box.querySelector('#aeEdit')?.addEventListener('click', toEditor);
  };
  // Ejercicio de la biblioteca (o uno nuevo con el nombre que dijiste)
  const ensure = x => {
    if (x.e) return x.e;
    let e = state.customExercises.find(c => norm(c.n) === norm(x.said));
    if (!e) {
      e = { id: 'u_' + uid(), n: x.said, d: '', cat: 'fuerza', g: '', custom: true, eq: 'gimnasio', bw: false, home: false, lv: 'principiante', m: [], m2: [], img: [], ins: [], tips: [] };
      state.customExercises.push(e);
    }
    return e;
  };
  const saveCardio = () => {
    const d = day();
    for (const x of cardio) d.exercises.push({ id: uid(), name: x.a.name + (x.km ? ` · ${x.km.toLocaleString('es')} km` : ''), minutes: x.minutes, kcal: burnedKcal(x.a.met, x.minutes), km: x.km || undefined });
  };
  // Pasa las pesas al registro del gym para anotar kg y reps (el cardio se guarda altiro)
  const toEditor = () => {
    saveCardio();
    const g = gymDraft();
    const draft = g && !g.wid && g.date === currentDate ? g : { date: currentDate, items: [], minutes: null, inten: 'normal' };
    for (const x of strength) {
      const e = ensure(x), last = lastSets(e.id);
      const sets = x.sets.length ? x.sets.map(z => ({ ...z })) : last ? last.map(z => ({ kg: z.kg, reps: z.reps })) : [{ kg: '', reps: '' }, { kg: '', reps: '' }, { kg: '', reps: '' }];
      const have = draft.items.find(y => y.id === e.id);
      have ? have.sets.push(...(x.sets.length ? sets : [])) : draft.items.push({ id: e.id, sets });
    }
    if (minutes) draft.minutes = Math.round(minutes);
    storeGymDraft(draft); save(); closeModal(); render();
    if (cardio.length) toast('Cardio guardado. Ahora completa las series 💪');
    openGymLog();
  };
  const save2 = () => {
    const ex = strength.map(x => ({ id: ensure(x).id, sets: x.sets }));
    // Si un ejercicio aparece dos veces, se juntan sus series
    const merged = [];
    for (const x of ex) { const y = merged.find(z => z.id === x.id); y ? y.sets.push(...x.sets) : merged.push({ ...x, sets: [...x.sets] }); }
    const prs = merged.length ? logStrength(merged, mins, burnedKcal(gymMet(merged), mins), { name: 'Pesas' }) : [];
    saveCardio();
    save(); closeModal(); render(); tap();
    if (prs.length) { confetti(60); toast(`🏆 ¡Nuevo récord en ${prs.join(', ')}!`); } else toast('Entrenamiento guardado 💪');
  };
  paint();
}

// ---------- Armar una comida con lo que te queda ----------
const MEAL_SYSTEM = `Eres un nutricionista y cocinero chileno. Propones UNA comida concreta y rica que calce con las calorías y proteína pedidas (±10 %).
Responde SOLO con JSON:
{"name":"nombre del plato","minutes":15,"items":[{"name":"Pechuga de pollo","grams":150,"kcal":165,"p":31,"c":0,"g":3.6}],"steps":["paso corto"],"tip":"consejo breve"}
- items: ingredientes con cantidad en gramos; kcal y macros son para esa cantidad (no por 100 g).
- Usa ingredientes que se encuentran en supermercados chilenos y nombres comunes en Chile.
- 2 a 6 pasos cortos. Si no hay que cocinar, steps puede tener 1 paso.`;
function openAIMeal() {
  if (!aiReady()) return openModal(`<h2>🤖 Armar comida con IA</h2>${AI_LOGIN}`, bindLogin);
  // Proteína sugerida: la misma parte de lo que te falta que las calorías de esta comida
  const { meal: m0, target } = nextMealTarget();
  const tg = calcTargets(), t = totals(peekDay(todayKey()));
  let meal = m0.id, prefs = new Set(), last = [];
  const PREFS = [['rapida', '⚡ Rápida (≤15 min)'], ['proteina', '💪 Alta en proteína'], ['sincocinar', '🥪 Sin cocinar'], ['economica', '💸 Económica'], ['vegetariana', '🥦 Vegetariana']];
  openModal(`<h2>🤖 Armar comida con IA</h2>
    <p class="muted small" style="margin-top:-6px">Te quedan <b>${r0(Math.max(0, tg.kcal + t.burned - t.kcal))} kcal</b> y <b>${r0(Math.max(0, tg.prot - t.p))} g de proteína</b> hoy.</p>
    <div class="meal-pick small-pick">${MEALS.map(x => `<button class="${x.id === meal ? 'on' : ''}" data-am-meal="${x.id}">${MEAL_ICO[x.id]} ${x.name}</button>`).join('')}</div>
    <div class="grid g2 keep" style="gap:8px">
      <div class="field"><label for="amK">kcal</label><input id="amK" type="number" min="100" inputmode="numeric" value="${r0(target)}"></div>
      <div class="field"><label for="amP">Proteína (g)</label><input id="amP" type="number" min="0" inputmode="numeric" value="${r0(Math.min(80, Math.max(15, (tg.prot - t.p) * Math.min(1, target / Math.max(1, tg.kcal + t.burned - t.kcal)))))}"></div>
    </div>
    <div class="field"><label for="amHave">¿Qué tienes en la casa? (opcional)</label><input id="amHave" placeholder="Ej: pollo, arroz, tomate, huevos"></div>
    <div class="chips">${PREFS.map(([k, l]) => `<button class="chip" data-am-pref="${k}">${l}</button>`).join('')}</div>
    <button class="btn" id="amGo" style="width:100%">✨ Armar comida</button>
    <div id="amOut"></div>`, m => {
    const q = s => m.querySelector(s);
    m.querySelectorAll('[data-am-meal]').forEach(b => b.addEventListener('click', () => { meal = b.dataset.amMeal; m.querySelectorAll('[data-am-meal]').forEach(x => x.classList.toggle('on', x === b)); }));
    m.querySelectorAll('[data-am-pref]').forEach(b => b.addEventListener('click', () => { prefs.has(b.dataset.amPref) ? prefs.delete(b.dataset.amPref) : prefs.add(b.dataset.amPref); b.classList.toggle('active'); }));
    const run = async () => {
      const kcal = num(q('#amK').value, 3000), prot = num(q('#amP').value, 300);
      if (kcal < 100) return toast('Indica al menos 100 kcal');
      q('#amGo').disabled = true;
      q('#amOut').innerHTML = spinner('Pensando en algo rico…');
      try {
        const p = state.profile;
        const r = await aiJSON(`Arma ${{ desayuno: 'un desayuno', almuerzo: 'un almuerzo', cena: 'una cena', snack: 'un snack' }[meal]} de unas ${r0(kcal)} kcal con unos ${r0(prot)} g de proteína.
Dieta de la persona: ${DIETS[p.dieta || 'equilibrada'].label}. Objetivo: ${GOALS[p.objetivo].label}.
${q('#amHave').value.trim() ? 'Tiene en la casa: ' + q('#amHave').value.trim() + ' (úsalo de base, puede sumar básicos como aceite, sal o especias).' : ''}
${prefs.size ? 'Preferencias: ' + [...prefs].map(k => PREFS.find(x => x[0] === k)[1].replace(/^\S+\s/, '')).join(', ') + '.' : ''}
${last.length ? 'No repitas estas ideas: ' + last.join('; ') + '.' : ''}`, { system: MEAL_SYSTEM });
        const items = (Array.isArray(r.items) ? r.items : []).map(aiFoodEntry).filter(x => x.kcal > 0);
        if (!items.length) throw Object.assign(new Error('respuesta sin ingredientes'), { code: 'parse' });
        const name = String(r.name || 'Comida sugerida').slice(0, 80);
        last.push(name);
        const tot = k => items.reduce((a, x) => a + x[k], 0);
        const steps = (Array.isArray(r.steps) ? r.steps : []).map(String).slice(0, 8);
        q('#amOut').innerHTML = `<div class="ai-result">
          <div class="sheet-title"><span class="fi lg">${iconFor(name) || MEAL_ICO[meal]}</span><div><h3 style="margin:0">${esc(name)}</h3>${num(r.minutes, 600) ? `<span class="muted small">⏱️ ${r0(num(r.minutes, 600))} min</span>` : ''}</div></div>
          <div class="result-box"><b>${r0(tot('kcal'))} kcal</b> · P ${r0(tot('p'))} g · C ${r0(tot('c'))} g · G ${r0(tot('g'))} g</div>
          <div class="list">${items.map(x => `<div class="item"><span class="fi sm">${entryIcon(x)}</span><div class="info"><div class="name">${esc(x.name)}</div><div class="muted small">${r0(x.grams)} g</div></div><span class="kcal">${r0(x.kcal)}</span></div>`).join('')}</div>
          ${steps.length ? `<ol class="steps">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
          ${r.tip ? `<p class="muted small">💡 ${esc(String(r.tip))}</p>` : ''}
          <div class="btn-row"><button class="btn" id="amAdd" style="flex:1">Agregar a ${MEALS.find(x => x.id === meal).name.toLowerCase()}</button><button class="btn ghost" id="amCombo">💾 Combo</button></div>
          <button class="see" id="amAgain" style="margin-top:8px">🔄 Otra idea</button></div>`;
        q('#amAdd').addEventListener('click', () => {
          day(todayKey()).foods.push(...items.map(x => ({ ...x, id: uid(), meal, ai: true })));
          save(); closeModal(); render(); tap();
          toast(`✓ ${name} · ${r0(tot('kcal'))} kcal`);
        });
        q('#amCombo').addEventListener('click', () => {
          state.combos.push({ id: uid(), name, meal, items: items.map(x => ({ ...x, id: uid() })) });
          save(); toast('Guardado en Comidas → 🍱 Combos');
          q('#amCombo').disabled = true;
        });
        q('#amAgain').addEventListener('click', run);
      } catch (e) { q('#amOut').innerHTML = aiFail(e); }
      finally { q('#amGo').disabled = false; }
    };
    q('#amGo').addEventListener('click', run);
  });
}

// ---------- Revisión semanal del coach ----------
// Se pide una vez por semana y queda guardada en el teléfono (y en el chat del coach, para seguir conversando)
const REVIEW_KEY = pkey('fitplan-review');
function storedReview(start) { try { const r = JSON.parse(localStorage.getItem(REVIEW_KEY)); return r && r.week === start ? r.text : null; } catch (e) { return null; } }
async function weeklyReview(start, box, force) {
  const cached = !force && storedReview(start);
  if (cached) { box.innerHTML = mdLite(cached); return; }
  if (!aiReady()) { box.innerHTML = '🔐 Inicia sesión con Google en Perfil para que el coach con IA revise tu semana.'; return; }
  box.innerHTML = spinner('El coach está revisando tu semana…');
  const w = weeklyReport(start);
  const ask = `Haz mi revisión de la semana del ${w.keys[0]} al ${w.keys[6]}.
Resumen: ${w.logged}/7 días registrados, ${w.inGoal}/7 en la meta, ${r0(w.avgKcal)} kcal promedio (meta ${r0(w.tg.kcal)}), proteína ${r0(w.avgP)} g (meta ${r0(w.tg.prot)}), ${w.def >= 0 ? 'déficit' : 'superávit'} total ${r0(Math.abs(w.def))} kcal, ${w.trainDays} días con ejercicio${w.wch !== null ? `, peso ${w.wch > 0 ? '+' : ''}${r1(w.wch)} kg` : ''}.
Formato, máximo 9 líneas:
**✅ Lo que hiciste bien** (2 viñetas con números)
**⚠️ Lo que falló** (1 o 2 viñetas)
**🎯 Meta para esta semana** (1 meta concreta y medible)`;
  try {
    const text = await window.FitSync.ask({ system: COACH_SYSTEM, message: `DATOS ACTUALIZADOS:\n${coachContext()}\n\nPREGUNTA: ${ask}`, onChunk: t => { box.innerHTML = mdLite(t); } });
    try { localStorage.setItem(REVIEW_KEY, JSON.stringify({ week: start, text })); } catch (e) { /* ignorar */ }
    const log = coachLog();
    log.push({ role: 'user', text: `Revisión de la semana del ${shortDate(w.keys[0])} al ${shortDate(w.keys[6])}` }, { role: 'model', text });
    storeCoach(log);
    box.innerHTML = mdLite(text);
  } catch (e) { box.innerHTML = aiFail(e); }
}
