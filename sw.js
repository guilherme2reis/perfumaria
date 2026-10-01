const CACHE = 'perfumaria';
const ARQUIVOS = [
  './', './index.html', './style.css', './app.js', './manifest.json',
  './icon-192.png', './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ARQUIVOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Rede primeiro, cache como reserva: com internet o app sempre abre na versão mais nova
// publicada no GitHub; sem internet, abre a última que foi guardada.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((resposta) => {
        if (resposta.ok && new URL(event.request.url).origin === self.location.origin) {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
