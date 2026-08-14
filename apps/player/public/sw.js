const SHELL='signage-shell-v12';
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(['/','/index.html'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('signage-shell-')&&key!==SHELL).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/socket.io/'))return;
  if(request.destination==='document'){
    event.respondWith(fetch(request).catch(()=>caches.match('/index.html')));
    return;
  }
  if(!['script','style','font'].includes(request.destination))return;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok)caches.open(SHELL).then(cache=>cache.put(request,response.clone()));
    return response;
  })));
});
