const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const F=require('../_extensions/ctm-libs/feedback/feedback-core.js');
const configuration={layers:[{policies:{course:{'base-prompt':'COURSE CAP'},hints:{steps:[{'step-prompt':'HINT'}]},specific:{'base-prompt':'PRACTICE',harder:'MORE VECTORS'},child:{extends:'specific',easier:'FEWER VECTORS'}},exercises:{'math-exercise':{original:{same:'SAME LEVEL'}}}}],projectPolicy:'hints',generationPolicy:{default:'course','math-exercise':'child'}};
test('one dictionary resolves independent defaults, selections and full common/integration instructions',()=>{
 const g=F.resolveGenerationPolicy('math-exercise','en',configuration,{exercise:'original'});
 assert.deepEqual(g.basePrompts,['COURSE CAP','PRACTICE']);assert.equal(g.harder,'MORE VECTORS');assert.equal(g.easier,'FEWER VECTORS');assert.equal(g.same,'SAME LEVEL');
 const f=F.resolvePolicy('math-exercise','en',{},configuration,{exercise:'original'});assert.deepEqual(f.steps,[{'step-prompt':'HINT'}]);
 assert.match(F.resolveGenerationPolicy('math-exercise','en',{...configuration,generationPolicy:undefined}).basePrompts.join(' '),/Create one self-contained/);
 assert.doesNotMatch(F.resolveGenerationPolicy('math-exercise','en',{...configuration,generationPolicy:undefined}).basePrompts.join(' '),/HINT/);
 assert.deepEqual(F.resolveGenerationPolicy('math-exercise','en',{...configuration,generationPolicy:'specific'}).basePrompts,['PRACTICE']);
 assert.throws(()=>F.resolveGenerationPolicy('math-exercise','en',{...configuration,generationPolicy:'missing'}),/Unknown/);
});
test('a shared policy may retain teaching steps without requiring a separate generation schema',()=>{
 const c={layers:[{policies:{both:{'base-prompt':'BOTH',steps:[{'step-prompt':'GUIDE'}],harder:'MORE'}}}],projectPolicy:'both',generationPolicy:'both'};
 assert.deepEqual(F.resolveGenerationPolicy('math-exercise','en',c).basePrompts,['BOTH']);
 assert.equal(F.resolvePolicy('stack','en',{},c).steps[0]['step-prompt'],'GUIDE');
});
const response=text=>({ok:true,json:async()=>({choices:[{message:{content:text},finish_reason:'stop'}]})});
test('generation strips reasoning before validation and uses its own budget without disabling thinking',async()=>{
 const calls=[];const client=F.createClient({baseUrl:'https://provider.invalid/v1',model:'kimi-k2.5'},{fetch:async(url,request)=>{calls.push(JSON.parse(request.body));return response('<think>private</think><analysis>private</analysis>{"question":"Q"}');}});
 const result=await client.complete([{role:'system',content:'JSON'}],{generation:true,validate:text=>{JSON.parse(text);return '';}});
 assert.equal(result.text,'{"question":"Q"}');assert.equal(calls[0].max_tokens,16384);assert.equal(calls[0].thinking,undefined);assert.equal(calls.length,1);
});
test('ordinary feedback keeps token budget and reasoning-leak rejection',async()=>{
 const bodies=[];const client=F.createClient({baseUrl:'https://provider.invalid',model:'fast'},{fetch:async(url,request)=>{bodies.push(JSON.parse(request.body));return response('<think>private</think>feedback');}});
 await assert.rejects(client.complete([{role:'user',content:'Feedback'}]),e=>e.code==='REASONING');assert.equal(bodies.length,2);assert.equal(bodies[0].max_tokens,8192);
});
test('per-call timeout and cancellation stop the actual request and reject late responses',async()=>{
 const client=F.createClient({baseUrl:'https://provider.invalid',model:'reasoning'},{fetch:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort'))))});
 await assert.rejects(client.complete([{role:'user',content:'Generate'}],{generation:true,timeoutMs:5}),e=>e.code==='TIMEOUT');
 const controller=new AbortController();const pending=client.complete([{role:'user',content:'Generate'}],{generation:true,signal:controller.signal});controller.abort();await assert.rejects(pending,e=>e.code==='ABORTED');
});
test('a correction retry gets a fresh time budget instead of the rest of the first call',async()=>{
 let calls=0;const slow=(text)=>new Promise(resolve=>setTimeout(()=>resolve(response(text)),60));
 const client=F.createClient({baseUrl:'https://provider.invalid/v1',model:'reasoning'},{fetch:async()=>{calls++;return slow(calls===1?'not json':'{"question":"Q"}');}});
 const result=await client.complete([{role:'user',content:'Generate'}],{generation:true,timeoutMs:100,validate:text=>{try{JSON.parse(text);return '';}catch{return 'Return JSON.';}}});
 assert.equal(result.text,'{"question":"Q"}');assert.equal(calls,2);
});
test('generation allows five minutes per model call by default',async()=>{
 const delays=[];const realSetTimeout=global.setTimeout;
 global.setTimeout=(fn,ms,...rest)=>{delays.push(ms);return realSetTimeout(fn,1e9,...rest);};
 try{const client=F.createClient({baseUrl:'https://provider.invalid/v1',model:'reasoning'},{fetch:async()=>response('{"question":"Q"}')});
  await client.complete([{role:'user',content:'Generate'}],{generation:true});await client.complete([{role:'user',content:'Feedback'}]);}
 finally{global.setTimeout=realSetTimeout;}
 assert.deepEqual(delays,[300000,60000]);
});
test('changing generation-only fields does not reset a teaching hint counter',async()=>{
 const w=new JSDOM('<button>Feedback</button><div id="out"></div>',{url:'https://course.invalid/task',runScripts:'outside-only'}).window;w.AbortController=AbortController;
 for(const file of ['feedback-core.js','feedback-dom.js','ai-feedback.js'])w.eval(fs.readFileSync(path.join(__dirname,'../_extensions/ctm-libs/feedback',file),'utf8'));
 w.__aiFeedbackPolicies={layers:[{policies:{shared:{steps:[{'step-prompt':'FIRST'},{'step-prompt':'SECOND'}],harder:'ONE'}}}],projectPolicy:'shared'};
 const levels=[];const api=w.AIFeedback.attach({integration:'math-exercise',id:'original',button:w.document.querySelector('button'),output:w.document.querySelector('#out'),client:{request:async request=>{levels.push(request.feedback.level);return {text:'A hint',format:'markdown'};}},getRequest:()=>({profile:'mathematics',task:'Find x',responses:[{id:'x',value:'1'}],feedback:{language:'en'}})});
 await api.request();w.__aiFeedbackPolicies.layers[0].policies.shared.harder='TWO';await api.request();assert.deepEqual(levels,[1,2]);const ephemeral=w.AIFeedback.attach({integration:'math-exercise',id:'',button:w.document.createElement('button'),output:w.document.createElement('div'),client:{request:async()=>({text:'A hint',format:'markdown'})},getRequest:()=>({profile:'mathematics',task:'Find x',responses:[{id:'x',value:'1'}],feedback:{language:'en'}})});await ephemeral.request();assert.equal(w.sessionStorage.getItem('null|policy'),null);w.close();
});
test('Fetch models populates identical independent feedback and generation dropdowns',async()=>{
 const w=new JSDOM('',{url:'https://course.invalid/task',runScripts:'outside-only'}).window;
 w.AbortSignal=AbortSignal;
 const calls=[];
 w.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({data:[{id:'fast-model'},{id:'reasoning-model'},{id:'another-model'}]})};};
 for(const file of ['feedback-core.js','feedback-dom.js','ai-feedback.js'])w.eval(fs.readFileSync(path.join(__dirname,'../_extensions/ctm-libs/feedback',file),'utf8'));
 w.AIFeedback.saveConfig({mode:'api',baseUrl:'https://provider.invalid/v1',apiKey:'test-key',model:'fast-model',generatorModel:'reasoning-model',storage:'local'});
 w.AIFeedback.openSettings();
 const buttons=[...w.document.querySelectorAll('button')];
 await buttons.find(button=>button.textContent==='Fetch models').onclick();
 const feedback=w.document.querySelector('select[aria-label="Model"]');
 const generation=w.document.querySelector('select[aria-label="Model for generating problems"]');
 assert.ok(feedback&&!feedback.hidden);assert.ok(generation&&!generation.hidden);
 assert.deepEqual([...feedback.options].map(o=>o.value),[...generation.options].map(o=>o.value));
 assert.equal(feedback.value,'fast-model');assert.equal(generation.value,'reasoning-model');
 generation.value='another-model';generation.onchange();
 feedback.value='reasoning-model';feedback.onchange();
 buttons.find(button=>button.textContent==='Save settings').onclick();
 const cfg=w.AIFeedback.loadConfig();assert.equal(cfg.model,'reasoning-model');assert.equal(cfg.generatorModel,'another-model');
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://provider.invalid/v1/models');assert.equal(calls[0].options.headers.Authorization,'Bearer test-key');
 w.close();
});
test('generation selector registers with PR48 shared Settings and keeps the standalone fallback',()=>{
 const w=new JSDOM('',{url:'https://course.invalid/task',runScripts:'outside-only'}).window;
 let registered,opened,closed=0;
 w.CTMSettings={register:(id,title,content)=>{registered={id,title,content};w.document.body.append(content);},open:id=>{opened=id;},close:()=>{closed++;}};
 for(const file of ['feedback-core.js','feedback-dom.js','ai-feedback.js'])w.eval(fs.readFileSync(path.join(__dirname,'../_extensions/ctm-libs/feedback',file),'utf8'));
 w.AIFeedback.saveConfig({mode:'api',baseUrl:'https://provider.invalid',model:'fast',generatorModel:'reasoning',storage:'local'});
 w.AIFeedback.settingsButton('en').click();assert.equal(opened,'ai');assert.equal(registered.id,'ai');assert.equal(registered.content.tagName,'DIV');
 assert.equal(registered.content.getAttribute('aria-labelledby'),'ctm-settings-ai-title');assert.equal(w.document.querySelectorAll('dialog.ai-feedback-settings').length,0);
 const generator=[...registered.content.querySelectorAll('label')].find(el=>el.firstChild.textContent==='Model for generating problems').querySelector('input');assert.equal(generator.value,'reasoning');
 [...registered.content.querySelectorAll('button')].find(b=>b.textContent==='Save settings').click();assert.equal(closed,1);assert.equal(w.AIFeedback.loadConfig().generatorModel,'reasoning');w.close();
});
