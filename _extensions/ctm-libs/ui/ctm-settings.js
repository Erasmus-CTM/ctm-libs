/* Shared settings shell; answer and AI adapters own their controls. AGPL-3.0-or-later. */
(function () {
  'use strict';
  if (window.CTMSettings) return;
  let dialog, toolbar, gear, opener;
  const sections = new Map();
  // Sections appear in this order whatever order the components register in:
  // AI feedback first, then everything about saving answers. Unknown ids follow.
  const ORDER = ['ai', 'answers', 'code'];
  function rank(id) { const i = ORDER.indexOf(id); return i < 0 ? ORDER.length : i; }
  function text(key, fallback) {
    try {
      const manifest = JSON.parse(document.getElementById('ctm-store-manifest')?.textContent || '{}');
      return manifest.messages?.[key] || window.CTMLocales?.t('ui', key, manifest.messages?.locale || document.documentElement.lang || 'en') || fallback;
    } catch (_) { return fallback; }
  }
  function iconButton(symbol, label) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'ctm-icon-button';
    const icon = document.createElement('span'); icon.textContent = symbol; icon.setAttribute('aria-hidden', 'true');
    button.append(icon); button.setAttribute('aria-label', label); button.title = label;
    return button;
  }
  function ensure() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.id = 'ctm-settings'; dialog.className = 'ctm-settings';
    dialog.setAttribute('aria-labelledby', 'ctm-settings-title');
    const heading = document.createElement('h2'); heading.id = 'ctm-settings-title'; heading.textContent = text('settings', 'Settings');
    const close = iconButton('×', text('copyClose', 'Close'));
    close.classList.add('ctm-settings-close'); close.onclick = () => dialog.close();
    dialog.append(heading, close);
    dialog.addEventListener('close', () => {
      if (opener?.isConnected && (document.activeElement === document.body || dialog.contains(document.activeElement))) opener.focus({preventScroll: true});
    });
    document.body.append(dialog);
    toolbar = document.createElement('div'); toolbar.className = 'ctm-settings-toolbar';
    gear = iconButton('⚙︎', text('settings', 'Settings'));
    gear.setAttribute('aria-haspopup', 'dialog'); gear.setAttribute('aria-controls', dialog.id);
    gear.onclick = () => open(); toolbar.append(gear);
    const title = document.querySelector('#title-block-header');
    if (title) title.append(toolbar); else (document.querySelector('main') || document.body).prepend(toolbar);
  }
  function register(id, title, content) {
    ensure();
    if (sections.has(id)) return sections.get(id);
    const section = document.createElement('section'); section.id = 'ctm-settings-' + id;
    const heading = document.createElement('h3'); heading.id = section.id + '-title'; heading.textContent = title;
    section.setAttribute('aria-labelledby', heading.id); section.append(heading, content);
    const next = [...sections].find(([other]) => rank(other) > rank(id));
    if (next) next[1].before(section); else dialog.append(section);
    sections.set(id, section); return section;
  }
  function open(id) {
    ensure();
    document.dispatchEvent(new CustomEvent('ctm:settings-open'));
    if (!dialog.open) { opener = document.activeElement; dialog.showModal(); }
    const section = sections.get(id);
    if (section) { section.scrollIntoView({block: 'nearest'}); (section.querySelector('button, input, select, textarea') || dialog).focus(); }
    return dialog;
  }
  function summary(node) { ensure(); toolbar.prepend(node); }
  // A component with its own page-level settings button (the Pyodide status row)
  // hands it over here, so a page shows exactly one gear: the toolbar moves into
  // `container`, the given button replaces the default gear and opens this dialog.
  function mount(container, button) {
    ensure();
    if (button && button !== gear) {
      button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', dialog.id);
      button.onclick = () => open();
      gear.replaceWith(button); gear = button;
    }
    if (container) { container.append(toolbar); toolbar.classList.add('ctm-settings-toolbar-mounted'); }
    return toolbar;
  }
  window.CTMSettings = {register, open, summary, mount, close: () => dialog?.close(), text};
})();
