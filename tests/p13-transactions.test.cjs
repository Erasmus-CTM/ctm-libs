const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const C = require('./helpers/ctm-libs.cjs'), W = require('./helpers/worker.cjs');
const source = fs.readFileSync(path.join(C.library, 'runtime/pyodide-runtime.js'), 'utf8');
function runtime() {const context={setTimeout,clearTimeout};context.globalThis=context;vm.runInNewContext(source,context);return context;}

test('logical operations from separate components cannot interleave globals, capture or cleanup', async () => {
  const R=runtime().MathExerciseRuntime, py={}, events=[];
  let release, entered;const gate=new Promise(r=>release=r), started=new Promise(r=>entered=r);
  const a=R.transaction(py,async()=>{events.push('A set');entered();await gate;events.push('A evaluate','A cleanup');return 1;});
  await started;
  const b=R.transaction(py,async()=>{events.push('B set','B evaluate','B cleanup');return 2;});
  await W.tick();assert.deepEqual(events,['A set']);release();
  assert.deepEqual(await Promise.all([a,b]),[1,2]);
  assert.deepEqual(events,['A set','A evaluate','A cleanup','B set','B evaluate','B cleanup']);
});

test('Stop cancels queued logical work before it can mutate Python, with no replay', async () => {
  const context=runtime(), R=context.MathExerciseRuntime, py={restart(){}}, events=[];
  context.mainPyodide=py;
  let release, entered;const gate=new Promise(r=>release=r), started=new Promise(r=>entered=r);
  const a=R.transaction(py,async()=>{entered();await gate;return 42;});
  await started;
  const b=R.transaction(py,async()=>events.push('MUST NOT EXECUTE'));
  const done=Promise.allSettled([a,b]);R.stop('Stopped');release();
  const results=await done;assert.ok(results.every(x=>x.status==='rejected'));assert.deepEqual(events,[]);
});

test('self-hosted worker bytes match the canonical source and static startup uses no blob', async () => {
  const page=W.pageContext();
  assert.equal(fs.readFileSync(path.join(C.library,'runtime/pyodide-worker-core.js'),'utf8'), page.CTMWorker.source);
  const first=page.CTMWorker.page({indexURL:'http://local/pyodide/',workerURL:'http://local/worker-core.js'});
  assert.equal(page.CTMWorker.page(),first);assert.equal(page.workers.length,1);
  assert.equal(page.workers[0].url,'http://local/worker-core.js');
  page.workers[0].reply({type:'result',id:page.workers[0].posted[0].id,value:true});
  assert.equal((await first).isWorkerProxy,true);
});

test('output floods are bounded before posting or collecting per-run output', async () => {
  const w=W.workerContext({plugin:'registerPlugin(api=>({commands:{flood:async()=>{api.capture.start();for(let i=0;i<10000;i++)api.capture.push({message:"x".repeat(1024),type:"stdout"});return api.capture.entries();}}}));'});
  await w.init();await w.send({type:'beginOperation',id:1,operationID:7});await w.send({type:'flood',id:2});
  const result=w.result(2);assert.ok(result.value.length<=256);
  assert.ok(w.messages.filter(x=>x.type==='streamBatch').length<=1,'one batch in flight');
  await w.send({type:'endOperation',id:3});
  const messages=w.messages.filter(x=>x.type==='streamBatch');
  assert.ok(messages.length<=2,'bounded final flush');assert.ok(messages.every(x=>x.operationID===7));
  assert.ok(messages.flatMap(x=>x.entries).some(x=>x.type==='notice'));
});

test('empty-line floods cannot evade the output entry budget', async () => {
  const w=W.workerContext({plugin:'registerPlugin(api=>({commands:{emptyFlood:async()=>{api.capture.start();for(let i=0;i<100000;i++)api.capture.push({message:"",type:"stdout"});return api.capture.entries();}}}));'});
  await w.init();await w.send({type:'beginOperation',id:1,operationID:8});await w.send({type:'emptyFlood',id:2});
  assert.equal(w.result(2).value.length,4096);
  assert.equal(w.messages.filter(x=>x.type==='streamBatch').length,1);
  await w.send({type:'endOperation',id:3});
  const batches=w.messages.filter(x=>x.type==='streamBatch');
  assert.equal(batches.length,2);
  assert.equal(batches.flatMap(x=>x.entries).filter(x=>x.type==='notice').length,1);
});
