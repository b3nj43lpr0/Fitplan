// Simulación de dos dispositivos sincronizando con una Firestore falsa en memoria (node tests/sync.test.js)
const vm = require('vm'), fs = require('fs');
const code = fs.readFileSync(require('path').join(__dirname, '..', 'sync.js'), 'utf8');
const DB = {}; // path -> data
const listeners = [];
let denyParts = false;
function fakeFb() {
  const mk = (p, id) => ({ path: p, id });
  const snapOf = (path) => ({ exists: () => path in DB, data: () => DB[path], id: path.split('/').pop(), metadata: { hasPendingWrites: false } });
  const notify = (path) => listeners.forEach(l => { if (path.startsWith(l.prefix + '/')) l.cb({ docChanges: () => [{ type: 'modified', doc: snapOf(path) }] }); });
  return {
    db: {},
    doc: (db, ...seg) => mk(seg.join('/'), seg[seg.length - 1]),
    collection: (db, ...seg) => ({ prefix: seg.join('/') }),
    getDoc: async r => snapOf(r.path),
    getDocs: async c => {
      if (denyParts) { const e = new Error('denied'); e.code = 'permission-denied'; throw e; }
      const docs = Object.keys(DB).filter(k => k.startsWith(c.prefix + '/')).map(snapOf);
      return { size: docs.length, forEach: f => docs.forEach(f) };
    },
    setDoc: async (r, d) => { DB[r.path] = d; notify(r.path); },
    deleteDoc: async r => { delete DB[r.path]; },
    runTransaction: async (db, fn) => {
      // Como Firestore: si un documento leído cambió antes de escribir, se reintenta
      let writes;
      for (;;) {
        writes = []; const seen = {};
        await fn({ get: async r => { seen[r.path] = DB[r.path]; await new Promise(z => setTimeout(z, 1)); return snapOf(r.path); }, set: (r, d) => writes.push([r.path, d]) });
        if (Object.keys(seen).every(p => DB[p] === seen[p])) break;
      }
      writes.forEach(([p, d]) => { DB[p] = d; });
      // notificación asíncrona, como el servidor
      setTimeout(() => writes.forEach(([p]) => notify(p)), 5);
    },
    onSnapshot: (c, cb) => { if (c.prefix) { const l = { prefix: c.prefix, cb }; listeners.push(l); return () => listeners.splice(listeners.indexOf(l), 1); } return () => {}; },
  };
}
function device(name, initial, profileId) {
  const store = {};
  let state = JSON.parse(JSON.stringify(initial));
  const win = {
    FIREBASE_CONFIG: null,
    __fitplan: { profileId, get: () => state, replace: s => { state = { days: {}, workouts: [], ...s }; } },
    addEventListener: () => {},
  };
  const ctx = { window: win, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } }, setTimeout, clearTimeout, console, Math, JSON, Date };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const api = win.FitSync;
  api._test.inject(fakeFb());
  return { name, api, get state() { return state; }, set state(s) { state = s; }, store };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + msg); if (!c) fails++; };
(async () => {
  // Formato antiguo en la nube (migración)
  DB['users/u1'] = { data: JSON.stringify({ profile: { nombre: 'Benja' }, days: { '2026-09-30': { foods: [{ id: 'f0', kcal: 100 }], exercises: [], water: 2 } }, workouts: [{ id: 'w0', d: '2026-09-30', ex: [] }], _ts: 1 }), ts: 1 };
  const A = device('A', { profile: { nombre: 'Benja' }, days: { '2026-10-20': { foods: [{ id: 'f1', kcal: 500 }], exercises: [], water: 3 } }, workouts: [], _ts: 2 });
  await A.api._test.start({ uid: 'u1' });
  await sleep(20);
  ok(Object.keys(DB).some(k => k === 'users/u1/parts/m2026-10') && 'users/u1/parts/m2026-09' in DB && 'users/u1/parts/base' in DB, 'migración crea base y documentos por mes');
  ok(A.state.days['2026-09-30'] && A.state.days['2026-10-20'], 'A fusiona lo local con lo antiguo');

  // B entra por primera vez con datos propios
  const B = device('B', { profile: { nombre: 'Benja' }, days: { '2026-10-21': { foods: [{ id: 'f2', kcal: 300 }], exercises: [], water: 1 } }, workouts: [], _ts: 3 });
  await B.api._test.start({ uid: 'u1' });
  await sleep(30);
  ok(B.state.days['2026-10-20'] && B.state.days['2026-10-21'] && B.state.days['2026-09-30'], 'B recibe todo y suma lo suyo');
  ok(A.state.days['2026-10-21'], 'A recibe el día nuevo de B en vivo');
  ok(A.state.workouts.length === 1 && B.state.workouts.length === 1, 'entrenamiento antiguo llega a ambos');

  // Ediciones concurrentes en el MISMO mes, días distintos (antes se perdía una)
  A.state = { ...A.state, days: { ...A.state.days, '2026-10-20': { foods: [{ id: 'f1', kcal: 500 }, { id: 'f3', kcal: 200 }], exercises: [], water: 3 } } };
  B.state = { ...B.state, days: { ...B.state.days, '2026-10-21': { foods: [{ id: 'f2', kcal: 300 }], exercises: [], water: 8 } } };
  await Promise.all([A.api._test.push(), B.api._test.push()]);
  await sleep(30);
  for (const D of [A, B]) {
    ok(D.state.days['2026-10-20'].foods.length === 2 && D.state.days['2026-10-21'].water === 8, `${D.name}: se conservan ambos cambios del mismo mes`);
  }
  // MISMO día en los dos dispositivos a la vez (teléfono anota comida, PC anota otra cosa): no se pierde nada
  A.state = { ...A.state, days: { ...A.state.days, '2026-10-20': { ...A.state.days['2026-10-20'], foods: [...A.state.days['2026-10-20'].foods, { id: 'tel1', kcal: 450 }] } } };
  B.state = { ...B.state, days: { ...B.state.days, '2026-10-20': { ...B.state.days['2026-10-20'], foods: [...B.state.days['2026-10-20'].foods, { id: 'pc1', kcal: 120 }], water: 5 } } };
  await Promise.all([A.api._test.push(), B.api._test.push()]);
  await sleep(80);
  for (const D of [A, B]) {
    const ids = D.state.days['2026-10-20'].foods.map(f => f.id);
    ok(ids.includes('tel1') && ids.includes('pc1') && D.state.days['2026-10-20'].water === 5, `${D.name}: mismo día editado en ambos: se juntan las comidas de los dos`);
  }
  // Un dispositivo cambió el día sin conexión y la nube tiene otra versión: al reconectar se juntan
  B.state = { ...B.state, days: { ...B.state.days, '2026-10-22': { foods: [{ id: 'off1', kcal: 300 }], exercises: [], water: 1 } } };
  A.state = { ...A.state, days: { ...A.state.days, '2026-10-22': { foods: [{ id: 'on1', kcal: 200 }], exercises: [{ id: 'e1', kcal: 100 }], water: 0 } } };
  await A.api._test.push(); await sleep(30);
  await B.api._test.push(); await sleep(80);
  for (const D of [A, B]) {
    const x = D.state.days['2026-10-22'];
    ok(x && x.foods.length === 2 && x.exercises.length === 1 && x.water === 1, `${D.name}: día anotado sin conexión se junta con la nube`);
  }
  // Alimentos propios creados en los dos a la vez
  A.state = { ...A.state, customFoods: [...(A.state.customFoods || []), { id: 'cA', name: 'Uno' }] };
  B.state = { ...B.state, customFoods: [...(B.state.customFoods || []), { id: 'cB', name: 'Dos' }] };
  await Promise.all([A.api._test.push(), B.api._test.push()]);
  await sleep(80);
  ok([A, B].every(D => (D.state.customFoods || []).length === 2), 'alimentos propios creados en ambos se conservan');
  // Aviso en vivo cortado (PC suspendido): al volver a la app, refresh() trae lo nuevo
  const saved = listeners.splice(0);
  A.state = { ...A.state, days: { ...A.state.days, '2026-10-23': { foods: [{ id: 'z1', kcal: 99 }], exercises: [], water: 0 } } };
  await A.api._test.push(); await sleep(30);
  ok(!B.state.days['2026-10-23'], 'sin aviso en vivo, B todavía no lo tiene');
  await B.api._test.refresh();
  ok(B.state.days['2026-10-23'] && B.state.days['2026-10-23'].foods[0].id === 'z1' && /Sincronizado/.test(B.api.state.status) && B.api.state.last > 0, 'al volver a la app, B trae lo nuevo de la nube');
  listeners.push(...saved);
  // Cambio en base (perfil) en A y en un día en B al mismo tiempo
  A.state = { ...A.state, profile: { nombre: 'Benjamín' } };
  B.state = { ...B.state, days: { ...B.state.days, '2026-10-21': { ...B.state.days['2026-10-21'], water: 9 } } };
  await Promise.all([A.api._test.push(), B.api._test.push()]);
  await sleep(30);
  ok(B.state.profile.nombre === 'Benjamín' && A.state.days['2026-10-21'].water === 9, 'perfil y día cambian en paralelo sin pisarse');
  // Borrar un día en A
  const d = { ...A.state.days }; delete d['2026-09-30'];
  A.state = { ...A.state, days: d };
  await A.api._test.push(); await sleep(30);
  ok(!B.state.days['2026-09-30'], 'borrar un día se propaga');
  // Entrenamiento nuevo en B
  B.state = { ...B.state, workouts: [...B.state.workouts, { id: 'w1', d: '2026-10-21', ex: [] }] };
  await B.api._test.push(); await sleep(30);
  ok(A.state.workouts.some(w => w.id === 'w1'), 'entrenamiento nuevo llega');
  // Reabrir A (ya tiene registro de sincronización)
  const A2store = A.store;
  ok(Object.keys(JSON.parse(A2store['fitplan-sync2-u1'])).length > 3, 'A guarda el registro de sincronización');
  // Otro perfil del mismo teléfono con la misma cuenta: espacio propio, sin mezclar datos
  const P2 = device('P2', { profile: { nombre: 'Sofía' }, days: { '2026-10-21': { foods: [{ id: 's1', kcal: 222 }], exercises: [], water: 2 } }, workouts: [], _ts: 5 }, 'p2');
  await P2.api._test.start({ uid: 'u1' }); await sleep(30);
  ok(P2.state.profile.nombre === 'Sofía' && !P2.state.days['2026-10-20'], 'perfil 2 no recibe los datos del perfil 1');
  ok(Object.keys(DB).some(k => k.startsWith('users/u1/parts_p2/')), 'perfil 2 guarda en su propia colección');
  ok(A.state.profile.nombre === 'Benjamín' && !A.state.days['2026-10-21'].foods.some(f => f.id === 's1'), 'perfil 1 no recibe los datos del perfil 2');
  // Respaldos: copia completa en trozos, se lee igual, se guardan las últimas 8 y el automático es semanal
  const bk = await A.api.backups.create('manual');
  const back = await A.api.backups.load(bk.id);
  ok(JSON.stringify(back) === JSON.stringify(A.state) && bk.days === Object.keys(A.state.days).length, 'respaldo: se guarda y se recupera igual');
  for (let i = 0; i < 9; i++) await A.api.backups.create('manual');
  const all = await A.api.backups.list();
  ok(all.length === 8 && Object.keys(DB).filter(k => k.startsWith('users/u1/backupChunks/')).length === 8, 'respaldo: quedan las últimas 8 (con sus trozos)');
  const n0 = all.length;
  await A.api._test.autoBackup();
  ok((await A.api.backups.list()).length === n0 && (await A.api.backups.list())[0].created === all[0].created, 'respaldo semanal: no se repite si hay uno de esta semana');
  ok(!Object.keys(DB).some(k => k.startsWith('users/u1/backups_p2/')), 'respaldo: cada perfil en su propia colección');
  // Modo antiguo si las reglas no permiten la subcolección
  denyParts = true;
  const C = device('C', { profile: { nombre: 'X' }, days: {}, workouts: [], _ts: 0 });
  await C.api._test.start({ uid: 'u1' }); await sleep(10);
  ok(C.state.profile.nombre === 'Benja' && /reglas/.test(C.api.state.status), 'sin permiso: usa el formato antiguo y avisa');
  console.log(fails ? `${fails} fallas` : 'Todo bien');
  process.exit(fails ? 1 : 0);
})();
