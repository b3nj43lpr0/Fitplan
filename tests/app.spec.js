// Recorridos principales de la app con datos realistas de 3 semanas (tests/fixture.js)
const { test, expect } = require('@playwright/test');
const fixture = require('./fixture.js');

const state = page => page.evaluate(() => window.__fitplan.get());
const today = page => page.evaluate(() => {
  const s = window.__fitplan.get();
  const z = n => String(n).padStart(2, '0');
  const d = new Date();
  return s.days[`${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`];
});

test.beforeEach(async ({ page }) => {
  page.on('dialog', d => d.accept());
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto('/index.html');
  await page.evaluate(f => localStorage.setItem('fitplan-v1', JSON.stringify(f)), fixture());
  await page.reload();
});
test.afterEach(async ({ page }) => {
  expect(page.errors, 'errores de JavaScript en la página').toEqual([]);
});

test('perfil nuevo: calcula y entra a Hoy', async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('#pNombre', 'Ana');
  await page.click('#saveProfile');
  await expect(page.locator('.hello .name')).toHaveText('Ana');
});

test('Hoy: repetir, agua, editar y ＋ por comida', async ({ page }) => {
  const n0 = (await today(page)).foods.length;
  await page.click('[data-repeat=cena]');
  expect((await today(page)).foods.length).toBeGreaterThan(n0);
  await page.click('[data-water-step="1"]');
  expect((await today(page)).water).toBe(4);
  const id = await page.getAttribute('[data-edit-food]', 'data-edit-food');
  await page.click(`[data-edit-food="${id}"]`);
  await page.fill('#eGrams', '100');
  await page.click('#eSave');
  expect((await today(page)).foods.find(f => f.id === id).grams).toBe(100);
  await page.click('[data-add-meal=snack]');
  await expect(page.locator('[data-pick-meal=snack]')).toHaveClass(/on/);
});

test('Comidas: agregar rápido, hoja, registro rápido y alimento propio', async ({ page }) => {
  await page.click('[data-view=comidas]');
  await page.click('[data-pick-meal=snack]');
  const n0 = (await today(page)).foods.length;
  await page.click('[data-quick]');
  expect((await today(page)).foods.length).toBe(n0 + 1);
  expect((await today(page)).foods.at(-1).meal).toBe('snack');
  await page.fill('#foodSearch', 'empanada');
  await expect(page.locator('#foodSearch')).toBeFocused();
  expect(await page.locator('#foodList [data-food]').count()).toBeGreaterThan(1);
  await page.click('#foodList [data-food]');
  await page.click('[data-step="1"]');
  await page.click('[data-sheet-meal=almuerzo]');
  await page.click('#addFood');
  expect((await today(page)).foods.at(-1).meal).toBe('almuerzo');
  await page.click('#quickLog');
  await page.fill('#qKcal', '350');
  await page.click('#qAdd');
  expect((await today(page)).foods.at(-1).kcal).toBe(350);
  await page.click('#newFood');
  await page.fill('#cfName', 'Mi barra');
  await page.fill('#cfKcal', '400');
  await page.click('#cfSave');
  await page.click('#addFood');
  expect((await state(page)).customFoods.some(f => f.name === 'Mi barra')).toBe(true);
});

test('Recetas: agregar, detalle, crear receta, plan y compras', async ({ page }) => {
  await page.click('[data-view=recetas]');
  const n0 = (await today(page)).foods.length;
  await page.click('.rcard [data-log-recipe]');
  await page.click('[data-open-recipe]');
  await page.click('#rcAdd');
  expect((await today(page)).foods.length).toBe(n0 + 2);
  await page.click('#newRecipe');
  await page.fill('#rcName', 'Prueba');
  await page.fill('#rcSearch', 'arroz');
  await page.click('[data-pick]');
  await page.click('#rcSave');
  expect((await state(page)).customRecipes).toHaveLength(1);
  await page.click('[data-tab-rec=plan]');
  await page.click('#genPlan');
  await page.click('[data-tab-rec=compras]');
  await expect(page.locator('#shareList')).toBeVisible();
});

test('Entrenar: rutina, entrenamiento completo, actividad y biblioteca', async ({ page }) => {
  await page.click('[data-view=rutinas]');
  await page.click('#genRoutine');
  await page.click('[data-start="0"]');
  // Primero viene el calentamiento (sin descanso); se salta hasta el primer ejercicio de fuerza
  const warm = (await state(page)).routine.days[0].exercises.filter(x => x.warm).length;
  for (let i = 0; i < warm; i++) await page.click('#wNext');
  await page.fill('[data-kg="0"]', '50');
  await page.click('[data-set="0"]');
  await page.click('#rSkip');
  while (await page.locator('#wNext').count()) await page.click('#wNext');
  await page.click('#wFinish');
  await page.click('#okW');
  const s = await state(page);
  expect(s.routine.days[0].done).toBe(true);
  expect(s.workouts.at(-1).ex.find(x => x.sets.some(z => z.kg === 50))).toBeTruthy();
  await page.click('[data-toggle-day="2"]');
  await expect(page.locator('[data-start="2"]')).toBeVisible();
  await page.click('[data-tab-rut=actividad]');
  await page.click('[data-act=trotar]');
  await page.click('#addEx');
  expect((await today(page)).exercises.some(e => /Trotar/.test(e.name))).toBe(true);
  await page.click('[data-tab-rut=biblioteca]');
  await page.fill('#exSearch', 'sentadilla');
  expect(await page.locator('.ex-card').count()).toBeGreaterThan(3);
});

test('Progreso: peso, pestañas y gráfico de fuerza', async ({ page }) => {
  await page.click('[data-view=progreso]');
  await page.click('[data-wstep="-0.1"]');
  await page.click('#addWeight');
  expect((await state(page)).weights.some(w => w.kg === 80.2)).toBe(true);
  await page.click('[data-tab-prog=resumen]');
  await expect(page.locator('.chart.stacked')).toBeVisible();
  await page.click('[data-tab-prog=fuerza]');
  await page.click('[data-strength]');
  await expect(page.locator('.modal svg.wchart')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.click('[data-tab-prog=logros]');
  await expect(page.locator('.badge.on').first()).toBeVisible();
});

test('Perfil, tema y navegación', async ({ page }) => {
  await page.click('.hello [data-go=perfil]');
  await page.click('[data-theme-mode=dark]');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.click('[data-view=hoy]');
  await page.click('[data-go=ejercicio]');
  await expect(page.locator('[data-tab-rut=actividad]')).toHaveClass(/active/);
});

test('carga liviana: no descarga ejercicios ni lector al abrir', async ({ page }) => {
  const urls = [];
  page.on('request', r => urls.push(r.url()));
  await page.reload();
  await page.waitForTimeout(500);
  expect(urls.some(u => /exercises\.js|zxing/.test(u))).toBe(false);
});

test('Entrenar: calentamiento, superseries, progresión y ejercicio propio', async ({ page }) => {
  await page.click('[data-view=rutinas]');
  await page.selectOption('#rNivel', 'intermedio');
  await page.click('#genRoutine');
  const r = (await state(page)).routine;
  expect(r.days.every(d => d.exercises[0].warm)).toBe(true);
  expect(r.days.some(d => d.exercises.some(x => x.ss))).toBe(true);
  // Progresión: todas las series en el tope del rango → sube el peso
  const sg = await page.evaluate(() => {
    state.workouts.push({ id: 'wx', d: todayKey(), name: 'x', minutes: 40, ex: [{ id: 'bench-press', sets: [{ kg: 60, reps: 10 }, { kg: 60, reps: 10 }] }] });
    return [suggestion({ ex: 'bench-press', series: 2, reps: '8-10' }), suggestion({ ex: 'bench-press', series: 2, reps: '8-12' })];
  });
  expect(sg[0]).toMatchObject({ kg: 62.5, reps: 8, up: true });
  expect(sg[1]).toMatchObject({ kg: 60, reps: 11 });
  // Superserie: tras una serie del primero pasa al segundo
  const di = r.days.findIndex(d => d.exercises.some(x => x.ss));
  const first = r.days[di].exercises.findIndex(x => x.ss);
  if (!(await page.locator(`[data-start="${di}"]`).count())) await page.click(`[data-toggle-day="${di}"]`);
  await page.click(`[data-start="${di}"]`);
  for (let i = 0; i < first; i++) await page.click('#wNext');
  await page.click('[data-set="0"]');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fitplan-session')).i)).toBe(first + 1);
  await page.click('#wQuit');
  // Ejercicio propio
  await page.click('[data-tab-rut=biblioteca]');
  await page.click('#newEx');
  await page.fill('#ceName', 'Remo máquina azul');
  await page.click('#ceSave');
  await page.fill('#exSearch', 'azul');
  await expect(page.locator('.ex-card')).toHaveCount(1);
});

test('Metas inteligentes: carbos en días de entreno, aviso de proteína y plan con entrenos', async ({ page }) => {
  // Día con ejercicio: la meta de carbos sube
  const g = await page.evaluate(() => { const tg = calcTargets(); return [tg.carb, dayGoals(tg, 400).carb, dayGoals(tg, 0).carb]; });
  expect(g[1]).toBeCloseTo(g[0] + 70, 0);
  expect(g[2]).toBe(g[0]);
  await page.click('[data-view=rutinas]');
  await page.click('#genRoutine');
  await page.click('[data-view=recetas]');
  await page.click('[data-tab-rec=plan]');
  await page.click('#genPlan');
  const plan = (await state(page)).plan;
  expect(plan.days.filter(d => d.train)).toHaveLength(3);
  await expect(page.locator('.tag', { hasText: 'entreno' }).first()).toBeVisible();
  // Aviso de proteína (forzamos la hora de la tarde)
  const n = await page.evaluate(() => {
    const H = Date.prototype.getHours; Date.prototype.getHours = () => 19;
    try { return nudges({ foods: [{ meal: 'almuerzo', kcal: 500, p: 5, c: 50, g: 10 }], exercises: [], water: 20 }, calcTargets()).map(x => x.id); }
    finally { Date.prototype.getHours = H; }
  });
  expect(n).toContain('prot');
});

test('Deshacer, buscar recetas por ingrediente y accesos directos', async ({ page }) => {
  const n0 = (await today(page)).foods.length;
  await page.click('[data-del-food]');
  expect((await today(page)).foods.length).toBe(n0 - 1);
  await page.click('.toast-undo');
  expect((await today(page)).foods.length).toBe(n0);
  await page.click('[data-view=recetas]');
  await page.fill('#recSearch', 'pollo arroz');
  await expect(page.locator('#recSearch')).toBeFocused();
  await expect(page.locator('#recList .rcard').first()).toContainText('Tiene todo');
  const w0 = (await today(page)).water;
  await page.goto('/index.html?a=agua');
  expect((await today(page)).water).toBe(w0 + 1);
  expect(page.url()).not.toContain('?a=');
  await page.goto('/index.html?a=entrenar');
  await expect(page.locator('[data-tab-rut=rutina]')).toHaveClass(/active/);
});

test('sin señal: la app y la rutina funcionan sin conexión', async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.click('[data-view=rutinas]');
  await page.click('#genRoutine');
  // Las imágenes de la rutina se guardan solas
  await expect(page.locator('#offlineBox')).toContainText('Lista para entrenar sin señal', { timeout: 30000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.hello .name')).toHaveText('Benja');
  await page.click('[data-view=rutinas]');
  await expect(page.locator('.day-list .ex').first()).toBeVisible();
  const loaded = await page.$$eval('.day-list img.ex-thumb', imgs => Promise.all(imgs.map(i => i.decode().then(() => i.naturalWidth > 0, () => false))));
  expect(loaded.length).toBeGreaterThan(0);
  expect(loaded.every(Boolean)).toBe(true);
  await context.setOffline(false);
});

test('Íconos de comidas según el alimento', async ({ page }) => {
  const icons = await page.evaluate(() => ['Pechuga de pollo asada (sin piel)', 'Repollo', 'Pan amasado', 'Espinaca cruda', 'Empanada de pino (horno)', 'Tallarines con salsa boloñesa']
    .map(n => foodIcon(allFoods().find(f => f.name === n))));
  expect(icons).toEqual(['🍗', '🥬', '🍞', '🥬', '🥟', '🍝']);
  await expect(page.locator('.meal .fi').first()).toBeVisible();
  await page.click('[data-view=comidas]');
  await expect(page.locator('#foodList .fi').first()).toHaveText('🍗');
});

test('Más entrenamientos: tipos de rutina y entrenamiento suelto', async ({ page }) => {
  await page.click('[data-view=rutinas]');
  await page.waitForSelector('#genRoutine');
  for (const [prog, dias, first] of [['ppl', 3, 'Empuje'], ['bro', 5, 'Pecho'], ['gluteos', 3, 'Glúteos'], ['fuerza', 2, 'Fuerza A'], ['circuito', 3, 'Circuito A'], ['torso', 4, 'Torso']]) {
    if (!(await page.locator('#rProg').count())) await page.click('#cfgToggle');
    await page.selectOption('#rProg', prog);
    await page.selectOption('#rDias', String(dias));
    await page.selectOption('#rEq', 'gym');
    await page.click('#genRoutine');
    const r = (await state(page)).routine;
    expect(r.programa).toBe(prog);
    expect(r.days).toHaveLength(dias);
    expect(r.days[0].name).toContain(first);
    expect(r.days.every(d => d.exercises.filter(x => !x.warm && !x.stretch).length >= 3)).toBe(true);
  }
  // La rutina de fuerza usa los básicos con barra a 5×5
  await page.click('#cfgToggle');
  await page.selectOption('#rProg', 'fuerza');
  await page.selectOption('#rDias', '3');
  await page.click('#genRoutine');
  const f = (await state(page)).routine.days[0].exercises.filter(x => !x.warm && !x.stretch);
  expect(f.map(x => x.ex).slice(0, 3)).toEqual(['squat', 'bench-press', 'barbell-row']);
  expect(f[0]).toMatchObject({ series: 5, reps: '5' });
  // Fuera del gimnasio la de fuerza no aplica
  await page.click('#cfgToggle');
  await page.selectOption('#rEq', 'casa');
  await page.click('#genRoutine');
  expect((await state(page)).routine.programa).toBe('auto');
  // Entrenamiento suelto: no cambia la rutina y suma la actividad del día
  const before = JSON.stringify((await state(page)).routine);
  await page.click('[data-quick-w=core]');
  await page.click('#qkNew');
  await page.click('#qkGo');
  await page.click('[data-set="0"]');
  while (await page.locator('#wNext').count()) await page.click('#wNext');
  await page.click('#wFinish');
  await page.click('#okW');
  expect(JSON.stringify((await state(page)).routine)).toBe(before);
  expect((await today(page)).exercises.some(e => e.name === 'Entrenamiento: Core 15 min')).toBe(true);
});

test('Déficit: balance, ritmo, meta, avisos y semana de mantención', async ({ page }) => {
  // Ritmo: cambia la meta de calorías
  const kc = await page.evaluate(() => ['suave', 'moderado', 'rapido'].map(r => { state.profile.ritmo = r; return Math.round(calcTargets().kcal); }));
  expect(kc[0] - kc[1]).toBe(200);
  expect(kc[1] - kc[2]).toBe(250);
  await page.evaluate(() => { state.profile.ritmo = 'moderado'; });
  // Hoy muestra el balance de ayer y de la semana
  await page.reload();
  await expect(page.locator('.deficit-card')).toContainText('Últimos 7 días');
  // El déficit de un día es gasto + ejercicio − comida
  const d = await page.evaluate(() => { const k = shiftKey(todayKey(), -1), t = totals(state.days[k]), tg = calcTargets(); return [dayDeficit(k, tg), tg.tdee + t.burned - t.kcal]; });
  expect(d[0]).toBeCloseTo(d[1], 5);
  await page.click('[data-prog-tab=deficit]');
  await expect(page.locator('.def-chart .dc')).toHaveCount(14);
  // Meta y proyección
  await page.fill('#dMeta', '75');
  await page.selectOption('#dRitmo', 'suave');
  await page.click('#dSave');
  const p = (await state(page)).profile;
  expect(p).toMatchObject({ meta: 75, ritmo: 'suave' });
  await expect(page.locator('.result-box').first()).toContainText(/semanas|no te acercas/);
  // Aviso de déficit muy agresivo: 7 días comiendo 600 kcal
  await page.evaluate(() => { for (let i = 1; i <= 7; i++) state.days[shiftKey(todayKey(), -i)] = { foods: [{ id: 'x' + i, name: 'x', meal: 'almuerzo', kcal: 600, p: 40, c: 60, g: 20 }], exercises: [], water: 8 }; save(); render(); });
  await expect(page.locator('.warn-box').first()).toContainText(/Más de 1.000 kcal|metabolismo basal/);
  // Semana de mantención: la meta pasa a ser el gasto
  await page.evaluate(() => { state.dietBreak = { from: todayKey(), until: shiftKey(todayKey(), 6) }; });
  expect(await page.evaluate(() => Math.round(calcTargets().kcal) === Math.round(calcTargets().tdee))).toBe(true);
});

test('Desafíos de 30 días y resumen semanal', async ({ page }) => {
  await page.click('[data-view=progreso]');
  await page.click('[data-tab-prog=logros]');
  await page.click('[data-start-ch=pasos]');
  await page.click('[data-start-ch=agua]');
  await page.click('[data-check-ch=pasos]');
  const c = (await state(page)).challenges.find(x => x.id === 'pasos');
  expect(Object.keys(c.checks)).toHaveLength(1);
  await page.click('[data-view=hoy]');
  await expect(page.locator('.card', { hasText: 'Desafíos' })).toContainText('10.000 pasos');
  // Un desafío que empezó hace 31 días y se cumplió se cierra como ganado
  await page.evaluate(() => {
    const start = shiftKey(todayKey(), -31), checks = {};
    for (let i = 0; i < 30; i++) checks[shiftKey(start, i)] = true;
    state.challenges.push({ id: 'sueno', start, checks }); save(); render();
  });
  const s = (await state(page)).challenges.find(x => x.id === 'sueno');
  expect(s).toMatchObject({ closed: true, won: true });
  // Resumen semanal: aparece solo una vez por semana
  await page.evaluate(() => { state.weeklySeen = null; save(); });
  await page.reload();
  await expect(page.locator('.weekly')).toBeVisible();
  await page.click('#wkOk');
  await page.reload();
  await page.waitForTimeout(1000);
  await expect(page.locator('.weekly')).toHaveCount(0);
});

test('Leer la etiqueta nutricional con la cámara (OCR)', async ({ page }) => {
  test.setTimeout(120000);
  await page.click('[data-view=comidas]');
  await page.click('#newFood');
  await page.setInputFiles('#cfPhoto', require('path').join(__dirname, 'assets', 'etiqueta.png'));
  await expect(page.locator('#cfStatus')).toContainText('Leí 4 de 4', { timeout: 90000 });
  expect(await page.inputValue('#cfKcal')).toBe('420');
  expect(await page.inputValue('#cfP')).toBe('8.5');
  expect(await page.inputValue('#cfG')).toBe('15.2');
  expect(await page.inputValue('#cfC')).toBe('62');
  expect(await page.inputValue('#cfPor')).toBe('30');
  // El intérprete también entiende etiquetas con la porción primero o con kJ
  const r = await page.evaluate(() => [
    parseLabel('Porción 200 ml\n 1 porción 100 ml\nEnergía (kcal) 130 65\nProteínas (g) 6,4 3,2\nGrasa total (g) 3,0 1,5\nHidratos de carbono disponibles (g) 19,6 9,8'),
    parseLabel('Por 100 g\nEnergía 1760 kJ / 420 kcal\nGrasas 15 g\nde las cuales saturadas 6 g\nHidratos de carbono 62 g\nProteínas 8.5 g'),
  ]);
  expect(r[0]).toMatchObject({ kcal: 65, p: 3.2, g: 1.5, c: 9.8, por: 200 });
  expect(r[1]).toMatchObject({ kcal: 420, p: 8.5, g: 15, c: 62 });
});

test('Combos y ayuno intermitente', async ({ page }) => {
  // Guardar el desayuno de hoy (avena + plátano) como combo
  await page.click('[data-save-combo=desayuno]');
  await page.fill('#cbName', 'Desayuno de siempre');
  await page.click('#cbSave');
  expect((await state(page)).combos).toHaveLength(1);
  await page.click('[data-view=comidas]');
  await page.click('[data-pick-meal=snack]');
  await page.click('[data-cat="🍱 Combos"]');
  const n0 = (await today(page)).foods.length;
  await page.click('[data-combo-add]');
  const foods = (await today(page)).foods;
  expect(foods.length).toBe(n0 + 2);
  expect(foods.slice(-2).every(f => f.meal === 'snack')).toBe(true);
  // Ayuno: se activa en Perfil y aparece en Hoy
  await page.click('.page-head [data-go=perfil]');
  await page.selectOption('#fastPlan', '16');
  await page.check('#fastOn');
  await page.click('[data-view=hoy]');
  await page.click('#fastStart');
  expect((await state(page)).fasting.start).toBeGreaterThan(0);
  await expect(page.locator('.fast-card')).toContainText('En ayuno');
  // Simulamos que empezó hace 17 horas: la meta está cumplida
  await page.evaluate(() => { state.fasting.start = Date.now() - 17 * 3600000; render(); });
  await expect(page.locator('#fastMsg')).toContainText('Meta cumplida');
  await page.click('#fastEnd');
  const f = (await state(page)).fasting;
  expect(f.start).toBeNull();
  expect(f.log.at(-1).ok).toBe(true);
});

test('Entrenamiento: historial, semana de descarga y cronómetro de cardio', async ({ page }) => {
  // Historial del press de banca (los datos de prueba traen 10 sesiones)
  expect(await page.evaluate(() => exHistory('bench-press').length)).toBe(5);
  await page.click('[data-view=rutinas]');
  await page.waitForSelector('#genRoutine');
  await page.selectOption('#rEq', 'gym');
  await page.click('#genRoutine');
  await page.click('[data-quick-w=fuerza]');
  await page.click('#qkGo');
  for (let i = 0; i < 6 && !(await page.locator('#wk h2', { hasText: 'Press de Banca con Barra' }).count()); i++) await page.click('#wNext');
  await page.click('summary:has-text("Historial")');
  await expect(page.locator('.hist-row')).toHaveCount(5);
  await page.click('#wQuit');
  // Semana de descarga: al completar la semana 4 llega la 5, de descarga
  await page.evaluate(() => { state.routine.week = 4; state.routine.days.forEach((d, i) => { if (!d.done) setDayDone(i); }); save(); render(); });
  const r = (await state(page)).routine;
  expect(r).toMatchObject({ week: 5, deload: true });
  await expect(page.locator('.warn-box', { hasText: 'Semana de descarga' })).toBeVisible();
  const lens = await page.evaluate(() => {
    startWorkout(0);
    const ses = JSON.parse(localStorage.getItem('fitplan-session'));
    return state.routine.days[0].exercises.map((x, k) => [x.series, ses.sets[k].length, !!(x.warm || x.stretch)]);
  });
  expect(lens.filter(([, , w]) => !w).every(([a, b]) => b < a)).toBe(true);
  await page.click('#wQuit');
  // Cronómetro: 30 minutos trotando, 5 km → 6:00 min/km
  await page.click('[data-tab-rut=actividad]');
  await page.click('[data-cardio-act=trotar]');
  await page.click('#cdStart');
  await expect(page.locator('#cdT')).toBeVisible();
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('fitplan-cardio')); c.start = Date.now() - 30 * 60000; localStorage.setItem('fitplan-cardio', JSON.stringify(c)); render(); });
  await page.click('#cdStop');
  await page.fill('#cdKm', '5');
  await expect(page.locator('#cdPace')).toContainText('6:00 min/km');
  await page.click('#cdSave');
  const ex = (await today(page)).exercises.at(-1);
  expect(ex).toMatchObject({ minutes: 30, km: 5 });
  expect(ex.name).toContain('6:00 min/km');
});

test('Varias personas en el mismo teléfono', async ({ page }) => {
  await page.click('#avatarBtn');
  await page.fill('#newProf', 'Sofía');
  await Promise.all([page.waitForEvent('load'), page.click('#addProf')]);
  // Perfil nuevo: empieza vacío, en la bienvenida y con su nombre puesto
  await expect(page.locator('#pNombre')).toHaveValue('Sofía');
  await page.fill('#pPeso', '60');
  await page.fill('#pAltura', '165');
  await page.selectOption('#pSexo', 'm');
  await page.click('#saveProfile');
  await expect(page.locator('.hello .name')).toHaveText('Sofía');
  expect(Object.keys((await state(page)).days)).toHaveLength(0);
  const idx = await page.evaluate(() => profilesIndex());
  expect(idx.list.map(p => p.name)).toEqual(['Benja', 'Sofía']);
  // Volver a Benja: sus datos siguen ahí
  await page.click('#avatarBtn');
  await Promise.all([page.waitForEvent('load'), page.click(`[data-switch="p1"]`)]);
  await expect(page.locator('.hello .name')).toHaveText('Benja');
  expect(Object.keys((await state(page)).days).length).toBeGreaterThan(10);
  // Eliminar a Sofía desde Perfil
  await page.click('.hello [data-go=perfil]');
  await page.click('[data-del-p]');
  expect((await page.evaluate(() => profilesIndex())).list).toHaveLength(1);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fitplan-v1-')))).toEqual([]);
});

test('Coach: chat con IA (simulada), contexto sin datos personales y coach básico de respaldo', async ({ page }) => {
  // IA simulada: devuelve la respuesta por partes, como la real
  await page.evaluate(() => {
    window.__asked = [];
    window.FitSync.ask = async ({ message, history, system, onChunk }) => {
      window.__asked.push({ message, history, system });
      const txt = '**¡Bien hecho!** Registraste todos los días.\n- Sube la proteína en el desayuno.';
      onChunk(txt.slice(0, 10)); await new Promise(r => setTimeout(r, 50)); onChunk(txt);
      return txt;
    };
  });
  await page.click('#coachBtn');
  await expect(page.locator('.coach-log .msg.model').first()).toContainText('Conozco tus registros');
  await page.click('[data-q=bien]');
  await expect(page.locator('.msg.model').last()).toContainText('¡Bien hecho!');
  await expect(page.locator('.msg.model b').last()).toHaveText('¡Bien hecho!');
  // El mensaje lleva los datos, pero no el nombre de la persona
  const asked = await page.evaluate(() => window.__asked[0]);
  expect(asked.message).toContain('Metas diarias');
  expect(asked.message).toContain('Últimos 7 días');
  expect(asked.message).not.toContain('Benja');
  expect(asked.system).toContain('español de Chile');
  // Pregunta escrita: el historial anterior viaja con ella
  await page.fill('#cMsg', '¿Qué ceno hoy?');
  await page.press('#cMsg', 'Enter');
  await expect(page.locator('.msg.user').last()).toHaveText('¿Qué ceno hoy?');
  expect(await page.evaluate(() => window.__asked[1].history.length)).toBe(2);
  // Mientras responde no se puede mandar otra pregunta
  await expect(page.locator('[data-q=mejorar]')).toBeDisabled();
  await expect(page.locator('.msg.model').last()).toContainText('Sube la proteína');
  await expect(page.locator('.msg.model')).toHaveCount(2); // el saludo inicial se reemplaza por la conversación
  await expect(page.locator('[data-q=mejorar]')).toBeEnabled();
  // Si la IA falla (por ejemplo, sin iniciar sesión), responde el coach básico
  await page.evaluate(() => { window.FitSync.ask = async () => { const e = new Error('auth'); e.code = 'auth'; throw e; }; });
  await page.click('[data-q=mejorar]');
  await expect(page.locator('.msg.model').last()).toContainText('inicia sesión con Google');
  // El chat queda guardado en el teléfono
  expect(await page.evaluate(() => coachLog().length)).toBe(6);
  // Si Firebase rechaza la petición, se muestra el motivo y el detalle técnico para revisarlo
  await page.evaluate(() => { window.FitSync.ask = async () => { throw new Error('[403] PERMISSION_DENIED: Firebase AI Logic API has not been used in project'); }; });
  await page.click('[data-q=meta]');
  await expect(page.locator('.msg.model').last()).toContainText('Falta activar la IA en Firebase');
  await expect(page.locator('.msg.model').last()).toContainText('Detalle técnico: [403] PERMISSION_DENIED');
  const basic = await page.evaluate(() => basicCoach('semana'));
  expect(basic.some(x => x.startsWith('✅')) || basic.some(x => x.startsWith('💡'))).toBe(true);
});
