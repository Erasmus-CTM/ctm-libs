/* Browser interface for AI Feedback — AGPL-3.0-or-later. */
(function (root) {
  'use strict';
  const F = root.AIFeedback;
  if (!F || F.attach) return;
  const CONFIG_KEY = 'ai-feedback-config-v1';
  // BEGIN GENERATED FEEDBACK STRINGS (locales/feedback.js; python scripts/sync-feedback-defaults.py)
  const locale = {"en": {"button": "Feedback", "settings": "Feedback settings", "response": "Your response", "busy": "Getting feedback…", "cancelled": "Feedback cancelled.", "stale": "Your response changed. Request feedback again for the current version.", "copy": "Copy prompt", "copied": "Copied", "save": "Save settings", "saved": "Settings saved.", "cancel": "Cancel", "images": "Upload images", "clear": "Remove images", "storage": "Storage", "session": "This tab", "local": "Remember on this device", "mode": "Mode", "api": "Direct API", "url": "API base URL", "key": "Personal API key", "model": "Model", "models": "Fetch models", "privacy": "Direct feedback sends your response, selected context and images to the chosen provider.", "imageNote": "PNG, JPEG or WebP; up to three images, 8 MiB each and 12 MiB total. Images are not saved in browser storage.", "prompt": "Paste this prompt into your chosen AI chat.", "choose": "Choose a model", "legacy": "Use saved settings from", "invalidImage": "Use PNG, JPEG or WebP images within the size limit.", "hint": "Hint", "attachImages": "Attach these images in your AI chat as well.", "generatorModel": "Model for generating problems", "correctReading": "The AI misunderstood my work", "correctionLabel": "What did the AI misread or misunderstand?", "correctionHelp": "Point to a line or feature on this uploaded page, for example: “The exponent on line 3 is −2.” One correction reply; changed or additional work needs a new upload.", "updateFeedback": "Update feedback", "correctionNote": "Your correction:", "correctionClosed": "Correction complete. For changed or additional work, upload a new page.", "correctionRestart": "Feedback restarted at hint 1.", "correctionSettingsChanged": "The feedback settings changed. Request fresh feedback before correcting its reading.", "presets": "Choose a provider", "groupFree": "Free online services", "groupLocal": "Local (this computer)", "keyLink": "Get your key here:", "installLink": "Download:", "urlHelpLabel": "How do I get access?", "urlHelp": "Any service with an OpenAI-compatible API works, for example your university's AI service. Use ▾ at the edge of the field to choose a provider; this ⓘ then shows how to get a key there.", "helpOpenrouter": "Sign up for free and create a key under “Keys”. Free models end in “:free” and have a daily limit.", "helpCerebras": "Sign up for free and create a key under “API Keys”. The free tier is enough for exercises.", "helpGemini": "Sign in with a Google account and choose “Create API key”. On the free tier Google may use your inputs to improve its services.", "helpMistral": "Sign up, choose the free “Experiment” plan (a phone number is required) and create a key under “API Keys”.", "helpOllama": "No key needed. Install Ollama, load a model (e.g. ollama pull llama3.2) and click Fetch models. If this page is not opened from localhost, allow it with OLLAMA_ORIGINS.", "helpLmstudio": "No key needed. Load a model in LM Studio, start the server under “Developer” and turn on CORS.", "showModels": "Show models", "modelsFree": "Free models", "modelsOther": "Other models", "modelsLoaded": "{n} models loaded. Choose one with ▾ next to the model fields or start typing."}, "de": {"button": "Feedback", "settings": "KI-Feedback einrichten", "response": "Deine Antwort", "busy": "Feedback wird geladen…", "cancelled": "Feedback abgebrochen.", "stale": "Deine Antwort hat sich geändert. Fordere erneut Feedback an.", "copy": "Prompt kopieren", "copied": "Kopiert", "save": "Einstellungen speichern", "saved": "Einstellungen gespeichert.", "cancel": "Abbrechen", "images": "Bilder hochladen", "clear": "Bilder entfernen", "storage": "Speicherung", "session": "Dieser Tab", "local": "Auf diesem Gerät merken", "mode": "Modus", "api": "Direkte API", "url": "API-Basis-URL", "key": "Persönlicher API-Schlüssel", "model": "Modell", "models": "Modelle abrufen", "privacy": "Direktes Feedback sendet deine Antwort, Kontext und Bilder an den gewählten Anbieter.", "imageNote": "PNG, JPEG oder WebP; höchstens drei Bilder, je 8 MiB und insgesamt 12 MiB. Bilder werden nicht dauerhaft gespeichert.", "prompt": "Füge diesen Prompt in deinen KI-Chat ein.", "choose": "Modell wählen", "legacy": "Gespeicherte Einstellungen übernehmen von", "invalidImage": "Verwende PNG-, JPEG- oder WebP-Bilder innerhalb der Größenbegrenzung.", "hint": "Hinweis", "attachImages": "Füge diese Bilder ebenfalls in deinem KI-Chat an.", "generatorModel": "Modell zum Erstellen von Aufgaben", "correctReading": "Die KI hat meine Arbeit missverstanden", "correctionLabel": "Was hat die KI falsch gelesen oder verstanden?", "correctionHelp": "Verweise auf eine Zeile oder ein Detail auf dieser hochgeladenen Seite, etwa: „Der Exponent in Zeile 3 ist −2.“ Es gibt eine Antwort auf die Klarstellung. Geänderte oder zusätzliche Arbeit erfordert einen neuen Upload.", "updateFeedback": "Feedback aktualisieren", "correctionNote": "Deine Klarstellung:", "correctionClosed": "Klarstellung abgeschlossen. Lade für geänderte oder zusätzliche Arbeit eine neue Seite hoch.", "correctionRestart": "Das Feedback beginnt wieder bei Hinweis 1.", "correctionSettingsChanged": "Die Feedback-Einstellungen haben sich geändert. Fordere neues Feedback an, bevor du die Lesart korrigierst.", "presets": "Anbieter auswählen", "groupFree": "Kostenlose Online-Dienste", "groupLocal": "Lokal (dieser Rechner)", "keyLink": "Schlüssel gibt es hier:", "installLink": "Download:", "urlHelpLabel": "Wie bekomme ich Zugang?", "urlHelp": "Es funktioniert jeder Dienst mit OpenAI-kompatibler API, z. B. auch der KI-Dienst deiner Hochschule. Über ▾ am Rand des Feldes wählst du einen Anbieter; dieses ⓘ zeigt dann, wie du dort einen Schlüssel bekommst.", "helpOpenrouter": "Kostenlos registrieren und unter „Keys“ einen Schlüssel erstellen. Kostenlose Modelle enden auf „:free“ und haben ein Tageslimit.", "helpCerebras": "Kostenlos registrieren und unter „API Keys“ einen Schlüssel erstellen. Das kostenlose Kontingent reicht für Übungen.", "helpGemini": "Mit einem Google-Konto anmelden und „API-Schlüssel erstellen“ wählen. Im kostenlosen Kontingent darf Google deine Eingaben zur Verbesserung seiner Dienste nutzen.", "helpMistral": "Registrieren, den kostenlosen Plan „Experiment“ wählen (Telefonnummer nötig) und unter „API Keys“ einen Schlüssel erstellen.", "helpOllama": "Kein Schlüssel nötig. Ollama installieren, ein Modell laden (z. B. ollama pull llama3.2) und „Modelle abrufen“ klicken. Ist diese Seite nicht über localhost geöffnet, sie mit OLLAMA_ORIGINS erlauben.", "helpLmstudio": "Kein Schlüssel nötig. In LM Studio ein Modell laden, unter „Developer“ den Server starten und CORS einschalten.", "showModels": "Modelle anzeigen", "modelsFree": "Kostenlose Modelle", "modelsOther": "Weitere Modelle", "modelsLoaded": "{n} Modelle geladen. Über ▾ an den Modell-Feldern auswählen oder einfach lostippen."}, "nb": {"button": "Tilbakemelding", "settings": "Innstillinger for KI", "response": "Svaret ditt", "busy": "Henter tilbakemelding…", "cancelled": "Avbrutt.", "stale": "Svaret ditt er endret. Be om ny tilbakemelding.", "copy": "Kopier instruksjon", "copied": "Kopiert", "save": "Lagre innstillinger", "saved": "Innstillinger lagret.", "cancel": "Avbryt", "images": "Last opp bilder", "clear": "Fjern bilder", "storage": "Lagring", "session": "Denne fanen", "local": "Husk på denne enheten", "mode": "Modus", "api": "Direkte API", "url": "API-adresse", "key": "Personlig API-nøkkel", "model": "Modell", "models": "Hent modeller", "privacy": "Direkte tilbakemelding sender svaret, konteksten og bildene til valgt leverandør.", "imageNote": "PNG, JPEG eller WebP; opptil tre bilder, 8 MiB hver og 12 MiB totalt. Bilder lagres ikke i nettleserlagringen.", "prompt": "Lim inn instruksjonen i din valgte KI-chat.", "choose": "Velg modell", "legacy": "Bruk lagrede innstillinger fra", "invalidImage": "Bruk PNG-, JPEG- eller WebP-bilder innenfor størrelsesgrensen.", "hint": "Hint", "attachImages": "Legg også ved disse bildene i KI-chatten.", "generatorModel": "Modell for å lage oppgaver", "correctReading": "KI-en misforsto besvarelsen min", "correctionLabel": "Hva leste eller forsto KI-en feil?", "correctionHelp": "Vis til en linje eller detalj på dette bildet, for eksempel: «Eksponenten på linje 3 er −2.» Du får ett svar på presiseringen. Endret eller nytt arbeid krever en ny opplasting.", "updateFeedback": "Oppdater tilbakemeldingen", "correctionNote": "Din presisering:", "correctionClosed": "Presiseringen er behandlet. Last opp en ny side for endret eller nytt arbeid.", "correctionRestart": "Tilbakemeldingen startet på nytt på hint 1.", "correctionSettingsChanged": "Innstillingene for tilbakemelding er endret. Be om ny tilbakemelding før du korrigerer lesingen.", "presets": "Velg leverandør", "groupFree": "Gratis nettjenester", "groupLocal": "Lokalt (denne maskinen)", "keyLink": "Hent nøkkelen her:", "installLink": "Last ned:", "urlHelpLabel": "Hvordan får jeg tilgang?", "urlHelp": "Alle tjenester med et OpenAI-kompatibelt API fungerer, for eksempel KI-tjenesten til lærestedet ditt. Velg en leverandør med ▾ i kanten av feltet; denne ⓘ viser da hvordan du får en nøkkel der.", "helpOpenrouter": "Registrer deg gratis og lag en nøkkel under «Keys». Gratis modeller slutter på «:free» og har en daglig grense.", "helpCerebras": "Registrer deg gratis og lag en nøkkel under «API Keys». Gratisnivået holder for øvingsoppgaver.", "helpGemini": "Logg inn med en Google-konto og velg «Create API key». På gratisnivået kan Google bruke det du skriver til å forbedre tjenestene sine.", "helpMistral": "Registrer deg, velg gratisplanen «Experiment» (telefonnummer kreves) og lag en nøkkel under «API Keys».", "helpOllama": "Ingen nøkkel nødvendig. Installer Ollama, last ned en modell (f.eks. ollama pull llama3.2) og klikk Hent modeller. Er siden ikke åpnet fra localhost, tillat den med OLLAMA_ORIGINS.", "helpLmstudio": "Ingen nøkkel nødvendig. Last inn en modell i LM Studio, start serveren under «Developer» og slå på CORS.", "showModels": "Vis modeller", "modelsFree": "Gratis modeller", "modelsOther": "Andre modeller", "modelsLoaded": "{n} modeller lastet inn. Velg med ▾ ved modellfeltene eller begynn å skrive."}, "es": {"button": "Comentarios", "settings": "Configurar IA", "response": "Tu respuesta", "busy": "Obteniendo comentarios…", "cancelled": "Cancelado.", "stale": "Tu respuesta ha cambiado. Solicita comentarios de nuevo.", "copy": "Copiar instrucciones", "copied": "Copiado", "save": "Guardar configuración", "saved": "Configuración guardada.", "cancel": "Cancelar", "images": "Subir imágenes", "clear": "Quitar imágenes", "storage": "Almacenamiento", "session": "Esta pestaña", "local": "Recordar en este dispositivo", "mode": "Modo", "api": "API directa", "url": "URL base de la API", "key": "Clave API personal", "model": "Modelo", "models": "Obtener modelos", "privacy": "Los comentarios directos envían tu respuesta, contexto e imágenes al proveedor elegido.", "imageNote": "PNG, JPEG o WebP; hasta tres imágenes, 8 MiB cada una y 12 MiB en total. Las imágenes no se guardan en el almacenamiento del navegador.", "prompt": "Pega estas instrucciones en tu chat de IA.", "choose": "Elegir modelo", "legacy": "Usar configuración guardada de", "invalidImage": "Usa imágenes PNG, JPEG o WebP dentro del límite de tamaño.", "hint": "Pista", "attachImages": "Adjunta también estas imágenes en tu chat de IA.", "generatorModel": "Modelo para generar problemas", "correctReading": "La IA ha malinterpretado mi trabajo", "correctionLabel": "¿Qué ha leído o interpretado mal la IA?", "correctionHelp": "Indica una línea o un detalle de esta página, por ejemplo: «El exponente de la línea 3 es −2». Recibirás una respuesta a la aclaración. El trabajo modificado o adicional requiere una nueva imagen.", "updateFeedback": "Actualizar comentarios", "correctionNote": "Tu aclaración:", "correctionClosed": "Aclaración completada. Sube una nueva página para evaluar trabajo modificado o adicional.", "correctionRestart": "Los comentarios vuelven a la pista 1.", "correctionSettingsChanged": "La configuración de los comentarios ha cambiado. Solicita nuevos comentarios antes de corregir la lectura.", "presets": "Elegir proveedor", "groupFree": "Servicios en línea gratuitos", "groupLocal": "Local (este equipo)", "keyLink": "Consigue tu clave aquí:", "installLink": "Descarga:", "urlHelpLabel": "¿Cómo obtengo acceso?", "urlHelp": "Funciona cualquier servicio con una API compatible con OpenAI, por ejemplo el servicio de IA de tu universidad. Con ▾ en el borde del campo eliges un proveedor; esta ⓘ muestra entonces cómo conseguir una clave allí.", "helpOpenrouter": "Regístrate gratis y crea una clave en «Keys». Los modelos gratuitos terminan en «:free» y tienen un límite diario.", "helpCerebras": "Regístrate gratis y crea una clave en «API Keys». El nivel gratuito basta para los ejercicios.", "helpGemini": "Inicia sesión con una cuenta de Google y elige «Create API key». En el nivel gratuito, Google puede usar tus entradas para mejorar sus servicios.", "helpMistral": "Regístrate, elige el plan gratuito «Experiment» (se necesita un número de teléfono) y crea una clave en «API Keys».", "helpOllama": "No hace falta clave. Instala Ollama, descarga un modelo (p. ej. ollama pull llama3.2) y pulsa Obtener modelos. Si esta página no se abre desde localhost, permítela con OLLAMA_ORIGINS.", "helpLmstudio": "No hace falta clave. Carga un modelo en LM Studio, inicia el servidor en «Developer» y activa CORS.", "showModels": "Mostrar modelos", "modelsFree": "Modelos gratuitos", "modelsOther": "Otros modelos", "modelsLoaded": "{n} modelos cargados. Elige uno con ▾ junto a los campos de modelo o empieza a escribir."}, "nn": {"button": "Tilbakemelding", "settings": "KI-innstillingar", "response": "Svaret ditt", "busy": "Hentar tilbakemelding…", "cancelled": "Avbrote.", "stale": "Svaret ditt er endra. Be om ny tilbakemelding.", "copy": "Kopier instruksjon", "copied": "Kopiert", "save": "Lagre innstillingar", "saved": "Innstillingane er lagra.", "cancel": "Avbryt", "images": "Last opp bilete", "clear": "Fjern bilete", "storage": "Lagring", "session": "Denne fana", "local": "Hugs på denne eininga", "mode": "Modus", "api": "Direkte API", "url": "API-basisadresse", "key": "Personleg API-nøkkel", "model": "Modell", "models": "Hent modellar", "privacy": "Direkte tilbakemelding sender svaret, konteksten og bileta til den valde tilbydaren.", "imageNote": "PNG, JPEG eller WebP; høgst tre bilete, 8 MiB kvar og 12 MiB til saman. Bilete blir ikkje lagra.", "prompt": "Lim inn denne instruksjonen i den valde KI-chatten.", "choose": "Vel ein modell", "legacy": "Bruk lagra innstillingar frå", "invalidImage": "Bruk PNG-, JPEG- eller WebP-bilete innanfor storleiksgrensa.", "hint": "Hint", "attachImages": "Legg òg ved desse bileta i KI-chatten.", "generatorModel": "Modell for å lage oppgåver", "correctReading": "KI-en misforstod svaret mitt", "correctionLabel": "Kva las eller forstod KI-en feil?", "correctionHelp": "Vis til ei linje eller ein detalj på dette biletet, til dømes: «Eksponenten på linje 3 er −2.» Du får eitt svar på presiseringa. Endra eller nytt arbeid krev ei ny opplasting.", "updateFeedback": "Oppdater tilbakemeldinga", "correctionNote": "Di presisering:", "correctionClosed": "Presiseringa er behandla. Last opp ei ny side for endra eller nytt arbeid.", "correctionRestart": "Tilbakemeldinga starta på nytt på hint 1.", "correctionSettingsChanged": "Innstillingane for tilbakemelding er endra. Be om ny tilbakemelding før du korrigerer lesinga.", "presets": "Vel tilbydar", "groupFree": "Gratis nettenester", "groupLocal": "Lokalt (denne maskina)", "keyLink": "Hent nøkkelen her:", "installLink": "Last ned:", "urlHelpLabel": "Korleis får eg tilgang?", "urlHelp": "Alle tenester med eit OpenAI-kompatibelt API fungerer, til dømes KI-tenesta til lærestaden din. Vel ein tilbydar med ▾ i kanten av feltet; denne ⓘ viser då korleis du får ein nøkkel der.", "helpOpenrouter": "Registrer deg gratis og lag ein nøkkel under «Keys». Gratis modellar sluttar på «:free» og har ei dagleg grense.", "helpCerebras": "Registrer deg gratis og lag ein nøkkel under «API Keys». Gratisnivået held for øvingsoppgåver.", "helpGemini": "Logg inn med ein Google-konto og vel «Create API key». På gratisnivået kan Google bruke det du skriv til å forbetre tenestene sine.", "helpMistral": "Registrer deg, vel gratisplanen «Experiment» (telefonnummer krevst) og lag ein nøkkel under «API Keys».", "helpOllama": "Ingen nøkkel nødvendig. Installer Ollama, last ned ein modell (t.d. ollama pull llama3.2) og klikk Hent modellar. Er sida ikkje opna frå localhost, tillat ho med OLLAMA_ORIGINS.", "helpLmstudio": "Ingen nøkkel nødvendig. Last inn ein modell i LM Studio, start serveren under «Developer» og slå på CORS.", "showModels": "Vis modellar", "modelsFree": "Gratis modellar", "modelsOther": "Andre modellar", "modelsLoaded": "{n} modellar lasta inn. Vel med ▾ ved modellfelta eller byrja å skrive."}};
  // END GENERATED FEEDBACK STRINGS
  function lang(code) { const key = String(code || document.documentElement.lang || 'en').toLowerCase().replace(/_/g, '-').split('-')[0]; return locale[key === 'no' || key === 'nn' ? 'nb' : key] || locale.en; }
  function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
  function button(text) { const el = node('button', text, 'ai-feedback-button'); el.type = 'button'; return el; }
  function store(kind) { try { return root[kind === 'local' ? 'localStorage' : 'sessionStorage']; } catch { return null; } }
  let memoryConfig = null;
  function loadConfig() {
    for (const kind of ['local', 'session']) {
      try { const saved = JSON.parse(store(kind)?.getItem(CONFIG_KEY) || 'null'); if (saved) return { generatorModel: root.__aiFeedbackConfig?.generatorModel || '', ...saved, storage: kind }; } catch {}
    }
    if (memoryConfig) return { ...memoryConfig };
    return { mode: root.__aiFeedbackConfig?.mode || 'copy', storage: root.__aiFeedbackConfig?.storage || 'local', baseUrl: root.__aiFeedbackConfig?.baseUrl || '', model: root.__aiFeedbackConfig?.model || '', generatorModel: root.__aiFeedbackConfig?.generatorModel || '', apiKey: '' };
  }
  function saveConfig(config) {
    memoryConfig = { ...config };
    try { store(config.storage)?.setItem(CONFIG_KEY, JSON.stringify(config)); store(config.storage === 'local' ? 'session' : 'local')?.removeItem(CONFIG_KEY); } catch {}
    if (root.document) root.document.dispatchEvent(new CustomEvent('ai-feedback:settings-change'));
  }
  // Suggestions for the API base URL (feedback-core.js posts to <base>/chat/completions):
  // services students can use without paying, and local servers. All allow requests
  // from a web page (CORS). The field itself stays free text.
  const PROVIDERS = [
    { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', help: 'helpOpenrouter', link: 'https://openrouter.ai/keys' },
    { name: 'Cerebras', url: 'https://api.cerebras.ai/v1', help: 'helpCerebras', link: 'https://cloud.cerebras.ai' },
    { name: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai', help: 'helpGemini', link: 'https://aistudio.google.com/apikey' },
    { name: 'Mistral', url: 'https://api.mistral.ai/v1', help: 'helpMistral', link: 'https://console.mistral.ai/api-keys' },
    { name: 'Ollama', url: 'http://localhost:11434/v1', help: 'helpOllama', link: 'https://ollama.com/download', local: true },
    { name: 'LM Studio', url: 'http://localhost:1234/v1', help: 'helpLmstudio', link: 'https://lmstudio.ai', local: true }
  ];
  function providerFor(url) { const clean = String(url || '').trim().replace(/\/+$/, ''); return PROVIDERS.find(p => p.url === clean); }
  let settings;
  function openSettings() {
    if (!settings) buildSettings();
    if (root.CTMSettings) { settings.populate?.(loadConfig()); root.CTMSettings.open('ai'); return; }
    if (!settings.open) { settings.populate?.(loadConfig()); if (settings.showModal) settings.showModal(); else settings.setAttribute('open', ''); }
  }
  function closeSettings() { if (root.CTMSettings) { root.CTMSettings.close(); return; } if (settings?.close) settings.close(); else settings?.removeAttribute('open'); }
  function settingsButton(code) { const L = lang(code); const gear = button('⚙'); gear.classList.add('ai-feedback-gear'); gear.title = L.settings; gear.setAttribute('aria-label', L.settings); gear.onclick = openSettings; if (root.CTMSettings) buildSettings(); return gear; }
  function buildSettings() {
    if (settings) return settings;
    const L = lang();
    settings = node(root.CTMSettings ? 'div' : 'dialog', undefined, 'ai-feedback-settings');
    settings.id = 'ai-feedback-settings';
    settings.setAttribute('aria-labelledby', root.CTMSettings ? 'ctm-settings-ai-title' : 'ai-feedback-settings-title');
    const title = node('h2', L.settings); title.id = 'ai-feedback-settings-title';
    const close = button(L.cancel); close.onclick = closeSettings;
    if (!root.CTMSettings) settings.append(title, close);
    const form = node('div', undefined, 'ai-feedback-settings-grid');
    const fields = {};
    function field(name, label, choices, type = 'text') {
      const wrap = node('label', label);
      const input = node(choices ? 'select' : 'input');
      if (choices) for (const [value, text] of choices) input.add(new Option(text, value));
      else input.type = type;
      input.autocomplete = 'off'; wrap.append(input); form.append(wrap); fields[name] = input;
      return input;
    }
    field('mode', L.mode, [['copy', L.copy], ['api', L.api]]);
    // Free text fields with a ▾ at their edge (no extra controls): the API base URL
    // offers PROVIDERS, the two model fields the models fetched from the provider
    // and narrow that list while the learner types.
    function combo(input, labelText, toggleLabel, { filter = false } = {}) {
      const label = input.parentElement, box = node('div', undefined, 'ai-feedback-combo');
      // Password managers otherwise put their own icon over the ▾.
      for (const attr of ['data-lpignore', 'data-1p-ignore', 'data-bwignore']) input.setAttribute(attr, 'true');
      input.setAttribute('data-form-type', 'other');
      const toggle = node('button', undefined, 'ai-feedback-combo-toggle'); toggle.type = 'button';
      toggle.title = toggleLabel; toggle.setAttribute('aria-label', toggleLabel);
      const menu = node('div', undefined, 'ai-feedback-presets'); menu.id = input.id + '-menu'; menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', menu.id);
      let items = [], picking = false;
      const options = () => [...menu.querySelectorAll('.ai-feedback-preset')];
      function render(query) {
        const q = filter ? String(query || '').trim().toLowerCase() : '';
        menu.replaceChildren(); let heading = null, shown = 0;
        for (const item of items) {
          if (item.heading) { heading = item.heading; continue; }
          if (q && !item.value.toLowerCase().includes(q) && !(item.title || '').toLowerCase().includes(q)) continue;
          if (shown === 200) break;
          if (heading) { menu.append(node('div', heading, 'ai-feedback-presets-group')); heading = null; }
          const option = node('button', undefined, 'ai-feedback-preset'); option.type = 'button'; option.dataset.value = item.value;
          option.append(node('span', item.title || item.value)); if (item.detail) option.append(node('small', item.detail));
          menu.append(option); shown++;
        }
        return shown;
      }
      function show(open, { query = '', focus = false } = {}) {
        if (open && !render(query)) open = false;
        if (open && query && options().length === 1 && options()[0].dataset.value === input.value.trim()) open = false;
        menu.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
        if (open && focus) (options().find(o => o.dataset.value === input.value.trim()) || options()[0]).focus();
      }
      toggle.onclick = () => show(menu.hidden, { focus: true });
      menu.onclick = event => {
        const option = event.target.closest('.ai-feedback-preset'); if (!option) return;
        input.value = option.dataset.value; picking = true; input.dispatchEvent(new Event('input', { bubbles: true })); picking = false;
        show(false); input.focus();
      };
      menu.addEventListener('keydown', event => {
        const all = options(), i = all.indexOf(document.activeElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); all[(i + (event.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus(); }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); show(false); input.focus(); }
      });
      input.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' && items.length) { event.preventDefault(); show(true, { query: menu.hidden ? '' : input.value, focus: true }); }
        if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); event.stopPropagation(); show(false); }
      });
      if (filter) input.addEventListener('input', event => { if (!picking && document.activeElement === input) show(!!items.length, { query: input.value }); });
      menu.addEventListener('mousedown', event => event.preventDefault()); // keep focus, so the click lands
      box.addEventListener('focusout', event => { if (!box.contains(event.relatedTarget)) show(false); });
      // The label keeps only its text; input, ▾ (and an ⓘ) sit beside it so no button takes over the label.
      const text = node('label', labelText); text.htmlFor = input.id;
      const head = node('span', undefined, 'ai-feedback-label-row'); head.append(text);
      box.append(input, toggle, menu);
      const wrap = node('div', undefined, 'ai-feedback-url'); wrap.append(head, box);
      label.replaceWith(wrap);
      function setItems(list) { items = list; toggle.hidden = !list.length; box.classList.toggle('ai-feedback-combo-empty', !list.length); if (!menu.hidden) show(true); }
      return { head, setItems };
    }
    const url = field('baseUrl', L.url); url.id = 'ai-feedback-base-url';
    const urlCombo = combo(url, L.url, L.presets);
    urlCombo.setItems([[L.groupFree, false], [L.groupLocal, true]].flatMap(([heading, local]) =>
      [{ heading }, ...PROVIDERS.filter(p => !!p.local === local).map(p => ({ value: p.url, title: p.name, detail: p.url }))]));
    // ⓘ explains how to get a key for the provider the URL belongs to.
    const help = node('div', undefined, 'ai-feedback-help'); help.id = 'ai-feedback-url-help'; help.hidden = true;
    const info = node('button', 'i', 'ai-feedback-info'); info.type = 'button';
    info.title = L.urlHelpLabel; info.setAttribute('aria-label', L.urlHelpLabel);
    info.setAttribute('aria-expanded', 'false'); info.setAttribute('aria-controls', help.id);
    function renderHelp() {
      const p = providerFor(url.value);
      if (!p) { help.replaceChildren(node('p', L.urlHelp)); return; }
      const text = node('p'); text.append(node('strong', p.name + ': '), L[p.help]);
      const where = node('p', (p.local ? L.installLink : L.keyLink) + ' ');
      const a = node('a', p.link.replace(/^https?:\/\//, '')); a.href = p.link; a.target = '_blank'; a.rel = 'noopener noreferrer';
      where.append(a); help.replaceChildren(text, where);
    }
    info.onclick = () => { renderHelp(); help.hidden = !help.hidden; info.setAttribute('aria-expanded', String(!help.hidden)); };
    url.addEventListener('input', () => { if (!help.hidden) renderHelp(); });
    urlCombo.head.append(info);
    form.append(help);
    field('apiKey', L.key, null, 'password');
    const modelCombos = [['model', L.model], ['generatorModel', L.generatorModel]].map(([name, label]) => {
      const input = field(name, label); input.id = 'ai-feedback-' + name;
      return combo(input, label, L.showModels, { filter: true });
    });
    for (const c of modelCombos) c.setItems([]);
    field('storage', L.storage, [['session', L.session], ['local', L.local]]);
    function populate(cfg) { for (const [k, v] of Object.entries(cfg)) if (fields[k]) fields[k].value = v; }
    settings.populate = populate;
    populate(loadConfig());
    const message = node('p'); message.setAttribute('role', 'status');
    // Existing configurations are offered explicitly; never silently choose among providers.
    // A migrated legacy record (it can hold an API key) is removed once the
    // settings are saved, so the storage the learner chose is the only copy.
    let migrated = null;
    for (const [key, label] of [['math-exercise-llm-config', 'math-exercise'], ['qpyodide-feedback-config', 'Pyodide']]) {
      let saved;
      for (const kind of ['session', 'local']) { try { saved ||= JSON.parse(store(kind)?.getItem(key) || 'null'); } catch {} }
      if (saved) { const migrate = button(L.legacy + ' ' + label); migrate.onclick = () => { populate({ ...saved, mode: saved.mode || 'api' }); migrated = key; }; form.append(migrate); }
    }
    const models = button(L.models);
    // A changed provider makes the fetched list stale.
    url.addEventListener('input', () => { for (const c of modelCombos) c.setItems([]); });
    models.onclick = async () => {
      models.disabled = true; message.textContent = '';
      try {
        const url = new URL(fields.baseUrl.value);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use a valid API base URL.');
        const response = await fetch(url.href.replace(/\/+$/, '') + '/models', { headers: fields.apiKey.value ? { Authorization: 'Bearer ' + fields.apiKey.value } : {}, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('API ' + response.status);
        const data = await response.json();
        const available = (data.data || []).filter(m => typeof m.id === 'string' && !F.modelPolicy(m.id).incompatible);
        // OpenRouter and others report prices; free models then come first.
        const free = m => m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0;
        const item = m => ({ value: m.id, title: m.id, detail: m.name && m.name !== m.id ? m.name : '' });
        const priced = available.some(m => m.pricing);
        const list = priced
          ? [{ heading: L.modelsFree }, ...available.filter(free).map(item), { heading: L.modelsOther }, ...available.filter(m => !free(m)).map(item)]
          : available.map(item);
        for (const c of modelCombos) c.setItems(list);
        message.textContent = L.modelsLoaded.replace('{n}', available.length);
      } catch (e) { for (const c of modelCombos) c.setItems([]); message.textContent = e.message; } finally { models.disabled = false; }
    };
    const save = button(L.save);
    save.onclick = () => {
      const cfg = {}; for (const key of ['mode', 'baseUrl', 'apiKey', 'model', 'generatorModel', 'storage']) cfg[key] = fields[key].value.trim();
      saveConfig(cfg);
      if (migrated) { for (const kind of ['session', 'local']) { try { store(kind)?.removeItem(migrated); } catch {} } migrated = null; }
      message.textContent = L.saved; closeSettings();
    };
    form.append(models, save, message, node('p', L.privacy, 'ai-feedback-notice'));
    settings.append(form);
    if (root.CTMSettings) root.CTMSettings.register('ai', L.settings, settings);
    else document.body.append(settings);
    return settings;
  }
  document.addEventListener('ctm:settings-open', () => { buildSettings().populate?.(loadConfig()); });
  function getClient() { return F.createClient(loadConfig(), { storage: store(loadConfig().storage) }); }
  function getGenerationClient() {
    const cfg = loadConfig();
    if (cfg.mode !== 'api') throw new F.FeedbackError('CONFIGURATION', 'Choose Direct API in Feedback settings.');
    if (!cfg.generatorModel && !F.modelPolicy(cfg.model).slow) throw new F.FeedbackError('CONFIGURATION', 'Choose a reasoning model for generating problems in Feedback settings.');
    return F.createClient({...cfg, model: cfg.generatorModel || cfg.model}, {storage: store(cfg.storage)});
  }
  function signature(request) { return JSON.stringify(request); }
  function attach(options) {
    const { button: trigger, output, getRequest } = options;
    const L = lang(options.uiLanguage);
    let controller, disposed = false, quietCancellation = false;
    let count = 0;
    const counterKey = options.id ? 'ai-feedback-hints-v2|' + location.pathname + '|' + options.id : null;
    try { if (counterKey) count = Number(store('session')?.getItem(counterKey)) || 0; } catch {}
    let policyFingerprint;
    // Correction state belongs to this uploaded submission, never browser storage.
    let lastFeedback = null, correctionUsed = false, correctionNote = '', revision = 0;
    function clearCorrection() { lastFeedback = null; correctionUsed = false; correctionNote = ''; revision++; }
    function currentPolicyFingerprint() {
      if (!options.integration) return;
      const {harder, easier, same, ...teaching} = F.resolvePolicy(options.integration, options.uiLanguage, options.policyDefaults, undefined, options.policySelection);
      return JSON.stringify(teaching);
    }
    function providerFingerprint(config) { return JSON.stringify([config.baseUrl, config.model, config.apiKey]); }
    function feedbackSettingsChanged(feedback, config) {
      return !feedback || currentPolicyFingerprint() !== feedback.policyFingerprint ||
        (!options.client && (config.mode !== 'api' || providerFingerprint(config) !== feedback.providerFingerprint));
    }
    function syncPolicy() {
      if (!options.integration) return;
      const fingerprint = currentPolicyFingerprint();
      if (fingerprint === policyFingerprint) return;
      const changed = policyFingerprint !== undefined;
      policyFingerprint = fingerprint;
      if (changed) { lastFeedback = null; revision++; }
      if (!counterKey) { if (changed) count = 0; return; }
      try {
        if (changed || store('session')?.getItem(counterKey + '|policy') !== fingerprint) {
          count = 0; store('session')?.removeItem(counterKey);
          store('session')?.setItem(counterKey + '|policy', fingerprint);
        }
      } catch { if (changed) count = 0; }
    }
    async function collect(hintLevel) {
      let request = await getRequest({ hintLevel });
      const refs = typeof options.contextRefs === 'function' ? options.contextRefs() : options.contextRefs;
      if (refs) {
        const visual = await F.collectVisualContexts(refs);
        request = {...request, materials:[...(request.materials || []), ...visual.materials],
          attachments:[...(request.attachments || []), ...visual.attachments]};
      }
      if (options.integration) request = F.applyPolicy(options.integration, request, hintLevel, options.policyDefaults, options.policySelection);
      if (request.feedback?.mode === 'hints') request = { ...request, feedback: { ...request.feedback, level: Math.min(hintLevel, request.feedback.steps.length) } };
      if (correctionNote) request = {...request, correction: {note: correctionNote}};
      return request;
    }
    function showCorrection() {
      if (!options.corrections || !lastFeedback) return;
      const section = node('div', undefined, 'ai-feedback-correction');
      output.append(section);
      if (correctionUsed) {
        section.append(node('p', L.correctionNote + ' ' + correctionNote), node('p', L.correctionClosed, 'ai-feedback-notice'));
        return;
      }
      const open = button(L.correctReading);
      open.setAttribute('aria-expanded', 'false');
      const form = node('form'); form.hidden = true;
      const label = node('label', L.correctionLabel), note = node('textarea');
      note.rows = 3; note.maxLength = 1200; note.required = true; label.append(note);
      const submit = button(L.updateFeedback); submit.type = 'submit';
      const close = button(L.cancel), status = node('p'); status.setAttribute('role', 'status');
      close.onclick = () => { form.hidden = true; open.setAttribute('aria-expanded', 'false'); open.focus(); };
      open.onclick = () => { form.hidden = !form.hidden; open.setAttribute('aria-expanded', String(!form.hidden)); if (!form.hidden) note.focus(); };
      form.append(node('p', L.correctionHelp, 'ai-feedback-notice'), label, submit, close, status);
      section.append(open, form);
      function requestFreshFeedback() {
        const notice = node('p', L.correctionSettingsChanged, 'ai-feedback-notice'); notice.setAttribute('role', 'status');
        section.replaceChildren(notice);
      }
      form.onsubmit = async event => {
        event.preventDefault();
        if (controller || disposed || correctionUsed) return;
        const text = note.value.trim(), originalFeedback = lastFeedback;
        // Checking settings here must not synchronize/reset hint progress. The
        // displayed feedback and its counter stay intact until fresh feedback.
        try {
          if (feedbackSettingsChanged(originalFeedback, loadConfig())) { requestFreshFeedback(); return; }
        } catch { requestFreshFeedback(); return; }
        if (!text || text.length > 1200) return;
        const currentRevision = revision;
        const original = trigger.textContent;
        controller = new AbortController(); quietCancellation = false;
        trigger.disabled = true; submit.disabled = true; close.disabled = true; note.disabled = true; open.disabled = true;
        trigger.textContent = L.busy; status.textContent = L.busy;
        output.setAttribute('aria-busy', 'true');
        const cancel = button(L.cancel); cancel.onclick = () => controller?.abort(); form.append(cancel);
        try {
          const current = await collect(originalFeedback.level);
          if (controller.signal.aborted || disposed || revision !== currentRevision) throw new F.FeedbackError('ABORTED', L.cancelled);
          if (signature(current) !== originalFeedback.signature) { status.textContent = L.stale; return; }
          const restarted = JSON.parse(JSON.stringify(await collect(1)));
          const request = {...restarted, correction: {note: text, previousFeedback: originalFeedback.text, previousLevel: originalFeedback.previousLevel}};
          if (request.feedback?.mode === 'hints') request.feedback = {...request.feedback, level: 1, allowFullRewrite: false};
          if (controller.signal.aborted || disposed || revision !== currentRevision) throw new F.FeedbackError('ABORTED', L.cancelled);
          const config = loadConfig();
          if (feedbackSettingsChanged(originalFeedback, config)) { requestFreshFeedback(); return; }
          const client = options.client || F.createClient(config, {storage: store(config.storage)});
          const reply = await client.request(request, {...options.requestOptions, signal: controller.signal});
          if (controller.signal.aborted || disposed || revision !== currentRevision) throw new F.FeedbackError('ABORTED', L.cancelled);
          const after = await collect(originalFeedback.level);
          if (controller.signal.aborted || disposed || revision !== currentRevision) throw new F.FeedbackError('ABORTED', L.cancelled);
          if (signature(after) !== originalFeedback.signature) { status.textContent = L.stale; return; }
          // Prepare the replacement separately: errors and cancellation keep the old feedback.
          const body = node('div', undefined, 'ai-feedback-body'); body.innerHTML = F.renderMarkdown(reply.text);
          output.append(body); body.hidden = true;
          try { await F.typesetFeedback(body); }
          catch (error) { console.warn('ai-feedback: math typesetting unavailable; keeping readable TeX.', error); }
          if (controller.signal.aborted || disposed || revision !== currentRevision) { body.remove(); throw new F.FeedbackError('ABORTED', L.cancelled); }
          if (signature(await collect(originalFeedback.level)) !== originalFeedback.signature || controller.signal.aborted || disposed || revision !== currentRevision) {
            body.remove(); status.textContent = L.stale; return;
          }
          correctionUsed = true; correctionNote = text;
          if (request.feedback?.mode === 'hints') {
            count = 1; try { if (counterKey) store('session')?.setItem(counterKey, '1'); } catch {}
          }
          body.hidden = false; output.replaceChildren(body);
          if (request.feedback?.mode === 'hints') {
            output.prepend(node('p', L.hint + ' ' + request.feedback.level, 'ai-feedback-hint'));
            output.append(node('p', L.correctionRestart, 'ai-feedback-notice'));
          }
          showCorrection(); options.afterRender?.(body);
          body.setAttribute('tabindex', '-1'); body.focus();
        } catch (error) {
          if (section.isConnected && !disposed) status.textContent = revision !== currentRevision ? L.stale : error.code === 'ABORTED' ? L.cancelled : error.message;
        } finally {
          controller = null; trigger.disabled = false; trigger.textContent = original;
          submit.disabled = false; close.disabled = false; note.disabled = false; open.disabled = false; cancel.remove();
          output.setAttribute('aria-busy', 'false');
        }
      };
    }
    async function run() {
      if (controller || disposed) return;
      const original = trigger.textContent;
      trigger.disabled = true; trigger.textContent = L.busy;
      output.replaceChildren(); output.setAttribute('aria-busy', 'true');
      quietCancellation = false;
      controller = new AbortController();
      const cancel = button(L.cancel); cancel.onclick = () => controller?.abort(); output.append(cancel);
      try {
        syncPolicy();
        const hintLevel = count + 1;
        const request = await collect(hintLevel);
        if (controller.signal.aborted || disposed) throw new F.FeedbackError('ABORTED', L.cancelled);
        const snapshot = signature(request);
        const cfg = loadConfig();
        const client = options.client || (cfg.mode === 'api' ? getClient() : null);
        let reply;
        if (client) reply = await client.request(request, { ...options.requestOptions, signal: controller.signal });
        else reply = { text: F.buildPrompt(request), format: 'prompt' };
        if (controller.signal.aborted) throw new F.FeedbackError('ABORTED', L.cancelled);
        const current = signature(await collect(hintLevel));
        if (controller.signal.aborted || disposed) throw new F.FeedbackError('ABORTED', L.cancelled);
        if (snapshot !== current) { output.textContent = L.stale; return; }
        output.replaceChildren();
        if (reply.format === 'prompt') {
          output.append(node('p', L.prompt));
          const pre = node('pre', reply.text, 'ai-feedback-prompt'); output.append(pre);
          const images = F.normalizeRequest(request).attachments;
          if (images.length) {
            output.append(node('p', (locale[String(options.uiLanguage || 'en').split('-')[0]] || locale.en).attachImages));
            const previews = node('div', undefined, 'ai-feedback-images');
            for (const image of images) {
              const figure = node('figure'); const preview = node('img'); preview.src = image.dataUrl; preview.alt = image.label;
              const download = node('a', image.label); download.href = image.dataUrl;
              download.download = image.id.replace(/[^a-z0-9_-]/gi, '-') + '.' + image.dataUrl.match(/^data:image\/([^;]+)/)[1];
              figure.append(preview, download); previews.append(figure);
            }
            output.append(previews);
          }
          const copy = button(L.copy); copy.onclick = async () => { try { await navigator.clipboard.writeText(reply.text); copy.textContent = L.copied; } catch { pre.setAttribute('tabindex', '0'); pre.focus(); } }; output.append(copy);
        } else {
          const body = node('div', undefined, 'ai-feedback-body');
          body.innerHTML = F.renderMarkdown(reply.text); output.append(body);
          try { await F.typesetFeedback(body); }
          catch (error) { console.warn('ai-feedback: math typesetting unavailable; keeping readable TeX.', error); }
          if (body.isConnected && !controller.signal.aborted) options.afterRender?.(body);
        }
        if (controller.signal.aborted || disposed) throw new F.FeedbackError('ABORTED', L.cancelled);
        if (request.feedback?.mode === 'hints') {
          count = Math.min(count + 1, request.feedback.steps.length); try { if (counterKey) store('session')?.setItem(counterKey, String(count)); } catch {}
          output.prepend(node('p', L.hint + ' ' + Math.min(count, request.feedback.steps.length), 'ai-feedback-hint'));
        }
        if (client && options.corrections && request.attachments?.some(a => a.role === 'response')) {
          lastFeedback = {signature: snapshot, level: hintLevel, previousLevel: request.feedback?.level || 1,
            text: reply.text, policyFingerprint, providerFingerprint: providerFingerprint(cfg)};
          showCorrection();
          options.onCorrectionAvailable?.();
        }

      } catch (e) {
        if (controller.signal.aborted && quietCancellation) { output.replaceChildren(); return; }
        output.textContent = e.code === 'ABORTED' ? L.cancelled : e.message;
        if (e.code === 'CONFIGURATION') { const configure = button(L.settings); configure.onclick = openSettings; output.append(configure); }
      } finally { controller = null; trigger.disabled = false; trigger.textContent = original; output.setAttribute('aria-busy', 'false'); }
    }
    trigger.addEventListener('click', run);
    return { request: run, reset(reason = 'reset') {
      clearCorrection();
      quietCancellation = true; controller?.abort(); output.replaceChildren();
      options.onReset?.();
      if (reason !== 'run' || !options.integration || F.resolvePolicy(options.integration, options.uiLanguage, options.policyDefaults, undefined, options.policySelection)['reset-on-run']) {
        count = 0; try { if (counterKey) store('session')?.removeItem(counterKey); } catch {}
      }
    }, cancel({clearOutput = false} = {}) { quietCancellation ||= clearOutput; controller?.abort(); if (clearOutput) output.replaceChildren(); }, dispose() { disposed = true; controller?.abort(); trigger.removeEventListener('click', run); } };
  }
  function readFile(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read image.')); reader.readAsDataURL(file); }); }
  function initActivity(el) {
    if (el.dataset.aiFeedbackReady) return;
    el.dataset.aiFeedbackReady = 'true';
    const data = JSON.parse(el.querySelector('script.ai-feedback-data').textContent);
    const L = lang(data.uiLanguage);
    const label = node('label', L.response);
    const input = node('textarea'); input.rows = 7; input.id = data.id + '-response'; input.value = data.starter || ''; label.htmlFor = input.id; input.lang = data.responseLanguage || '';
    el.append(label, input);
    let handle;
    const unlockOriginalResponse = () => { input.readOnly = false; input.hidden = label.hidden = false; };
    const resetSubmission = () => {
      if (data.corrections) handle?.reset();
    };
    const lockOriginalResponse = () => {
      if (data.corrections) { input.readOnly = true; input.hidden = label.hidden = !input.value.trim(); }
    };
    let attachments = [], loadingImages = null, resetImages = () => {};
    if (data.imageUpload) {
      const imageLabel = node('label', L.images); const upload = node('input'); upload.type = 'file'; upload.accept = 'image/png,image/jpeg,image/webp'; upload.multiple = true; imageLabel.append(upload);
      const preview = node('div', undefined, 'ai-feedback-images');
      let selectionVersion = 0;
      upload.onchange = () => {
        resetSubmission();
        const files = [...upload.files]; const version = ++selectionVersion; attachments = []; preview.replaceChildren();
        loadingImages = (async () => {
          if (files.length > 3 || files.some(f => !['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size > 8 * 1024 * 1024) || files.reduce((n, f) => n + f.size, 0) > 12 * 1024 * 1024) throw new Error(L.invalidImage);
          const loaded = await Promise.all(files.map(async (f, i) => ({ id: 'image-' + (i + 1), role: data.imageRole || 'response', label: f.name, dataUrl: await readFile(f) })));
          if (version !== selectionVersion) return;
          attachments = loaded;
          for (const a of attachments) { const image = node('img'); image.src = a.dataUrl; image.alt = a.label; preview.append(image); }
        })().catch(e => { if (version === selectionVersion) preview.textContent = e.message; throw e; });
        loadingImages.catch(() => {});
      };
      resetImages = () => { resetSubmission(); selectionVersion++; attachments = []; loadingImages = null; upload.value = ''; preview.replaceChildren(); };
      const clear = button(L.clear); clear.onclick = resetImages;
      el.append(imageLabel, node('p', L.imageNote, 'ai-feedback-notice'), preview, clear);
    }
    const trigger = button(L.button); const output = node('div', undefined, 'ai-feedback-output'); output.setAttribute('aria-live', 'polite');
    el.append(trigger, settingsButton(data.uiLanguage), output);
    handle = attach({ integration: 'plain-text', corrections: data.corrections, onCorrectionAvailable: lockOriginalResponse, onReset: unlockOriginalResponse, contextRefs: () => data.contextMode === 'none' ? '' : data.contextRefs, policySelection: data.policySelection, id: data.id, button: trigger, output, uiLanguage: data.uiLanguage, getRequest: async () => {
      if (loadingImages) await loadingImages;
      let materials = (data.materials || []).slice();
      materials.push(...F.contextMaterials({mode:data.contextMode, refs:data.contextRefs, text:data.context}));
      if (data.sourceRef) {
        const sources = F.collectExplicitContexts(data.sourceRef);
        if (!sources.length) throw new Error('The referenced source text is missing or unavailable.');
        materials.push(...sources.map(c => ({ id: c.id, role: 'source', text: c.content, language: data.sourceLanguage || '' })));
      }
      return { task: data.task, profile: data.profile, materials, responses: [{ id: 'response', value: input.value, format: 'text', language: data.responseLanguage }], attachments,
        learner: { level: data.learnerLevel || '' }, criteria: data.criteria,
        feedback: { language: data.feedbackLanguage, mode: 'review', maxIssues: data.maxIssues, allowFullRewrite: false } };
    } });
    if (typeof data.resetOnVariant === 'string' && data.resetOnVariant.trim()) {
      // Initial choice hydration and cancelled requests do not emit this event.
      // The activity owns its response and cancellation; the math component
      // needs no access to another component's DOM or private grading context.
      document.addEventListener('math-exercise:variant-accepted', event => {
        if (!el.isConnected || event.detail?.label !== data.resetOnVariant) return;
        handle.reset();
        input.value = '';
        resetImages();
        input.dispatchEvent(new Event('input', {bubbles: true}));
      });
    }
  }
  function renderPolicySummaries() {
    for (const el of document.querySelectorAll('.ai-feedback-policy-summary')) {
      try {
        const options=el.dataset.integration === 'pyodide-interaktiv' && root.qpyodideFeedbackOptions?.hints === false ? {steps:[]} : {};
        const info=F.explainPolicy(el.dataset.integration, el.dataset.language || document.documentElement.lang || 'en', undefined,
          {exercise:el.dataset.exercise || '',name:el.dataset.policy || ''},options);
        const p=info.policy;
        el.replaceChildren(node('strong','Effective policy'));
        el.append(node('p',info.scopes.length ? info.scopes.map(s => s.scope + ': ' + s.chain.join(' → ')).join('; ') : 'Integration defaults (no named selection)'));
        if (el.dataset.exercise) el.append(node('p','Exercise: ' + el.dataset.exercise));
        el.append(node('p',p.steps.length ? p.steps.length + ' feedback step(s)' : 'Review without a hint sequence'));
        const table=node('table'),head=node('tr');
        for(const label of ['Step','Word limit','Issue limit','Full solution'])head.append(node('th',label));
        table.append(head);
        for(const [i,step] of (p.steps.length?p.steps:[{}]).entries()){
          const effective={...p,...step},row=node('tr');
          for(const value of [p.steps.length?String(i+1):'Review',String(effective['max-words']),String(el.dataset.integration === 'plain-text' && el.dataset.maxIssues ? el.dataset.maxIssues : effective['max-issues']),effective['allow-full-solution']?'Allowed':'Not allowed'])row.append(node('td',value));
          table.append(row);
        }
        el.append(table,node('p','Resolved base instructions'),node('pre',p.basePrompts.join('\n\n')));
      } catch(error) { el.replaceChildren(node('p',error.message)); }
    }
  }
  function initialize() {
    if (document.querySelector('.ai-feedback-activity')) { buildSettings(); document.querySelectorAll('.ai-feedback-activity').forEach(initActivity); }
    renderPolicySummaries();
  }

  Object.assign(F, { attach, openSettings, settingsButton, buildSettings, loadConfig, saveConfig, getClient, getGenerationClient, initActivity, initialize, renderPolicySummaries, locales: locale });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize); else initialize();
})(globalThis);
