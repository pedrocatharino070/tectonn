// TecTonn - Service Worker
// Páginas: rede primeiro (atualizações chegam sozinhas), com cache de reserva para uso offline.
const VERSAO = 'tectonn-v3';
const ARQUIVOS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './logo.jpg', './fonte-tectonn.ttf'];
const CDN = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSAO);
    await Promise.allSettled(ARQUIVOS.map(u => c.add(u)));
    await Promise.allSettled(CDN.map(u => c.add(new Request(u, { mode: 'no-cors' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const host = new URL(req.url).hostname;

  // Nunca interceptar o banco (Supabase) nem o Apps Script/Google
  if (host.endsWith('supabase.co') || host.endsWith('google.com') || host.endsWith('googleusercontent.com')) return;

  // Abrir o app: tenta a rede (até 4s); se estiver sem sinal ou lento, usa a cópia salva
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const limite = new Promise((_, rej) => setTimeout(() => rej(new Error('lento')), 4000));
        const r = await Promise.race([fetch(req), limite]);
        const copia = r.clone();
        caches.open(VERSAO).then(c => c.put('./index.html', copia));
        return r;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }

  // Ícones, manifest e biblioteca do Supabase: cache primeiro
  e.respondWith((async () => {
    const guardado = await caches.match(req);
    if (guardado) return guardado;
    const r = await fetch(req);
    if (r && (r.ok || r.type === 'opaque')) {
      const copia = r.clone();
      caches.open(VERSAO).then(c => c.put(req, copia));
    }
    return r;
  })());
});
