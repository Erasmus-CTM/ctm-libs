const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('./helpers/ctm-libs.cjs');
test('generation settings use policy selection and nearest boolean/model settings without altering feedback', {skip:!C.hasQuarto},()=>{
 const dir=C.tempdir('ctm-generation-settings-');
 try {
  C.installPackage(dir);C.install(dir);
  C.write(dir,{'_quarto.yml':'project:\n  type: default\n  render: [page.qmd]\nfilters: [ctm-libs]\nai-feedback:\n  similar: true\n  generator-model: reasoning-course\n  policy-files: policies.yml\n  policy: hints\n  generation-policy: {default: course}\n','policies.yml':'ai-feedback:\n  policies:\n    hints:\n      steps: [{step-prompt: Hint}]\n    course:\n      base-prompt: Course constraint\n      harder: More vectors\n','page.qmd':'---\ntitle: test\nai-feedback:\n  similar: false\n  generator-model: reasoning-page\n---\n\n::: {.ai-feedback}\nA task\n:::\n'});
  const r=C.render(dir);assert.equal(r.status,0,r.stderr);const html=C.html(dir,'page.qmd');
  const config=JSON.parse(html.match(/window\.__aiFeedbackConfig = (.*?);<\/script>/s)[1]);assert.equal(config.generatorModel,'reasoning-page');assert.notEqual(config.similar,true);
  const policy=JSON.parse(html.match(/window\.__aiFeedbackPolicies = (.*?);<\/script>/s)[1]);assert.equal(policy.projectPolicy,'hints');assert.deepEqual(policy.generationPolicy,{default:'course'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
