const scope=new URL(self.registration.scope);
const prefix=`probalia-app:${scope.pathname}:`;
const cacheName=prefix+'5.0.4';
const shell=new Set(['./','./index.html','./manifest.webmanifest','./viewer.css','./viewer.js',
  './icons/icon.svg','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png'].map(file=>new URL(file,scope).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName)
  .then(cache=>cache.addAll([...shell].map(file=>new Request(file,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==cacheName&&(key.startsWith(prefix)||
    (scope.pathname==='/probalia/'&&key.startsWith('probalia-shell-')))).map(key=>caches.delete(key)))),self.clients.claim()
])));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==scope.origin)return;
  if(url.pathname===new URL('data/release.json',scope).pathname){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>new Response(null,{status:503})));return;
  }
  url.search='';url.hash='';
  if(shell.has(url.href)){
    event.respondWith(fetch(event.request).catch(async()=>await (await caches.open(cacheName)).match(url.href)||Response.error()));
  }
});
