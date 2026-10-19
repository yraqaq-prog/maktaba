// Keeps the app working with no internet. The idea model itself is cached separately by the model library.
const VERSION='maktaba-v4';
const FILES=['./','index.html','app.js','embed-worker.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png',
  'pdf.min.js','pdf.worker.min.js','jszip.min.js','mammoth.browser.min.js','transformers.min.js',
  'ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())) });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('maktaba-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())) });
self.addEventListener('fetch',e=>{
  const req=e.request, url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin) return;
  e.respondWith((async()=>{
    const cache=await caches.open(VERSION);
    const hit=await cache.match(req,{ignoreSearch:true}) || (req.mode==='navigate'?await cache.match('index.html'):null);
    if(hit) return hit;
    try{ const res=await fetch(req); if(res.ok) cache.put(req,res.clone()); return res }
    catch(err){ return new Response('Offline',{status:503}) }
  })());
});
