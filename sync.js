// Sincronización opcional con Firebase (Auth con Google + Firestore, plan Spark gratuito).
// Un documento por usuario: users/{uid} = { data: <estado en JSON>, ts: <última modificación> }
(function () {
  'use strict';
  const V = '10.12.2';
  const BASE = `https://www.gstatic.com/firebasejs/${V}/`;
  const cfg = window.FIREBASE_CONFIG;
  const listeners = new Set();
  const S = { enabled: !!cfg, user: null, status: cfg ? 'Sin iniciar sesión' : 'No configurada', busy: false };
  let fb = null, ref = null, pushTimer = null, applying = false, unsub = null;

  function emit() { listeners.forEach(f => { try { f(S); } catch (e) { /* ignorar */ } }); }
  function set(patch) { Object.assign(S, patch); emit(); }
  const getState = () => window.__fitplan.get();
  const ts = s => (s && s._ts) || 0;

  // Fusión para el primer inicio de sesión en un dispositivo con datos en ambos lados:
  // lo más reciente manda en los datos sueltos y se unen días, alimentos y registros por id.
  function merge(a, b) {
    const [newer, older] = ts(a) >= ts(b) ? [a, b] : [b, a];
    const out = { ...older, ...newer };
    const days = {};
    for (const k of new Set([...Object.keys(older.days || {}), ...Object.keys(newer.days || {})])) {
      const x = (older.days || {})[k], y = (newer.days || {})[k];
      if (!x || !y) { days[k] = y || x; continue; }
      const byId = (p, q) => { const m = new Map(); [...p, ...q].forEach(i => m.set(i.id || JSON.stringify(i), i)); return [...m.values()]; };
      days[k] = { ...x, ...y, foods: byId(x.foods || [], y.foods || []), exercises: byId(x.exercises || [], y.exercises || []), water: Math.max(x.water || 0, y.water || 0) };
    }
    out.days = days;
    const uniq = (p, q, key) => { const m = new Map(); [...(p || []), ...(q || [])].forEach(i => m.set(key(i), i)); return [...m.values()]; };
    out.customFoods = uniq(older.customFoods, newer.customFoods, i => i.id || i.name);
    out.weights = uniq(older.weights, newer.weights, i => i.d).sort((m, n) => (m.d < n.d ? -1 : 1));
    out.measures = uniq(older.measures, newer.measures, i => JSON.stringify(i));
    out.customRecipes = uniq(older.customRecipes, newer.customRecipes, i => i.id);
    out.favFoods = [...new Set([...(older.favFoods || []), ...(newer.favFoods || [])])];
    out.workouts = uniq(older.workouts, newer.workouts, i => i.id).sort((m, n) => (m.d < n.d ? -1 : 1));
    out._ts = Date.now();
    return out;
  }

  async function push() {
    if (!ref || !S.user || applying) return;
    try {
      await fb.setDoc(ref, { data: JSON.stringify(getState()), ts: ts(getState()) });
      set({ status: 'Sincronizado ✓' });
    } catch (e) { set({ status: 'Sin conexión: se enviará después' }); }
  }
  function schedulePush() {
    if (!ref || !S.user || applying) return;
    set({ status: 'Guardando…' });
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1500);
  }

  function applyRemote(snap) {
    if (!snap.exists()) { push(); return; }
    let remote;
    try { remote = JSON.parse(snap.data().data); } catch (e) { return; }
    const local = getState();
    if (ts(remote) === ts(local)) { set({ status: 'Sincronizado ✓' }); return; }
    if (ts(remote) > ts(local)) {
      applying = true;
      window.__fitplan.replace(remote);
      applying = false;
      set({ status: 'Sincronizado ✓' });
    } else {
      push();
    }
  }

  async function start(user) {
    ref = fb.doc(fb.db, 'users', user.uid);
    try {
      const snap = await fb.getDoc(ref);
      if (snap.exists()) {
        const remote = JSON.parse(snap.data().data);
        const local = getState();
        const hasLocal = local.profile || Object.keys(local.days || {}).length;
        const merged = hasLocal && ts(local) !== ts(remote) && !localStorage.getItem('fitplan-synced-' + user.uid) ? merge(local, remote) : null;
        applying = true;
        window.__fitplan.replace(merged || (ts(remote) >= ts(local) ? remote : local));
        applying = false;
      }
      localStorage.setItem('fitplan-synced-' + user.uid, '1');
      await push();
    } catch (e) { set({ status: 'Error al sincronizar (revisa las reglas de Firestore)' }); }
    unsub = fb.onSnapshot(ref, applyRemote, () => set({ status: 'Sin conexión' }));
  }

  async function init() {
    if (!cfg) return;
    try {
      const [app, auth, fs] = await Promise.all([
        import(BASE + 'firebase-app.js'), import(BASE + 'firebase-auth.js'), import(BASE + 'firebase-firestore.js'),
      ]);
      const a = app.initializeApp(cfg);
      fb = {
        auth: auth.getAuth(a), db: fs.getFirestore(a), doc: fs.doc, getDoc: fs.getDoc, setDoc: fs.setDoc, onSnapshot: fs.onSnapshot,
        GoogleAuthProvider: auth.GoogleAuthProvider, signInWithPopup: auth.signInWithPopup, signOut: auth.signOut,
      };
      auth.onAuthStateChanged(fb.auth, u => {
        if (unsub) { unsub(); unsub = null; }
        if (u) { set({ user: { name: u.displayName, email: u.email }, status: 'Conectando…' }); start(u); }
        else { ref = null; set({ user: null, status: 'Sin iniciar sesión' }); }
      });
    } catch (e) { set({ status: 'No se pudo cargar (necesita internet)' }); }
  }

  window.FitSync = {
    state: S,
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    notify: schedulePush,
    async signIn() {
      if (!fb) return;
      try { await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider()); }
      catch (e) { set({ status: 'No se pudo iniciar sesión' }); }
    },
    async signOut() { if (fb) await fb.signOut(fb.auth); },
  };
  init();
})();
