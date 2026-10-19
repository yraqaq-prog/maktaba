// Runs the idea model on this device. Loaded as a module worker.
import { pipeline, env } from './transformers.min.js';
const MODEL='Xenova/paraphrase-multilingual-MiniLM-L12-v2';
env.allowLocalModels=false;
env.useBrowserCache=true;
env.backends.onnx.wasm.wasmPaths=new URL('./',self.location.href).href;
env.backends.onnx.wasm.numThreads=1;
let fe=null, loading=null;
function load(){
  if(!loading) loading=pipeline('feature-extraction',MODEL,{dtype:'q8',device:'wasm',
    progress_callback:p=>{ if(p.status==='progress'&&/\.onnx$/.test(p.file||'')) self.postMessage({type:'progress',loaded:p.loaded,total:p.total}) }
  }).then(x=>{fe=x;return x}).catch(e=>{loading=null;throw e});
  return loading;
}
self.onmessage=async e=>{
  const m=e.data;
  try{
    if(m.type==='load'){ await load(); self.postMessage({type:'ready'}); return }
    if(m.type==='embed'){
      await load();
      const out=await fe(m.texts,{pooling:'mean',normalize:true});
      const data=out.data instanceof Float32Array?out.data:Float32Array.from(out.data);
      self.postMessage({type:'vecs',id:m.id,dim:out.dims[out.dims.length-1],data},[data.buffer]);
    }
  }catch(err){ self.postMessage({type:'error',id:m.id,message:String(err&&err.message||err)}) }
};
