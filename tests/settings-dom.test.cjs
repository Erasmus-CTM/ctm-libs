const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const C=require('./helpers/ctm-libs.cjs');
const catalogue=JSON.parse(fs.readFileSync(path.join(C.library,'locales/ui.js'),'utf8').split('/*BEGIN-JSON*/')[1].split('/*END-JSON*/')[0]);
async function page(language='en') {
 const manifest={save:true,export:true,course:'settings',exercises:[],messages:{...catalogue[language],locale:language}};
 const w=new JSDOM(`<!doctype html><html lang="${language}"><body><main><header id="title-block-header"><h1>Practice</h1></header><div class="ctm-save-bar" hidden><p class="ctm-save-notice"></p><div class="ctm-save-actions"><button data-ctm-save-toggle>Stop saving</button><button data-ctm-export>Export</button><button data-ctm-clear-page>Delete page</button><button data-ctm-clear-course>Delete course</button></div><span class="ctm-save-status" role="status"></span></div><script type="application/json" id="ctm-store-manifest">${JSON.stringify(manifest)}</script></main></body></html>`,{url:'https://example.test/course/page.html',runScripts:'outside-only',pretendToBeVisual:true}).window;
 w.TextEncoder=TextEncoder;
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 for(const file of ['locales/ctm-locale.js','locales/common.js','locales/ui.js','ui/ctm-layout.js','ui/ctm-settings.js','ui/ctm-store.js','feedback/feedback-core.js','feedback/feedback-dom.js','feedback/ai-feedback.js']) w.eval(fs.readFileSync(path.join(C.library,file),'utf8'));
 if(w.document.readyState==='loading') await new Promise(resolve=>w.document.addEventListener('DOMContentLoaded',resolve));
 await Promise.resolve();
 return w;
}
test('storage and AI controls share one dialog reached from the toolbar and exercise cogwheels',async()=>{
 const w=await page(),d=w.document;
 assert.equal(d.querySelector('main .ctm-save-bar'),null);
 assert.equal(d.querySelector('#ctm-settings-answers .ctm-save-bar').hidden,false);
 d.querySelector('.ctm-settings-toolbar .ctm-icon-button').click();
 const dialog=d.querySelector('#ctm-settings');assert.equal(dialog.open,true);
 assert.equal(d.querySelectorAll('#ctm-settings-ai').length,1);
 const gears=[w.AIFeedback.settingsButton(),w.AIFeedback.settingsButton()];d.querySelector('main').append(...gears);
 for(const gear of gears) gear.click();
 assert.equal(d.querySelectorAll('dialog').length,1);
 assert.equal(d.querySelectorAll('#ctm-settings-ai').length,1);
 assert.equal(dialog.querySelectorAll('input[type=password]').length,1);
 w.close();
});
test('saving status opens storage directly and deletion requires an explicit confirmed scope',async()=>{
 const w=await page(),d=w.document;
 d.querySelector('.ctm-save-summary').click();
 assert.equal(d.activeElement.hasAttribute('data-ctm-save-toggle'),true);
 const key=w.CTMStore.key('answer');w.localStorage.setItem(key,'record');
 const confirmations=[];w.confirm=message=>{confirmations.push(message);return false;};
 d.querySelector('[data-ctm-clear-page]').click();
 assert.equal(w.localStorage.getItem(key),'record');
 assert.deepEqual(confirmations,['Delete all saved answers on this page?']);
 w.confirm=()=>true;d.querySelector('[data-ctm-clear-page]').click();
 assert.equal(w.localStorage.getItem(key),null);
 d.querySelector('[data-ctm-save-toggle]').click();
 assert.equal(w.CTMStore.enabled(),false);
 assert.equal(d.querySelector('.ctm-save-summary').textContent,catalogue.en.notSaving);
 w.close();
});
test('shared settings labels and storage explanations use the selected UI language',async()=>{
 for(const language of ['en','de','nb','nn']){
  const w=await page(language),d=w.document;
  assert.equal(d.querySelector('#ctm-settings-title').textContent,catalogue[language].settings);
  assert.equal(d.querySelector('#ctm-settings-answers-title').textContent,catalogue[language].answersStorage);
  assert.equal(d.querySelector('.ctm-save-summary').textContent,catalogue[language].savingLocal);
  w.close();
 }
});
