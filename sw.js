// Service worker: permite usar la app sin conexión una vez instalada
const CACHE = 'fitplan-v11';
const FILES = ['./', './index.html', './styles.css', './js/core.js', './js/hoy.js', './js/comidas.js', './js/actividad.js', './js/recetas.js', './js/entrenar.js', './js/progreso.js', './js/perfil.js', './js/main.js', './sync.js', './firebase-config.js', './data.js', './foods.js', './exercises.js', './vendor/zxing.min.js', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Solo guardamos en caché los archivos de la app y las imágenes de ejercicios
  const cacheable = url.origin === location.origin || url.href.startsWith('https://raw.githubusercontent.com/RepDB/');
  if (!cacheable) return;
  // Red primero (para recibir actualizaciones), caché si no hay conexión
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
