const test=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'../_extensions/ctm-libs/ui',name),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(numbered){
 const manifest={course:'course',save:true,progress:true,exercises:[{component:'math-exercise',id:'sum',save:true}]};
 const dom=new JSDOM('<main><div id="sum"></div></main><script id="ctm-store-manifest" type="application/json">'+JSON.stringify(manifest)+'</script>',{url:'https://example.test/chapter.html',runScripts:'outside-only'});
 const w=dom.window;w.TextEncoder=TextEncoder;w.eval(source('ctm-layout.js'));w.CTMLayout.ready=fn=>fn();
 w.eval(source('ctm-store.js'));w.eval(source('variants.js'));w.eval(source('ctm-progress.js'));
 const approved={n:7,id:'seven',hash:'approved'},proposal={n:null,id:'new',hash:'proposal',proposal:true};
 const chooser=w.CTMVariants.create({label:'sum',variants:[approved,proposal],allowProposals:true,seed:'fixed',page:'page'});chooser.restore({variant:approved});
 const events=[];w.document.addEventListener('ctm:result',event=>events.push(event.detail));
 const handle=w.CTMStore.register({component:'math-exercise',id:'sum',source:'source',save:true,numberedVariantResults:numbered,
  variant:()=>chooser.state().variant,proposal:()=>chooser.state().proposal,allowProposals:true,seen:()=>chooser.seen(),variants:()=>[approved,proposal],read:()=>({answer:'x'}),write(){}});
 return{w,dom,chooser,handle,events,approved,proposal,record:()=>JSON.parse(w.localStorage.getItem(w.CTMStore.key('sum'))),tile:()=>w.document.querySelector('.ctm-progress button')};
}
test('legacy result descriptor and explicit override remain unchanged by default',()=>{
 const p=fixture(false);p.handle.result({status:'correct',score:1});assert.deepEqual(plain(p.events[0].variant),p.approved);assert.equal('variantIdentity' in p.events[0],false);
 const override={n:31,id:'override',hash:'other'};p.handle.result({status:'wrong',score:0,variant:override});assert.deepEqual(plain(p.events[1].variant),override);
 assert.deepEqual(p.record().variant,p.approved);p.dom.window.close();
});
test('numbered events preserve separate identity, P17 and progress for approved choices',()=>{
 const p=fixture(true);p.handle.result({status:'correct',score:1});const event=p.events[0];
 assert.equal(event.variant,7);assert.deepEqual(plain(event.variantIdentity),p.approved);assert.deepEqual(p.record().variant,p.approved);assert.equal(p.tile().dataset.status,'correct');
 event.variantIdentity.n=999;assert.equal(p.chooser.state().variant.n,7);assert.equal(p.record().variant.n,7);
 p.handle.result({status:'invalid',score:0});assert.equal(p.events[1].variant,7);assert.equal(p.tile().dataset.status,'correct');p.dom.window.close();
});
test('proposal results have null public number/identity while P17 retains its proposal',()=>{
 const p=fixture(true);p.chooser.restore({variant:null,proposal:{id:p.proposal.id,hash:p.proposal.hash}});p.handle.choice(p.chooser.state());p.handle.result({status:'partial',score:0.5});
 assert.equal(p.events[0].variant,null);assert.equal(p.events[0].variantIdentity,null);assert.equal(p.record().variant,null);assert.deepEqual(p.record().proposal,{id:'new',hash:'proposal'});assert.equal(p.tile().dataset.status,'partial');p.dom.window.close();
});
