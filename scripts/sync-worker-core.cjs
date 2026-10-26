// Self-hosted module entry; the compatibility source uses exactly these bytes.
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '../_extensions/ctm-libs/runtime');
const wrapper = fs.readFileSync(path.join(root, 'pyodide-worker.js'), 'utf8');
const source = wrapper.split('var WORKER_SOURCE = String.raw`')[1].split('`;\n')[0];
const target = path.join(root, 'pyodide-worker-core.js');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== source) throw new Error('Run node scripts/sync-worker-core.cjs');
} else fs.writeFileSync(target, source);
