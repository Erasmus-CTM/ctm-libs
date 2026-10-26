const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const W=require('./helpers/worker.cjs'),C=require('./helpers/ctm-libs.cjs');
test('both editor consumers can suppress unsafe WebKit writes without replacing copy fallbacks',()=>{
 for(const exam of [false,true])for(const available of [false,true]) {
  const p=W.pageContext();let installed=0;
  class ClipboardService {installWebKitWriteTextWorkaround(arg){installed++;assert.equal(this.marker,42);return arg;}writeText(){return 'normal copy';}}
  const copy=ClipboardService.prototype.writeText;
  p.require=id=>{assert.equal(id,'vs/platform/clipboard/browser/clipboardService');return {BrowserClipboardService:ClipboardService};};
  p.qpyodideExamOutput=exam;p.navigator=available?{clipboard:{write(){}}}:{};p.ClipboardItem=available?class {}:undefined;
  vm.runInContext(fs.readFileSync(path.join(C.library,'runtime/pyodide-runtime.js'),'utf8'),p);
  p.MathExerciseRuntime.prepareMonacoClipboard();const wrapped=ClipboardService.prototype.installWebKitWriteTextWorkaround;
  p.MathExerciseRuntime.prepareMonacoClipboard();assert.equal(ClipboardService.prototype.installWebKitWriteTextWorkaround,wrapped);
  const instance=new ClipboardService();instance.marker=42;
  assert.equal(instance.installWebKitWriteTextWorkaround('preserved'),!exam&&available?'preserved':undefined);
  assert.equal(installed,!exam&&available?1:0);assert.equal(ClipboardService.prototype.writeText,copy);
 }
});
