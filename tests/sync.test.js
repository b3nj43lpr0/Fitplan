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
  // Modo antiguo si las reglas no permiten la subcolección
  denyParts = true;
  const C = device('C', { profile: { nombre: 'X' }, days: {}, workouts: [], _ts: 0 });
  await C.api._test.start({ uid: 'u1' }); await sleep(10);
  ok(C.state.profile.nombre === 'Benja' && /reglas/.test(C.api.state.status), 'sin permiso: usa el formato antiguo y avisa');
  console.log(fails ? `${fails} fallas` : 'Todo bien');
  process.exit(fails ? 1 : 0);
})();
