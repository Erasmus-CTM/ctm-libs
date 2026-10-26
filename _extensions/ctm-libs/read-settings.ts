// Settings reader of ctm-libs: lua/settings.lua runs it with `quarto run`,
// at most once per page. Quarto supplies its offline YAML parser and Deno
// runtime; no author-installed dependency (deno.json keeps a project's own
// Deno or npm configuration out).
import { parse } from 'stdlib/yaml';
import { resolve, dirname, join, relative } from 'stdlib/path';
import './feedback/feedback-core.js';

// Input on stdin, never the command line (it can hold credentials an author
// put in metadata by mistake, and command lines are visible to other users):
//   {projectDirectory, inputFile, profiles, sections: [...],
//    documentMeta: {<section>: {<key>: <JSON value>}}}
// documentMeta is Quarto's merged metadata of the page, converted by Lua.
//
// Output on stdout:
//   {settings: {<section>: {<key>: {value, origin}}}, policies: "<JSON>",
//    policyNames: [...], warnings: [...], errors: [...]}
//
// Quarto replaces a whole custom metadata mapping when a page defines its own
// (F-79), so the reader reads every level itself and combines the keys one by
// one: _quarto.yml, the profiles (the first listed wins), _quarto.yml.local,
// the _metadata.yml files from the project root to the page, the page's front
// matter. For a key of a section:
//   1. the page's front matter;
//   2. Quarto's merged metadata (metadata-files, format-scoped metadata,
//      notebooks, -M): it holds the key unless the page's own map dropped it;
//   3. the levels above, the nearest one winning.
const input = JSON.parse(await new Response(Deno.stdin.readable).text());
const sections: string[] = input.sections || ['ai-feedback'];
const warnings: string[] = [];
const errors: string[] = [];
const root = resolve(input.projectDirectory || dirname(input.inputFile));
const has = (object: unknown, key: string) => !!object && typeof object === 'object' && Object.hasOwn(object as object, key);
const isMap = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value);
const label = (file: string) => relative(root, file).split(/[\\/]/).join('/') || file;

// YAML values as JSON: dates (`model: 2024-08-06`) become their written form.
function plain(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(plain);
  if (isMap(value)) return Object.fromEntries(Object.entries(value as object).map(([k, v]) => [k, plain(v)]));
  return value;
}

type Level = {origin: string, page: boolean, sections: Record<string, Record<string, unknown>>, assets: Record<string, unknown>};
const levels: Level[] = [];

function readLevel(file: string, page = false) {
  let raw: string;
  try { raw = Deno.readTextFileSync(file); } catch (error) {
    if (error instanceof Deno.errors.NotFound) return;
    throw error;
  }
  if (page) {
    const match = raw.match(/^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\s*(?:\r?\n|$)/);
    if (!match) return;
    raw = match[1];
  }
  const origin = label(file);
  let document: unknown;
  try { document = parse(raw); } catch (error) {
    errors.push('Cannot read the metadata of ' + origin + ': ' + (error as Error).message);
    return;
  }
  const level: Level = {origin, page, sections: {}, assets: isMap(document) ? plain(document) as Record<string, unknown> : {}};
  for (const section of sections) {
    if (!has(document, section)) continue;
    const value = (document as Record<string, unknown>)[section];
    if (!isMap(value)) {
      if (section === 'ai-feedback') errors.push('ai-feedback metadata must be a mapping: ' + origin);
      else warnings.push(section + ' in ' + origin + ' must be a mapping of options; it is ignored.');
      continue;
    }
    level.sections[section] = plain(value) as Record<string, unknown>;
  }
  levels.push(level);
}
function readMetadataFile(stem: string) {
  for (const suffix of ['.yml', '.yaml']) {
    try { Deno.statSync(stem + suffix); } catch (error) {
      if (error instanceof Deno.errors.NotFound) continue;
      throw error;
    }
    readLevel(stem + suffix);
    return;
  }
}

if (input.projectDirectory) {
  readMetadataFile(join(root, '_quarto'));
  // Quarto gives the first listed profile precedence, then _quarto.yml.local.
  for (const profile of [...(input.profiles || [])].reverse()) readMetadataFile(join(root, '_quarto-' + profile));
  for (const local of ['_quarto.yml.local', '_quarto.yaml.local']) readLevel(join(root, local));
}
const page = resolve(input.inputFile);
let directory = root;
readMetadataFile(join(directory, '_metadata'));
for (const part of relative(root, dirname(page)).split(/[\\/]/).filter(Boolean)) {
  directory = join(directory, part);
  readMetadataFile(join(directory, '_metadata'));
}
readLevel(page, true);

// Quarto's merged metadata, per section. Lua encodes an empty map as [].
const documentMeta: Record<string, Record<string, unknown>> = {};
for (const [section, value] of Object.entries(input.documentMeta || {})) {
  if (Array.isArray(value) && value.length === 0) documentMeta[section] = {};
  else if (isMap(value)) documentMeta[section] = value as Record<string, unknown>;
  else if (section === 'ai-feedback') errors.push('ai-feedback metadata must be a mapping (document metadata)');
  else warnings.push(section + ' (document metadata) must be a mapping of options; it is ignored.');
}

type Entry = {value: unknown, origin: string};
// Equal up to Pandoc's metadata strings (`7` arrives from Lua as "7").
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => same(item, b[i]));
  if (isMap(a) && isMap(b)) {
    const keys = Object.keys(a as object);
    return keys.length === Object.keys(b as object).length && keys.every(key => same((a as any)[key], (b as any)[key]));
  }
  if (a === null || b === null || typeof a === 'object' || typeof b === 'object') return a === b;
  return String(a) === String(b);
}
// The value of section.key by the rules above, or undefined. When the merged
// metadata holds what a file level says, the file is named as its origin.
function resolveKey(section: string, key: string, accept: (value: unknown) => boolean = () => true): Entry | undefined {
  let file: Entry | undefined, fromPage = false;
  for (const level of levels) {
    const values = level.sections[section];
    if (values && Object.hasOwn(values, key)) { file = {value: values[key], origin: level.origin}; fromPage = level.page; }
  }
  const meta = documentMeta[section];
  if (!fromPage && meta && Object.hasOwn(meta, key) && accept(meta[key]) && !(file && same(file.value, meta[key]))) {
    return {value: meta[key], origin: 'document metadata'};
  }
  return file;
}
// Nested variants options obey the same leaf-by-leaf precedence as section
// keys. A page setting variants.target must not erase project approval.
function variantApproval(): Entry | undefined {
  let file: Entry | undefined, fromPage = false;
  const leaf = (section: Record<string, unknown> | undefined, origin: string): unknown => {
    if (!section || !Object.hasOwn(section, 'variants')) return undefined;
    const group = section.variants;
    if (!isMap(group)) { errors.push('ctm-assessment: variants must be a mapping (' + origin + ')'); return undefined; }
    return Object.hasOwn(group, 'approval') ? (group as Record<string, unknown>).approval : undefined;
  };
  for (const level of levels) {
    const value = leaf(level.sections['ctm-assessment'], level.origin);
    if (value !== undefined) { file = {value, origin: level.origin}; fromPage = level.page; }
  }
  const meta = leaf(documentMeta['ctm-assessment'], 'document metadata');
  if (!fromPage && meta !== undefined && !(file && same(file.value, meta))) return {value: meta, origin: 'document metadata'};
  return file;
}
// Every key of a section at any level or in the merged metadata, with where it was set.
function keysOf(section: string) {
  const found = new Map<string, string>();
  for (const level of levels) for (const key of Object.keys(level.sections[section] || {})) if (!found.has(key)) found.set(key, level.origin);
  for (const key of Object.keys(documentMeta[section] || {})) if (!found.has(key)) found.set(key, 'document metadata');
  return found;
}

const CREDENTIAL = /^(api[-_]?key|apikey|key|token|secret|password|authorization)$/i;
// A3: unknown options warn in 0.9 and become errors in CTM Assessment 1.0.
const UNKNOWN_IS_ERROR = false;
const settings: Record<string, Record<string, Entry>> = {};

// A1: a key that looks like a credential stops the render, in every CTM
// section, at every level and in the merged metadata. The messages never
// repeat its value.
function credentials() {
  const message = (section: string, key: string, origin: string) => section + ': ' + key + ' in ' + origin
    + ' looks like a credential. Remove it: Quarto metadata is published with the site; learners enter their own key in the Feedback settings.';
  for (const section of sections) {
    const reported = new Set<string>();
    for (const level of levels) {
      for (const key of Object.keys(level.sections[section] || {})) {
        if (CREDENTIAL.test(key)) { reported.add(key); errors.push(message(section, key, level.origin)); }
      }
    }
    for (const key of Object.keys(documentMeta[section] || {})) {
      if (CREDENTIAL.test(key) && !reported.has(key)) errors.push(message(section, key, 'document metadata'));
    }
  }
}
function unknown(section: string, key: string, origin: string, known: string[]) {
  if (UNKNOWN_IS_ERROR) errors.push(section + ': unknown option ' + key + ' (' + origin + '). Known options: ' + known.join(', ') + '.');
  else warnings.push(section + ': unknown option ' + key + ' (' + origin + ') is ignored; this becomes an error in CTM Assessment 1.0. Known options: ' + known.join(', ') + '.');
}

// --- ai-feedback ------------------------------------------------------------
const RUNTIME_KEYS = ['mode', 'storage', 'base-url', 'model', 'generator-model', 'ui-language', 'feedback-language'];
const SWITCH_KEYS = ['enabled', 'similar'];
// What a build without AI feedback does with exercises only AI feedback can
// assess (lua/policy.lua validates the value).
const BUILD_KEYS = ['without-ai'];
// A2: policy-files adds up over the levels, policy selects (the nearest wins).
const POLICY_KEYS = ['policy-files', 'policy', 'generation-policy'];
const DEPRECATED: Record<string, string> = {
  'project-policy': 'use policy (the nearest setting wins)',
  'page-policy': "use policy, extending the project's policy where needed",
  'page-policy-files': 'use policy-files, which now adds up across project, _metadata and page',
};
const KNOWN = [...RUNTIME_KEYS, ...SWITCH_KEYS, ...BUILD_KEYS, ...POLICY_KEYS];
function scalar(value: unknown): string | undefined {
  if (value === null || value === undefined || typeof value === 'object') return undefined;
  return String(value);
}
function feedbackSettings() {
  const out: Record<string, Entry> = {};
  for (const [key, origin] of keysOf('ai-feedback')) {
    if (CREDENTIAL.test(key)) continue;
    if (['defaults', 'integrations', 'policies', 'exercises'].includes(key)) {
      errors.push('ai-feedback: inline ' + key + ' (' + origin + ') is not supported; define named policies in a policy file (policy-files) and select one with policy');
    } else if (!KNOWN.includes(key) && !Object.hasOwn(DEPRECATED, key)) {
      unknown('ai-feedback', key, origin, KNOWN);
    }
  }
  feedbackSwitch(out);
  const similar = resolveKey('ai-feedback', 'similar');
  if (similar && similar.value !== null) {
    if (typeof similar.value !== 'boolean') errors.push('ai-feedback: similar must be true or false');
    else out.similar = similar;
  }
  for (const key of [...RUNTIME_KEYS, ...BUILD_KEYS]) {
    // Only a single value of the merged metadata counts (as before).
    const entry = resolveKey('ai-feedback', key, value => scalar(value) !== undefined);
    if (!entry || entry.value === null) continue;
    const value = scalar(entry.value);
    if (value === undefined) {
      warnings.push('ai-feedback: ' + key + ' (' + entry.origin + ') must be a single value; it is ignored.');
      continue;
    }
    out[key] = {value, origin: entry.origin};
  }
  const allowed: Record<string, string[]> = {mode: ['copy', 'api'], storage: ['local', 'session']};
  for (const [key, values] of Object.entries(allowed)) {
    if (out[key] && !values.includes(out[key].value as string)) {
      warnings.push('ai-feedback: ' + key + ' (' + out[key].origin + ') must be ' + values.join(' or ') + ' (found ' + JSON.stringify(out[key].value) + '); using ' + values[0] + '.');
      delete out[key];
    }
  }
  if (out['base-url'] && out['base-url'].value !== '') {
    // Never echo the value: a rejected URL may itself contain a secret.
    let url: URL | null = null;
    try { url = new URL(out['base-url'].value as string); } catch { url = null; }
    const problems = !url ? ['is not a valid URL'] : [
      ...(['https:', 'http:'].includes(url.protocol) ? [] : ['must use http or https']),
      ...(url.username || url.password ? ['contains a user name or password'] : []),
      ...(url.search ? ['contains a query'] : []),
      ...(url.hash ? ['contains a fragment'] : []),
    ];
    if (problems.length) {
      const shown = url && ['https:', 'http:'].includes(url.protocol) ? ' ' + url.origin.replace(/\/\/[^@/]*@/, '//') + url.pathname : '';
      warnings.push('ai-feedback: base-url' + shown + ' (' + out['base-url'].origin + ') ' + problems.join(', ') + '; it is ignored.');
      delete out['base-url'];
    }
  }
  return out;
}

// ai-feedback: enabled (P22) is AND over every level and the merged metadata:
// any level can turn AI feedback off for the build, none can turn it back on.
// origin names the first level that turned it off. asked names the page's own
// front matter when it says enabled: true: only that is a request of the page
// (a project-wide enabled: true is the normal configuration, not a request of
// every page), reported in the page's build message whichever switch is off.
function feedbackSwitch(out: Record<string, Entry>) {
  const found: (Entry & {page: boolean})[] = [];
  for (const level of levels) {
    const values = level.sections['ai-feedback'];
    if (values && Object.hasOwn(values, 'enabled')) found.push({value: values.enabled, origin: level.origin, page: level.page});
  }
  const meta = documentMeta['ai-feedback'];
  if (meta && Object.hasOwn(meta, 'enabled')) found.push({value: meta.enabled, origin: 'document metadata', page: false});
  let off: string | undefined, asked: string | undefined, last: string | undefined;
  for (const {value, origin, page} of found) {
    const on = value === true || value === 'true' ? true : value === false || value === 'false' ? false : null;
    if (on === null) {
      errors.push('ai-feedback: enabled (' + origin + ') must be true or false (found ' + JSON.stringify(value) + ')');
      continue;
    }
    if (!on && off === undefined) off = origin;
    if (on && page) asked = origin;
    last = origin;
  }
  const request = asked ? {asked} : {};
  if (off !== undefined) out.enabled = {value: false, origin: off, ...request} as Entry;
  else if (last !== undefined) out.enabled = {value: true, origin: last, ...request} as Entry;
}

// Policy files and selections (A2), onto the browser contract
// {layers, pageLayers, projectPolicy, pagePolicy}:
//   policy-files       additive over the levels in order, duplicates dropped  -> layers
//   page-policy-files  (deprecated) additive likewise, after all policy-files  -> pageLayers
//   policy             the nearest level wins; project-policy (deprecated) is
//                      the same slot, and at one level policy wins            -> projectPolicy
//   page-policy        (deprecated) the nearest level wins                     -> pagePolicy
// The merged metadata seeds each key that no file level sets (so that
// metadata-files and format-scoped settings keep working).
function policies() {
  const meta = documentMeta['ai-feedback'] || {};
  const atLevels = (key: string): Entry[] => levels.flatMap(level => {
    const values = level.sections['ai-feedback'];
    return values && Object.hasOwn(values, key) ? [{value: values[key], origin: level.origin}] : [];
  });
  const seeded = (key: string): Entry[] => {
    const entries = atLevels(key);
    if (!entries.length && Object.hasOwn(meta, key)) entries.push({value: meta[key], origin: 'document metadata'});
    return entries;
  };
  for (const [key, advice] of Object.entries(DEPRECATED)) {
    for (const entry of seeded(key)) warnings.push('ai-feedback: ' + key + ' (in ' + entry.origin + ') is deprecated; ' + advice + '. It keeps working in 0.9.');
  }
  const files = (value: unknown, key: string, origin: string): string[] | null => {
    if (!(typeof value === 'string' || Array.isArray(value) && value.every(file => typeof file === 'string'))) {
      errors.push('ai-feedback: ' + key + ' (' + origin + ') must be a path or ordered path list');
      return null;
    }
    return (Array.isArray(value) ? value : [value]).map(file => resolve(root, file));
  };
  const selection = (value: unknown, origin: string) => {
    if (typeof value === 'boolean' || Array.isArray(value) && origin === 'document metadata') {
      errors.push('ai-feedback: policy selection needs a policy name or integration mapping (' + origin + ')');
      return undefined;
    }
    return value;
  };
  const config: Record<string, unknown> = {layers: [], pageLayers: []};
  const loaded: string[] = [];
  for (const [key, slot] of [['policy-files', 'layers'], ['page-policy-files', 'pageLayers']]) {
    for (const entry of seeded(key)) {
      for (const file of files(entry.value, key, entry.origin) || []) {
        if (!loaded.includes(file)) { loaded.push(file); (config[slot] as string[]).push(file); }
      }
    }
  }
  // At one level `policy` wins over its deprecated spelling; the nearest level wins.
  let project: Entry | undefined;
  for (const level of levels) {
    const values = level.sections['ai-feedback'];
    if (!values) continue;
    for (const key of ['project-policy', 'policy']) if (Object.hasOwn(values, key)) project = {value: values[key], origin: level.origin};
  }
  if (!project) {
    const key = Object.hasOwn(meta, 'policy') ? 'policy' : Object.hasOwn(meta, 'project-policy') ? 'project-policy' : null;
    if (key) project = {value: meta[key], origin: 'document metadata'};
  }
  const page = seeded('page-policy').at(-1);
  const generation = seeded('generation-policy').at(-1);
  for (const [slot, entry] of [['projectPolicy', project], ['pagePolicy', page], ['generationPolicy', generation]] as [string, Entry | undefined][]) {
    if (!entry) continue;
    const value = selection(entry.value, entry.origin);
    if (value !== undefined && value !== null) config[slot] = value;
  }
  for (const slot of ['layers', 'pageLayers']) {
    config[slot] = (config[slot] as string[]).flatMap((file: string) => {
      let document: unknown;
      try { document = parse(Deno.readTextFileSync(file)); } catch (error) {
        errors.push('ai-feedback: cannot read the policy file ' + file + ': ' + (error as Error).message);
        return [];
      }
      if (!isMap(document) || !Object.hasOwn(document as object, 'ai-feedback')) {
        errors.push('ai-feedback: policy file needs an ai-feedback mapping: ' + file);
        return [];
      }
      return [(document as Record<string, unknown>)['ai-feedback']];
    });
  }
  // The browser's exact schema and graph checks, at render time, including
  // unused definitions: both builds (with and without AI feedback) fail alike.
  if (!errors.length) {
    const feedback = (globalThis as any).AIFeedback;
    try {
      for (const integration of ['plain-text', 'py-exercise', 'math-exercise', 'pyodide-interaktiv', 'stack']) feedback.resolvePolicy(integration, 'en', {}, config);
    } catch (error) {
      errors.push('ai-feedback: ' + (error as Error).message);
    }
  }
  const names = new Set<string>();
  for (const layers of [config.layers, config.pageLayers] as unknown[][]) {
    for (const layer of layers) if (isMap(layer) && isMap((layer as any).policies)) for (const name of Object.keys((layer as any).policies)) names.add(name);
  }
  return {config, names: [...names]};
}

// --- ctm-assessment and the components --------------------------------------
// Shared options: every component reads them, its own spelling winning at any
// level. ctm-assessment's own options, with the kind of value they take:
// the page's interface (lua/ui.lua).
const SHARED_KEYS = ['stop-after', 'lang', 'save'];
const OWN_KEYS: Record<string, 'boolean' | 'string' | 'assets'> = {'tab-links': 'boolean', 'modes': 'boolean', 'markdown-lint': 'boolean', 'progress': 'boolean', 'storage-key': 'string', 'export': 'boolean', assets: 'assets'};
const show = (value: unknown) => typeof value === 'object' ? JSON.stringify(value) : String(value);
function sectionSettings(section: string) {
  const out: Record<string, Entry> = {};
  const known = [...SHARED_KEYS, ...Object.keys(OWN_KEYS), 'variants'];
  for (const [key, origin] of keysOf(section)) {
    if (CREDENTIAL.test(key)) continue;
    if (section === 'ctm-assessment' && !known.includes(key)) {
      unknown('ctm-assessment', key, origin, known);
      continue;
    }
    const entry = resolveKey(section, key);
    if (!entry || entry.value === null || entry.value === undefined) continue;
    if (key === 'save' && !['answers', 'none'].includes(entry.value as string)) {
      errors.push(section + ': save must be answers or none (found ' + show(entry.value) + ' in ' + entry.origin + ')');
    }
    if (section === 'ctm-assessment' && OWN_KEYS[key] === 'string' && (typeof entry.value !== 'string' || !entry.value.trim())) {
      errors.push('ctm-assessment: ' + key + ' must be a non-empty string (found ' + show(entry.value) + ' in ' + entry.origin + ')');
    }
    if (section === 'ctm-assessment' && OWN_KEYS[key] === 'boolean' && ![true, false, 'true', 'false'].includes(entry.value as never)) {
      errors.push('ctm-assessment: ' + key + ' must be true or false (found ' + show(entry.value) + ' in ' + entry.origin + ')');
      continue;
    }
    if (section === 'ctm-assessment' && key === 'assets' && !['cdn', 'local'].includes(entry.value as string)) {
      errors.push('ctm-assessment: assets must be cdn or local (found ' + show(entry.value) + ' in ' + entry.origin + ')');
      continue;
    }
    out[key] = entry;
  }
  if (section === 'ctm-assessment') {
    const approval = variantApproval();
    if (approval) {
      if (!['required', 'optional'].includes(approval.value as string)) {
        errors.push('ctm-assessment: variants.approval must be required or optional (' + approval.origin + ')');
      } else out['variants.approval'] = approval;
    }
  }
  return out;
}

// Build configuration is read alongside the settings levels. Quarto merges
// resource/theme arrays additively; only the relevant paths are inspected.
function localAssets() {
  if (settings['ctm-assessment']?.assets?.value !== 'local') return;
  const list = (value: unknown): unknown[] => Array.isArray(value) ? value : value == null ? [] : [value];
  const paths = (value: unknown): string[] => list(value).filter((v): v is string => typeof v === 'string').map(v => v.replace(/\\/g, '/'));
  const docs = [...levels.map(l => ({doc: l.assets as any, origin: l.origin})),
    {doc: input.assetsMeta || {}, origin: 'document metadata'}];
  let resources = false, theme = false;
  const http = (value: unknown) => typeof value === 'string' && /^(?:https?:)?\/\//i.test(value);
  for (const {doc, origin} of docs) {
    resources ||= paths(doc.project?.resources).includes('_ctm-assets/**');
    theme ||= [...paths(doc.theme), ...paths(doc.format?.html?.theme)].some(p => /(?:^|\/)offline(?:-system)?\.scss$/.test(p));
    // Format-scoped project options may be hidden by a nearer section map in
    // Quarto's merged metadata. Validate both raw scopes before that merge.
    for (const [scope, where] of [[doc, origin], [doc.format?.html, origin + ' (format.html)']] as [any, string][]) {
      if (!isMap(scope)) continue;
      for (const key of ['base-url', 'build-variant']) {
        if (Object.hasOwn(scope.pyodide || {}, key)) errors.push('ctm-assessment: local assets do not support pyodide.' + key + ' (' + where + '). Remove that override.');
      }
      for (const key of ['src_jxg', 'src_css', 'src_mjx', 'mjx_fonts']) {
        const value = scope.jsxgraph?.[key];
        const suppliedByHook = scope === doc && origin === 'document metadata' && same(value, doc.defaults?.[key]);
        if (http(value) && !suppliedByHook) errors.push('ctm-assessment: local assets do not support an author HTTP jsxgraph.' + key + ' (' + where + '). Use a local path or remove that override.');
      }
    }
  }
  // The resolved pyodide map also covers metadata-files and format scope.
  for (const key of ['base-url', 'build-variant']) if (settings.pyodide?.[key]) {
    const origin = settings.pyodide[key].origin;
    if (!errors.some(e => e.includes('pyodide.' + key + ' (' + origin + ')'))) errors.push('ctm-assessment: local assets do not support pyodide.' + key + ' (' + origin + '). Remove that override.');
  }
  if (!resources) errors.push('ctm-assessment: local assets require project.resources to include "_ctm-assets/**". Run the CTM Assessment installer with --assets local.');
  if (!theme) errors.push('ctm-assessment: local assets require the offline.scss or offline-system.scss theme. Run the CTM Assessment installer with --assets local.');
}

let policyResult = {config: {layers: [], pageLayers: []} as Record<string, unknown>, names: [] as string[]};
try {
  credentials();
  for (const section of sections) settings[section] = section === 'ai-feedback' ? feedbackSettings() : sectionSettings(section);
  if (sections.includes('ai-feedback')) policyResult = policies();
  localAssets();
} catch (error) {
  errors.push('ctm-libs settings: ' + ((error as Error).message || String(error)));
}
// Policies stay a JSON string: Lua's JSON decoder would drop explicit nulls (extends: null).
console.log(JSON.stringify({settings, policies: JSON.stringify(policyResult.config), policyNames: policyResult.names, warnings, errors}));
