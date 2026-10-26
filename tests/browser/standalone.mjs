// P13: real standalone Pyodide, local assets only, isolated and ordinary LAN.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtime = path.join(root, '_extensions/ctm-libs/runtime');
const dist = process.env.PYODIDE_DIST || path.join(root, 'node_modules/pyodide');
const report = [];
let exerciseSource=null;
if(process.env.P13_PY_EXERCISE) {
  const source=fs.readFileSync(process.env.P13_PY_EXERCISE,'utf8');
  const body=source.match(/var MODULE_PY = \[\n([\s\S]*?)\n  \]\.join\('\\n'\);/)[1];
  exerciseSource=vm.runInNewContext('['+body+'].join("\\n")');
}
const server = http.createServer((req,res) => {
  const url = new URL(req.url, 'http://local');
  const isolated = url.pathname.startsWith('/isolated/');
  const headers = (isolated || url.pathname.startsWith('/runtime/')) ? {'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'} : {};
  const name = path.basename(url.pathname);
  if (name === 'index.html') {
    res.writeHead(200, {...headers,'Content-Type':'text/html'});
    res.end('<!doctype html><button id="responsive">Edit</button><script>globalThis.CTMAssets={url:()=>new URL("/pyodide/",location.href).href};</script><script src="/runtime/pyodide-runtime.js"></script><script src="/runtime/pyodide-worker.js"></script>'); return;
  }
  const dir = url.pathname.startsWith('/pyodide/') ? dist : url.pathname.startsWith('/runtime/') ? runtime : null;
  const file = dir && path.join(dir,name);
  if (!file || !fs.existsSync(file)) {res.writeHead(404,headers);res.end();return;}
  res.writeHead(200, {...headers,'Cross-Origin-Resource-Policy':'same-origin','Content-Type':name.endsWith('.wasm')?'application/wasm':/\.(m?js)$/.test(name)?'text/javascript':name.endsWith('.json')?'application/json':'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'0.0.0.0',resolve));
const port=server.address().port;
const lan=Object.values(os.networkInterfaces()).flat().find(x=>x.family==='IPv4'&&!x.internal)?.address;
assert.ok(lan,'real non-loopback LAN address required');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--no-proxy-server']});
try {
  for (const [label,base] of [['plainLAN',`http://${lan}:${port}/plain/`],['isolatedLocalhost',`http://127.0.0.1:${port}/isolated/`]]) {
    const context=await browser.newContext({serviceWorkers:'block'});
    const external=[],errors=[];
    await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==new URL(base).origin){external.push(route.request().url());return route.abort();}return route.continue();});
    const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
    const response = await page.goto(base+'index.html');
    assert.equal(response.status(), 200, await page.content());
    await page.waitForFunction(()=>typeof MathExerciseRuntime !== 'undefined');
    await page.evaluate(async()=>{globalThis.py=await MathExerciseRuntime.ensurePyodide();globalThis.heartbeats=0;setInterval(()=>heartbeats++,20);});
    assert.equal(await page.evaluate(()=>py.isWorkerProxy),true);
    assert.equal(await page.evaluate(()=>crossOriginIsolated),label==='isolatedLocalhost');
    if(label==='plainLAN')assert.equal(await page.evaluate(()=>isSecureContext),false);
    assert.equal(await page.evaluate(async()=>py===await MathExerciseRuntime.ensurePyodide()),true);
    assert.equal(await page.evaluate(()=>MathExerciseRuntime.transaction(py,()=>py.runPythonAsync('6*7'))),42);
    assert.deepEqual(await page.evaluate(()=>MathExerciseRuntime.transaction(py,()=>py.runPythonAsync('[1,2,3]'))),[1,2,3]);
    assert.equal(await page.evaluate(()=>MathExerciseRuntime.transaction(py,()=>py.runPythonAsync('import sys\nsys.modules.pop(\"_ctm_executor\", None)\n42'))),42);
    assert.equal(await page.evaluate(()=>MathExerciseRuntime.transaction(py,()=>py.runPythonAsync('42'))),42);
    for(const code of ['while True: pass','while True: print("output flood")','while True: print("")','while True:\n    try:\n        while True: pass\n    except KeyboardInterrupt: pass']) {
      const before=await page.evaluate(()=>{globalThis.output=[];globalThis.finished=null;globalThis.runStart=performance.now();return heartbeats;});
      await page.evaluate(code=>{globalThis.running=MathExerciseRuntime.transaction(py,()=>py.runPythonAsync(code),{onStream:(text,kind)=>output.push({text,kind})}).then(()=>finished='done',e=>finished=String(e));},code);
      await page.waitForTimeout(250);
      assert.ok(await page.evaluate(()=>heartbeats)>before,'page heartbeat must continue during Python');
      await page.locator('#responsive').click();
      const start=Date.now();
      await page.evaluate(()=>MathExerciseRuntime.stop('Stopped; variables reset on restart.'));
      await page.waitForFunction(()=>finished!==null);
      await page.evaluate(async()=>{globalThis.py=await MathExerciseRuntime.ensurePyodide();});
      assert.equal(await page.evaluate(()=>MathExerciseRuntime.transaction(py,()=>py.runPythonAsync('40+2'))),42);
      report.push({label,code:code.split('\n')[0],stopRecoveryMs:Date.now()-start});
    }
    if(label==='isolatedLocalhost') {
      await page.evaluate(()=>{globalThis.inputPrompt=null;globalThis.answer=null;globalThis.inputRun=MathExerciseRuntime.transaction(py,()=>py.runPythonAsync('input("Name: ")'),{onInputRequired:prompt=>inputPrompt=prompt}).then(x=>answer=x);});
      await page.waitForFunction(()=>inputPrompt!==null);
      assert.equal(await page.evaluate(()=>inputPrompt),'Name: ');
      await page.evaluate(()=>py.provideInput('Norsk æøå'));
      await page.waitForFunction(()=>answer!==null);
      assert.equal(await page.evaluate(()=>answer),'Norsk æøå');
    } else {
      const message=await page.evaluate(async()=>{try{await MathExerciseRuntime.transaction(py,()=>py.runPythonAsync('input("Name: ")'));}catch(e){return String(e);}});
      assert.match(message,/cross-origin isolated/);
    }
    if (process.env.P13_TEST_NUMPY === '1') {
      const start=Date.now();
      const answer=await page.evaluate(()=>MathExerciseRuntime.transaction(py,async()=>{
        const code='import numpy as np\nint(np.array([20,22]).sum())';
        await py.loadPackagesFromImports(code);return py.runPythonAsync(code);
      }));
      assert.equal(answer,42); report.push({label,numpyImportMs:Date.now()-start,result:answer});
    }
    if (exerciseSource) {
      const result=await page.evaluate(async source=>{
        const seen=[];const R=MathExerciseRuntime;
        await R.ensureGuard(py);
        const run=async(code,tests,handlers={})=>R.transaction(py,async()=>{
          await py.loadPackagesFromImports(code);
          await R.installModule(py,'_ctm_py_exercise',source);
          await py.globals.set('_ctm_py_request',JSON.stringify({function:'run',args:[code,tests,{syntax_error:'Syntax: {}',test_error:'Error: {}',assertion_failed:'Failed'}]}));
          return JSON.parse(await py.runPythonAsync('__import__("_ctm_py_exercise").call(globals())'));
        },handlers);
        const data=await run('print("learner")','print("TEACHER_ONLY")\nassert True',{onStream:text=>seen.push(text)});
        let overflow,unsupported;
        try{await run('print("x" * 262145)','assert False');}catch(e){overflow=String(e);}
        if(!crossOriginIsolated)try{await run('input("Name?")','assert False',{onInputRequired(){}});}catch(e){unsupported=e.code;}
        const plot=await run('import matplotlib.pyplot as plt\nplt.plot([0,1],[0,1])\nplt.show()','assert True');
        const privatePlot=await run('import matplotlib.pyplot as plt','plt.plot([0,1],[1,0])\nplt.show()');
        return {stdout:data.stdout,tests:data.tests,stream:seen.join(''),overflow,unsupported,plotError:plot.student_error,images:plot.images?.length||0,privateImages:privatePlot.images?.length||0};
      },exerciseSource);
      assert.equal(result.stdout,'learner\n');assert.equal(result.stream,'learner\n');
      assert.ok(result.tests.every(x=>x.passed));assert.match(result.overflow,/capture budget/);
      if(label==='plainLAN')assert.equal(result.unsupported,'input-unavailable');
      assert.equal(result.images,1,JSON.stringify(result));assert.equal(result.privateImages,0);
      report.push({label,exercise:result});
    }
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    await context.close();
  }
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({browser:'Chromium',version:browser.version(),results:report},null,2));
