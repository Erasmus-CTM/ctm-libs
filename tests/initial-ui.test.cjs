// Actual canonical runtime; controlled load/UI/font promises, no Python setup.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../_extensions/ctm-libs/runtime/pyodide-runtime.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise, resolve, reject}; };
function page({math, fonts, state='loading', existing}={}) {
  const listeners = {}, errors = [];
  const document = {readyState:state, fonts: fonts && {ready:fonts}};
  const w = {document, console:{error:(...args)=>errors.push(args)},
    addEventListener:(name,fn)=>{(listeners[name] ||= []).push(fn);}};
  if (existing) w.MathExerciseRuntime = existing;
  if (math) w.MathJax = {startup:{promise:math}};
  vm.runInNewContext(source, w);
  return {w, emit:name=>(listeners[name]||[]).forEach(fn=>fn()), api:w.MathExerciseRuntime, errors, load:()=>{document.readyState='complete'; (listeners.load||[]).forEach(fn=>fn());}};
}
test('initial UI closes after load, shares one barrier, then waits UI, MathJax and discovered fonts', async()=>{
  const ui=deferred(), math=deferred(), fonts=deferred(), p=page({math:math.promise, fonts:fonts.promise});
  assert.equal(p.api.trackInitialUI(ui.promise),ui.promise);
  const first=p.api.whenInitialUIReady(); assert.equal(first,p.api.whenInitialUIReady());
  let settled=false; first.then(()=>settled=true);
  await tick(); assert.equal(settled,false,'no load yet');
  p.load(); await tick(); assert.equal(settled,false,'UI still building');
  ui.resolve(); await tick(); assert.equal(settled,false,'MathJax still typesetting');
  math.resolve(); await tick(); assert.equal(settled,false,'fonts still loading');
  fonts.resolve(); await first; assert.equal(settled,true);
  assert.throws(()=>p.api.trackInitialUI(Promise.resolve()),/registered before window.load/);
});
test('a task rejected before load is visible immediately and the barrier rejects the original error', async()=>{
  const ui=deferred(), p=page(), error=new Error('actual UI failed');
  p.api.trackInitialUI(ui.promise); ui.reject(error); await tick();
  assert.equal(p.errors.length,1); assert.equal(p.errors[0][1],error);
  const result=assert.rejects(p.api.whenInitialUIReady(),e=>e===error);
  p.load(); await result;
});
test('UI readiness has no Python or authored-startup dependency and supports already-loaded documents', async()=>{
  const p=page({state:'complete'});
  await p.api.whenInitialUIReady(); assert.equal(p.errors.length,0);
});
test('adds the UI contract to an older live runtime without replacing its namespace or methods', async()=>{
  const ensureCheckers=()=>{}, existing={ensureCheckers, liveState:{value:42}};
  const p=page({state:'complete',existing});
  assert.equal(p.api,existing); assert.equal(p.api.ensureCheckers,ensureCheckers);
  assert.equal(p.api.liveState.value,42); await p.api.whenInitialUIReady();
});

test('load seals initial registration even when isolation needed no barrier call',()=>{
  const p=page();p.load();
  assert.throws(()=>p.api.trackInitialUI(Promise.resolve()),/registered before window.load/);
  const late=page({state:'complete'});
  assert.throws(()=>late.api.trackInitialUI(Promise.resolve()),/registered before window.load/);
});


test('standalone COI reload waits for initial UI and never reloads edited work or the IDE coordinator', async()=>{
  const p=page(), ui=deferred(), saved=new Map();let reloads=0;
  p.w.location={reload:()=>reloads++};p.w.sessionStorage={setItem:(k,v)=>saved.set(k,v)};
  p.api.trackInitialUI(ui.promise);p.emit('coi-sw-ready');p.load();await tick();assert.equal(reloads,0);
  ui.resolve();await tick();assert.equal(reloads,1);assert.equal(saved.get('qpyodide-coi-reload-pending'),'1');
  for(const scenario of ['input','pointerdown','keydown','IDE','isolated']) {
    const q=page({state:'complete'});let count=0;q.w.location={reload:()=>count++};q.w.sessionStorage={setItem(){}};
    if(scenario==='IDE')q.w.qpyodideCoiSettled=Promise.resolve();
    else if(scenario==='isolated')q.w.crossOriginIsolated=true;
    else q.emit(scenario);
    q.emit('coi-sw-ready');await tick();assert.equal(count,0,scenario);
  }
});
