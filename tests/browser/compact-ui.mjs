// Local browser coverage for the shared settings and question-navigation UI.
// Run with Playwright available: node tests/browser/compact-ui.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../_extensions/ctm-libs');
const catalogue=JSON.parse(fs.readFileSync(path.join(root,'locales/ui.js'),'utf8').split('/*BEGIN-JSON*/')[1].split('/*END-JSON*/')[0]);
const manifest={v:1,course:'compact-ui',save:true,export:true,progress:true,
  messages:{...catalogue.en,locale:'en'},quizzes:[{id:'quiz',title:'Practice quiz'}],
  exercises:[1,2,3,4,5,6].map(n=>({component:'math-exercise',id:'q'+n,quiz:'quiz',save:true,order:n}))};
const fixture=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Practice</title>
<link rel="stylesheet" href="/ui/ctm-ui.css"><link rel="stylesheet" href="/feedback/ai-feedback.css">
<style>body{font:16px system-ui;margin:0;color:#26333b;background:#fff} main{max-width:760px;margin:0 auto;padding:24px} textarea{box-sizing:border-box;width:100%;height:70px} section.exercise{min-height:240px} h1{font-size:2rem} #quarto-margin-sidebar{display:none} @media(min-width:1200px){main{margin-left:calc((100vw - 1100px)/2);margin-right:0}#quarto-margin-sidebar{display:block;position:fixed;left:calc((100vw - 1100px)/2 + 840px);top:60px;width:180px}} @media(prefers-color-scheme:dark){body{color:#e2e8ed;background:#18232c;--bs-body-color:#e2e8ed;--bs-body-bg:#18232c}}</style>
${['locales/ctm-locale.js','locales/common.js','locales/ui.js','ui/ctm-layout.js','ui/ctm-settings.js','feedback/feedback-core.js','feedback/feedback-dom.js','feedback/ai-feedback.js','ui/ctm-store.js','ui/ctm-export.js','ui/ctm-nav.js','ui/ctm-progress.js'].map(src=>`<script src="/${src}" defer></script>`).join('')}
</head><body><main><header id="title-block-header"><h1>Practice</h1></header>
<div class="ctm-save-bar" hidden><p class="ctm-save-notice"></p><div class="ctm-save-actions"><button data-ctm-save-toggle>Do not save on this device</button><button data-ctm-export>Export my answers</button><button data-ctm-clear-page>Delete answers on this page</button><button data-ctm-clear-course>Delete all course answers</button></div><span class="ctm-save-status" role="status"></span></div>
<div class="ctm-progress-slot" data-ctm-quiz="quiz"></div>
${manifest.exercises.map((e,i)=>`<section class="exercise" id="${e.id}" data-ctm-id="${e.id}" data-ctm-component="math-exercise"><h2>Question ${i+1}</h2><label for="answer-${i}">Answer</label><textarea id="answer-${i}"></textarea></section>`).join('')}
<script id="ctm-store-manifest" type="application/json">${JSON.stringify(manifest)}</script>
</main><aside id="quarto-margin-sidebar" aria-label="On this page"><p>On this page</p></aside>
<script>document.addEventListener('DOMContentLoaded',()=>{
window.handles=[...document.querySelectorAll('.exercise')].map((element,i)=>{
 const input=element.querySelector('textarea');
 const handle=CTMStore.register({component:'math-exercise',id:element.id,source:'0123456789abcdef',element,
 read:()=>input.value?{answer:input.value}:null,write:value=>{input.value=value.answer},clear:()=>{input.value=''},exportItem:()=>({title:element.id,parts:[{kind:'text',text:input.value}]})});
 handle.restore();input.oninput=()=>handle.changed();return handle;
});
});</script></body></html>`;
const server=http.createServer((request,response)=>{
 if(request.url==='/'){response.setHeader('Content-Type','text/html');response.end(fixture);return;}
 const file=path.resolve(root,'.'+decodeURIComponent(request.url));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404).end();return;}
 response.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');response.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForSelector('.ctm-question-tile');
 assert.equal(await page.locator('.ctm-save-bar').evaluate(el=>el.closest('dialog')?.id),'ctm-settings');
 assert.equal(await page.locator('.ctm-questions-toggle').isVisible(),false);
 assert.equal(await page.locator('main .ctm-progress').count(),0);
 assert.deepEqual(await page.locator('.ctm-question-tile').allTextContents(),['1','2','3','4','5','6']);
 async function accessibility() {
  if(!process.env.AXE_MODULE) return;
  if(!await page.evaluate(()=>Boolean(window.axe))) await page.addScriptTag({path:process.env.AXE_MODULE});
  const result=await page.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
  assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
 }
 await accessibility();
 await page.locator('#answer-0').fill('answer');
 await page.waitForFunction(()=>document.querySelector('.ctm-question-tile').dataset.status==='answered');
 await page.evaluate(()=>handles[0].result({score:.25,status:'partial'}));
 assert.equal(await page.locator('.ctm-question-tile').first().evaluate(el=>el.style.getPropertyValue('--ctm-credit')),'25%');
 await page.evaluate(()=>handles[1].result({score:0,status:'wrong'}));
 await page.evaluate(()=>handles[2].result({score:1,status:'correct'}));
 await page.locator('#answer-3').fill('not checked');
 await page.waitForTimeout(300);
 await page.locator('.ctm-settings-toolbar .ctm-icon-button').click();
 assert.equal(await page.locator('#ctm-settings').evaluate(el=>el.open),true);
 assert.equal(await page.locator('#ctm-settings-answers').count(),1);
 assert.equal(await page.locator('#ctm-settings-ai').count(),1);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.ctm-settings-toolbar .ctm-icon-button').evaluate(el=>el===document.activeElement),true);
 await page.locator('.ctm-save-summary').click();
 await page.locator('[data-ctm-export]').click();
 await page.waitForTimeout(30);
 assert.equal(await page.locator('#ctm-settings').evaluate(el=>el.open),false);
 assert.equal(await page.locator('#ctm-export-view textarea').evaluate(el=>el===document.activeElement),true);
 await page.getByRole('button',{name:'Close',exact:true}).filter({visible:true}).click();
 if(process.env.COMPACT_UI_SCREENSHOTS) await page.screenshot({path:path.join(process.env.COMPACT_UI_SCREENSHOTS,'compact-desktop.png')});
 await page.setViewportSize({width:390,height:844});
 await page.locator('h1').click();
 await page.waitForSelector('.ctm-questions-toggle',{state:'visible'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('.ctm-questions-toggle').click();
 assert.equal(await page.locator('#ctm-questions').evaluate(el=>el.open),true);
 if(process.env.COMPACT_UI_SCREENSHOTS) await page.screenshot({path:path.join(process.env.COMPACT_UI_SCREENSHOTS,'compact-mobile.png')});
 await accessibility();
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.ctm-questions-toggle').evaluate(el=>el===document.activeElement),true);
 await page.locator('.ctm-questions-toggle').click();
 await page.locator('.ctm-question-tile').nth(2).click();
 assert.equal(await page.locator('#ctm-questions').evaluate(el=>el.open),false);
 await page.waitForFunction(()=>document.activeElement===document.querySelector('#q3 h2'));
 await page.emulateMedia({forcedColors:'active'});
 await page.locator('.ctm-questions-toggle').click();
 assert.equal(await page.locator('.ctm-question-tile').first().evaluate(el=>getComputedStyle(el,'::after').content),'"½"');
 await page.keyboard.press('Escape');
 await page.emulateMedia({forcedColors:'none',colorScheme:'dark'});
 await page.locator('.ctm-settings-toolbar .ctm-icon-button').click();
 await accessibility();
 await page.keyboard.press('Escape');
 await page.emulateMedia({media:'print'});
 assert.equal(await page.locator('.ctm-questions-toggle').isVisible(),false);
 assert.equal(await page.locator('.ctm-settings-toolbar').isVisible(),false);
 const touch=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await touch.goto(`http://127.0.0.1:${server.address().port}/`);
 await touch.locator('.ctm-questions-toggle').click();
 assert.equal(await touch.locator('.ctm-question-tile').first().evaluate(el=>el.getBoundingClientRect().width),44);
 await touch.close();
 assert.deepEqual(errors,[]);
 console.log('Passed: shared settings, export focus, proportional credit, mobile navigation, forced colors, dark settings, accessibility and print.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
