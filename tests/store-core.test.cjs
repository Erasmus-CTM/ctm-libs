const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function checkStore(source, assert) {
  var count = 0;
  function ok(value, reason) { assert(value, reason); count++; }
  function setup(config, existing, quota, blocked, Channel) {
    var local = Object.assign({}, existing), session = {}, events = [], windowEvents = {}, timers = [], status = {textContent: ''};
    function storage(map) { return {
      get length() { return Object.keys(map).length; }, key: function(i) { return Object.keys(map)[i]; },
      getItem: function(key) { return Object.prototype.hasOwnProperty.call(map,key) ? map[key] : null; },
      setItem: function(key,value) { if (map === local && quota && quota()) throw Error('QuotaExceededError'); map[key]=value; },
      removeItem: function(key) { delete map[key]; }
    }; }
    var document = {readyState:'complete', getElementById:function(){return {textContent:JSON.stringify(config || {})};},
      querySelector:function(selector){return selector === 'meta[name="quarto:offset"]' ? {content:'../'} : selector === '.ctm-save-status' ? status : null;},
      addEventListener:function(){}, dispatchEvent:function(event){events.push(event);}};
    var window = {localStorage:storage(local),sessionStorage:storage(session),addEventListener:function(type,fn){(windowEvents[type] || (windowEvents[type]=[])).push(fn);},
      crypto:{getRandomValues:function(bytes){for(var i=0;i<bytes.length;i++)bytes[i]=i+1;}}};
    if(Channel)window.BroadcastChannel=Channel;
    if(blocked)Object.defineProperty(window,'localStorage',{get:function(){throw Error('SecurityError');}});
    function URL(){this.pathname='/course/';}
    function CustomEvent(type,opts){this.type=type;this.detail=opts.detail;}
    function Encoder(){}
    Encoder.prototype.encode=function(text){return new Uint8Array(unescape(encodeURIComponent(text)).length);};
    new Function('window','document','location','URL','CustomEvent','TextEncoder','setTimeout','clearTimeout',source)(window,document,
      {pathname:config && config.testPath || '/course/chapter/x.html',href:'https://example.test/course/chapter/x.html'},URL,CustomEvent,Encoder,function(fn){var token={fn:fn,canceled:false};timers.push(token);return token;},function(token){if(token)token.canceled=true;});
    var input={code:'answer'},writes=[],clears=0;
    function register(extra){return window.CTMStore.register(Object.assign({component:'code',id:'ex',source:'0123456789abcdef',
      read:function(){return input;},write:function(value,meta){writes.push({value:value,meta:meta});},clear:function(){clears++;}},extra));}
    return {store:window.CTMStore,local:local,session:session,events:events,register:register,writes:writes,
      input:function(value){input=value;},clears:function(){return clears;},fire:function(event){(windowEvents.storage || []).forEach(function(fn){fn(event);});},runTimers:function(){timers.forEach(function(token){if(!token.canceled){token.canceled=true;token.fn();}});}};
  }
  function record(extra){return Object.assign({v:1,component:'code',source:'0123456789abcdef',inputs:{code:'old'}},extra);}
  var x=setup(),key=x.store.key('ex'),h=x.register();
  ok(x.store.enabled(),'default on');
  ok(key==='ctm|1|%2Fcourse%2F|chapter%2Fx|ex','encoded canonical key');
  x.local[key]=JSON.stringify(record()); ok(h.restore().state==='restored' && x.writes[0].value.code==='old','restore inputs without checking');
  x.local[key]=JSON.stringify(record({source:'changed'}));ok(h.restore().state==='changed' && x.writes.length===1,'source mismatch no fill');
  x.local[key]=JSON.stringify(record({v:4}));h.result({status:'correct',score:1});ok(JSON.parse(x.local[key]).v===4,'unknown future version preserved');
  h.clear();h.changed();h.result({status:'invalid',score:0});ok(JSON.parse(x.local[key]).inputs.code==='answer' && !JSON.parse(x.local[key]).result,'invalid check flushes pending input without grade');
  h.clear();x.input({code:'ø'.repeat(33000)});h.result({status:'wrong',score:0});ok(!x.local[key],'64KiB measures UTF8');
  h.result({status:'wrong',score:0});ok(x.events.filter(function(event){return event.type==='ctm:store-message';}).length===1,'oversize notice once');
  x.input({code:'answer'});h.result({status:'partial',score:.5});ok(JSON.parse(x.local[key]).result.score===.5,'last result stored');
  x.store.seed();x.local['ctm|1|other|x|ex']='other';var cleared=x.clears();x.store.setEnabled(false);
  ok(!x.local[key] && x.local['ctm|1|other|x|ex']==='other','off deletes only this course');
  ok(x.clears()===cleared,'off preserves active editor');
  ok(!!x.session['ctm|1|%2Fcourse%2F|~seed'] && !x.local['ctm|1|%2Fcourse%2F|~seed'],'off seed in session');
  x.store.setEnabled(true);ok(!x.session['ctm|1|%2Fcourse%2F|~seed'] && !!x.local['ctm|1|%2Fcourse%2F|~seed'],'seed follows on');
  var v=setup(),vk=v.store.key('ex'),deployed=[{n:2,id:'two',hash:'b'},{n:1,id:'one',hash:'a'}];
  var vh=v.register({variant:function(){return deployed[0];},variants:function(){return deployed;}});
  v.local[vk]=JSON.stringify(record({variant:{n:1,id:'one',hash:'a'},seen:[1]}));
  ok(vh.restore().variant.n===1,'variant hash exact');
  deployed[1].hash='edited';ok(vh.restore().state==='changed','variant n fallback changed');
  deployed.pop();ok(vh.restore().state==='withdrawn','variant withdrawn');
  vh.result({status:'correct',score:1});ok(JSON.stringify(JSON.parse(v.local[vk]).seen)==='[1,2]','seen cycle retained');
  var l=setup(),lk=l.store.key('ex'),removed=0,reads=0;
  l.local[lk]=JSON.stringify(record());var lh=l.register({legacy:[{read:function(){reads++;return {inputs:{code:'legacy'}};},remove:function(){removed++;}}]});
  ok(lh.restore().state==='restored' && l.writes[0].value.code==='legacy' && removed===1,'legacy after new wins');
  l.store.setEnabled(false);lh.restore();ok(reads===1,'off never reads legacy');
  var q=setup({},null,function(){return true;}),deleted=false;
  var qh=q.register({legacy:[{read:function(){return {inputs:{code:'legacy'}};},remove:function(){deleted=true;}}]});
  qh.restore();ok(!deleted,'quota never deletes legacy');
  ok(qh.restore().state==='restored','quota memory restores');
  q.local[q.store.key('persisted')]=JSON.stringify(record());q.store.setEnabled(false);ok(!q.local[q.store.key('persisted')],'quota still deletes durable keys');
  var n=setup(),nk=n.store.key('ex');n.local[nk]=JSON.stringify(record());removed=0;
  var nh=n.register({legacy:[{read:function(){return {inputs:null};},remove:function(){removed++;}}]});
  ok(nh.restore().state==='empty' && !n.local[nk] && removed===1,'legacy starter deletes safely');
  var m=setup({exercises:[{id:'ex',save:false}]}),mh=m.register();mh.result({status:'correct',score:1});ok(!m.local[m.store.key('ex')],'duplicate manifest disabled');
  var full=true,r=setup({}, {'ctm|1|%2Fcourse%2F|chapter%2Fx|old':JSON.stringify(record())},function(){return full;});
  r.register().result({status:'wrong',score:0});full=false;r.store.setEnabled(false);var reload=setup({},r.local);
  ok(!reload.store.enabled(),'quota recovery persists off preference across reload');
  ok(!reload.local[reload.store.key('old')],'durable deletion survives reload');
  var offpage=setup({save:false}),offseed=offpage.store.seed();
  ok(!offpage.local['ctm|1|%2Fcourse%2F|~seed'] && offpage.session['ctm|1|%2Fcourse%2F|~seed']===offseed,'author save none seed is session only');
  offpage.store.setEnabled(true);
  ok(!offpage.local['ctm|1|%2Fcourse%2F|~seed'],'author save none does not migrate seed on learner enable');
  var tabs=setup(),th=tabs.register();
  tabs.local['ctm|1|%2Fcourse%2F|~prefs']=JSON.stringify({v:1,save:false});th.flush();
  ok(!tabs.local[tabs.store.key('ex')] && !tabs.store.enabled(),'other tab optout stops pending writes');
  var blocked=setup({},null,null,true),bh=blocked.register();bh.result({status:'wrong',score:0});
  ok(bh.restore().state==='restored','SecurityError memory restore');
  ok(blocked.store.clearCourse()===false,'SecurityError clear reports durable failure');
  ok(blocked.events.some(function(event){return event.type==='ctm:store-message' && event.detail.key==='clearFailed';}),'blocked deletion informs learner');
  var quotaNow=true, unseenKey='ctm|1|%2Fcourse%2F|chapter%2Fx|unseen';
  var unseen=setup({}, {[unseenKey]:JSON.stringify(record({v:2}))}, function(){return quotaNow;});
  unseen.register().result({status:'wrong',score:0});quotaNow=false;
  var unseenHandle=unseen.register({id:'unseen'});
  ok(unseenHandle.restore().state==='empty','unknown future record not restored after quota');
  unseenHandle.flush();ok(JSON.parse(unseen.local[unseenKey]).v===2,'unread future record survives quota recovery');
  var normalKey='ctm|1|%2Fcourse%2F|chapter%2Fx|normal';unseen.local[normalKey]=JSON.stringify(record());
  ok(unseen.register({id:'normal'}).restore().state==='restored','untouched durable answer readable after quota');
  var exporter=setup(),rawItem={title:'Code',parts:[{kind:'code',text:'print(1)'}]},eh=exporter.register({exportItem:function(){return rawItem;}});
  eh.result({status:'partial',score:.5});
  ok(exporter.store.exportItems()[0].parts[1].text.includes('50 %'),'export appends last check result');
  ok(rawItem.parts.length===1,'export does not mutate adapter item');
  eh.changed();
  ok(exporter.store.exportItems()[0].parts[1].text.includes('Outdated'),'edited answer export marks historical result outdated');
  eh.cancel();
  var removedTab=setup(),rtkey=removedTab.store.key('ex'),rth=removedTab.register({exportItem:function(){return {title:'Code',parts:[{kind:'code',text:'answer'}]};}});
  rth.result({status:'partial',score:.5});rth.changed();delete removedTab.local[rtkey];
  removedTab.fire({key:rtkey,newValue:null});removedTab.runTimers();
  ok(!removedTab.local[rtkey],'external record deletion cancels pending save');
  rth.result({status:'partial',score:.5});rth.changed();Object.keys(removedTab.local).forEach(function(name){delete removedTab.local[name];});
  removedTab.fire({key:null,newValue:null});removedTab.runTimers();
  ok(!removedTab.local[rtkey] && removedTab.store.exportItems()[0].parts.length===1,'external browser clear cancels and invalidates history');
  ok(bh.clear()===false,'individual clear exposes durable failure');
  var oldGrade={score:1,status:'correct',at:'2026-10-20T10:30:12Z'};
  var stale=setup(),sk=stale.store.key('ex'),sh=stale.register();
  stale.local[sk]=JSON.stringify(record({source:'fedcba9876543210',result:oldGrade}));
  ok(sh.restore().state==='changed','graded source mismatch marked changed');
  sh.result({status:'invalid',score:0});
  ok(!JSON.parse(stale.local[sk]).result,'invalid check never promotes old source grade');
  var staleVariant=setup(),svk=staleVariant.store.key('ex'),svh=staleVariant.register({variant:function(){return {n:1,id:'same',hash:'new'};}});
  staleVariant.local[svk]=JSON.stringify(record({variant:{n:1,id:'same',hash:'old'},seen:[1],result:oldGrade}));
  ok(svh.restore().state==='changed','graded variant mismatch marked changed');
  svh.result({status:'invalid',score:0});
  ok(!JSON.parse(staleVariant.local[svk]).result,'invalid check never promotes old variant grade');
  var matched=setup(),mk=matched.store.key('ex'),mth=matched.register();
  matched.local[mk]=JSON.stringify(record({result:oldGrade}));mth.restore();mth.result({status:'invalid',score:0});
  ok(JSON.parse(matched.local[mk]).result.score===1,'invalid check retains same-source historical grade');
  var ports=[];
  function Channel(name){this.name=name;ports.push(this);}
  Channel.prototype.postMessage=function(value){var self=this;ports.forEach(function(port){if(port!==self && port.name===self.name && port.onmessage)port.onmessage({data:value});});};
  var a=setup({},null,null,false,Channel),b=setup({},null,null,false,Channel),bh2=b.register();
  bh2.changed();a.store.clearPage();b.runTimers();
  ok(!b.local[b.store.key('ex')],'page clear command cancels never-persisted record in another tab');
  bh2.changed();a.store.clearCourse();b.runTimers();
  ok(!b.local[b.store.key('ex')],'course clear command cancels never-persisted record in another tab');
  var separate=setup({testPath:'/course/chapter/other.html'},null,null,false,Channel),sep=separate.register();
  sep.changed();a.store.clearPage();separate.runTimers();
  ok(!!separate.local[separate.store.key('ex')],'page clear command does not cancel another page');
  sep.changed();delete separate.local[separate.store.key('ex')];a.store.clearCourse();separate.runTimers();
  ok(!separate.local[separate.store.key('ex')],'course clear command cancels pending record on other page');
  var transient=setup();transient.store.clearCourse();
  ok(!Object.keys(transient.local).some(function(name){return name.endsWith('~clear');}),'storage fallback clear command leaves no persistent marker');
  var runtime=setup({exercises:[{id:'',runtimeId:'one',save:false},{id:'dup',runtimeId:'two',save:false},{id:'dup',runtimeId:'three',save:false}]});
  function element(id){return {getAttribute:function(name){return name==='data-ctm-runtime-id'?id:null;}};}
  var unlabelled=runtime.register({id:'',element:element('one')});unlabelled.result({status:'correct',score:1});
  ok(runtime.events.some(function(event){return event.type==='ctm:result' && event.detail.runtimeId==='one';}),'unlabelled result carries unique runtime identity');
  var firstDuplicate=runtime.register({id:'dup',element:element('two')});firstDuplicate.result({status:'partial',score:.5});
  ok(!runtime.local[runtime.store.key('dup')],'manifest prevents first duplicate saving before second registration');
  var secondDuplicate=runtime.register({id:'dup',element:element('three')});secondDuplicate.result({status:'wrong',score:0});
  ok(runtime.events.filter(function(event){return event.type==='ctm:result' && ['two','three'].includes(event.detail.runtimeId);}).length===2,'duplicate results keep distinct runtime identities');
  var generated=runtime.register({id:'generated-dom-id',runtimeId:'one',save:true});
  generated.result({status:'correct',score:1});
  ok(!runtime.local[runtime.store.key('generated-dom-id')],'manifest runtime identity prevents saving generated DOM id for unlabelled exercise');
  var duplicateConfig={exercises:[{id:'dup',runtimeId:'r1',save:false},{id:'dup',runtimeId:'r2',save:false}]};
  var da=setup(duplicateConfig,null,null,false,Channel),db=setup(duplicateConfig,null,null,false,Channel);
  function dup(tab,runtimeId){return tab.register({id:'dup',runtimeId:runtimeId,save:false,exportItem:function(){return {title:runtimeId,parts:[{kind:'answer',text:'answer'}]};}});}
  var da1=dup(da,'r1'),da2=dup(da,'r2'),db1=dup(db,'r1'),db2=dup(db,'r2');
  da1.result({status:'correct',score:1});da2.result({status:'partial',score:.5});db1.result({status:'correct',score:1});db2.result({status:'partial',score:.5});
  da1.clear();
  ok(db.store.exportItems()[0].parts.length===1 && db.store.exportItems()[1].parts.length===2,'runtime exercise clear preserves sibling duplicate history across tabs');
  ok(db.events.some(function(event){return event.type==='ctm:store-clear' && event.detail.runtimeId==='r1' && event.detail.component==='code';}),'runtime clear command emits exact runtime and component');
  var oldOrder=setup({exercises:[{id:'A',runtimeId:'r1',save:true}]},null,null,false,Channel);
  var newOrder=setup({exercises:[{id:'B',runtimeId:'r1',save:true},{id:'A',runtimeId:'r2',save:true}]},null,null,false,Channel);
  function ordered(tab,id,runtimeId){return tab.register({id:id,runtimeId:runtimeId,exportItem:function(){return {title:id,parts:[{kind:'answer',text:'answer'}]};}});}
  var oa=ordered(oldOrder,'A','r1'),nb=ordered(newOrder,'B','r1'),na=ordered(newOrder,'A','r2');
  oa.result({status:'correct',score:1});nb.result({status:'correct',score:1});na.result({status:'partial',score:.5});oa.clear();
  ok(newOrder.store.exportItems()[0].parts.length===2 && newOrder.store.exportItems()[1].parts.length===1,'cross-version ordinal collision clears stable label A and preserves unrelated B');
  ok(newOrder.events.some(function(event){return event.type==='ctm:store-clear' && event.detail.id==='A' && event.detail.runtimeId==='r2';}),'cross-version clear emits receiving entry actual runtime identity');

  var intentConfig={course:'explicit-clear-intent'},intentA=setup(intentConfig,null,null,false,Channel),intentB=setup(intentConfig,null,null,false,Channel);
  var liveInput='pending',remoteClears=0,remoteReads=0;
  var intentHandle=intentB.register({
    read:function(){remoteReads++;return {code:liveInput};},
    clear:function(){remoteClears++;liveInput='';}
  });
  intentHandle.changed();intentA.store.clearPage();intentB.runTimers();
  ok(liveInput==='' && remoteClears===1,'explicit remote page clear resets adapter input');
  ok(remoteReads===0,'explicit remote page clear cancels pending adapter read');
  liveInput='keep while off';intentHandle.changed();intentA.store.setEnabled(false);intentB.runTimers();
  ok(liveInput==='keep while off' && remoteClears===1,'remote opt-out preserves live adapter input');
  ok(remoteReads===0,'remote opt-out cancels pending adapter read');
  liveInput='course answer';intentHandle.changed();intentA.store.clearCourse();intentB.runTimers();
  ok(liveInput==='' && remoteClears===2 && remoteReads===0,'explicit remote course clear resets input without reading or saving');
  var intentSource=intentA.register();liveInput='exercise answer';intentHandle.changed();intentSource.clear();intentB.runTimers();
  ok(liveInput==='' && remoteClears===3 && remoteReads===0,'explicit remote exercise clear resets matched adapter');
  liveInput='keep raw removal';intentHandle.changed();intentB.fire({key:intentB.store.key('ex'),newValue:null});intentB.runTimers();
  ok(liveInput==='keep raw removal' && remoteClears===3 && remoteReads===0,'raw external record removal preserves live input but cancels save');
  intentHandle.changed();intentB.fire({key:null,newValue:null});intentB.runTimers();
  ok(liveInput==='keep raw removal' && remoteClears===3 && remoteReads===0,'raw browser storage clear preserves live input but cancels save');
  var fallback=setup({course:'fallback-intent'}),fallbackHandle=fallback.register(),fallbackCount=fallback.clears();
  fallbackHandle.changed();
  fallback.fire({key:'ctm|1|fallback-intent|~clear',newValue:JSON.stringify({v:1,scope:'page',page:'chapter/x',reset:true})});
  fallback.runTimers();
  ok(fallback.clears()===fallbackCount+1 && !fallback.local[fallback.store.key('ex')],'storage fallback explicit reset clears input and cancels never-saved record');
  fallbackHandle.changed();
  fallback.fire({key:'ctm|1|fallback-intent|~clear',newValue:JSON.stringify({v:1,scope:'page',page:'chapter/x'})});
  fallback.runTimers();
  ok(fallback.clears()===fallbackCount+1 && !fallback.local[fallback.store.key('ex')],'legacy clear command without reset intent preserves live input');


  // Optional adapter cache invalidation is scoped by the canonical store.
  function tracked(tab,id,component,runtimeId) {
    var state={live:'learner',ack:'learner',calls:[],reads:0};
    state.handle=tab.register({id:id || 'ex',component:component || 'code',runtimeId:runtimeId,
      read:function(){state.reads++;return {code:state.live};},
      forget:function(){state.calls.push('forget');state.ack=null;},
      clear:function(){state.calls.push('clear');state.live='starter';},
      exportItem:function(){return {title:id || 'ex',parts:[{kind:'code',text:state.live}]};}});
    state.handle.result({status:'correct',score:1});state.handle.changed();state.reads=0;
    return state;
  }
  var fl=setup({course:'forget-local'}),fle=tracked(fl);
  fle.handle.clear();fl.runTimers();
  ok(fle.calls.join(',')==='forget,clear' && fle.reads===0 && !fl.local[fl.store.key('ex')] && fl.store.exportItems()[0].parts.length===1,'local exercise forget precedes reset, clears history and cancels pending read');
  var fp=setup({course:'forget-page'}),fpe=tracked(fp);
  fp.store.clearPage();fp.runTimers();
  ok(fpe.calls.join(',')==='forget,clear' && fpe.live==='starter' && fpe.reads===0,'local page reset invalidates adapter before clear');
  var fc=setup({course:'forget-course'}),fce=tracked(fc);
  fc.store.clearCourse();fc.runTimers();
  ok(fce.calls.join(',')==='forget,clear' && fce.reads===0 && fce.ack===null,'local course reset invalidates adapter before clear');
  var fo=setup({course:'forget-off'}),foe=tracked(fo);
  fo.store.setEnabled(false);fo.runTimers();
  ok(foe.calls.join(',')==='forget' && foe.live==='learner' && foe.ack===null && foe.reads===0,'local optout forgets persisted state while preserving live input');

  var fra=setup({course:'forget-remote'},null,null,false,Channel),frb=setup({course:'forget-remote'},null,null,false,Channel);
  var fre=tracked(frb),frSource=fra.register();
  frSource.clear();frb.runTimers();
  ok(fre.calls.join(',')==='forget,clear' && fre.reads===0,'remote explicit exercise reset invokes forget then clear');
  fre.calls=[];fre.live='page edit';fre.handle.changed();fra.store.clearPage();frb.runTimers();
  ok(fre.calls.join(',')==='forget,clear' && fre.live==='starter' && fre.reads===0,'remote page reset invalidates before reset');
  fre.calls=[];fre.live='course edit';fre.handle.changed();fra.store.clearCourse();frb.runTimers();
  ok(fre.calls.join(',')==='forget,clear' && fre.reads===0,'remote course reset invalidates before reset');
  fre.calls=[];fre.live='keep off';fre.ack='keep off';fre.handle.changed();fra.store.setEnabled(false);frb.runTimers();
  ok(fre.calls.join(',')==='forget' && fre.live==='keep off' && fre.ack===null && fre.reads===0,'remote optout forgets cache without resetting live input');

  var fr=setup({course:'forget-raw'}),fr1=tracked(fr,'one'),fr2=tracked(fr,'two');
  delete fr.local[fr.store.key('one')];fr.fire({key:fr.store.key('one'),newValue:null});fr.runTimers();
  ok(fr1.calls.join(',')==='forget' && fr1.live==='learner' && fr1.reads===0 && fr2.calls.length===0 && fr2.ack==='learner' && fr2.reads===1,'raw targeted deletion forgets only matching entry and cancels its pending save');
  fr1.calls=[];fr1.handle.changed();fr2.handle.changed();fr1.reads=fr2.reads=0;
  Object.keys(fr.local).forEach(function(name){delete fr.local[name];});fr.fire({key:null,newValue:null});fr.runTimers();
  ok(fr1.calls.join(',')==='forget' && fr2.calls.join(',')==='forget' && fr1.live==='learner' && fr2.live==='learner' && fr1.reads===0 && fr2.reads===0,'raw all-storage deletion forgets every local entry without resetting inputs');
  var fpr=setup({course:'forget-prefs'}),fpre=tracked(fpr);
  fpr.local['ctm|1|forget-prefs|~prefs']=JSON.stringify({v:1,save:false});
  fpr.fire({key:'ctm|1|forget-prefs|~prefs',newValue:fpr.local['ctm|1|forget-prefs|~prefs']});fpr.runTimers();
  ok(fpre.calls.join(',')==='forget' && fpre.live==='learner' && fpre.reads===0 && !fpr.store.enabled(),'remote preference optout invalidates adapter acknowledgement');

  var fw=setup({course:'forget-overwrite'}),fw1=tracked(fw,'one'),fw2=tracked(fw,'two');
  var replacement=JSON.stringify(record({inputs:{code:'remote replacement'}}));
  fw.local[fw.store.key('one')]=replacement;
  fw.fire({key:fw.store.key('one'),newValue:replacement});fw.runTimers();
  ok(fw1.calls.join(',')==='forget' && fw1.ack===null && fw1.live==='learner' && fw1.reads===0 && fw2.calls.length===0 && fw.store.exportItems()[0].parts.length===1 && fw.local[fw.store.key('one')]===replacement,'external overwrite forgets matching acknowledgement/history, preserves local input and remote record');
  fw1.calls=[];fw.fire({key:'ctm|1|forget-overwrite|another-page|one',newValue:replacement});
  ok(fw1.calls.length===0 && fw2.calls.length===0,'external overwrite on another page does not invalidate local entries');
  fw.fire({key:'ctm|1|other-course|chapter%2Fx|one',newValue:null});
  ok(fw1.calls.length===0 && fw2.calls.length===0,'foreign-course storage deletion does not invalidate entries');

  var fm=setup({course:'forget-mirror'},null,function(){return true;}),observedMirror,mirrorHandle;
  mirrorHandle=fm.register({forget:function(){observedMirror=mirrorHandle.restore().record.inputs.code;}});
  mirrorHandle.result({status:'correct',score:1});mirrorHandle.changed();
  fm.local[fm.store.key('ex')]=replacement;fm.fire({key:fm.store.key('ex'),newValue:replacement});
  ok(observedMirror==='remote replacement','overwrite invalidates dirty memory mirror before optional forget callback');
  var fdconfig={course:'forget-duplicates',exercises:[{id:'dup',runtimeId:'r1',save:false},{id:'dup',runtimeId:'r2',save:false}]};
  var fda=setup(fdconfig,null,null,false,Channel),fdb=setup(fdconfig,null,null,false,Channel);
  var fdsource=fda.register({id:'dup',runtimeId:'r1',save:false});
  var fd1=tracked(fdb,'dup','code','r1'),fd2=tracked(fdb,'dup','code','r2');
  fdsource.clear();
  ok(fd1.calls.join(',')==='forget,clear' && fd2.calls.length===0,'optional forget honors duplicate runtime scoping owned by core');

  var auxiliary=setup();auxiliary.input({fields:{x:''},generated:[{question:'practice'}]});
  var ah=auxiliary.register({hasAnswer:function(inputs){return !!inputs.fields.x;}});
  var beforeAux=auxiliary.events.length;ah.flush({notify:false});
  ok(auxiliary.events.length===beforeAux && !!auxiliary.local[auxiliary.store.key('ex')],'auxiliary flush saves without answer-change events');
  ah.restore();
  ok(auxiliary.events[auxiliary.events.length-1].detail.answered===false,'adapter excludes auxiliary data from restored answered marker');
  auxiliary.input({fields:{x:'1'},generated:[]});ah.result({status:'correct',score:1});beforeAux=auxiliary.events.length;
  auxiliary.input({fields:{x:'1'},generated:[{question:'practice',answer:'0'}]});ah.flush({notify:false});
  ok(auxiliary.events.length===beforeAux && JSON.parse(auxiliary.local[auxiliary.store.key('ex')]).result.score===1,'auxiliary edits retain original score and do not reset navigation');
  ah.changed();var editEvents=auxiliary.events.length;ah.flush({notify:false});
  ok(auxiliary.events.length>editEvents,'auxiliary flush does not swallow a pending ordinary answer-edit notification');
  ok(!JSON.parse(auxiliary.local[auxiliary.store.key('ex')]).result,'ordinary edits still invalidate credit');

  return count;
}
test('shared store contracts and durable quota recovery',()=>{
 const source=['ctm-layout.js','ctm-store.js'].map(name=>fs.readFileSync(path.join(__dirname,'../_extensions/ctm-libs/ui',name),'utf8')).join('\n');
 assert.equal(checkStore(source,assert.ok),90);
});
