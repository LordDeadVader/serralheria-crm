/*
 * Service worker do CRM (app instalável). Escopo: /crm/ — o site público não é afetado.
 * - Arquivos versionados (/crm/assets/*): cache primeiro (nunca mudam de conteúdo).
 * - Páginas do app: rede primeiro, com a última versão em cache como reserva (abre mesmo sem sinal).
 * - API e imagens: sempre pela rede (dados nunca ficam guardados aqui).
 */
const CACHE = 'wjr-crm-v1';
const SHELL = './';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wjr-crm-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const scope = new URL(self.registration.scope).pathname;

  if (url.pathname.startsWith(`${scope}assets/`)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === 'navigate' && url.pathname.startsWith(scope)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(SHELL, copy));
          }
          return res;
        })
        .catch(() => caches.match(SHELL)),
    );
  }
});
