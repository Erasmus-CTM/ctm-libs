-- Shared saved-answer manifest and page bar. Components own their inputs.
return function(ctm)
  local M = {}
  local exercises, finalized, warned, runtimeSeen = {}, false, false, {}
  local function escape(value)
    return tostring(value or ""):gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"):gsub('"', "&quot;")
  end
  local function text(key) return ctm.locale.text("ui", key, ctm.locale.resolve("ui")) end
  local function isHTML() return quarto.doc.is_format("html:js") end
  local function dependencies()
    if not isHTML() then return end
    ctm.layout.use()
    ctm.locale.use("ui")
    ctm.deps.html({name = "ctm-ui", stylesheets = {"ui/ctm-ui.css"}})
    ctm.deps.html({name = "ctm-copy", scripts = {"ui/ctm-copy.js"}})
    ctm.deps.html({name = "ctm-store", scripts = {"ui/ctm-store.js"}})
  end
  local function saving(spec)
    local value = spec.save
    if value == nil then
      value = ctm.settings.choice(spec.component == "pyodide-interaktiv" and "pyodide" or spec.component, "save", {"answers", "none"}, {shared = true, default = "answers"})
    end
    if value == true or value == "true" or value == "answers" then return true end
    if value == false or value == "false" or value == "none" then return false end
    ctm.fail(spec.component .. ": save must be true or false on an exercise (answers or none in metadata).")
  end
  function M.exercise(spec)
    assert(type(spec) == "table" and spec.component, "ctm.ui.exercise needs a component")
    local id = spec.id and tostring(spec.id) or ""
    local source = spec.source and tostring(spec.source) or ""
    assert(source:match("^[%da-fA-F]+$") and #source == 16, "ctm.ui.exercise source must be the first 16 hex digits of the block's SHA-1")
    local save = saving(spec) and isHTML()
    local entry = {component = spec.component, id = id, source = source, save = save and id ~= "", title = spec.title}
    local attrs = spec.block and spec.block.attributes or {}
    local runtime = attrs["__ctm-runtime-id"] or ("ctm-runtime-" .. tostring(#exercises + 1))
    runtimeSeen[runtime] = (runtimeSeen[runtime] or 0) + 1
    entry.runtimeId = runtime .. (runtimeSeen[runtime] > 1 and ("-" .. runtimeSeen[runtime]) or "")
    entry.order = tonumber(attrs["__ctm-order"]) or (#exercises + 1)
    entry.quiz = ctm.progress.quizFor(id, source, spec.block)
    exercises[#exercises + 1] = entry
    if id ~= "" then
      for _, other in ipairs(exercises) do
        if other ~= entry and other.id == id then other.save = false; entry.save = false end
      end
    end
    dependencies()
    return {save = entry.save, attributes = {
      ["data-ctm-component"] = spec.component, ["data-ctm-id"] = id,
      ["data-ctm-runtime-id"] = entry.runtimeId,
      ["data-ctm-source"] = source, ["data-ctm-save"] = tostring(entry.save)
    }}
  end
  function M.exercises() return exercises end
  local function messages()
    local out = {}
    for _, key in ipairs({"settings", "answersStorage", "savingLocal", "savedLocal", "notSaving", "answered", "confirmClearPage", "savingNotice", "savingDisabled", "savingOffNotice", "clearFailed", "storageUnavailable", "recordTooLarge", "saveOff", "saveOn", "confirmSaveOff", "confirmClearCourse",
      "lastResult", "sourceChanged", "showSaved", "outdated", "variantChanged", "variantWithdrawn", "statusCorrect", "statusPartial",
      "statusWrong", "statusInvalid", "confirmNewVariant", "progressTitle", "exercise", "correct", "partial", "wrong",
      "unattempted", "total", "exportTitle", "copyAll", "downloadMarkdown", "downloadHTML", "exportClose"}) do
      out[key] = text(key)
    end
    out.locale = ctm.locale.resolve("ui")
    return out
  end
  local function bar(saving, export)
    local buttons = saving and {
      '<button type="button" data-ctm-save-toggle>' .. escape(text("saveOff")) .. '</button>'
    } or {}
    if export then buttons[#buttons + 1] = '<button type="button" data-ctm-export>' .. escape(text("exportTitle")) .. '</button>' end
    if saving then
      buttons[#buttons + 1] = '<button type="button" data-ctm-clear-page>' .. escape(text("clearPage")) .. '</button>'
      buttons[#buttons + 1] = '<button type="button" data-ctm-clear-course>' .. escape(text("clearCourse")) .. '</button>'
    end
    return pandoc.RawBlock("html", '<!--ctm-save-generated--><div class="ctm-save-bar" role="region" aria-label="'
      .. escape(text(saving and "savingLabel" or "exportTitle")) .. '" hidden><p class="ctm-save-notice">' .. escape(text(saving and "savingNotice" or "savingDisabled")) .. '</p><div class="ctm-save-actions">'
      .. table.concat(buttons, "\n") .. '</div><span class="ctm-save-status" role="status" aria-live="polite"></span></div>')
  end
  function M.finalize(doc)
    -- The umbrella knows every component has finished. Standalone components
    -- call again after their own CodeBlocks; replace our previous output.
    if rawget(_G, "__ctmLibsEnd") and not rawget(_G, "__ctmLibsEndRan") then return doc end
    if not isHTML() then return doc end
    local quizzes = ctm.progress.finalize(exercises)
    if #exercises == 0 then return doc end
    dependencies()
    local progress = ctm.settings.bool("ctm-assessment", "progress", {default = false})
    local export = ctm.settings.bool("ctm-assessment", "export", {default = true})
    if export then ctm.deps.html({name = "ctm-export", scripts = {"ui/ctm-export.js"}}) end
    if progress or #quizzes > 0 then
      ctm.deps.html({name = "ctm-nav", scripts = {"ui/ctm-nav.js"}})
      ctm.deps.html({name = "ctm-progress", scripts = {"ui/ctm-progress.js"}})
    end
    local warnings = {}
    local seen, duplicates = {}, {}
    for _, entry in ipairs(exercises) do
      if entry.id == "" then warnings[#warnings + 1] = entry.component .. " (unlabelled)"
      elseif seen[entry.id] then duplicates[entry.id] = true
      else seen[entry.id] = true end
    end
    for id in pairs(duplicates) do warnings[#warnings + 1] = id .. " (duplicate label)" end
    if #warnings > 0 and not warned then
      warned = true
      quarto.log.warning("Saved answers: not saved on " .. ctm.source.pageName() .. ": " .. table.concat(warnings, ", ") .. ". Add unique exercise labels.")
    end
    local saving = false
    for _, entry in ipairs(exercises) do saving = saving or entry.save end
    table.sort(exercises, function(a, b) return a.order < b.order end)
    local manifest = {v = 1, course = ctm.settings.string("ctm-assessment", "storage-key"),
      save = saving, export = export, progress = progress, exercises = exercises, quizzes = quizzes, messages = messages()}
    -- JSON is data, never executable script. Escape '<' so author text cannot
    -- terminate the script element, including titles and storage-key.
    local json = quarto.json.encode(manifest):gsub("<", "\\u003c"):gsub(">", "\\u003e"):gsub("&", "\\u0026")
    local blocks = pandoc.Blocks({})
    for _, block in ipairs(doc.blocks) do
      if not (block.t == "RawBlock" and block.text:find("<!--ctm%-save%-generated-->")) then blocks:insert(block) end
    end
    local position = 1
    if blocks[1] and blocks[1].t == "RawBlock" and blocks[1].text:find('class="ctm%-modes"') then position = 2 end
    if saving or export then blocks:insert(position, bar(saving, export)) end
    blocks:insert(pandoc.RawBlock("html", '<!--ctm-save-generated--><script type="application/json" id="ctm-store-manifest">' .. json .. '</script>'))
    doc.blocks = blocks
    finalized = true
    return doc
  end
  return M
end
