/* CTM Assessment: browser-only saved answers. AGPL-3.0-or-later. */
(function () {
  'use strict';
  if (window.CTMStore) return;
  var config, course, page, prefix, pagePrefix, prefsKey, seedKey, clearKey, clearChannel, prefs;
  var entries = [], memory = {localStorage: {}, sessionStorage: {}}, dirty = {localStorage: {}, sessionStorage: {}}, failed = {}, messages = {};
  var savedHere = false, compactNotice;
  var LIMIT = 64 * 1024, delay = 250;
  function emit(type, detail) { document.dispatchEvent(new CustomEvent(type, {detail: detail})); }
  function text(key, fallback) { return config && config.messages && config.messages[key] || fallback; }
  function announce(key, fallback) {
    if (messages[key]) return;
    messages[key] = text(key, fallback);
    var node = document.querySelector('.ctm-save-status');
    if (node) node.textContent = messages[key];
    if (compactNotice) compactNotice.textContent = messages[key];
    emit('ctm:store-message', {key: key, text: messages[key]});
  }
  // Keep a memory mirror. A failed durable write must never delete legacy data.
  function storage(kind, action, key, value) {
    var map = memory[kind];
    if (failed[kind]) {
      if (action === 'get') {
        if (!dirty[kind][key]) {
          try {
            var durableValue = window[kind].getItem(key);
            if (durableValue === null) delete map[key]; else map[key] = durableValue;
            return durableValue;
          } catch (error) { /* inaccessible: retain the page mirror */ }
        }
        return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
      }
      if (action === 'keys') {
        var known = Object.keys(map);
        try { for (var j = 0; j < window[kind].length; j++) if (!known.includes(window[kind].key(j))) known.push(window[kind].key(j)); } catch (error) { /* inaccessible storage */ }
        return known;
      }
      if (action === 'set') {
        map[key] = value; dirty[kind][key] = true;
        try { window[kind].setItem(key, value); delete dirty[kind][key]; return true; } catch (error) { /* memory only */ }
      }
      if (action === 'remove') {
        delete map[key]; dirty[kind][key] = true;
        try { window[kind].removeItem(key); delete dirty[kind][key]; return true; } catch (error) { /* memory only */ }
      }
      return false;
    }
    try {
      var target = window[kind], result;
      if (action === 'get') {
        result = target.getItem(key);
        if (result === null) delete map[key]; else map[key] = result;
        return result;
      }
      if (action === 'keys') {
        result = [];
        for (var i = 0; i < target.length; i++) result.push(target.key(i));
        return result;
      }
      if (action === 'set') { map[key] = value; target.setItem(key, value); }
      if (action === 'remove') { delete map[key]; target.removeItem(key); }
      return true;
    } catch (error) {
      failed[kind] = true;
      announce('storageUnavailable', 'Saving is unavailable. Your answers are kept in memory for this page only.');
      return storage(kind, action, key, value);
    }
  }
  function get(key) { return storage('localStorage', 'get', key); }
  function put(key, value) { return storage('localStorage', 'set', key, value); }
  function remove(key) { return storage('localStorage', 'remove', key); }
  function parse(value) { try { return JSON.parse(value); } catch (error) { return null; } }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function configure() {
    if (config) return;
    var node = document.getElementById('ctm-store-manifest');
    config = parse(node && node.textContent) || {};
    var offset = document.querySelector('meta[name="quarto:offset"]');
    var root = new URL(offset ? offset.content || './' : './', location.href).pathname;
    if (!root.endsWith('/')) root += '/';
    course = config.course || root;
    page = location.pathname.startsWith(root) ? location.pathname.slice(root.length) : location.pathname.replace(/^\//, '');
    page = page.replace(/\.html$/, '');
    if (!page || page.endsWith('/')) page += 'index';
    prefix = 'ctm|1|' + encodeURIComponent(course) + '|';
    pagePrefix = prefix + encodeURIComponent(page) + '|';
    prefsKey = prefix + '~prefs'; seedKey = prefix + '~seed'; clearKey = prefix + '~clear';
    prefs = parse(get(prefsKey));
    // Old opt-out is read once per course, without deleting old answers.
    if (!prefs && get('qpyodide:local-storage-user-disabled') === '1') {
      prefs = {v: 1, save: false}; put(prefsKey, JSON.stringify(prefs));
    }
    if (window.BroadcastChannel) {
      try {
        clearChannel = new window.BroadcastChannel(prefix + 'clear');
        clearChannel.onmessage = function (event) { receiveClear(event.data); };
      } catch (error) { /* transient storage-event fallback */ }
    }
  }
  function enabled() { configure(); prefs = parse(get(prefsKey)); return !(prefs && prefs.save === false); }
  function key(id) { configure(); return pagePrefix + encodeURIComponent(id); }
  function future(record) { return record && Number.isInteger(record.v) && record.v > 1; }
  function cancel(entry) { clearTimeout(entry.timer); entry.timer = null; }
  // The store owns entry scope; adapters only discard cached persistence state.
  function forget(entry) {
    cancel(entry); entry.lastResult = null; entry.lastChecked = null; entry.outdated = false;
    if (entry.options.forget) entry.options.forget();
  }
  function resetEntries() {
    entries.forEach(function (entry) {
      forget(entry);
      if (entry.options.clear) entry.options.clear();
    });
  }
  function localReadable() {
    try { return typeof window.localStorage.length === 'number'; } catch (error) { return false; }
  }
  function clearFailure() {
    announce('clearFailed', 'Browser storage could not be cleared or updated. Use your browser settings to remove this course data.');
  }
  function erase(where) {
    var durable = localReadable();
    storage('localStorage', 'keys').forEach(function (name) {
      if (name.startsWith(where) && !remove(name)) durable = false;
    });
    return durable;
  }
  // A scoped command is necessary even when no record exists yet: deleting
  // keys alone cannot notify another tab with an unsaved debounce.
  function receiveClear(command) {
    if (!command || command.v !== 1 || !['course', 'page', 'exercise'].includes(command.scope)) return;
    if (command.scope !== 'course' && command.page !== page) return;
    var componentMatches = function (item) { return !command.component || item.component === command.component; };
    var declared = (config.exercises || []).filter(function (item) { return item.id === command.id && componentMatches(item); }).length;
    var mounted = entries.filter(function (entry) { return entry.id === command.id && componentMatches({component: entry.options.component}); }).length;
    var ambiguous = Math.max(declared, mounted) > 1;
    entries.forEach(function (entry) {
      if (command.scope === 'exercise') {
        // Author labels survive source-order changes. Runtime ordinals only
        // disambiguate duplicate labels within that stable label's matches.
        if (entry.id !== command.id || !componentMatches({component: entry.options.component})) return;
        if (ambiguous && command.runtimeId && entry.runtimeExplicit && entry.runtimeId !== command.runtimeId) return;
      }
      if (entry.id) {
        delete memory.localStorage[key(entry.id)]; delete dirty.localStorage[key(entry.id)];
        storage('sessionStorage', 'remove', key(entry.id));
      }
      forget(entry);
      if (command.reset === true && entry.options.clear) entry.options.clear();
      if (command.scope === 'exercise') emit('ctm:store-clear', {
        course: course, page: page, id: entry.id, runtimeId: entry.runtimeId, component: entry.options.component
      });
    });
    if (command.scope !== 'exercise') emit('ctm:store-clear', {
      course: course, page: command.scope === 'course' ? undefined : page
    });
  }
  function sendClear(scope, id, runtimeId, component, reset) {
    var command = {v: 1, scope: scope, page: page, id: id, runtimeId: runtimeId, component: component, reset: reset === true, nonce: Date.now() + ':' + Math.random()};
    if (clearChannel) {
      try { clearChannel.postMessage(command); return true; } catch (error) { /* storage-event fallback */ }
    }
    var sent = put(clearKey, JSON.stringify(command));
    var removed = remove(clearKey);
    return sent && removed;
  }
  function clearPage() {
    configure(); var durable = erase(pagePrefix); resetEntries();
    storage('sessionStorage', 'keys').forEach(function (name) { if (name.startsWith(pagePrefix)) storage('sessionStorage', 'remove', name); });
    if (!sendClear('page', undefined, undefined, undefined, true)) durable = false;
    if (!durable) clearFailure();
    emit('ctm:store-clear', {course: course, page: page, durable: durable});
    return durable;
  }
  function deleteCourse(reset) {
    configure(); var durable = localReadable();
    storage('localStorage', 'keys').forEach(function (name) {
      if (name.startsWith(prefix) && name !== prefsKey && name !== prefix + '~mode' && !remove(name)) durable = false;
    });
    storage('sessionStorage', 'keys').forEach(function (name) { if (name.startsWith(prefix)) storage('sessionStorage', 'remove', name); });
    if (reset) resetEntries();
    else entries.forEach(forget);
    if (!sendClear('course', undefined, undefined, undefined, reset)) durable = false;
    if (!durable) clearFailure();
    emit('ctm:store-clear', {course: course, durable: durable});
    return durable;
  }
  function clearCourse() { return deleteCourse(true); }
  function seed() {
    configure();
    var kind = enabled() && config.save !== false ? 'localStorage' : 'sessionStorage', found = storage(kind, 'get', seedKey);
    if (found) return found;
    var bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
    found = Array.prototype.map.call(bytes, function (n) { return n.toString(16).padStart(2, '0'); }).join('');
    storage(kind, 'set', seedKey, found);
    return found;
  }
  function setEnabled(value) {
    configure(); value = !!value;
    if (!value) deleteCourse(false);
    prefs = {v: 1, save: value}; if (!put(prefsKey, JSON.stringify(prefs))) clearFailure();
    if (value && config.save !== false) {
      var temporary = storage('sessionStorage', 'get', seedKey);
      if (temporary) { put(seedKey, temporary); storage('sessionStorage', 'remove', seedKey); }
    } else if (!value) { remove(seedKey); seed(); }
    updateBar(); emit('ctm:store-enabled', {enabled: value}); return value;
  }
  function current(entry) { return entry.options.variant ? entry.options.variant() : null; }
  function proposal(entry) { return entry.options.allowProposals === true && entry.options.proposal ? entry.options.proposal() : null; }
  function writable(entry) {
    if (!enabled() || entry.options.save === false || entry.duplicate || !entry.id) return false;
    return !(config.exercises || []).some(function (item) { return item.id === entry.id && item.save === false; });
  }
  function save(entry, inputs) {
    if (!writable(entry)) return false;
    var name = key(entry.id), previous = parse(get(name));
    if (future(previous)) return false;
    var variant = current(entry), pending = proposal(entry);
    if (inputs === null || inputs === undefined) {
      entry.lastResult = null;
      if (!variant && !pending) return remove(name);
      inputs = {}; // An untouched answer still retains its selected variant.
    }
    var record = {v: 1, component: entry.options.component, saved: new Date().toISOString(), inputs: inputs};
    if (variant || pending) {
      record.variant = variant ? {n: variant.n, id: variant.id, hash: variant.hash} : null;
      if (pending && !variant) record.proposal = {id: pending.id, hash: pending.hash};
      record.seen = Array.from(new Set([].concat(entry.options.seen ? entry.options.seen() : previous && previous.seen || [],
        variant ? [variant.n] : ['proposal:' + pending.id])));
    } else record.source = entry.options.source;
    if (entry.lastResult) record.result = entry.lastResult;
    var serialized;
    try { serialized = JSON.stringify(record); } catch (error) { return false; }
    if (new TextEncoder().encode(serialized).length > LIMIT) {
      announce('recordTooLarge', 'This answer is too large to save. Copy it before leaving the page.');
      return false;
    }
    var persisted = put(name, serialized);
    if (persisted) { savedHere = true; updateBar(); }
    return persisted;
  }
  function valid(record, component) {
    return record && record.v === 1 && record.component === component && record.inputs &&
      typeof record.inputs === 'object' && !Array.isArray(record.inputs);
  }
  function register(options) {
    configure();
    if (!options || !options.component || typeof options.read !== 'function' || typeof options.write !== 'function') {
      throw new TypeError('CTMStore.register needs component, read and write.');
    }
    var entry = {options: options, id: options.id, timer: null, lastResult: null, lastChecked: null, outdated: false, duplicate: false};
    var explicitRuntime = options.runtimeId || (options.element && options.element.getAttribute && options.element.getAttribute('data-ctm-runtime-id'));
    entry.runtimeExplicit = !!explicitRuntime;
    entry.runtimeId = explicitRuntime || options.id;
    var declared = (config.exercises || []).find(function (item) { return item.runtimeId && item.runtimeId === entry.runtimeId; });
    if (declared) entry.id = declared.id || '';
    entries.forEach(function (other) { if (entry.id && other.id === entry.id) entry.duplicate = other.duplicate = true; });
    entries.push(entry);
    function restore() {
      cancel(entry);
      if (!writable(entry)) return {state: 'disabled'};
      var record = parse(get(key(entry.id)));
      if (!future(record)) {
        (options.legacy || []).some(function (adapter) {
          var candidate = adapter.read();
          if (!candidate || !Object.prototype.hasOwnProperty.call(candidate, 'inputs')) return false;
          entry.lastResult = null;
          if (save(entry, candidate.inputs)) {
            if (adapter.remove) adapter.remove(candidate);
            else (candidate.keys || []).forEach(remove);
          }
          record = candidate.inputs === null ? null : {v: 1, component: options.component, source: options.source, inputs: candidate.inputs};
          return true;
        });
      }
      if (!valid(record, options.component)) return {state: 'empty'};
      entry.lastResult = record.result || null; entry.lastChecked = entry.lastResult;
      var state = 'restored', selected = null;
      if (record.variant || record.proposal) {
        var oldIdentity = record.variant || record.proposal;
        var variants = options.variants ? options.variants() : [current(entry)].filter(Boolean);
        var sameHash = variants.filter(function (variant) { return variant.hash && variant.hash === oldIdentity.hash; });
        selected = sameHash.find(function (variant) { return Number.isSafeInteger(oldIdentity.n) && variant.n === oldIdentity.n; }) ||
          sameHash.find(function (variant) { return variant.id === oldIdentity.id; }) ||
          (sameHash.length === 1 ? sameHash[0] : null);
        if (!selected) {
          selected = variants.find(function (variant) { return Number.isSafeInteger(oldIdentity.n) && variant.n === oldIdentity.n; }) ||
            variants.find(function (variant) { return oldIdentity.id !== undefined && variant.id === oldIdentity.id; });
          state = selected ? 'changed' : 'withdrawn';
        }
      } else if (current(entry) || record.source !== options.source) state = 'changed';
      entry.outdated = state !== 'restored';
      if (entry.outdated) entry.lastResult = null;
      var outcome = {state: state, record: clone(record), variant: selected || null, outdated: entry.outdated};
      if (state === 'restored') options.write(clone(record.inputs), outcome);
      emit('ctm:store-restore', {component: options.component, id: entry.id, runtimeId: entry.runtimeId, state: state, answered: hasAnswer(record.inputs), result: record.result || null, outdated: outcome.outdated});
      return outcome;
    }
    function flush() {
      cancel(entry);
      var inputs = options.read();
      emit('ctm:answer-change', {component: options.component, id: entry.id, runtimeId: entry.runtimeId, answered: hasAnswer(inputs)});
      return save(entry, inputs);
    }
    function changed() {
      cancel(entry); entry.lastResult = null; entry.outdated = !!entry.lastChecked;
      savedHere = false; updateBar();
      emit('ctm:answer-change', {component: options.component, id: entry.id, runtimeId: entry.runtimeId, answered: true});
      entry.timer = setTimeout(flush, delay);
    }
    function result(detail) {
      detail = detail || {};
      if (!['correct', 'partial', 'wrong', 'invalid'].includes(detail.status) ||
        !Number.isFinite(detail.score) || detail.score < 0 || detail.score > 1) {
        throw new TypeError('ctm:result needs status and score from 0 to 1.');
      }
      cancel(entry);
      if (detail.status !== 'invalid') {
        entry.outdated = false;
        entry.lastResult = {score: detail.score, status: detail.status, at: new Date().toISOString()};
        entry.lastChecked = entry.lastResult;
      }
      save(entry, options.read());
      var selected = detail.variant || current(entry);
      var event = {component: options.component, id: entry.id, runtimeId: entry.runtimeId, score: detail.score, status: detail.status, variant: selected};
      if (options.numberedVariantResults === true) {
        var identity = selected && Number.isSafeInteger(selected.n) && selected.n > 0 &&
          typeof selected.id === 'string' && selected.id && typeof selected.hash === 'string' && selected.hash ? selected : null;
        event.variant = identity ? identity.n : null;
        event.variantIdentity = identity ? {n: identity.n, id: identity.id, hash: identity.hash} : null;
      }
      emit('ctm:result', event);
    }
    function clear() {
      var durable = entry.id ? remove(key(entry.id)) : true;
      if (entry.id) storage('sessionStorage', 'remove', key(entry.id));
      forget(entry);
      if (options.clear) options.clear();
      if (entry.id && !sendClear('exercise', entry.id, entry.runtimeExplicit ? entry.runtimeId : undefined, options.component, true)) durable = false;
      if (!durable) clearFailure();
      emit('ctm:store-clear', {course: course, page: page, id: entry.id, runtimeId: entry.runtimeId, durable: durable});
      return durable;
    }
    // Choice-only state shares the P17 exercise key, even before any answer.
    // Saving off keeps only identity/seen in session storage, never answers.
    function restoreChoice() {
      if (!entry.id || entry.duplicate) return null;
      var kind = writable(entry) ? 'localStorage' : 'sessionStorage';
      var record = parse(storage(kind, 'get', key(entry.id)));
      return valid(record, options.component) && (record.variant || record.proposal) ? clone(record) : null;
    }
    function choice(state) {
      if (!entry.id || entry.duplicate) return false;
      var variant = state && state.variant, pending = state && state.proposal;
      var isProposal = options.allowProposals === true && state && state.variant === null && pending;
      var chosen = variant || (isProposal && pending);
      if (!chosen || (!isProposal && (!Number.isSafeInteger(variant.n) || variant.n < 1)) ||
          typeof chosen.id !== 'string' || !chosen.id || typeof chosen.hash !== 'string' || !chosen.hash ||
          !Array.isArray(state.seen) || state.seen.some(function (n) {
            return !(Number.isSafeInteger(n) && n > 0) && !(options.allowProposals === true && typeof n === 'string' && /^proposal:.+/.test(n));
          })) {
        throw new TypeError('Variant choice needs a positive identity and seen numbers.');
      }
      var kind = writable(entry) ? 'localStorage' : 'sessionStorage', name = key(entry.id);
      var previous = parse(storage(kind, 'get', name));
      if (future(previous)) return false;
      var oldIdentity = previous && (previous.variant || previous.proposal);
      var matchingContent = options.variants ? options.variants().filter(function (item) { return item.hash === chosen.hash; }) : [];
      var unambiguousContent = matchingContent.length === 1 &&
        (matchingContent[0].n === chosen.n || matchingContent[0].id === chosen.id);
      // Equal mathematical content can belong to distinct note identities.
      // A deliberate switch must discard its old answer/result cache too.
      var sameIdentity = oldIdentity && oldIdentity.hash === chosen.hash &&
        (unambiguousContent || ((Number.isSafeInteger(oldIdentity.n) && Number.isSafeInteger(chosen.n)) ? oldIdentity.n === chosen.n : oldIdentity.id === chosen.id));
      if (!sameIdentity) forget(entry);
      var record = {v: 1, component: options.component, saved: new Date().toISOString(), inputs: {},
        variant: variant ? {n: variant.n, id: variant.id, hash: variant.hash} : null,
        seen: Array.from(new Set(state.seen.concat(variant ? variant.n : 'proposal:' + pending.id)))};
      if (isProposal) record.proposal = {id: pending.id, hash: pending.hash};
      if (kind === 'localStorage' && valid(previous, options.component) && sameIdentity) {
        record.inputs = previous.inputs;
        if (previous.result) record.result = previous.result;
      }
      return storage(kind, 'set', name, JSON.stringify(record));
    }
    entry.flush = flush;
    return {restore: restore, restoreChoice: restoreChoice, choice: choice, changed: changed, result: result, clear: clear, flush: flush, cancel: function () { cancel(entry); }};
  }
  function cleanup() {
    if (!enabled() || !Array.isArray(config.exercises)) return;
    var live = config.exercises.filter(function (item) { return !!item.id; }).map(function (item) { return key(item.id); });
    storage('localStorage', 'keys').forEach(function (name) {
      if (name.startsWith(pagePrefix) && !live.includes(name) && !future(parse(get(name)))) remove(name);
    });
  }
  function hasAnswer(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'object') return Object.keys(value).some(function (key) { return hasAnswer(value[key]); });
    return true;
  }
  function updateBar() {
    var button = document.querySelector('[data-ctm-save-toggle]');
    if (button) button.textContent = enabled() ? text('saveOff', 'Do not save on this device') : text('saveOn', 'Save again');
    var notice = document.querySelector('.ctm-save-notice');
    if (notice) notice.textContent = config.save === false ? text('savingDisabled', 'Saving is off for this page.') :
      enabled() ? text('savingNotice', 'Your answers are saved only in this browser.') : text('savingOffNotice', 'Saving is off on this device for this course.');
    if (compactNotice) compactNotice.textContent = failed.localStorage ? text('storageUnavailable', 'Saving is unavailable. Your answers are kept in memory for this page only.') :
      config.save === false || !enabled() ? text('notSaving', 'Answers aren’t being saved') :
      savedHere && !entries.some(function (entry) { return entry.timer; }) ? text('savedLocal', 'Saved in this browser') : text('savingLocal', 'Saving in this browser');
  }
  function start() {
    configure(); cleanup(); updateBar();
    var status = document.querySelector('.ctm-save-status'), keys = Object.keys(messages);
    if (status && keys.length) status.textContent = messages[keys[keys.length - 1]];
    var bar = document.querySelector('.ctm-save-bar');
    if (bar) {
      if (window.CTMSettings) {
        window.CTMSettings.register('answers', text('answersStorage', 'Answers & storage'), bar);
        compactNotice = document.createElement('button'); compactNotice.type = 'button';
        compactNotice.className = 'ctm-save-summary';
        compactNotice.setAttribute('aria-haspopup', 'dialog'); compactNotice.setAttribute('aria-controls', 'ctm-settings');
        compactNotice.onclick = function () { window.CTMSettings.open('answers'); };
        window.CTMSettings.summary(compactNotice); updateBar();
      }
      bar.hidden = false;
      bar.addEventListener('click', function (event) {
        var button = event.target.closest('button');
        if (!button) return;
        if (button.hasAttribute('data-ctm-clear-page') && window.confirm(text('confirmClearPage', 'Delete all saved answers on this page?'))) clearPage();
        if (button.hasAttribute('data-ctm-clear-course') && window.confirm(text('confirmClearCourse', 'Delete all your saved answers in this course?'))) clearCourse();
        if (button.hasAttribute('data-ctm-save-toggle') && (!enabled() ||
          window.confirm(text('confirmSaveOff', 'This deletes all saved answers in this course and stops saving.')))) setEnabled(!enabled());
      });
    }
  }
  window.addEventListener('storage', function (event) {
    configure();
    if (event.key === clearKey) { if (event.newValue) receiveClear(parse(event.newValue)); return; }
    if (event.key === null) {
      memory.localStorage = {}; dirty.localStorage = {};
      entries.forEach(forget);
      updateBar(); emit('ctm:store-clear', {course: course}); return;
    }
    if (event.key.startsWith(prefix)) {
      if (event.newValue === null) delete memory.localStorage[event.key];
      else memory.localStorage[event.key] = event.newValue;
      delete dirty.localStorage[event.key];
      if (event.key.startsWith(pagePrefix)) {
        entries.forEach(function (entry) {
          if (entry.id && key(entry.id) === event.key) {
            forget(entry);
            if (event.newValue === null) emit('ctm:store-clear', {course: course, page: page, id: entry.id, runtimeId: entry.runtimeId});
          }
        });
      }
    }
    if (event.key !== prefsKey) return;
    prefs = parse(event.newValue);
    if (prefs && prefs.save === false) entries.forEach(forget);
    updateBar(); emit('ctm:store-enabled', {enabled: !(prefs && prefs.save === false)});
  });
  window.addEventListener('pagehide', function () { entries.forEach(function (entry) { if (entry.timer) entry.flush(); }); });
  window.CTMStore = {
    version: 1, register: register, enabled: enabled, setEnabled: setEnabled, clearPage: clearPage, clearCourse: clearCourse, seed: seed, key: key,
    exportItems: function () {
      return entries.filter(function (entry) { return typeof entry.options.exportItem === 'function'; }).sort(function (a, b) {
        if (!a.options.element || !b.options.element) return 0;
        return a.options.element.compareDocumentPosition(b.options.element) & 2 ? 1 : -1;
      }).map(function (entry) {
        var item = entry.options.exportItem();
        if (!item) return null;
        var exported = Object.assign({element: entry.options.element}, item), result = entry.lastChecked || entry.lastResult;
        exported.parts = (item.parts || []).slice();
        if (result) {
          var locale = config.messages && config.messages.locale || 'en';
          var date = new Date(result.at).toLocaleDateString(locale), percent = (result.score * 100).toLocaleString(locale);
          var status = text({correct: 'statusCorrect', partial: 'statusPartial', wrong: 'statusWrong'}[result.status], result.status);
          var description = 'Last checked ' + date + ': ' + status + ' (' + percent + ' %)';
          if (window.CTMLocales) {
            try { description = window.CTMLocales.t('ui', 'lastChecked', locale, date, status, percent); } catch (error) { /* standalone fallback */ }
          }
          if (entry.outdated) description = text('outdated', 'Outdated') + ': ' + description;
          exported.parts.push({kind: 'answer', label: text('lastResult', 'Last result'), text: description});
        }
        return exported;
      }).filter(Boolean);
    }
  };
  Object.defineProperties(window.CTMStore, {course: {get: function () { configure(); return course; }}, page: {get: function () { configure(); return page; }}});
  window.CTMLayout.ready(start);
})();
