const CACHE='baseball-notes-shell-v2';
const SHELL=['/','/index.html','/styles.css','/app.js','/api.js','/core.js','/db.js','/pwa.js','/favicon.svg','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable.png','/icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('baseball-notes-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // API結果と個人のメモはService Workerに保存しない。
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));
    return;
  }
  if(!SHELL.includes(url.pathname))return;
  event.respondWith(caches.open(CACHE).then(async cache=>await cache.match(url.pathname)||fetch(request)));
});
