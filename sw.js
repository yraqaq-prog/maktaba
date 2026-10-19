// Keeps the app working with no internet.
// Small app files are checked online first (so updates arrive at once); the big libraries are kept and never re-downloaded.
const APP='maktaba-app-v6', LIBS='maktaba-libs-v1';
const APP_FILES=['./','index.html','app.js','embed-worker.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];
const LIB_FILES=['pdf.min.js','pdf.worker.min.js','jszip.min.js','mammoth.browser.min.js','transformers.min.js','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'];
self.addEventListener('install',e=>{ e.waitUntil((async()=>{
  const app=await caches.open(APP);
  await app.addAll(APP_FILES.map(u=>new Request(u,{cache:'reload'})));
  const libs=await caches.open(LIBS), old=(await caches.keys()).filter(k=>/^maktaba-v\d+$/.test(k));
  for(const f of LIB_FILES){
    if(await libs.match(f)) continue;
    let hit=null; for(const k of old){ hit=await (await caches.open(k)).match(f); if(hit) break }
    if(hit) await libs.put(f,hit); else { try{ await libs.add(f) }catch(err){} }
  }
  await self.skipWaiting();
})()) });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('maktaba-')&&k!==APP&&k!==LIBS).map(k=>caches.delete(k)))).then(()=>self.clients.claim())) });
const isAppFile=url=>{ const p=url.pathname.split('/').pop(); return p===''||APP_FILES.includes(p) };
async function networkFirst(req){
  const cache=await caches.open(APP);
  try{
    const res=await Promise.race([fetch(req,{cache:'no-cache'}),new Promise((_,rej)=>setTimeout(()=>rej(new Error('slow')),4000))]);
    if(res.ok) cache.put(req,res.clone()); return res;
  }catch(err){
    return (await cache.match(req,{ignoreSearch:true}))||(req.mode==='navigate'?await cache.match('index.html'):null)||new Response('Offline',{status:503});
  }
}
async function cacheFirst(req){
  const hit=await caches.match(req,{ignoreSearch:true}); if(hit) return hit;
  try{ const res=await fetch(req); if(res.ok) (await caches.open(LIBS)).put(req,res.clone()); return res }
  catch(err){ return new Response('Offline',{status:503}) }
}
self.addEventListener('fetch',e=>{
  const req=e.request, url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin) return;
  e.respondWith(req.mode==='navigate'||isAppFile(url)?networkFirst(req):cacheFirst(req));
});
