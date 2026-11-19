// Bounds and the end of a streamed reply (P01, P02): the size of the answer
// and of one event line, the idle limit and the deadline, the terminal
// [DONE]/finish_reason and a stream that closes before either.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const F=require('../_extensions/ctm-libs/feedback/feedback-core.js');
const C=require('./helpers/ctm-libs.cjs');
const data=o=>'data: '+JSON.stringify(o)+'\n\n';
const delta=(content,finish)=>data({choices:[{delta:{content},...(finish?{finish_reason:finish}:{})}]});
// A streamed body: `next(i)` gives the i-th chunk (a string), null for the end,
// or a promise of either; the body errors on abort like a real fetch body.
function stream(next){
 const enc=new TextEncoder(),log={reads:0,cancelled:false};
 const fetch=async(url,{signal})=>({ok:true,headers:{get:()=>'text/event-stream'},json:async()=>{throw new Error('not json');},
  body:{getReader:()=>({read:async()=>{
    if(signal.aborted)throw new Error('aborted');
    const chunk=await next(log.reads++);
    if(signal.aborted)throw new Error('aborted');
    return chunk===null?{done:true}:{value:enc.encode(chunk),done:false};
   },cancel:async()=>{log.cancelled=true;}})}});
 return {log,client:limits=>F.createClient({baseUrl:'https://provider.invalid/v1',model:'reasoning'},{fetch,replyLimits:limits})};
}
const chunks=list=>i=>i<list.length?list[i]:null;
const later=(ms,value)=>new Promise(resolve=>setTimeout(()=>resolve(value),ms));
const generate=(client,options={})=>client.complete([{role:'user',content:'Generate'}],{generation:true,...options});

test('a stream ends at [DONE]: later data is neither read nor appended',async()=>{
 const same=stream(chunks([delta('A')+'data: [DONE]\n\n'+delta('EXTRA AFTER DONE')]));
 assert.equal((await generate(same.client())).text,'A');assert.equal(same.log.cancelled,true);
 const next=stream(chunks([delta('A'),'data: [DONE]\n\n',delta('EXTRA')]));
 assert.equal((await generate(next.client())).text,'A');assert.equal(next.log.reads,2);assert.equal(next.log.cancelled,true);
});
test('a finish_reason ends the stream; a provider that then closes without [DONE] succeeds',async()=>{
 const closed=stream(chunks([delta('A'),delta('B','stop'),null]));
 assert.equal((await generate(closed.client())).text,'AB');
 const keepsOpen=stream(chunks([delta('A','stop'),delta('EXTRA')]));
 assert.equal((await generate(keepsOpen.client())).text,'A');assert.equal(keepsOpen.log.reads,1);
});
test('a stream that closes before [DONE] or a finish_reason is incomplete, not a short success',async()=>{
 const cut=stream(chunks([delta('{"question":'),delta('"Q"')]));
 await assert.rejects(generate(cut.client()),e=>e.code==='STREAM_INCOMPLETE'&&/broke off/.test(e.message));
 const empty=stream(chunks([': keep-alive\n\n']));
 await assert.rejects(generate(empty.client()),e=>e.code==='STREAM_INCOMPLETE');
 // The last line needs no newline when the stream ends.
 const unterminated=stream(chunks([delta('A'),'data: [DONE]']));
 assert.equal((await generate(unterminated.client())).text,'A');
});
test('one event line longer than the line limit stops the stream, also before its newline',async()=>{
 const huge=stream(chunks([delta('x'.repeat(2*1024*1024))]));
 await assert.rejects(generate(huge.client()),e=>e.code==='OUTPUT_LIMIT'&&/1048576 characters/.test(e.message));
 assert.equal(huge.log.cancelled,true);
 // A line that never ends: chunks without a newline are not buffered without bound.
 const endless=stream(()=>'data: '+'x'.repeat(256*1024));
 await assert.rejects(generate(endless.client()),e=>e.code==='OUTPUT_LIMIT');
 assert.ok(endless.log.reads<=6,'stops after about 1 MiB, read '+endless.log.reads+' chunks');assert.equal(endless.log.cancelled,true);
});
test('an answer longer than the text limit stops the stream before it is appended',async()=>{
 const long=stream(i=>delta('y'.repeat(40000)));
 await assert.rejects(generate(long.client()),e=>e.code==='OUTPUT_LIMIT'&&/100000 characters/.test(e.message));
 assert.equal(long.log.reads,3);assert.equal(long.log.cancelled,true);
 const small=stream(i=>delta('y'.repeat(10)));
 await assert.rejects(generate(small.client({maxText:25})),e=>e.code==='OUTPUT_LIMIT');assert.equal(small.log.reads,3);
 // A JSON (non-streamed) answer is held to the same text limit.
 const json=F.createClient({baseUrl:'https://provider.invalid/v1',model:'fast'},{fetch:async()=>({ok:true,json:async()=>({choices:[{message:{content:'z'.repeat(100001)},finish_reason:'stop'}]})})});
 await assert.rejects(json.complete([{role:'user',content:'Feedback'}]),e=>e.code==='OUTPUT_LIMIT');
});
test('keep-alive comments and malformed events are no progress: the idle limit ends the stream',async()=>{
 const pings=stream(()=>later(5,': keep-alive\n\ndata: {not json\n\ndata: {"choices":[{"delta":{"role":"assistant","content":""}}]}\n\n'));
 const started=Date.now();
 await assert.rejects(generate(pings.client({idleMs:60})),e=>e.code==='TIMEOUT'&&/sent nothing new/.test(e.message));
 assert.ok(Date.now()-started<1000);assert.ok(pings.log.reads>3);assert.equal(pings.log.cancelled,true);
 // Content and reasoning deltas are progress and renew the idle limit.
 const steady=stream(i=>i<20?later(10,i%2?delta('a'):data({choices:[{delta:{reasoning_content:'thinking'}}]})):delta('','stop'));
 assert.equal((await generate(steady.client({idleMs:60}))).text,'a'.repeat(10));
});
test('the deadline ends a stream that keeps making progress',async()=>{
 const endless=stream(()=>later(5,delta('a')));
 const started=Date.now();
 await assert.rejects(generate(endless.client({idleMs:1000,deadlineMs:80})),e=>e.code==='TIMEOUT'&&/took longer than/.test(e.message));
 assert.ok(Date.now()-started<1000);assert.equal(endless.log.cancelled,true);
 // A body that ignores the abort does not keep the request waiting.
 const deaf=F.createClient({baseUrl:'https://provider.invalid/v1',model:'reasoning'},{replyLimits:{idleMs:30},fetch:async()=>({ok:true,headers:{get:()=>'text/event-stream'},
  body:{getReader:()=>({read:()=>new Promise(()=>{})})}})});
 await assert.rejects(generate(deaf),e=>e.code==='TIMEOUT');
});
test('the defaults: idle limit is the time budget, the deadline twice the budget',async()=>{
 const delays=[];const realSetTimeout=global.setTimeout;
 global.setTimeout=(fn,ms,...rest)=>{delays.push(ms);return realSetTimeout(fn,1e9,...rest);};
 try{const done=stream(chunks([delta('A','stop')]));await generate(done.client());}
 finally{global.setTimeout=realSetTimeout;}
 assert.equal(delays[0],300000);assert.equal(delays[1],300000);assert.ok(delays[2]>599000&&delays[2]<=600000);
});
test('the feedback interface shows stream failures in the learner\'s language',async()=>{
 const dom=new JSDOM('<!doctype html><html lang="de"><body></body></html>',{url:'https://example.invalid/page',runScripts:'outside-only'});
 const w=dom.window;
 for(const name of ['feedback-core.js','feedback-dom.js','ai-feedback.js'])w.eval(fs.readFileSync(path.join(C.feedback,name),'utf8'));
 const A=w.AIFeedback,trigger=w.document.createElement('button'),output=w.document.createElement('div');
 for(const [code,key] of [['STREAM_INCOMPLETE','incomplete'],['OUTPUT_LIMIT','tooLong'],['TIMEOUT','timedOut']]){
  const handle=A.attach({button:trigger,output,uiLanguage:'de',getRequest:async()=>({task:'T',responses:[{id:'r',value:'x'}]}),
   client:{request:async()=>{throw new A.FeedbackError(code,'English detail');}}});
  await handle.request();
  assert.equal(output.textContent,A.locales.de[key]);assert.notEqual(A.locales.de[key],A.locales.en[key]);
  handle.dispose();
 }
 w.close();
});
