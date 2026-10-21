// FitPlan · Coach: chat con IA (Gemini, nivel gratuito) que conoce tus datos, y un coach básico sin conexión
'use strict';

// ---------- Resumen de tus datos para la IA (sin nombre ni correo) ----------
function coachContext() {
  const p = state.profile, tg = calcTargets();
  const k7 = Array.from({ length: 7 }, (_, i) => shiftKey(todayKey(), -(7 - i)));
  const dayLine = k => {
    const d = peekDay(k);
    if (!d.foods.length && !d.exercises.length) return `${k}: sin registro`;
    const t = totals(d), def = dayDeficit(k, tg);
    return `${k}: ${r0(t.kcal)} kcal (P ${r0(t.p)} g, C ${r0(t.c)} g, G ${r0(t.g)} g), ejercicio ${r0(t.burned)} kcal${d.exercises.length ? ' [' + d.exercises.map(e => e.name).join(', ') + ']' : ''}, agua ${d.water}/${tg.water} vasos${def !== null ? `, ${def >= 0 ? 'déficit' : 'superávit'} ${r0(Math.abs(def))} kcal` : ''}`;
  };
  const today = peekDay(todayKey()), tt = totals(today);
  const ws = [...state.weights].sort((a, b) => a.d.localeCompare(b.d)).slice(-8);
  const st14 = deficitStats(14, tg);
  const tr = weightTrend();
  const wk = state.workouts.filter(w => w.d >= shiftKey(todayKey(), -14));
  const prs = typeof strengthStats === 'function' && exReady() ? strengthStats().filter(x => x.best).slice(0, 4).map(x => `${exById(x.id).n}: mejor serie ${x.best.kg} kg × ${x.best.reps}`) : [];
  const r = state.routine;
  const pr = goalProjection(tg);
  const lines = [
    `Fecha de hoy: ${todayKey()} (${new Date().toLocaleDateString('es', { weekday: 'long' })}), hora ${new Date().getHours()}:00.`,
    `Persona: ${p.sexo === 'h' ? 'hombre' : 'mujer'}, ${p.edad} años, ${p.altura} cm, ${r1(currentWeight())} kg. Actividad diaria x${p.actividad}.`,
    `Objetivo: ${GOALS[p.objetivo].label}${p.objetivo === 'perder' ? ` a ritmo ${RITMOS[p.ritmo || 'moderado'].label.toLowerCase()} (${goalAdj(p)} kcal)` : ''}${p.meta ? `, peso meta ${p.meta} kg` : ''}. Dieta: ${DIETS[p.dieta || 'equilibrada'].label}.`,
    `Metas diarias: ${r0(tg.kcal)} kcal, proteína ${r0(tg.prot)} g, carbohidratos ${r0(tg.carb)} g, grasas ${r0(tg.fat)} g, agua ${tg.water} vasos. Metabolismo basal ${r0(tg.bmr)} kcal, gasto de mantención ${r0(tg.tdee)} kcal.${tg.breakOn ? ' Está en semana de mantención.' : ''}`,
    `Hoy hasta ahora: ${r0(tt.kcal)} kcal (P ${r0(tt.p)} g), ejercicio ${r0(tt.burned)} kcal, agua ${today.water} vasos. Comidas de hoy: ${today.foods.map(f => `${f.name} (${r0(f.kcal)} kcal, ${f.meal})`).join('; ') || 'ninguna'}.`,
    'Últimos 7 días:', ...k7.map(dayLine),
    `Balance de 14 días: ${st14.logged} días registrados, ${st14.avg === null ? 'sin datos' : `${st14.avg >= 0 ? 'déficit' : 'superávit'} promedio ${r0(Math.abs(st14.avg))} kcal/día`}.`,
    `Peso: ${ws.map(w => `${w.d} ${w.kg} kg`).join(', ') || 'sin registros'}. Tendencia: ${tr === null ? 'sin datos suficientes' : `${r1(tr)} kg/semana`} (esperado ${expectedRate(p)} kg/semana).${pr && pr.date ? ` Proyección a la meta: ${Math.round(pr.weeks)} semanas.` : ''}`,
    `Rutina: ${r ? `${(PROGRAMS[r.programa] || PROGRAMS.auto).label}, ${r.dias} días/semana, ${EQUIP_OPTS[r.equipo]}, semana ${r.week || 1}${r.deload ? ' (descarga)' : ''}, hechos esta semana ${r.days.filter(x => x.done).length}/${r.days.length}` : 'sin rutina'}.`,
    `Entrenamientos con series en 14 días: ${wk.length}${wk.length ? ' (' + wk.map(w => `${w.d} ${w.name}`).join('; ') + ')' : ''}.`,
    prs.length ? `Fuerza: ${prs.join('; ')}.` : '',
    `Racha de registro: ${streak()} días. Logros: ${state.badges.length} de ${BADGES.length}.`,
    state.challenges.filter(c => !c.closed).length ? `Desafíos activos: ${state.challenges.filter(c => !c.closed).map(c => { const x = challengeProgress(c); return `${x.def.name} (${x.done} de ${x.elapsed} días)`; }).join('; ')}.` : '',
    state.fasting && state.fasting.on ? `Ayuno ${state.fasting.plan}:${24 - state.fasting.plan}, ${state.fasting.start ? 'ahora en ayuno' : 'ventana de comida abierta'}.` : '',
  ];
  return lines.filter(Boolean).join('\n');
}
const COACH_SYSTEM = `Eres el coach de FitPlan, una app personal de nutrición y entrenamiento. Hablas en español de Chile, cercano y motivador, sin exagerar.
Reglas:
- Basa tus respuestas en los DATOS que vienen en cada mensaje. Cita números concretos (kcal, gramos, días) cuando ayuden.
- Sé breve: 3 a 8 líneas, con viñetas cortas si sirve. Nada de introducciones largas.
- Cuando pregunten qué hicieron bien, empieza por lo positivo y luego da 1 o 2 mejoras concretas.
- Si recomiendas comida, usa alimentos comunes en Chile y di cantidades aproximadas en gramos y calorías.
- No inventes datos que no estén. Si faltan registros, dilo y sugiere qué registrar.
- No das diagnósticos médicos. Ante dolor, lesiones, embarazo, trastornos alimentarios o medicamentos, recomienda consultar a un profesional de salud.
- Nunca recomiendes comer bajo el metabolismo basal ni bajar más de 1 % del peso por semana.`;

// ---------- Coach básico (sin IA): qué hiciste bien y qué mejorar, a partir de tus números ----------
function basicCoach(topic = 'semana') {
  const p = state.profile, tg = calcTargets();
  const keys = Array.from({ length: 7 }, (_, i) => shiftKey(todayKey(), -(7 - i)));
  const logged = keys.filter(k => peekDay(k).foods.length);
  const tt = logged.map(k => totals(peekDay(k)));
  const avg = f => tt.length ? tt.reduce((a, t) => a + f(t), 0) / tt.length : 0;
  const st = deficitStats(7, tg);
  const inGoal = keys.filter(k => dayInGoal(k, tg)).length;
  const water = keys.filter(k => peekDay(k).water >= tg.water).length;
  const train = keys.filter(k => peekDay(k).exercises.length).length;
  const tr = weightTrend();
  const good = [], improve = [];
  if (logged.length >= 6) good.push(`Registraste ${logged.length} de 7 días: esa constancia es lo que más ayuda.`);
  else improve.push(`Registraste ${logged.length} de 7 días. Apunta a 6: sin registro no se puede ajustar nada.`);
  if (avg(t => t.p) >= tg.prot * 0.9) good.push(`Tu proteína promedio fue ${r0(avg(t => t.p))} g, casi o sobre tu meta de ${r0(tg.prot)} g.`);
  else if (logged.length) improve.push(`Proteína: ${r0(avg(t => t.p))} g de ${r0(tg.prot)} g. Suma una porción en el desayuno (2 huevos o un yogur griego) para cerrar la brecha.`);
  if (p.objetivo === 'perder' && st.logged >= 3) {
    if (st.avg > 150 && st.avg <= 1000) good.push(`Tuviste un déficit sano de ${r0(st.avg)} kcal al día (≈ ${fmtKg(st.sum / KCAL_KG)} kg de grasa en la semana).`);
    else if (st.avg > 1000) improve.push(`Tu déficit fue muy alto (${r0(st.avg)} kcal/día). Come un poco más para no perder músculo ni energía.`);
    else improve.push('No hubo déficit esta semana. Revisa snacks, bebidas y salsas: suelen ser las calorías escondidas.');
  }
  if (inGoal >= 4) good.push(`${inGoal} días dentro de tu meta de calorías.`);
  if (water >= 5) good.push(`Cumpliste tu meta de agua ${water} días.`);
  else improve.push(`Agua: cumpliste ${water} de 7 días. Deja una botella a la vista y toma un vaso con cada comida.`);
  if (train >= (state.routine ? state.routine.dias : 3)) good.push(`Entrenaste ${train} días: ¡bien ahí!`);
  else improve.push(`Entrenaste ${train} días${state.routine ? ` de los ${state.routine.dias} de tu rutina` : ''}. Agenda los entrenamientos como si fueran una cita.`);
  if (streak() >= 7) good.push(`Llevas una racha de ${streak()} días seguidos registrando.`);
  if (tr !== null && p.objetivo === 'perder' && tr < 0 && tr >= -0.01 * currentWeight()) good.push(`Estás bajando ${r1(-tr)} kg por semana, un ritmo sano.`);
  const meta = goalProjection(tg);
  const goalLine = !p.meta ? 'Aún no tienes un peso meta: ponlo en Progreso → Déficit para ver cuándo llegarías.'
    : meta && meta.reached ? '¡Estás en tu peso meta! Considera pasar tu objetivo a mantener.'
      : meta && meta.date ? `Vas camino a ${p.meta} kg: a este ritmo llegas en unas ${Math.max(1, Math.round(meta.weeks))} semanas.`
        : `Con tu balance actual no te estás acercando a ${p.meta} kg.`;
  if (topic === 'bien') return good.length ? good : ['Todavía no tengo suficientes datos de esta semana. ¡Registra tus comidas y te cuento!'];
  if (topic === 'mejorar') return improve.length ? improve : ['¡Vas muy bien en todo! Mantén lo que estás haciendo.'];
  if (topic === 'meta') return [goalLine, ...(st.avg !== null ? [`Balance de 7 días: ${st.avg >= 0 ? 'déficit' : 'superávit'} de ${r0(Math.abs(st.avg))} kcal al día.`] : [])];
  return [...good.slice(0, 3).map(x => '✅ ' + x), ...improve.slice(0, 2).map(x => '💡 ' + x), '🏁 ' + goalLine];
}

// ---------- Chat ----------
const COACH_KEY = pkey('fitplan-coach');
const QUICK_Q = [
  ['bien', '¿Qué hice bien esta semana?'],
  ['mejorar', '¿Qué debería mejorar?'],
  ['meta', '¿Cómo voy con mi meta?'],
  ['cena', '¿Qué ceno con lo que me queda hoy?'],
  ['estanco', '¿Por qué no estoy bajando de peso?'],
];
function coachLog() { try { return JSON.parse(localStorage.getItem(COACH_KEY)) || []; } catch (e) { return []; } }
function storeCoach(l) { try { localStorage.setItem(COACH_KEY, JSON.stringify(l.slice(-30))); } catch (e) { /* ignorar */ } }
// Texto de la IA → HTML seguro (negritas, viñetas y saltos de línea)
function mdLite(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-*•]\s+/gm, '• ').replace(/\n/g, '<br>');
}
function coachErrorText(e) {
  const m = String((e && (e.code || e.message)) || '');
  if (m === 'auth') return 'Para usar el coach con IA, inicia sesión con Google en Perfil → Sincronización (así nadie más puede usarlo).';
  if (m === 'offline' || /network|failed to fetch|load/i.test(m)) return 'No hay conexión con la IA ahora. Te dejo el análisis del coach básico:';
  if (/429|quota|resource.?exhausted|rate/i.test(m)) return 'Se acabó la cuota gratis de la IA por ahora; vuelve a intentar más tarde. Mientras, el coach básico:';
  if (/permission|403|not been used|disabled|enable|api-not-enabled|billing/i.test(m)) return 'Falta activar la IA en Firebase (AI Logic → Gemini Developer API). Mientras, el coach básico:';
  return 'La IA no respondió. Te dejo el análisis del coach básico:';
}
function openCoach() {
  let log = coachLog();
  const S = window.FitSync && window.FitSync.state;
  const aiReady = !!(S && S.enabled && S.user);
  openModal(`<div class="coach">
    <div class="coach-head"><span class="coach-ava">🤖</span><div><h2 style="margin:0">Tu coach</h2><span class="muted small">${aiReady ? 'Con IA (Gemini) · conoce tus registros' : 'Coach básico · inicia sesión en Perfil para usar la IA'}</span></div></div>
    <div class="coach-log" id="cLog"></div>
    <div class="chips scroll-x coach-quick">${QUICK_Q.map(([id, q]) => `<button class="chip" data-q="${id}">${esc(q)}</button>`).join('')}</div>
    <form class="coach-input" id="cForm"><input id="cMsg" placeholder="Pregúntale algo…" autocomplete="off"><button class="btn" aria-label="Enviar">➤</button></form>
    <div class="coach-foot"><span class="muted small">Tus números van resumidos a Google, sin nombre ni correo. No reemplaza a un profesional de salud.</span>${log.length ? '<button class="see" id="cClear">Borrar chat</button>' : ''}</div>
  </div>`, m => {
    m.querySelector('.modal').classList.add('coach-modal');
    const box = m.querySelector('#cLog');
    const bubble = (role, html) => `<div class="msg ${role}">${html}</div>`;
    const paint = () => {
      box.innerHTML = log.length ? log.map(x => bubble(x.role, x.role === 'user' ? esc(x.text) : mdLite(x.text))).join('')
        : bubble('model', `¡Hola! Conozco tus registros de comidas, peso y entrenamientos. Pregúntame lo que quieras o toca una pregunta rápida.<br><br>${basicCoach('semana').map(esc).join('<br>')}`);
      box.scrollTop = box.scrollHeight;
    };
    paint();
    // Una pregunta a la vez: mientras responde, no se aceptan otras
    let busy = false;
    const lock = on => { busy = on; m.querySelectorAll('[data-q], #cForm button').forEach(b => { b.disabled = on; }); };
    const send = async (text, topic) => {
      if (!text.trim() || busy) return;
      lock(true);
      log.push({ role: 'user', text });
      paint();
      const tmp = document.createElement('div');
      tmp.className = 'msg model typing';
      tmp.innerHTML = '<span></span><span></span><span></span>';
      box.appendChild(tmp); box.scrollTop = box.scrollHeight;
      let answer;
      try {
        if (!window.FitSync || !window.FitSync.ask) throw Object.assign(new Error('offline'), { code: 'offline' });
        const history = log.slice(-11, -1).map(x => ({ role: x.role, text: x.text }));
        answer = await window.FitSync.ask({
          history, system: COACH_SYSTEM,
          message: `DATOS ACTUALIZADOS:\n${coachContext()}\n\nPREGUNTA: ${text}`,
          onChunk: t => { tmp.classList.remove('typing'); tmp.innerHTML = mdLite(t); box.scrollTop = box.scrollHeight; },
        });
      } catch (e) {
        const fallback = basicCoach(topic && ['bien', 'mejorar', 'meta'].includes(topic) ? topic : 'semana');
        answer = coachErrorText(e) + '\n' + fallback.map(x => '- ' + x).join('\n');
      }
      log.push({ role: 'model', text: answer });
      storeCoach(log);
      paint();
      lock(false);
    };
    m.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => send(QUICK_Q.find(q => q[0] === b.dataset.q)[1], b.dataset.q)));
    m.querySelector('#cForm').addEventListener('submit', e => {
      e.preventDefault();
      const i = m.querySelector('#cMsg');
      const t = i.value; i.value = '';
      send(t);
    });
    const cl = m.querySelector('#cClear');
    if (cl) cl.addEventListener('click', () => { log = []; storeCoach(log); paint(); cl.remove(); });
  });
}
