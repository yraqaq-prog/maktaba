'use strict';
/* Maktaba (offline): search every passage of your library by word or by idea. Everything stays on this device. */

/* ---------- Text normalization (English, French, Arabic) ---------- */
const AR_RE=/[؀-ۿ]/;
const WORD_RE=/[\p{L}\p{N}]+/gu;
const WORD_ORIG_RE=/[\p{L}\p{N}\p{M}‌]+/gu;
function norm(s){
  return s.normalize('NFKC').toLowerCase()
    .replace(/[ً-ٰٟـ]/g,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
    .normalize('NFD').replace(/[̀-ͯ]/g,'');
}
const STOP=new Set(("a an and are as at be been but by for from has have he her his i if in into is it its me my no not of on or our she so than that the their them then there these they this to was we were what when which who will with would you your "+
 "au aux avec ce ces cet cette dans de des du elle en est et eux il ils je la le les leur lui ma mais me mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous y ete etre sont fait plus tres "+
 "في من على الى إلى عن ان أن إن او أو ما لا لم لن هو هي هم هذا هذه ذلك تلك التي الذي الذين كان كانت قد ثم كل بين عند مع حتى اذا إذا لكن بل و يا").split(' ').map(norm));
const LAT_SUF=['issements','issement','ations','ation','ements','ement','ments','ment','nesses','ness','ingly','ings','ing','fully','ful','ously','ous','euses','euse','eux','ives','ive','ies','ied','edly','ed','ly','es','s','e','x'];
const AR_PRE=['وال','بال','كال','فال','لل','ال'];
const AR_SUF=['ات','ون','ين','ها','هم','يه','ان','ه','ي'];
function stem(t){
  if(AR_RE.test(t)){
    for(const p of AR_PRE) if(t.startsWith(p)&&t.length-p.length>=2){t=t.slice(p.length);break}
    for(const s of AR_SUF) if(t.endsWith(s)&&t.length-s.length>=3){t=t.slice(0,-s.length);break}
    return t;
  }
  if(t.length<=3) return t;
  for(const s of LAT_SUF) if(t.endsWith(s)&&t.length-s.length>=3){t=t.slice(0,-s.length);break}
  return t;
}
function terms(text){
  const out=[];
  for(const m of norm(text).matchAll(WORD_RE)){const w=m[0]; if(w.length<2||STOP.has(w)) continue; out.push(stem(w))}
  return out;
}
const flat=s=>' '+norm(s).replace(/[^\p{L}\p{N}]+/gu,' ').trim()+' ';
const wc=s=>(s.match(/\S+/g)||[]).length;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const tick=()=>new Promise(r=>setTimeout(r,0));
const isRtl=s=>{const ar=(s.match(/[؀-ۿ]/g)||[]).length; const lat=(s.match(/[A-Za-z]/g)||[]).length; return ar>lat};
const $=id=>document.getElementById(id);

/* ---------- Sources, in your order of authority ---------- */
const SOURCES=[
  {id:'ram',label:'Royal Air Maroc'},
  {id:'boeing',label:'Boeing 737'},
  {id:'dgac',label:'DGAC Morocco'},
  {id:'icao',label:'ICAO'},
  {id:'easa',label:'EASA'},
  {id:'faa',label:'FAA'},
  {id:'uk',label:'UK CAA'},
  {id:'airline',label:'Other airlines'},
  {id:'other',label:'Unsorted'},
  {id:'knowledge',label:'Background knowledge'},
];
const SRC_RANK=Object.fromEntries(SOURCES.map((s,i)=>[s.id,i]));
const srcLabel=id=>(SOURCES.find(s=>s.id===id)||SOURCES[8]).label;
const SRC_RULES=[
  ['ram',{test:t=>/royal\s*air\s*maroc/i.test(t)||/\bRAM\b|\bRAM[_-]|\bRAM(OM|OPS|FOM)/.test(t)}, /royal\s*air\s*maroc|الخطوط الملكية المغربية/i,1],
  ['boeing',/boeing|\bB?-?7(37|3[78M])\b|\bFCOM\b|\bFCTM\b|\bQRH\b|\bDDG\b|\bMMEL\b/i, /boeing\s*(737|commercial)|737[- ]?(600|700|800|900|MAX|8)|flight crew operations manual|quick reference handbook|flight crew training manual/i,2],
  ['dgac',/\bDGAC\b|\bRACM\b|morocc|\bmaroc\b|المغرب/i, /direction g[ée]n[ée]rale de l.aviation civile|royaume du maroc|المديرية العامة للطيران المدني/i,2],
  ['icao',/\bICAO\b|\bOACI\b|annexe?\s*\d|\bDoc\s*\d{4}\b|\bPANS\b/i, /international civil aviation organization|organisation de l.aviation civile internationale|\bICAO\b|\bOACI\b/i,4],
  ['easa',/\bEASA\b|\bAMC\b|easy access rules|part[- ]?(ORO|CAT|FCL|ORA|ARO|SPA)\b|\bCS[- ]?25\b/i, /european union aviation safety agency|\bEASA\b/i,4],
  ['faa',/\bFAA\b|advisory circular|\bAC[ _-]?\d{2,3}[-–]|14 ?CFR|\bAIM\b|\bFAR\b/i, /federal aviation administration|advisory circular|14 CFR/i,3],
  ['uk',/\bUK\s*CAA\b|\bCAA\b|\bCAP[ _-]?\d{3,4}\b/i, /UK civil aviation authority|caa\.co\.uk|\bCAP\s?\d{3,4}\b/i,3],
  ['knowledge',/mermoz|\bESMA\b|oxford|jeppesen|\bATPL\b|\bcours\b|course|textbook|manuel de|principles of flight|m[ée]t[ée]o|human performance|aviation exam|ab initio/i, /oxford aviation|jeppesen|mermoz|\bESMA\b|\bATPL\b/i,2],
  ['airline',/airlines?|airways|air\s?france|lufthansa|emirates|qatar|ryanair|easyjet|turkish|saudia|transavia|\bFOM\b|\bOM[- ]?[ABCD]\b|operations manual/i, /\bairlines\b|\bairways\b/i,4],
];
function detectSource(title,file,text){
  const name=(title||'')+' '+(file||'');
  for(const [id,tr] of SRC_RULES) if(tr.test(name)) return id;
  const hay=(text||'').slice(0,8000);
  for(const [id,,xr,min] of SRC_RULES){ const n=(hay.match(new RegExp(xr.source,'gi'))||[]).length; if(n>=min) return id }
  return 'other';
}
const srcOf=bookId=>{const b=books.find(b=>b.id===bookId); return b&&SRC_RANK[b.source]!=null?b.source:'other'};
/* What kind of passage: checklist, procedure, limitation, definition */
const KINDS=[
  ['checklist','Checklist',/\bchecklists?\b|\bQRH\b|non[- ]?normal|memory items?|\bcondition\s*:|\bobjective\s*:|\.{6,}|▶|\bNNC\b|liste de v[ée]rification|check-?list/i],
  ['procedure','Procedure',/\bprocedures?\b|proc[ée]dures?|\bPF\b|\bPM\b|pilot flying|pilot monitoring|\bcrew (shall|should|must)\b|\bthe captain (shall|should|must)\b|[ée]quipage doit|\bstep \d/i],
  ['limitation','Limitation',null],
  ['definition','Definition',/\bis defined as\b|\bdefinitions?\b|\bmeans\b|\brefers to\b|se d[ée]finit|d[ée]signe|est d[ée]fini|يقصد|تعريف/i],
];
const KIND_BOOST={checklist:1.6,procedure:1.4,limitation:1.2,definition:1.1,none:1};
const NUM_RE=/\b\d+(?:[.,]\d+)?\s?(?:ft|feet|NM|nm|kts?|knots|min(?:utes)?|hours?|h\b|°\s?C|%|km|hPa|mb|FL\s?\d{2,3}|m\b)/gi;
function kindOf(text){
  for(const [id,,re] of KINDS){
    if(id==='limitation'){ if((text.match(NUM_RE)||[]).length>=2||/\blimitations?\b|\bminimums?\b|\bmaximum\b|\bnot exceed\b|\bprohibited\b|\binterdit\b|\bne doit pas d[ée]passer\b/i.test(text)) return id; continue }
    if(re.test(text)) return id;
  }
  return 'none';
}
const kindLabel=k=>(KINDS.find(x=>x[0]===k)||[,''])[1];

/* ---------- Library state + word index ---------- */
let books=[], passages=[], byBook=new Map(), index=new Map(), lens=[], flats=[], avgLen=1, vocab=null;
let selected=new Set(), usingSamples=false;

function rebuildIndex(){
  index=new Map(); lens=[]; flats=[]; byBook=new Map(); vocab=null;
  let total=0;
  passages.forEach((p,i)=>{
    if(!byBook.has(p.bookId)) byBook.set(p.bookId,[]);
    byBook.get(p.bookId).push(i);
    const ts=terms(p.text); lens[i]=ts.length; total+=ts.length; flats[i]=flat(p.text);
    const tf=new Map(); for(const t of ts) tf.set(t,(tf.get(t)||0)+1);
    for(const [t,n] of tf){let e=index.get(t); if(!e){e={ids:[],tfs:[]};index.set(t,e)} e.ids.push(i); e.tfs.push(n)}
  });
  avgLen=passages.length?total/passages.length:1;
}
function getVocab(){ if(!vocab) vocab=[...index.keys()].sort(); return vocab }
function variants(st){
  const v=new Map([[st,1]]);
  if(st.length>=4){
    const pre=st.length>=6?st.slice(0,-1):st, voc=getVocab();
    let lo=0,hi=voc.length; while(lo<hi){const m=(lo+hi)>>1; if(voc[m]<pre) lo=m+1; else hi=m}
    for(let i=lo,k=0;i<voc.length&&voc[i].startsWith(pre)&&k<40;i++,k++) if(voc[i]!==st) v.set(voc[i],.6);
  }
  return v;
}
function parseQuery(q){
  const phrases=[], excl=[], words=[], plain=[];
  q=q.replace(/["«»“”]([^"«»“”]+)["«»“”]/g,(_,p)=>{phrases.push(p);plain.push(p);return ' '});
  for(const w of q.split(/\s+/)){ if(!w) continue; if(w.startsWith('-')&&w.length>1) excl.push(...terms(w.slice(1))); else {words.push(...terms(w)); plain.push(w)} }
  return {phrases,excl,words,plain:plain.join(' ')};
}
function wordSearch(q,all){
  const {phrases,excl,words}=parseQuery(q);
  const groups=[];
  for(const w of new Set(words)) groups.push(variants(w));
  for(const ph of phrases) for(const w of new Set(terms(ph))) groups.push(new Map([[w,1]]));
  const N=passages.length, k1=1.4, b=.72;
  const score=new Map(), hit=new Map(), hl=new Set();
  groups.forEach((g,gi)=>{
    for(const [v,vw] of g){
      const e=index.get(v); if(!e) continue; hl.add(v);
      const idf=Math.log(1+(N-e.ids.length+.5)/(e.ids.length+.5));
      for(let k=0;k<e.ids.length;k++){
        const i=e.ids[k]; if(!selected.has(passages[i].bookId)) continue;
        const tf=e.tfs[k];
        score.set(i,(score.get(i)||0)+vw*idf*tf*(k1+1)/(tf+k1*(1-b+b*lens[i]/avgLen)));
        let h=hit.get(i); if(!h){h=new Set();hit.set(i,h)} h.add(gi);
      }
    }
  });
  const exclIds=new Set(); for(const x of excl){const e=index.get(x); if(e) e.ids.forEach(i=>exclIds.add(i))}
  const fl=phrases.map(p=>flat(p)).filter(p=>p.trim());
  const res=new Map();
  for(const [i,s] of score){
    if(exclIds.has(i)) continue;
    if(fl.length&&!fl.every(p=>flats[i].includes(p))) continue;
    const h=hit.get(i).size;
    if(all&&h<groups.length) continue;
    res.set(i,s*(1+.8*h/groups.length)+(fl.length?2:0));
  }
  for(const p of phrases) for(const w of terms(p)) hl.add(w);
  return {res,hl,exclIds,fl};
}
function highlight(text,hl){
  let out='',last=0;
  for(const m of text.matchAll(WORD_ORIG_RE)){
    const n=norm(m[0]).replace(/[^\p{L}\p{N}]/gu,'');
    if(n.length>=2&&hl.has(stem(n))){out+=esc(text.slice(last,m.index))+'<mark>'+esc(m[0])+'</mark>';last=m.index+m[0].length}
  }
  return out+esc(text.slice(last));
}

/* ---------- Storage (IndexedDB on this device) ---------- */
const store={db:null,ok:false,
  async open(){
    try{
      this.db=await new Promise((res,rej)=>{const r=indexedDB.open('maktaba-offline',1);
        r.onupgradeneeded=()=>{const d=r.result; d.createObjectStore('books',{keyPath:'id'}); d.createObjectStore('passages',{keyPath:'bookId'});
          const v=d.createObjectStore('vectors',{keyPath:'key'}); v.createIndex('book','bookId')};
        r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error)});
      this.ok=true;
      try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist() }catch(e){}
    }catch(e){this.ok=false}
  },
  req(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error)})},
  done(t){return new Promise((res,rej)=>{t.oncomplete=res; t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error)})},
  async all(name){ if(!this.ok) return []; return this.req(this.db.transaction(name).objectStore(name).getAll()) },
  async put(book,list){ if(!this.ok) return; const t=this.db.transaction(['books','passages'],'readwrite'); t.objectStore('books').put(book); if(list) t.objectStore('passages').put({bookId:book.id,list}); return this.done(t) },
  async putVec(rec){ if(!this.ok) return; const t=this.db.transaction('vectors','readwrite'); t.objectStore('vectors').put(rec); return this.done(t) },
  async vecsOf(id){ if(!this.ok) return []; const r=await this.req(this.db.transaction('vectors').objectStore('vectors').index('book').getAll(id)); return r.sort((a,b)=>a.seg-b.seg) },
  async del(id){ if(!this.ok) return; const t=this.db.transaction(['books','passages','vectors'],'readwrite'); t.objectStore('books').delete(id); t.objectStore('passages').delete(id);
    const vs=t.objectStore('vectors'); const keys=await this.req(vs.index('book').getAllKeys(id)); keys.forEach(k=>vs.delete(k)); return this.done(t) },
};

/* ---------- Idea model (runs on this device in a worker) ---------- */
const MODEL_FILE='paraphrase-multilingual-MiniLM-L12-v2/resolve/main/onnx/model_quantized.onnx';
const D=384, SEG=256;
let worker=null, modelState='absent', nextId=1; const pending=new Map();
let vecs=new Map();      // bookId -> {data:Int8Array, scale:Float32Array, owner:Int32Array}
let indexing=false, indexProgress=new Map();

async function modelCached(){
  try{ if(!('caches' in self)) return false; const c=await caches.open('transformers-cache'); const ks=await c.keys(); return ks.some(r=>r.url.includes(MODEL_FILE)) }catch(e){ return false }
}
function startWorker(){
  if(worker) return;
  worker=new Worker('embed-worker.js',{type:'module'});
  worker.onmessage=e=>{
    const m=e.data;
    if(m.type==='progress'){ const f=m.total?m.loaded/m.total:0; $('modelBar').hidden=false; $('modelBar').firstElementChild.style.width=Math.round(f*100)+'%';
      $('modelText').textContent='Downloading the idea model… '+Math.round(m.loaded/1048576)+' of '+Math.round((m.total||0)/1048576)+' MB. Keep this screen open.'; return }
    if(m.type==='ready'){ modelState='ready'; renderModel(); indexLoop(); return }
    const p=pending.get(m.id);
    if(m.type==='vecs'&&p){ pending.delete(m.id); p.res(m.data); return }
    if(m.type==='error'){
      if(p){ pending.delete(m.id); p.rej(new Error(m.message)) }
      else { modelState='error'; renderModel(m.message) }
    }
  };
  worker.onerror=e=>{ modelState='error'; renderModel(e.message||'The idea model could not start on this device.') };
}
function loadModel(){ startWorker(); modelState='loading'; renderModel(); worker.postMessage({type:'load'}) }
function embed(texts){ return new Promise((res,rej)=>{ const id=nextId++; pending.set(id,{res,rej}); worker.postMessage({type:'embed',id,texts}) }) }
function renderModel(err){
  const card=$('modelCard'), btn=$('modelBtn');
  if(modelState==='ready'){ card.hidden=true; updateNet(); return }
  card.hidden=false; btn.hidden=false; btn.disabled=false;
  if(modelState==='loading'){ btn.disabled=true; btn.textContent='Preparing…'; if(!$('modelText').textContent.startsWith('Downloading')) $('modelText').textContent='Loading the idea model…' }
  else if(modelState==='error'){ btn.textContent='Try again'; $('modelBar').hidden=true;
    $('modelText').textContent=(navigator.onLine?'The idea model couldn’t load. ':'You’re offline and the idea model hasn’t been downloaded yet. Connect once to download it. ')+(err&&navigator.onLine?'('+err+')':'') }
  else { btn.textContent='Download idea model' }
}
$('modelBtn').onclick=()=>loadModel();

/* Split a passage into overlapping windows short enough for the model (about 70 words each). */
function windowsOf(text){
  const ws=text.split(/\s+/).filter(Boolean);
  if(ws.length<=80) return [ws.join(' ')];
  const out=[]; for(let i=0;i<ws.length;i+=60){ out.push(ws.slice(i,i+70).join(' ')); if(i+70>=ws.length) break } return out;
}
const isIndexed=b=>b.sample?!!(vecs.get(b.id)&&vecs.get(b.id).complete):!!b.indexed;
async function indexLoop(){
  if(indexing||modelState!=='ready') return; indexing=true;
  try{
    for(;;){
      const b=books.find(b=>!isIndexed(b)&&!b.indexFailed); if(!b) break;
      try{ await indexBook(b) }catch(e){ b.indexFailed=true; console.error(e) }
      renderShelf();
    }
  }finally{ indexing=false; renderShelf() }
}
async function indexBook(b){
  const locals=byBook.get(b.id)||[]; const wins=[];
  locals.forEach((gi,li)=>windowsOf(passages[gi].text).forEach(t=>wins.push([li,t])));
  let st=vecs.get(b.id)||{data:new Int8Array(0),scale:new Float32Array(0),owner:new Int32Array(0)};
  const start=st.owner.length;
  for(let s=start;s<wins.length;s+=SEG){
    const part=wins.slice(s,s+SEG), n=part.length;
    const data=new Int8Array(n*D), scale=new Float32Array(n), owner=new Int32Array(n);
    for(let k=0;k<n;k+=16){
      if(!books.includes(b)) return;
      const batch=part.slice(k,k+16), f=await embed(batch.map(w=>w[1]));
      for(let j=0;j<batch.length;j++){
        let mx=1e-9; for(let d=0;d<D;d++){const v=Math.abs(f[j*D+d]); if(v>mx) mx=v}
        const sc=127/mx; scale[k+j]=sc; owner[k+j]=batch[j][0];
        for(let d=0;d<D;d++) data[(k+j)*D+d]=Math.round(f[j*D+d]*sc);
      }
      indexProgress.set(b.id,(s+k+batch.length)/wins.length); renderIndexBadge(b);
      await tick();
    }
    if(!books.includes(b)) return;
    if(!b.sample) await store.putVec({key:b.id+':'+(s/SEG),bookId:b.id,seg:s/SEG,data,scale,owner}).catch(()=>{});
    st=concatVec(st,{data,scale,owner}); vecs.set(b.id,st);
  }
  st.complete=true; vecs.set(b.id,st); indexProgress.delete(b.id);
  if(!b.sample){ b.indexed=true; await store.put(b).catch(()=>{}) }
  if($('q').value.trim()&&mode==='ideas') doSearch(true);
}
function concatVec(a,b){
  const data=new Int8Array(a.data.length+b.data.length); data.set(a.data); data.set(b.data,a.data.length);
  const scale=new Float32Array(a.scale.length+b.scale.length); scale.set(a.scale); scale.set(b.scale,a.scale.length);
  const owner=new Int32Array(a.owner.length+b.owner.length); owner.set(a.owner); owner.set(b.owner,a.owner.length);
  return {data,scale,owner};
}
async function ideaSearch(text){
  const qv=await embed([text]);
  const sims=new Map();
  for(const [bookId,st] of vecs){
    if(!selected.has(bookId)) continue;
    const g=byBook.get(bookId); if(!g) continue;
    const {data,scale,owner}=st, n=owner.length;
    for(let w=0;w<n;w++){
      let s=0; const o=w*D; for(let d=0;d<D;d++) s+=data[o+d]*qv[d];
      s/=scale[w]; const gi=g[owner[w]]; if(gi===undefined) continue;
      if(!(sims.get(gi)>=s)) sims.set(gi,s);
    }
  }
  return sims;
}

/* ---------- Reading files ---------- */
const LIBS={pdf:['pdf.min.js'],epub:['jszip.min.js'],docx:['mammoth.browser.min.js']};
const loaded={};
function loadScript(src){ return loaded[src]||(loaded[src]=new Promise((res,rej)=>{const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>{delete loaded[src];rej(new Error('Could not load the reader for this file type.'))}; document.head.appendChild(s)})) }
async function need(kind){ for(const src of LIBS[kind]) await loadScript(src); if(kind==='pdf') pdfjsLib.GlobalWorkerOptions.workerSrc='pdf.worker.min.js' }
function cleanTitle(name){ return name.replace(/\.[^.]+$/,'').replace(/[_]+/g,' ').replace(/\s+/g,' ').trim() }
function tidy(s){ return s.replace(/\r/g,'').replace(/(\p{L})-\n(?=\p{Ll})/gu,'$1').replace(/[ \t ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim() }

async function readPdf(file,progress){
  await need('pdf');
  const doc=await pdfjsLib.getDocument({data:await file.arrayBuffer(),isEvalSupported:false,useSystemFonts:true}).promise;
  let title=null, docDate=null;
  try{const m=await doc.getMetadata(); const t=m&&m.info&&m.info.Title; if(t&&t.trim().length>2&&!/microsoft word|untitled|^document/i.test(t)) title=t.trim();
    const ds=m&&m.info&&(m.info.ModDate||m.info.CreationDate); const d=ds&&pdfjsLib.PDFDateString&&pdfjsLib.PDFDateString.toDateObject(ds); if(d&&!isNaN(d)) docDate=d.getTime()}catch(e){}
  let labels=null; try{labels=await doc.getPageLabels()}catch(e){}
  const segs=[];
  for(let p=1;p<=doc.numPages;p++){
    const page=await doc.getPage(p), tc=await page.getTextContent();
    let s='', lastEnd=null;
    for(const it of tc.items){
      if(!('str' in it)) continue;
      const x=it.transform[4], fs=Math.abs(it.transform[0])||10;
      if(lastEnd!==null&&it.dir!=='rtl'&&s&&!/\s$/.test(s)&&!/^\s/.test(it.str)&&x-lastEnd>fs*.18) s+=' ';
      s+=it.str; lastEnd=x+(it.width||0);
      if(it.hasEOL){s+='\n';lastEnd=null}
    }
    const lab=labels&&labels[p-1]&&String(labels[p-1]).trim();
    segs.push({loc:'p. '+(lab||p),text:tidy(s).replace(/\n(?!\n)/g,' ')});
    page.cleanup(); progress(p/doc.numPages);
    if(p%4===0) await tick();
  }
  const units=doc.numPages; doc.destroy();
  return {title,segs,units,unitName:'pages',docDate};
}
async function readEpub(file,progress){
  await need('epub');
  const zip=await JSZip.loadAsync(await file.arrayBuffer());
  const xml=s=>new DOMParser().parseFromString(s,'application/xml');
  const cont=xml(await zip.file('META-INF/container.xml').async('string'));
  const opfPath=cont.querySelector('rootfile').getAttribute('full-path');
  const opf=xml(await zip.file(opfPath).async('string'));
  const base=opfPath.includes('/')?opfPath.slice(0,opfPath.lastIndexOf('/')+1):'';
  const tn=opf.getElementsByTagNameNS('*','title')[0]; const title=tn&&tn.textContent.trim()||null;
  const man={}; for(const it of opf.getElementsByTagNameNS('*','item')) man[it.getAttribute('id')]=it.getAttribute('href');
  const spine=[...opf.getElementsByTagNameNS('*','itemref')].map(r=>man[r.getAttribute('idref')]).filter(Boolean);
  const segs=[]; let ch=0;
  for(let k=0;k<spine.length;k++){
    const path=decodeURIComponent(new URL(spine[k],'http://x/'+base).pathname.slice(1));
    const f=zip.file(path); if(!f) continue;
    let html=await f.async('string');
    html=html.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|h[1-6]|li|blockquote|tr|section)>/gi,'$&\n\n');
    const d=new DOMParser().parseFromString(html,'text/html');
    d.querySelectorAll('script,style').forEach(n=>n.remove());
    const text=tidy(d.body?d.body.textContent:'');
    if(wc(text)<15) continue;
    ch++;
    const hEl=d.querySelector('h1,h2,h3'); const h=hEl&&hEl.textContent.replace(/\s+/g,' ').trim();
    segs.push({loc:'Ch. '+ch+(h?' · '+(h.length>48?h.slice(0,46)+'…':h):''),text:text.replace(/\n(?!\n)/g,' ')});
    progress((k+1)/spine.length); await tick();
  }
  let docDate=null;
  for(const m of opf.getElementsByTagNameNS('*','meta')) if(m.getAttribute('property')==='dcterms:modified'){const t=Date.parse(m.textContent.trim()); if(!isNaN(t)) docDate=t}
  if(!docDate){const dn=opf.getElementsByTagNameNS('*','date')[0]; const t=Date.parse(dn?dn.textContent.trim():''); if(!isNaN(t)) docDate=t}
  return {title,segs,units:ch,unitName:'chapters',docDate};
}
async function readDocx(file){ await need('docx'); const r=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()}); return {title:null,segs:[{loc:'',text:tidy(r.value)}],units:null} }
async function readText(file){
  let t=await file.text();
  if(/\.html?$/i.test(file.name)){const d=new DOMParser().parseFromString(t.replace(/<\/(p|div|h[1-6]|li)>/gi,'$&\n\n'),'text/html'); t=d.body?d.body.textContent:''}
  return {title:null,segs:[{loc:'',text:tidy(t)}],units:null};
}
/* Cut text into passages of roughly 130 words, never across a page or chapter. */
function cut(segs){
  const out=[]; let n=0;
  for(const seg of segs){
    const text=seg.text; if(!text||!text.trim()) continue;
    const parts=text.split(/\n{2,}|(?<=[.!?؟…])\s+/u).map(s=>s.trim()).filter(Boolean);
    let cur=[],cw=0,part=0; const startLen=out.length;
    const flush=()=>{ if(!cur.length) return; const t=cur.join(' ');
      if(cw<35&&out.length>startLen){out[out.length-1].text+=' '+t} else {part++; n++; out.push({loc:seg.loc,part,n,text:t})}
      cur=[];cw=0 };
    for(const s of parts){
      const w=wc(s);
      if(w>220){ const ws=s.split(/\s+/); for(let i=0;i<ws.length;i+=150){ flush(); cur=[ws.slice(i,i+150).join(' ')]; cw=Math.min(150,ws.length-i); flush() } continue }
      if(cw+w>140&&cw>=40) flush();
      cur.push(s); cw+=w;
    }
    flush();
  }
  return out.map(p=>({loc:p.loc||('Passage '+p.n),part:p.part,text:p.text}));
}

/* ---------- Spotting a book that's already on the shelf ---------- */
function fnv(s){let h=0x811c9dc5; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i); h=Math.imul(h,16777619)} return h>>>0}
function sketchOf(list){
  const w=norm(list.map(p=>p.text).join(' ')).match(WORD_RE)||[]; const hs=new Set();
  for(let i=0;i+5<=w.length;i++) hs.add(fnv(w[i]+' '+w[i+1]+' '+w[i+2]+' '+w[i+3]+' '+w[i+4]));
  if(!hs.size&&w.length) hs.add(fnv(w.join(' ')));
  return [...hs].sort((a,b)=>a-b).slice(0,256);
}
function similarity(a,b){
  if(!a||!a.length||!b||!b.length) return 0;
  const A=new Set(a),B=new Set(b), u=[...new Set([...a,...b])].sort((x,y)=>x-y).slice(0,256);
  let both=0; for(const h of u) if(A.has(h)&&B.has(h)) both++; return both/u.length;
}
function titleKey(s){ return norm(String(s||'').replace(/\.[a-z0-9]{2,5}$/i,'')).replace(/\b(v|ver|version|rev|revised|edition|ed|final|draft|copy|new|updated?|latest|old)\b/g,' ').replace(/[^\p{L}]+/gu,'') }
function findVersion(nb){
  let best=null;
  for(const b of books){
    if(b.sample) continue;
    if(b.fp&&b.fp===nb.fp) return {b,sim:1,dup:true};
    const sim=similarity(nb.sketch,b.sketch);
    const keys=[titleKey(b.title),titleKey(b.file)].filter(k=>k.length>=4), nk=[titleKey(nb.title),titleKey(nb.file)];
    const sameName=keys.some(k=>nk.includes(k));
    if((sim>=.5||(sameName&&sim>=.15))&&(!best||sim>best.sim)) best={b,sim};
  }
  if(best&&best.sim>=.985&&best.b.count===nb.count) best.dup=true;
  return best;
}
function isNewer(nb,ob){
  if(nb.docDate&&ob.docDate&&nb.docDate!==ob.docDate) return nb.docDate>ob.docDate;
  const n=nb.docDate||nb.fileDate, o=ob.docDate||ob.fileDate;
  if(n&&o&&Math.abs(n-o)>60000) return n>o;
  return true;
}
const fmtDate=t=>new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
function describe(b){ const d=b.docDate||b.fileDate; return [d?'dated '+fmtDate(d):null, b.units?b.units+' '+b.unitName:b.count+' passages'].filter(Boolean).join(', ') }

/* ---------- Adding and removing books ---------- */
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
async function commitBook(book,list){
  if(!book.sample) nagSet(nagGet()+1);
  if(usingSamples) clearSamples();
  await store.put(book,list).catch(()=>{});
  books.push(book); list.forEach(p=>passages.push({bookId:book.id,...p})); selected.add(book.id);
  rebuildIndex(); renderShelf(); if($('q').value.trim()) doSearch(); indexLoop();
}
async function removeBook(id){
  const list=passages.filter(p=>p.bookId===id).map(({loc,part,text})=>({loc,part,text}));
  await store.del(id).catch(()=>{});
  books=books.filter(x=>x.id!==id); passages=passages.filter(p=>p.bookId!==id); selected.delete(id); vecs.delete(id);
  rebuildIndex(); renderShelf(); if($('q').value.trim()) doSearch();
  return list;
}
function notice(job,text,actions){
  job.className='job'; job.innerHTML=''; const p=document.createElement('div'); p.textContent=text; job.appendChild(p);
  const row=document.createElement('div'); row.style.cssText='display:flex;gap:4px;flex-wrap:wrap;margin-top:6px';
  for(const [label,fn] of actions){ const b=document.createElement('button'); b.className='btn small'; b.type='button'; b.textContent=label; b.onclick=async()=>{ row.querySelectorAll('button').forEach(x=>x.disabled=true); await fn(); job.remove() }; row.appendChild(b) }
  const ok=document.createElement('button'); ok.className='btn ghost small'; ok.type='button'; ok.textContent='OK'; ok.onclick=()=>job.remove(); row.appendChild(ok);
  job.appendChild(row);
}
async function addFiles(files){
  for(const file of files){
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    const job=document.createElement('div'); job.className='job';
    job.innerHTML='<div></div><div class="bar"><i></i></div>'; job.firstChild.textContent='Reading '+file.name+'…';
    $('jobs').appendChild(job);
    const progress=f=>{job.querySelector('i').style.width=Math.round(f*100)+'%'};
    try{
      let r;
      if(ext==='pdf') r=await readPdf(file,progress);
      else if(ext==='epub') r=await readEpub(file,progress);
      else if(ext==='docx') r=await readDocx(file);
      else if(['txt','md','markdown','html','htm'].includes(ext)) r=await readText(file);
      else throw new Error('This file type isn’t supported. Use PDF, EPUB, DOCX, TXT or Markdown.');
      const list=cut(r.segs);
      if(list.reduce((a,p)=>a+p.text.length,0)<200) throw new Error(ext==='pdf'?'No text found in this PDF. It is probably scanned pages (pictures of text). Run it through a text-recognition (OCR) tool first, then add it again.':'No readable text found in this file.');
      const book={id:uid(),title:r.title||cleanTitle(file.name),file:file.name,kind:ext,addedAt:Date.now(),source:detectSource(r.title,file.name,list.slice(0,40).map(p=>p.text).join(' ')),units:r.units,unitName:r.unitName||null,count:list.length,size:file.size,
        docDate:r.docDate||null,fileDate:file.lastModified||null,fp:fnv(list.map(p=>p.text).join('\n')),sketch:sketchOf(list)};
      const m=findVersion(book);
      if(!m){ await commitBook(book,list); job.remove(); continue }
      const old=m.b, pct=Math.round(m.sim*100);
      if(m.dup){ notice(job,'“'+file.name+'” is already on your shelf as “'+old.title+'”, so it wasn’t added again.',[]); continue }
      if(isNewer(book,old)){
        await commitBook(book,list); const oldList=await removeBook(old.id);
        notice(job,'Replaced an older version. “'+old.title+'” ('+describe(old)+') was removed and this file ('+describe(book)+') took its place. About '+pct+'% of the text is the same.',
          [['Undo',async()=>{ await removeBook(book.id); old.indexed=false; await commitBook(old,oldList) }]]);
      } else {
        notice(job,'You already have a newer version: “'+old.title+'” ('+describe(old)+'). This file ('+describe(book)+') looks older, so it wasn’t added. About '+pct+'% of the text is the same.',
          [['Use this file instead',async()=>{ await commitBook(book,list); await removeBook(old.id) }],['Keep both',async()=>{ await commitBook(book,list) }]]);
      }
    }catch(e){
      job.className='job err'; job.textContent=file.name+': '+(e&&e.message||'Could not read this file.');
      const x=document.createElement('button'); x.className='btn ghost small'; x.textContent='Dismiss'; x.onclick=()=>job.remove(); job.appendChild(x);
    }
  }
}
function clearSamples(){ books=books.filter(b=>!b.sample); passages=passages.filter(p=>!p.bookId.startsWith('sample-')); selected=new Set([...selected].filter(id=>!id.startsWith('sample-'))); for(const k of [...vecs.keys()]) if(k.startsWith('sample-')) vecs.delete(k); usingSamples=false; $('sampleBanner').hidden=true }

/* ---------- Shelf UI ---------- */
function ixText(b){
  if(modelState!=='ready'&&!isIndexed(b)) return '';
  if(isIndexed(b)) return 'Idea search ready';
  if(b.indexFailed) return 'Idea search couldn’t index this book';
  const p=indexProgress.get(b.id); return p!=null?'Preparing idea search… '+Math.round(p*100)+'%':'Waiting for idea search…';
}
function renderIndexBadge(b){ const el=document.querySelector('[data-ix="'+b.id+'"]'); if(el) el.textContent=ixText(b) }
function renderShelf(){
  const ul=$('books'); ul.innerHTML='';
  const real=books.filter(b=>!b.sample).length;
  $('shelfCount').textContent=usingSamples?'samples':(real+' book'+(real===1?'':'s')+' · '+passages.length.toLocaleString()+' passages');
  const ordered=[...books].sort((a,b)=>(SRC_RANK[a.source]??8)-(SRC_RANK[b.source]??8)||a.addedAt-b.addedAt);
  let lastSrc=null;
  for(const b of ordered){
    if(b.source!==lastSrc){ lastSrc=b.source; const h=document.createElement('li'); h.className='shelf-group'; h.textContent=srcLabel(b.source); ul.appendChild(h) }
    const li=document.createElement('li'); li.className='book';
    const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=selected.has(b.id); cb.setAttribute('aria-label','Search in '+b.title);
    cb.onchange=()=>{cb.checked?selected.add(b.id):selected.delete(b.id); if($('q').value.trim()) doSearch()};
    const mid=document.createElement('div');
    const t=document.createElement('div'); t.className='t'; t.dir='auto'; t.textContent=b.title;
    if(b.sample){const s=document.createElement('span'); s.className='sample-tag'; s.textContent='Sample'; t.appendChild(s)}
    const m=document.createElement('div'); m.className='m';
    m.textContent=[b.kind.toUpperCase(), b.units?b.units+' '+b.unitName:null, b.count+' passages', (b.docDate||b.fileDate)&&!b.sample?fmtDate(b.docDate||b.fileDate):null].filter(Boolean).join(' · ');
    const ix=document.createElement('div'); ix.className='ix'; ix.dataset.ix=b.id; ix.textContent=ixText(b);
    const sel=document.createElement('select'); sel.className='srcsel'; sel.setAttribute('aria-label','Source of '+b.title);
    for(const so of SOURCES){ const o=document.createElement('option'); o.value=so.id; o.textContent=so.label; if(so.id===(b.source||'other')) o.selected=true; sel.appendChild(o) }
    sel.onchange=async()=>{ b.source=sel.value; if(!b.sample) await store.put(b).catch(()=>{}); renderShelf(); if($('q').value.trim()) doSearch() };
    mid.append(t,m,sel,ix);
    const acts=document.createElement('div');
    if(!b.sample){
      t.title='Tap to rename'; t.style.cursor='text';
      t.onclick=()=>{ const inp=document.createElement('input'); inp.className='rename'; inp.value=b.title; inp.dir='auto'; t.replaceWith(inp); inp.focus(); inp.select();
        let fin=false; const done=async save=>{ if(fin) return; fin=true; if(save&&inp.value.trim()){b.title=inp.value.trim(); await store.put(b).catch(()=>{})} renderShelf(); if($('q').value.trim()) doSearch() };
        inp.onkeydown=e=>{if(e.key==='Enter')done(true); if(e.key==='Escape')done(false)}; inp.onblur=()=>done(true) };
      const del=document.createElement('button'); del.className='btn ghost small'; del.textContent='Remove'; del.type='button';
      del.onclick=async()=>{
        if(del.dataset.armed){ await removeBook(b.id); if(!books.length){ loadSamples(); renderShelf(); indexLoop() } }
        else { del.dataset.armed='1'; del.textContent='Remove?'; del.style.color='var(--warn)'; setTimeout(()=>{if(del.isConnected){delete del.dataset.armed; del.textContent='Remove'; del.style.color=''}},3500) }
      };
      acts.appendChild(del);
    }
    li.append(cb,mid,acts); ul.appendChild(li);
  }
}

/* ---------- Search UI ---------- */
let mode='ideas', current=null, shown=0, run=0;
const PAGE=25;
function setMode(m){ mode=m; $('modeWords').setAttribute('aria-pressed',m==='words'); $('modeIdeas').setAttribute('aria-pressed',m==='ideas') }
$('modeWords').onclick=()=>{setMode('words'); if($('q').value.trim()) doSearch()};
$('modeIdeas').onclick=()=>{setMode('ideas'); if($('q').value.trim()) doSearch()};
$('allWords').onchange=()=>{ if($('q').value.trim()) doSearch() };
$('sort').onchange=()=>{ if(current){ order(); renderResults(true) } };
$('form').onsubmit=e=>{e.preventDefault(); $('q').blur(); doSearch()};
$('allBooks').onclick=()=>{ books.forEach(b=>selected.add(b.id)); renderShelf(); if($('q').value.trim()) doSearch() };

function order(){
  const list=current.list, view=$('sort').value;
  for(const x of list){ if(x.kind==null) x.kind=kindOf(passages[x.i].text); x.src=srcOf(passages[x.i].bookId); x.adj=x.score*KIND_BOOST[x.kind] }
  if(view==='book'){ const pos=new Map(books.map((b,i)=>[b.id,i])); list.sort((a,b)=>(pos.get(passages[a.i].bookId)-pos.get(passages[b.i].bookId))||(a.i-b.i)) }
  else if(view==='best') list.sort((a,b)=>b.adj-a.adj);
  else list.sort((a,b)=>SRC_RANK[a.src]-SRC_RANK[b.src]||b.adj-a.adj);
}

async function doSearch(keepScroll){
  const q=$('q').value.trim(); const my=++run;
  $('work').textContent='';
  if(!q){ $('status').hidden=true; $('results').innerHTML=''; $('moreBtn').hidden=true; return }
  const all=$('allWords').checked;
  const {res,hl,exclIds,fl}=wordSearch(q,all);
  let kwMax=1e-9; for(const v of res.values()) if(v>kwMax) kwMax=v;
  let list=[...res].map(([i,s])=>({i,score:s/kwMax,word:true}));
  current={q,list,hl}; order(); renderResults(!keepScroll);
  if(mode!=='ideas') return;
  if(modelState!=='ready'){ $('work').textContent=modelState==='loading'?'Idea search is getting ready. Showing word matches for now.':'Showing word matches. Download the idea model for idea search.'; return }
  const plain=parseQuery(q).plain.trim(); if(!plain) return;
  const notReady=books.filter(b=>selected.has(b.id)&&!isIndexed(b)).length;
  let sims;
  try{ sims=await ideaSearch(plain) }catch(e){ $('work').textContent='Idea search failed: '+e.message; return }
  if(my!==run) return;
  let top=0; for(const s of sims.values()) if(s>top) top=s;
  const thr=Math.max(.28,top*.7), floor=.12;
  const rel=s=>Math.max(0,Math.min(1,(s-floor)/Math.max(.05,top-floor)));
  const byI=new Map(list.map(x=>[x.i,x]));
  for(const x of list){ const s=sims.get(x.i); if(s!=null){ x.sim=s; x.idea=s>=thr; x.score=.45*x.score+.55*rel(s) } else x.score*=.45 }
  const extra=[...sims].filter(([i,s])=>s>=thr&&!byI.has(i)&&!exclIds.has(i)&&!all&&!(fl.length&&!fl.every(p=>flats[i].includes(p)))).sort((a,b)=>b[1]-a[1]).slice(0,150);
  for(const [i,s] of extra) list.push({i,sim:s,idea:true,word:false,score:.55*rel(s)});
  current={q,list,hl}; order(); renderResults(true);
  if(notReady) $('work').textContent=notReady+' book'+(notReady===1?' is':'s are')+' still being prepared for idea search.';
}

function renderResults(reset){
  const box=$('results');
  if(reset){ box.innerHTML=''; shown=0 }
  const {list,hl,q}=current;
  $('status').hidden=false;
  const nb=new Set(list.map(x=>passages[x.i].bookId)).size;
  $('count').innerHTML=list.length?'<b>'+list.length.toLocaleString()+'</b> passage'+(list.length===1?'':'s')+' in <b>'+nb+'</b> document'+(nb===1?'':'s'):'No passages found';
  $('claudeBtn').hidden=!list.length; $('claudeNote').hidden=true;
  $('srcnav').hidden=true;
  if(!list.length){
    box.innerHTML='<div class="empty">Nothing matched <b>'+esc(q)+'</b>'+(selected.size<books.length?' in the documents you ticked. Try <b>Search all books</b>.':'. Try fewer words or <b>Words + ideas</b>.')+'</div>';
    $('moreBtn').hidden=true; return;
  }
  if($('sort').value==='source'){ $('moreBtn').hidden=true; renderGrouped(box); return }
  const end=Math.min(list.length,shown+PAGE);
  for(let k=shown;k<end;k++) box.appendChild(card(list[k],k+1,hl));
  shown=end;
  $('moreBtn').hidden=shown>=list.length;
  $('moreBtn').textContent='Show more passages ('+(list.length-shown).toLocaleString()+' left)';
}
const GROUP_SHOW=4;
function renderGrouped(box){
  const {list,hl}=current, g=new Map();
  list.forEach((x,k)=>{ if(!g.has(x.src)) g.set(x.src,[]); g.get(x.src).push(k) });
  const owned=new Map(); for(const b of books) if(selected.has(b.id)){ const s=b.source||'other'; owned.set(s,(owned.get(s)||0)+1) }
  const nav=$('srcnav'); nav.innerHTML='';
  for(const so of SOURCES){
    const ks=g.get(so.id), have=owned.get(so.id);
    if(!ks&&!have) continue;
    const bt=document.createElement('button'); bt.type='button';
    bt.onclick=()=>{ const el=$('g-'+so.id); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}) };
    if(ks) bt.innerHTML=esc(so.label)+'<b>'+ks.length+'</b>'; else { bt.className='none'; bt.textContent=so.label+' · none' }
    nav.appendChild(bt);
    const sec=document.createElement('section'); sec.className='group'+(ks?'':' miss'); sec.id='g-'+so.id;
    const rk=so.id==='knowledge'?'BG':(SRC_RANK[so.id]+1);
    if(!ks){ sec.innerHTML='<h3><span class="rk">'+rk+'</span>'+esc(so.label)+'</h3><p>Nothing found in your '+have+' document'+(have===1?'':'s')+' from this source.</p>'; box.appendChild(sec); continue }
    const kc={}; for(const k of ks){ const kd=list[k].kind; if(kd!=='none') kc[kd]=(kc[kd]||0)+1 }
    const kinds=KINDS.filter(x=>kc[x[0]]).map(x=>kc[x[0]]+' '+x[1].toLowerCase()+(kc[x[0]]>1?'s':'')).join(' · ');
    sec.innerHTML='<h3><span class="rk">'+rk+'</span>'+esc(so.label)+'<span class="c">'+ks.length+' passage'+(ks.length===1?'':'s')+(kinds?' · '+esc(kinds):'')+'</span></h3>';
    ks.slice(0,GROUP_SHOW).forEach(k=>sec.appendChild(card(list[k],k+1,hl)));
    if(ks.length>GROUP_SHOW){
      const more=document.createElement('button'); more.className='btn more'; more.type='button';
      more.textContent='Show all '+ks.length+' passages from '+so.label;
      more.onclick=()=>{ ks.slice(GROUP_SHOW).forEach(k=>more.before(card(list[k],k+1,hl))); more.remove() };
      sec.appendChild(more);
    }
    box.appendChild(sec);
  }
  nav.hidden=!nav.children.length;
}

/* ---------- Hand the question and passages to Claude (copy, then paste into the Claude app) ---------- */
function claudePrompt(){
  const list=current.list;
  const byIdx=[...list.keys()].sort((a,b)=>SRC_RANK[list[a].src]-SRC_RANK[list[b].src]||list[b].adj-list[a].adj);
  const per={}, pick=[];
  for(const k of byIdx){ const s=list[k].src; if((per[s]=(per[s]||0)+1)<=5&&pick.length<40) pick.push(k) }
  const groups=SOURCES.map(so=>({so,ks:pick.filter(k=>list[k].src===so.id)})).filter(x=>x.ks.length);
  const block=groups.map(({so,ks})=>'=== '+so.label+' ===\n'+ks.map(k=>{const p=passages[list[k].i], b=books.find(b=>b.id===p.bookId); return '['+(k+1)+'] ('+(b?b.title:'')+', '+p.loc+')\n'+p.text.slice(0,1100)}).join('\n\n')).join('\n\n');
  const owned=new Set(books.filter(b=>selected.has(b.id)).map(b=>b.source||'other'));
  const missing=SOURCES.filter(so=>owned.has(so.id)&&!groups.some(g=>g.so.id===so.id)).map(so=>so.label);
  return 'I am an airline pilot (Boeing 737, Royal Air Maroc). Here are passages from my own document library about: "'+current.q+'".\n'+
'They are grouped by source in my order of authority: Royal Air Maroc → Boeing 737 → DGAC Morocco → ICAO → EASA → FAA → UK CAA → other airlines → unsorted → background knowledge (textbooks).\n'+
(missing.length?'Sources in my library with no matching passage: '+missing.join(', ')+'.\n':'')+
'\nAnswer in the language of my topic, with one section per source in that order:\n- What the source says.\n- Any procedure or checklist: its steps in the original order and wording.\n- Limitations, figures and conditions exactly as written.\n- Definitions, briefly.\nCite passage numbers like [12]. Then "Differences between sources" and "Not found".\n'+
'Use ONLY these passages. Do not add steps, numbers or procedures from general knowledge. If a checklist looks cut off, say so and give the reference.\n\n'+block;
}
$('claudeBtn').onclick=async()=>{
  const txt=claudePrompt(), note=$('claudeNote');
  try{ await navigator.clipboard.writeText(txt); note.textContent='Copied: your question and the top passages from each source. Open the Claude app, paste, and send. (Needs internet.)' }
  catch(e){ note.textContent='Select all the text below, copy it, then paste it into the Claude app.'; const ta=document.createElement('textarea'); ta.value=txt; ta.rows=8; ta.style.cssText='width:100%;margin-top:8px;font-size:12px'; note.appendChild(ta); ta.focus(); ta.select() }
  note.hidden=false;
};
$('moreBtn').onclick=()=>renderResults(false);

function card(x,n,hl){
  const p=passages[x.i], b=books.find(b=>b.id===p.bookId)||{title:'?'};
  const el=document.createElement('article'); el.className='pass'; el.id='r'+n;
  const units=byBook.get(p.bookId)||[]; const pos=units.indexOf(x.i);
  const partNote=p.loc.startsWith('Ch.')&&p.part>1?' · part '+p.part:'';
  const tags=($('sort').value!=='source'?'<span class="kind">'+esc(srcLabel(srcOf(p.bookId)))+'</span>':'')+(x.kind&&x.kind!=='none'?'<span class="kind '+x.kind+'">'+kindLabel(x.kind)+'</span>':'')+(x.word?'<span class="tag w">Word match</span>':'')+(x.idea?'<span class="tag i">Idea match</span>':'');
  el.innerHTML='<header><div class="ref"><span class="n">'+n+'</span><span class="bt" dir="auto">'+esc(b.title)+'</span><span>'+esc(p.loc+partNote)+'</span></div><div class="tags">'+tags+'</div></header>'+
    '<div class="text" dir="'+(isRtl(p.text)?'rtl':'ltr')+'">'+highlight(p.text,hl)+'</div>'+
    '<footer><button class="btn ghost small" data-a="ctx" type="button">Show surrounding text</button><button class="btn ghost small" data-a="copy" type="button">Copy with reference</button></footer>';
  el.querySelector('[data-a=ctx]').onclick=e=>{
    const btn=e.currentTarget, open=el.querySelector('.ctx');
    if(open){ el.querySelectorAll('.ctx').forEach(c=>c.remove()); btn.textContent='Show surrounding text'; return }
    const mk=i=>{ if(i==null) return null; const q=passages[i]; const d=document.createElement('div'); d.className='text ctx'; d.dir=isRtl(q.text)?'rtl':'ltr'; d.textContent=q.text; return d };
    const prev=mk(units[pos-1]), next=mk(units[pos+1]), main=el.querySelector('.text');
    if(prev) main.before(prev); if(next) main.after(next);
    btn.textContent=prev||next?'Hide surrounding text':'No surrounding text';
  };
  el.querySelector('[data-a=copy]').onclick=async e=>{
    const btn=e.currentTarget, txt='"'+p.text+'"\n— '+b.title+', '+p.loc;
    try{ await navigator.clipboard.writeText(txt); btn.textContent='Copied' }
    catch(err){ const r=document.createRange(); r.selectNodeContents(el.querySelector('.text')); const s=getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent='Selected. Use Copy.' }
    setTimeout(()=>{btn.textContent='Copy with reference'},1800);
  };
  return el;
}

/* ---------- Backup ---------- */
$('exportBtn').onclick=async()=>{
  const real=books.filter(b=>!b.sample);
  if(!real.length){ $('storeNote').textContent='Add a book first, then save a backup.'; return }
  const data={app:'maktaba',version:1,books:real.map(b=>({...b,indexed:false})),passages:real.map(b=>({bookId:b.id,list:passages.filter(p=>p.bookId===b.id).map(({loc,part,text})=>({loc,part,text}))}))};
  const name='maktaba-library-'+new Date().toISOString().slice(0,10)+'.json';
  const file=new File([JSON.stringify(data)],name,{type:'application/json'});
  try{
    if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:'Maktaba backup'}); nagSet(0); return }
  }catch(e){ if(e&&e.name==='AbortError') return }
  const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download=name; document.body.appendChild(a); a.click(); nagSet(0); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove()},4000);
};
$('importIn').onchange=async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  try{
    const d=JSON.parse(await f.text()); if(d.app!=='maktaba') throw 0;
    if(usingSamples) clearSamples();
    let added=0;
    for(const b0 of d.books){ if(books.some(x=>x.id===b0.id)) continue; const b={...b0,indexed:false}; const rec=d.passages.find(p=>p.bookId===b.id); const list=rec&&rec.list||[]; if(!b.source) b.source=detectSource(b.title,b.file,list.slice(0,40).map(p=>p.text).join(' '));
      await store.put(b,list).catch(()=>{}); books.push(b); list.forEach(p=>passages.push({bookId:b.id,...p})); selected.add(b.id); added++ }
    rebuildIndex(); renderShelf(); if($('q').value.trim()) doSearch(); indexLoop();
    $('storeNote').className='note'; $('storeNote').textContent='Restored '+added+' book'+(added===1?'':'s')+' from the backup.';
  }catch(err){ $('storeNote').textContent='That file isn’t a Maktaba backup.'; $('storeNote').className='note warn' }
};


/* ---------- Backup reminder ---------- */
const NAG_KEY='maktaba.unsavedBooks';
function nagGet(){ try{ return +(localStorage.getItem(NAG_KEY)||0) }catch(e){ return 0 } }
function nagSet(n){ try{ localStorage.setItem(NAG_KEY,String(n)) }catch(e){} renderNag() }
function renderNag(){
  const el=document.getElementById('backupNag'); if(!el) return; const n=nagGet();
  if(!n||usingSamples){ el.hidden=true; return }
  el.innerHTML=''; const t=document.createElement('span');
  t.textContent=(n===1?'1 document has':n+' documents have')+' been added since your last backup. ';
  const b=document.createElement('button'); b.className='btn small'; b.type='button'; b.textContent='Save a backup now'; b.onclick=()=>$('exportBtn').click();
  el.append(t,b); el.hidden=false;
}

/* ---------- Drag and drop ---------- */
const drop=$('drop');
$('fileIn').onchange=e=>{ const fs=[...e.target.files]; e.target.value=''; addFiles(fs) };
['dragenter','dragover'].forEach(t=>document.addEventListener(t,e=>{ if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){e.preventDefault(); drop.classList.add('over')} }));
['dragleave','drop'].forEach(t=>document.addEventListener(t,e=>{ if(t==='drop'||!e.relatedTarget) drop.classList.remove('over') }));
document.addEventListener('drop',e=>{ if(e.dataTransfer&&e.dataTransfer.files.length){ e.preventDefault(); addFiles([...e.dataTransfer.files]) } });

/* ---------- Sample books (shown only while the shelf is empty) ---------- */
const SAMPLES=[
 {id:'sample-ops',title:'Sample company operations manual (invented)',source:'ram',kind:'pdf',units:2,unitName:'pages',pages:[
  'VOLCANIC ASH – COMPANY POLICY (invented sample text, not a real manual). Flight crews shall avoid all areas of known or forecast volcanic ash. Before each flight the crew and dispatch shall review volcanic ash advisories and SIGMETs for the route, the destination and the alternates.',
  'If a volcanic ash encounter is suspected, the crew shall apply the aircraft manufacturer’s non-normal checklist, inform ATC, and report the encounter to the operations control centre as soon as practicable. A post-flight report is required after any suspected encounter.']},
 {id:'sample-qrh',title:'Sample aircraft QRH extract (invented)',source:'boeing',kind:'pdf',units:1,unitName:'pages',pages:[
  'Volcanic Ash (invented sample, not a real checklist; always use your aircraft’s approved QRH). Condition: Volcanic ash is suspected or encountered. Indications can include an acrid odour, dust in the flight deck, St. Elmo’s fire and engine malfunctions. Objective: To leave the ash and protect the engines. Step 1 Leave the ash by the quickest route. Step 2 Follow the remaining steps of the approved checklist.']},
 {id:'sample-icao',title:'Sample international guidance (invented)',source:'icao',kind:'pdf',units:2,unitName:'pages',pages:[
  'Volcanic ash advisory centres monitor eruptions and issue advisories that help meteorological offices prepare SIGMET messages for volcanic ash. Operators should include volcanic ash in their safety risk assessment (invented sample text).',
  'Cendres volcaniques : les exploitants doivent tenir compte des avis de cendres volcaniques et des SIGMET dans la planification des vols (texte d’exemple inventé).']},
 {id:'sample-met',title:'Sample meteorology course notes (invented)',source:'knowledge',kind:'epub',units:1,unitName:'chapters',chapters:[
  'Volcanic ash is made of fine particles of rock and glass. It is a hazard to aircraft because the glass can melt in the hot section of a jet engine, it abrades windscreens and leading edges, and it can block pitot-static sensors. Ash clouds are hard to see at night and do not show on weather radar (invented sample text for trying the search).']},
];
function loadSamples(){
  usingSamples=true; books=[]; passages=[];
  for(const s of SAMPLES){
    const list=s.pages?s.pages.map((t,i)=>({loc:'p. '+(i+1),part:1,text:t})):s.chapters.map((t,i)=>({loc:'Ch. '+(i+1),part:1,text:t}));
    books.push({id:s.id,title:s.title,source:s.source,kind:s.kind,units:s.units,unitName:s.unitName,count:list.length,sample:true,addedAt:0});
    list.forEach(p=>passages.push({bookId:s.id,...p})); selected.add(s.id);
  }
  rebuildIndex(); $('sampleBanner').hidden=false;
}

/* ---------- Offline status ---------- */
async function updateNet(){
  const el=$('net'), span=el.querySelector('span');
  const sw=('serviceWorker' in navigator)&&navigator.serviceWorker.controller;
  const parts=[];
  parts.push(sw?'App saved for offline use':'App not yet saved for offline use');
  parts.push(modelState==='ready'||await modelCached()?'idea model on this device':'idea model not downloaded');
  span.textContent=parts.join(' · ')+(navigator.onLine?'':' · offline now');
  el.classList.toggle('ok',!!sw&&(modelState==='ready'));
}
window.addEventListener('online',updateNet); window.addEventListener('offline',updateNet);

/* ---------- Start ---------- */
(async function start(){
  if('serviceWorker' in navigator){ try{ const had=!!navigator.serviceWorker.controller; let reloaded=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(had&&!reloaded){ reloaded=true; location.reload() } else updateNet() });
    const reg=await navigator.serviceWorker.register('sw.js'); if(navigator.onLine) reg.update().catch(()=>{}) }catch(e){} }
  const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(ios&&!standalone) $('installTip').hidden=false;
  await store.open();
  if(!store.ok){ $('storeNote').textContent='This browser is blocking storage, so books you add stay only until you close the app.'; $('storeNote').className='note warn' }
  try{
    const bs=await store.all('books'), ps=await store.all('passages');
    const map=new Map(ps.map(p=>[p.bookId,p.list]));
    bs.sort((a,b)=>a.addedAt-b.addedAt);
    for(const b of bs){ const list=map.get(b.id)||[];
      if(!b.source){ b.source=detectSource(b.title,b.file,list.slice(0,40).map(p=>p.text).join(' ')); store.put(b).catch(()=>{}) }
      books.push(b); list.forEach(p=>passages.push({bookId:b.id,...p})); selected.add(b.id) }
  }catch(e){}
  if(!books.length){ loadSamples(); $('q').value='volcanic ash' } else rebuildIndex();
  for(const b of books){ if(b.sample) continue;
    try{ const segs=await store.vecsOf(b.id); let st={data:new Int8Array(0),scale:new Float32Array(0),owner:new Int32Array(0)};
      for(const s of segs) st=concatVec(st,s); if(b.indexed) st.complete=true; if(st.owner.length) vecs.set(b.id,st) }catch(e){} }
  renderShelf(); renderNag();
  if($('q').value) doSearch();
  if(await modelCached()) loadModel(); else renderModel();
  updateNet();
})();
