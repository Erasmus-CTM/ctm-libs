const test=require('node:test'),assert=require('node:assert/strict');
const W=require('./helpers/worker.cjs');
function page(){
  const p=W.pageContext(),errors=[],revoked=[];
  p.console={...console,error:(...args)=>errors.push(args)};
  // The worker source's blob and the worker's stop URL, told apart.
  let made=0;p.URL.createObjectURL=blob=>(blob.type?'blob:source-':'blob:stop-')+(++made);
  p.URL.revokeObjectURL=url=>revoked.push(url.replace(/-\d+$/,''));
  return {p,errors,revoked};
}
async function ready(p,options={}){
  const started=p.CTMWorker.start({indexURL:'https://example.invalid/',publish:true,...options});
  const worker=p.workers.at(-1);worker.reply({type:'result',id:worker.posted[0].id,value:true});
  return {worker,proxy:await started};
}
test('fatal initialization rejects the published start, reports raw error and releases its worker/blob once',async()=>{
  const {p,errors,revoked}=page();
  const started=p.CTMWorker.start({publish:true});
  const rejected=assert.rejects(started,/startup failed/),worker=p.workers[0];
  let terminations=0;worker.terminate=()=>{terminations++;};
  const event={message:'startup failed'};worker.onerror(event);worker.onerror(event);
  await rejected;assert.equal(p.mainPyodide,undefined);assert.equal(p.qpyodideReady,started);
  assert.equal(terminations,1);assert.deepEqual(revoked.sort(),['blob:source','blob:stop']);assert.equal(errors.length,2);
  assert.equal(errors[0][1],event);assert.equal(p.workers.length,1);
});
test('fatal active worker rejects RPC/setup/future calls and explicit restart creates only one replacement',async()=>{
  const {p,errors,revoked}=page(),restarts=[];let events=0;
  p.addEventListener('qpyodide-runtime-restart',()=>events++);
  const {worker,proxy}=await ready(p,{onRestart:start=>restarts.push(start)});
  const one=proxy.runPythonAsync('one'),two=proxy.loadPackage('two'),setup=proxy.whenSetup;
  let fatal;const check=e=>{fatal ||= e;return e===fatal && e.workerFailed===true;};
  const results=[assert.rejects(one,check),assert.rejects(two,check),assert.rejects(setup,check)];
  worker.onerror({message:'runtime died'});await Promise.all(results);
  await assert.rejects(proxy.runPythonAsync('after'),e=>e===fatal);
  assert.equal(worker.terminated,true);assert.equal(p.workers.length,1);assert.equal(errors.length,1);
  const before=worker.posted.length;worker.reply({type:'status',text:'stale'});
  assert.equal(worker.posted.length,before);
  const replacement=proxy.restart('explicit recovery');assert.equal(proxy.restart(),replacement);
  assert.equal(p.workers.length,2);assert.equal(events,1);assert.deepEqual(restarts,[replacement]);
  assert.equal(p.qpyodideReady,replacement);assert.equal(p.mainPyodide,undefined);
  const next=p.workers[1];next.reply({type:'result',id:next.posted[0].id,value:true});
  const nextProxy=await replacement;assert.equal(p.mainPyodide,nextProxy);
  const call=nextProxy.runPythonAsync('valid');next.reply({type:'result',id:next.posted.at(-1).id,value:42});
  assert.equal(await call,42);await assert.rejects(proxy.runPythonAsync('old'),e=>e===fatal);
  assert.deepEqual(revoked.sort(),['blob:source','blob:source','blob:stop'],'the live replacement keeps its stop URL');
});
test('postMessage cloning failure rejects only that RPC; a later valid operation still works',async()=>{
  const {p}=page(),{worker,proxy}=await ready(p),native=worker.postMessage;
  const error=new Error('DataCloneError');let failedId;
  worker.postMessage=function(message){if(message.type==='runPython'){failedId=message.id;throw error;}return native.call(this,message);};
  await assert.rejects(proxy.runPythonAsync('not cloneable'),e=>e===error);
  worker.reply({type:'result',id:failedId,value:'late reply must be ignored'});
  assert.equal(worker.terminated,false);worker.postMessage=native;
  const call=proxy.runPythonAsync('valid');worker.reply({type:'result',id:worker.posted.at(-1).id,value:7});
  assert.equal(await call,7);
});
test('retry setup postMessage failure rejects its promise instead of throwing or hanging',async()=>{
  const {p}=page(),{worker,proxy}=await ready(p),error=new Error('post failed');
  worker.reply({type:'setup',ok:true});await proxy.whenSetup;
  worker.postMessage=()=>{throw error;};
  await assert.rejects(proxy.retrySetup(),e=>e===error);assert.equal(worker.terminated,false);
});
test('message decoding failure is visible and makes a ready proxy fail fast',async()=>{
  const {p,errors}=page(),{worker,proxy}=await ready(p);
  worker.reply({type:'setup',ok:true});await proxy.whenSetup;
  const call=proxy.runPythonAsync('pending'),result=assert.rejects(call,/could not be decoded/);
  const event={data:'bad clone'};worker.onmessageerror(event);await result;
  await assert.rejects(proxy.runPythonAsync('later'),/could not be decoded/);
  assert.equal(errors[0][1],event);assert.equal(p.workers.length,1);
});
test('worker construction failure rejects and publishes one shared failed start, releasing the blob',async()=>{
  const {p,revoked}=page(),error=new Error('CSP blocked Worker');
  p.Worker=class{constructor(){throw error;}};
  const start=p.CTMWorker.start({publish:true});
  assert.equal(p.qpyodideReady,start);await assert.rejects(start,e=>e===error);
  assert.deepEqual(revoked.sort(),['blob:source','blob:stop']);assert.equal(p.mainPyodide,undefined);
});
