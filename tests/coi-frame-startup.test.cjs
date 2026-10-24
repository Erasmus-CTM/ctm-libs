const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const runtime=path.join(__dirname,'../_extensions/ctm-libs/runtime');
const coordinator=fs.readFileSync(path.join(runtime,'coi-frame-startup.js'),'utf8');
const adaptorSource=fs.readFileSync(path.join(runtime,'mathjax-opaque-adaptor.js'),'utf8');
const protocol='ctm-coi-frame-startup';
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function pair({flag=true,state='loading',transport}={}){
 const parentListeners={},childListeners=new Set(),workers=[],requests=[],replies=[],errors=[],fetches=[];
 const childSource={},parentSource={postMessage(data){requests.push(data);queueMicrotask(()=>parentListeners.message({source:childSource,data,origin:'null'}));}};
 childSource.postMessage=data=>{replies.push(data);queueMicrotask(()=>childListeners.forEach(fn=>fn({source:parentSource,data,origin:'https://parent.test'})));};
 const frame={isConnected:true,contentWindow:childSource};
 const parent={document:{readyState:state,querySelectorAll:()=>[frame],addEventListener:(name,fn)=>{parentListeners[name]=fn;}},console:{error:(...args)=>errors.push(args)},addEventListener:(name,fn)=>{parentListeners[name]=fn;}};
 vm.createContext(parent);vm.runInContext(coordinator,parent);
 const config={},window={MathJax:config,parent:parentSource,addEventListener:(name,fn)=>childListeners.add(fn),removeEventListener:(name,fn)=>childListeners.delete(fn)};
 if(flag)window.CTM_COI_FRAME_STARTUP={protocol,version:1};
 const child={self:{origin:'null'},window,crypto:webcrypto,document:{currentScript:{getAttribute:()=>transport}},fetch:async(url,options)=>{fetches.push({url,options});return {ok:true,text:async()=>'self.originalWorker = true;'};},Worker:class{constructor(url){this.url=url;workers.push(this);}}};
 vm.createContext(child);vm.runInContext(adaptorSource,child);
 let factory;const native={};const browserAdaptor=()=>native;config.startup.adaptor='browserAdaptor';
 child.MathJax={config,_:{adaptors:{browserAdaptor:{browserAdaptor}}},startup:{constructors:{browserAdaptor},registerConstructor(name,value){factory=value;},useAdaptor(){},defaultReady(){return 'ready';}}};
 assert.equal(config.startup.ready(),'ready');const adaptor=factory();
 return {parent,parentListeners,childListeners,parentSource,childSource,frame,workers,requests,replies,errors,fetches,adaptor,start:()=>adaptor.createWorker(()=>{},{path:'https://vendor.test/sre',worker:'speech-worker.js',maps:'https://vendor.test/maps'})};
}
test('flagged SRE worker waits for deferred module publication at DCL and retained COI decision',async()=>{
 const f=pair(),gate=defer();const pending=f.start();await tick();assert.equal(f.requests.length,1);assert.equal(f.workers.length,0);
 f.parent.qpyodideCoiSettled=gate.promise;f.parentListeners.DOMContentLoaded();await tick();assert.equal(f.workers.length,0);assert.equal(f.replies.length,0);
 gate.resolve();await pending;assert.equal(f.workers.length,1);assert.equal(f.replies[0].type,'allow');
});
test('ordinary no-qpy parent releases after parsed content; standalone unflagged helper never waits for parent',async()=>{
 const ordinary=pair();const pending=ordinary.start();ordinary.parentListeners.DOMContentLoaded();await pending;assert.equal(ordinary.workers.length,1);
 const standalone=pair({flag:false});await standalone.start();assert.equal(standalone.workers.length,1);assert.equal(standalone.requests.length,0);
});
test('retired COI document never releases worker and removed iframe cannot receive a later permission',async()=>{
 const retired=pair(),gate=defer();retired.parent.qpyodideCoiSettled=gate.promise;retired.start();retired.parentListeners.DOMContentLoaded();await tick();assert.equal(retired.workers.length,0);assert.equal(retired.replies.length,0);
 const removed=pair(),other=defer();removed.parent.qpyodideCoiSettled=other.promise;removed.start();removed.parentListeners.DOMContentLoaded();await tick();removed.frame.isConnected=false;other.resolve();await tick();assert.equal(removed.workers.length,0);assert.equal(removed.replies.length,0);
});
test('child ignores sibling source and parent replies with wrong nonce or version',async()=>{
 const f=pair(),gate=defer();f.parent.qpyodideCoiSettled=gate.promise;const pending=f.start();await tick();const request=f.requests[0];
 for(const [source,data] of [[{}, {...request,type:'allow'}],[f.parentSource,{...request,type:'allow',nonce:'f'.repeat(32)}],[f.parentSource,{...request,type:'allow',version:2}]])f.childListeners.forEach(fn=>fn({source,data}));
 f.parentListeners.DOMContentLoaded();await tick();assert.equal(f.workers.length,0);gate.resolve();await pending;assert.equal(f.workers.length,1);
});
test('parent authenticates live iframe source and sends only the newest document nonce',async()=>{
 const f=pair(),gate=defer();f.parent.qpyodideCoiSettled=gate.promise;
 const message=nonce=>({protocol,version:1,type:'request',nonce});
 f.parentListeners.message({source:{},data:message('a'.repeat(32))});f.parentListeners.message({source:null,data:message('a'.repeat(32))});
 f.parentListeners.message({source:f.childSource,data:{...message('a'.repeat(32)),version:2}});f.parentListeners.DOMContentLoaded();await tick();assert.equal(f.replies.length,0);
 f.parentListeners.message({source:f.childSource,data:message('a'.repeat(32))});f.parentListeners.message({source:f.childSource,data:message('b'.repeat(32))});gate.resolve();await tick();assert.equal(f.replies.length,1);assert.equal(f.replies[0].nonce,'b'.repeat(32));
});
test('decision failure stays visible and rejects only the requesting optional worker',async()=>{
 const f=pair(),gate=defer(),error=new Error('decision failed');f.parent.qpyodideCoiSettled=gate.promise;const pending=f.start();const rejected=assert.rejects(pending,/startup decision failed/);f.parentListeners.DOMContentLoaded();gate.reject(error);await rejected;
 assert.equal(f.workers.length,0);assert.equal(f.errors.length,1);assert.equal(f.errors[0][1],error);assert.equal(f.replies[0].type,'error');
});
test('CORS fetch and worker creation both wait for the retained parent decision',async()=>{
 const f=pair({transport:'cors'}),gate=defer();f.parent.qpyodideCoiSettled=gate.promise;
 const pending=f.start();f.parentListeners.DOMContentLoaded();await tick();
 assert.equal(f.fetches.length,0);assert.equal(f.workers.length,0);
 gate.resolve();await pending;
 assert.equal(f.fetches.length,1);assert.equal(f.fetches[0].url,'https://vendor.test/sre/speech-worker.js');
 assert.equal(f.fetches[0].options.mode,'cors');assert.equal(f.fetches[0].options.credentials,'omit');assert.equal(f.workers.length,1);
 const imports=[],scope={self:{},importScripts:url=>imports.push(url)};
 vm.runInNewContext(decodeURIComponent(f.workers[0].url.split(',')[1]),scope);
 assert.equal(scope.self.maps,'https://vendor.test/maps');
 assert.equal(decodeURIComponent(imports[0].split(',')[1]),'self.originalWorker = true;');
});
test('CORS transport does not fetch for retired documents or rejected parent decisions',async()=>{
 const retired=pair({transport:'cors'}),gate=defer();retired.parent.qpyodideCoiSettled=gate.promise;
 retired.start();retired.parentListeners.DOMContentLoaded();await tick();
 assert.equal(retired.fetches.length,0);assert.equal(retired.workers.length,0);
 const failed=pair({transport:'cors'}),other=defer();failed.parent.qpyodideCoiSettled=other.promise;
 const pending=failed.start(),rejected=assert.rejects(pending,/startup decision failed/);
 failed.parentListeners.DOMContentLoaded();other.reject(new Error('decision failed'));await rejected;
 assert.equal(failed.fetches.length,0);assert.equal(failed.workers.length,0);
});
test('generic document decision holds a flagged worker until retention',async()=>{
 const f=pair(),gate=defer();f.parent.CTMCoiSettled=gate.promise;const pending=f.start();f.parentListeners.DOMContentLoaded();await tick();assert.equal(f.workers.length,0);assert.equal(f.replies.length,0);
 gate.resolve();await pending;assert.equal(f.workers.length,1);assert.equal(f.replies.length,1);
});
test('generic retirement takes precedence over an already settled IDE fallback',async()=>{
 const f=pair();f.parent.CTMCoiSettled=new Promise(()=>{});f.parent.qpyodideCoiSettled=Promise.resolve();f.start();f.parentListeners.DOMContentLoaded();await tick();assert.equal(f.workers.length,0);assert.equal(f.replies.length,0);
});
test('generic decision failure remains visible despite a resolved IDE fallback',async()=>{
 const f=pair(),gate=defer(),error=new Error('generic decision failed');f.parent.CTMCoiSettled=gate.promise;f.parent.qpyodideCoiSettled=Promise.resolve();const rejected=assert.rejects(f.start(),/startup decision failed/);f.parentListeners.DOMContentLoaded();gate.reject(error);await rejected;assert.equal(f.workers.length,0);assert.equal(f.errors[0][1],error);
});
