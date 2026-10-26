-- AI feedback, folded in from the ai-feedback extension: activities, learning
-- context and teaching policies for every component (ctm.feedback).
-- AGPL-3.0-or-later. Context preservation follows math-exercise fc549d2.
return function(ctm)
local M = {}
local policy = ctm.policy
local counter = 0
-- The page's ai-feedback settings (ctm.settings), read in prepare.
local cfg = {}
-- One ai-feedback version per page. Older components' loaders
-- (feedback-loader.lua, through the ai-feedback alias) and ctm-libs register
-- the installation they load here (filters share Lua globals); a page that
-- would combine two different versions, such as an old standalone
-- ai-feedback 0.8 next to the package, stops instead of mixing them. The
-- check stays after the alias (step-3 design §18.4, §18.6): projects of
-- pyodide-interaktiv 1.8 keep their ai-feedback 0.8.1 folder after updating.
do
  local here = ctm.path("lua", "feedback.lua")
  local loaded = _G.__ctmAiFeedbackInstallation
  if loaded and pandoc.path.normalize(loaded.path) ~= pandoc.path.normalize(here) and loaded.version ~= ctm.version then
    ctm.fail("This page combines filters that use different ai-feedback versions: " .. loaded.path .. " ("
      .. loaded.version .. ") and " .. here .. " (" .. ctm.version .. "). AI feedback is part of CTM Assessment "
      .. "and of pyodide-interaktiv 1.9: remove ai-feedback from filters: and delete the old folder.")
  end
  _G.__ctmAiFeedbackInstallation = loaded or {path = here, version = ctm.version}
end

-- P22: a build without AI feedback. Off when CTM_FEEDBACK=off or when
-- ai-feedback: enabled resolves to false (any level, the merged metadata;
-- no level can turn it back on). Policies are still read and validated, so
-- both builds fail alike; nothing of AI feedback reaches the HTML.
local switch = nil
-- One build message per page: its exercises that only AI feedback can
-- assess, shown as text or removed (ai-feedback: without-ai, lua/policy.lua),
-- and what it asked for but did not get. Those items are only what is on the
-- page: the exercises and cells a component found (request()), pyodide cells
-- under pyodide: feedback: true, and the page's own ai-feedback: enabled:
-- true (not a project-wide setting). With without-ai unset, exercises that
-- only AI feedback can assess stop the build instead (flush).
--
-- The message is printed by flush(), which ctm-libs-end.lua calls after every
-- component (the CTM Assessment package lists that file last). Where it is not
-- listed (component development builds, filters: [ctm-libs]), the table's
-- finalizer prints it instead: Pandoc closes the page's Lua state when its
-- filters have run, and closing runs the finalizers (Lua 5.4). Should a
-- future Pandoc or Quarto keep the state open, only that fallback is lost.
local leftOut = {items = {}, seen = {}, reason = ""}
local function message()
  local shown = policy.withoutAIMessage()
  if #leftOut.items == 0 and not shown then return nil end
  local parts = {shown}
  if #leftOut.items > 0 then
    parts[#parts + 1] = (shown and "Left out" or "left out") .. " on this page: " .. table.concat(leftOut.items, ", ")
  end
  leftOut.items = {}
  return "AI feedback is off for this build (" .. (switch and switch.reason or leftOut.reason) .. "); "
    .. table.concat(parts, ". ") .. "."
end
setmetatable(leftOut, {__gc = function()
  local text = message()
  if text then quarto.log.warning(text) end
end})
local function leaveOut(item)
  leftOut.reason = switch and switch.reason or leftOut.reason
  if not leftOut.seen[item] then
    leftOut.seen[item] = true
    table.insert(leftOut.items, item)
  end
end

-- Prints the page's build message now (once); true when there was one. When
-- without-ai is unset and the page has exercises only AI feedback can assess,
-- stops the build instead, with one error that names them all.
function M.flush()
  local stop = policy.withoutAIStop()
  if stop then
    leftOut.items = {}
    ctm.fail(stop)
  end
  local text = message()
  if text then quarto.log.warning(text) end
  return text ~= nil
end

-- true, or false and the reason (naming the setting that turned it off).
function M.enabled()
  if switch then return switch.on, switch.reason end
  local html = quarto.doc.is_format("html")
  local env = os.getenv("CTM_FEEDBACK")
  local entry = nil
  if env == "off" then
    switch = {on = false, reason = "CTM_FEEDBACK=off"}
    if html and ctm.settings.loaded() then entry = ctm.settings.entry("ai-feedback", "enabled") end
  else
    if env and env ~= "" and env ~= "on" then
      quarto.log.warning("CTM_FEEDBACK=" .. env .. " is not understood (use off); AI feedback follows the project's settings.")
    end
    switch = {on = true}
    if html then
      -- Stops when the page's settings were not loaded (a component bug).
      entry = ctm.settings.entry("ai-feedback", "enabled")
      if entry and entry.value == false then
        switch = {on = false, reason = "ai-feedback: enabled: false (" .. tostring(entry.origin) .. ")"}
      end
    end
  end
  if not switch.on and entry and entry.asked then leaveOut("ai-feedback: enabled: true (" .. entry.asked .. ")") end
  return switch.on, switch.reason
end

-- Whether `component` gets AI feedback: `wanted` and not switched off. A
-- request that the switch refuses is named in the page's build message
-- (`origin`: where the wish comes from, e.g. "feedback: true in _quarto.yml").
function M.request(component, wanted, origin)
  if not wanted then return false end
  if M.enabled() then return true end
  leaveOut(component .. " feedback" .. (origin and origin ~= "" and (" (" .. origin .. ")") or ""))
  return false
end

local function requireSettings(what)
  if quarto.doc.is_format("html") then
    assert(ctm.settings.loaded(), "ctm-libs: feedback." .. what .. " needs the page's settings; the component calls "
      .. "ctm.settings.load(meta) or ctm.feedback.prepare(doc) first.")
  end
end
-- The page's interface language for activities (resolved, e.g. "nb") and the
-- language feedback is written in (the raw tag), set in prepare.
local uiLanguage, feedbackLanguage = "en", "en"
local function str(v, fallback)
  if v == nil then return fallback end
  return pandoc.utils.stringify(v)
end
local function json(value)
  return quarto.json.encode(value):gsub("<", "\\u003c"):gsub(">", "\\u003e"):gsub("&", "\\u0026")
end
local function excluded(b, retainActivity)
  local attrs = b.attributes or {}
  if attrs["hidden"] ~= nil or attrs["aria-hidden"] == "true" then return true end
  local style = (attrs.style or ""):lower()
  if style:match("display%s*:%s*none") or style:match("visibility%s*:%s*hidden") then return true end
  for _, class in ipairs(b.classes or {}) do
    if (class == "ai-feedback" and not retainActivity) or class == "ai-feedback-activity" or class == "feedback-criteria" or class == "feedback-starter" or class == "example-author-notes" or class == "ai-feedback-ignore" or class == "hidden" or class:match("^cell%-output") then return true end
  end
  return false
end
local function sourceText(block)
  if excluded(block) then return "" end
  local source = block:walk({
    Math = function(m)
      local display = m.mathtype == "DisplayMath"
      return pandoc.Str((display and "\\[" or "\\(") .. m.text .. (display and "\\]" or "\\)"))
    end,
    traverse = "topdown",
    Div = function(b) if excluded(b) then return {}, false end end,
    Span = function(b) if excluded(b) then return {}, false end end,
    RawBlock = function() return {} end,
    RawInline = function() return {} end,
    CodeBlock = function() return {} end,
  })
  return pandoc.utils.stringify(source):match("^%s*(.-)%s*$")
end
local function preserveMath(block)
  return block:walk({ Math = function(m)
    return pandoc.Span({m}, pandoc.Attr("", {}, {
      ["data-ai-feedback-tex"] = m.text,
      ["data-ai-feedback-display"] = m.mathtype == "DisplayMath" and "true" or "false"
    }))
  end })
end
local function isContext(b)
  return b.t == "Div" and (b.classes:includes("ai-feedback-context") or b.classes:includes("ai-context") or b.classes:includes("math-exercise-context"))
end
-- The prose of an exercise's section (its innermost heading or tab, see
-- walk): entries {text, from}, where `from` lists the context blocks the text
-- sits in (their ids, "" for one without). With an explicit context (A5)
-- every context block is left out: the listed ones are sent on their own, the
-- others belong to other exercises. The last 1500 characters are kept, whole
-- entries only.
local function bounded(entries, explicit)
  local texts = {}
  for _, entry in ipairs(entries) do
    if not (explicit and #entry.from > 0) then texts[#texts + 1] = entry.text end
  end
  local kept, length = {}, 0
  for i = #texts, 1, -1 do
    local size = utf8.len(texts[i])
    local sep = #kept > 0 and 1 or 0
    if length + size + sep > 1500 then break end
    table.insert(kept, 1, texts[i]); length = length + size + sep
  end
  return table.concat(kept, "\n")
end
-- Whether a code cell's context is explicit: its first `#| feedback-context:`,
-- else its first `#| context:` line, names blocks (as context() below).
-- Pyodide's execution values (setup, output, interactive) are not feedback
-- context.
local function explicitCell(b)
  local found = {}
  for line in (b.text .. "\n"):gmatch("([^\r\n]*)\r?\n") do
    local key, value = line:match("^#|%s*([%w%-]+)%s*:%s*(.-)%s*$")
    if (key == "feedback-context" or key == "context") and found[key] == nil then found[key] = value end
  end
  local ref = found["feedback-context"] or found["context"]
  if not ref then return false end
  ref = ref:gsub('^"(.*)"$', '%1'):gsub("^'(.*)'$", "%1")
  local pyodide = b.classes:includes("{pyodide-python}") or b.classes:includes("pyodide-python")
  if pyodide and (ref == "setup" or ref == "output" or ref == "interactive") then return false end
  return ref ~= "" and ref ~= "auto" and ref ~= "none"
end
local function activity(block, context)
  counter = counter + 1
  local attrs = block.attributes
  local id = block.identifier ~= "" and block.identifier or "ai-feedback-" .. counter
  local visible, taskBlocks, materials, criteria = pandoc.Blocks({}), pandoc.Blocks({}), {}, nil
  local profile = attrs["profile"] or "review"
  local starter = ""
  for _, child in ipairs(block.content) do
    if child.t == "Div" and child.classes:includes("feedback-source") then
      table.insert(materials, { id = child.identifier ~= "" and child.identifier or id .. "-source", role = "source", language = attrs["source-language"] or "", text = sourceText(child) })
      visible:insert(preserveMath(child))
    elseif child.t == "Div" and child.classes:includes("feedback-criteria") then
      -- Criteria configure the reviewer; they are not instructions to the learner.
      criteria = criteria or {}
      table.insert(criteria, sourceText(pandoc.Div(child.content)))
    elseif child.t == "Div" and child.classes:includes("feedback-starter") then
      starter = sourceText(pandoc.Div(child.content))
    else
      visible:insert(child); taskBlocks:insert(child)
    end
  end
  local taskParts = {}
  for _, child in ipairs(taskBlocks) do table.insert(taskParts, sourceText(child)) end
  local task = table.concat(taskParts, "\n\n")
  if task == "" then task = profile == "translation" and "Translate the supplied source into the response language." or "Give feedback on the learner's response." end
  local contextMode = attrs["context"] == "none" and "none" or (attrs["context"] and attrs["context"] ~= "auto" and "explicit" or "auto")
  local data = {
    id = id, policySelection = policy.selection(block, attrs), profile = profile, task = task, materials = materials, criteria = criteria,
    uiLanguage = attrs["ui-language"] and ctm.locale.language("feedback", attrs["ui-language"]) or uiLanguage,
    responseLanguage = attrs["response-language"] or "",
    feedbackLanguage = attrs["feedback-language"] or feedbackLanguage,
    sourceLanguage = attrs["source-language"] or "", sourceRef = attrs["source"],
    learnerLevel = attrs["learner-level"] or "", starter = starter,
    resetOnVariant = attrs["reset-on-variant"],
    imageUpload = attrs["image-upload"] == "true", imageRole = attrs["image-role"] or "response",
    contextMode = contextMode, contextRefs = attrs["context"] or "",
    context = contextMode ~= "none" and bounded(context, contextMode == "explicit") or "",
    maxIssues = tonumber(attrs["max-issues"])
  }
  visible:insert(pandoc.RawBlock("html", '<script type="application/json" class="ai-feedback-data">' .. json(data) .. '</script>'))
  visible:insert(pandoc.RawBlock("html", '<noscript>Enable JavaScript to use this feedback activity.</noscript>'))
  return pandoc.Div(visible, pandoc.Attr(id, {"ai-feedback-activity"}))
end
-- P22: an activity is assessed by AI feedback only, so ai-feedback:
-- without-ai decides (lua/policy.lua): shown as text it keeps its visible task
-- (and source), with a note, and loses its answer box, button, criteria,
-- starter and data; under drop it is left out. Its policy selection is still
-- checked.
local function task(block)
  policy.selection(block, block.attributes)
  local visible = pandoc.Blocks({})
  for _, child in ipairs(block.content) do
    if not (child.t == "Div" and (child.classes:includes("feedback-criteria") or child.classes:includes("feedback-starter"))) then
      visible:insert(child)
    end
  end
  local decision = policy.withoutAIRecord({kind = "AI feedback activity", name = block.identifier,
    text = sourceText(pandoc.Div(visible)), lang = block.attributes["ui-language"] or ctm.locale.tag("ai-feedback", "ui-language")})
  counter = counter + 1
  if decision.action == "drop" then return nil end
  visible:insert(decision.note)
  return pandoc.Div(visible, pandoc.Attr(block.identifier ~= "" and block.identifier or "ai-feedback-" .. counter, {"ai-feedback-task"}))
end

local function copy(list)
  local result = {}
  for i, value in ipairs(list) do result[i] = value end
  return result
end
local function prose(state, text)
  if text ~= "" then table.insert(state.context, {text = text, from = state.from}) end
end
-- One source-order pass for every integration, before consumers transform
-- cells, along the page's sections (lua/sections.lua). The section of an
-- exercise is its innermost heading or tab: its prose is what precedes the
-- exercise there, without other tabs, closed material it is not in (raw
-- <details>, reveals, collapsed callouts: scopes), code and activities. With
-- state.off (P22) activities become tasks and no context is written.
local hooks = {
  -- Hidden, generated and author-only content does not change section state.
  skip = function(b, tabbed)
    return excluded(b, true) or (tabbed and excluded(pandoc.Div({}, tabbed.attr), true)) or false
  end,
  header = function(b, state) state.context = {{text = sourceText(b), from = {}}} end,
  -- A scope's prose is context only for the exercises inside it.
  open = function(state)
    local outer = state.context
    state.context = copy(outer)
    return outer
  end,
  close = function(state, outer) state.context = outer end,
  -- Each tab is a section, as under a heading; after the tabset the
  -- enclosing section goes on without the tabs' prose.
  tab = function(tab, state)
    local title = tab.title and sourceText(pandoc.Div(quarto.utils.as_blocks(tab.title))) or ""
    state.context = title ~= "" and {{text = title, from = {}}} or {}
  end,
  block = function(b, state, walk)
    if b.t == "Div" and b.classes:includes("ai-feedback") then
      if state.off then return true, task(b) end
      return true, activity(b, state.context)
    elseif b.t == "CodeBlock" then
      if not state.off then b.attributes["data-ai-feedback-context"] = bounded(state.context, explicitCell(b)) end
      return true, b
    elseif isContext(b) then
      if not state.off then b = preserveMath(b) end
      local outer = state.from
      state.from = copy(outer)
      table.insert(state.from, b.identifier)
      b.content = walk(b.content)
      state.from = outer
      return true, b
    end
  end,
  term = function(inlines, state) prose(state, pandoc.utils.stringify(inlines)) end,
  leaf = function(b, state)
    if not state.off then
      b = b:walk({CodeBlock = function(code) code.attributes["data-ai-feedback-context"] = bounded(state.context, explicitCell(code)); return code end})
    end
    prose(state, sourceText(b))
    return b
  end,
}
local function walk(blocks, state)
  return ctm.sections.walk(blocks, hooks, state)
end
-- This callback is a Quarto filter pass, not a Pandoc-only walk.
function M.markCallout(c)
  if c.attr.attributes["data-ai-feedback-marked"] then return c end
  if excluded(pandoc.Div({}, c.attr)) then
    c.content = pandoc.Blocks({pandoc.Div(c.content, pandoc.Attr("", {"ai-feedback-ignore"}))})
    c.title = pandoc.Inlines({pandoc.Span(quarto.utils.as_inlines(c.title or {}), pandoc.Attr("", {"ai-feedback-ignore"}))})
    c.attr.attributes["data-ai-feedback-marked"] = "true"
  end
  return c
end
function M.prepare(doc)
  if not quarto.doc.is_format("html") then return doc end
  if doc.meta["ctm-feedback-prepared"] then return doc end
  doc.meta["ctm-feedback-prepared"] = true
  ctm.settings.load(doc.meta)
  policy.checkOrder("ctm-libs' preparation")
  -- Checked in both builds, so that they fail alike.
  policy.withoutAIChoice()
  if not M.enabled() then
    ctm.settings.policies()
    doc.blocks = walk(doc.blocks, {context = {}, from = {}, off = true})
    -- The walk passes hidden and author-only blocks through untouched; their
    -- activities' criteria and starters must not reach the HTML either.
    doc.blocks = doc.blocks:walk({Div = function(div)
      if div.classes:includes("feedback-criteria") or div.classes:includes("feedback-starter") then return {} end
    end})
    -- Activities that stop the build: the end filter raises the error after
    -- every component; without it (component development builds,
    -- filters: [ctm-libs]) it comes now.
    if not rawget(_G, "__ctmLibsEnd") and policy.withoutAIStop() then M.flush() end
    return doc
  end
  for _, key in ipairs({"mode", "storage", "base-url", "model", "generator-model"}) do
    cfg[key] = ctm.settings.string("ai-feedback", key)
  end
  -- ai-feedback: ui-language / feedback-language, then ctm-assessment: lang, then lang.
  uiLanguage = ctm.locale.resolve("ai-feedback")
  feedbackLanguage = ctm.locale.tag("ai-feedback", "feedback-language")
  policy.emit()
  ctm.layout.use()
  ctm.deps.html({
    name = "ai-feedback",
    scripts = {"feedback/feedback-core.js", "feedback/feedback-dom.js", "feedback/ai-feedback.js"},
    stylesheets = {"feedback/ai-feedback.css"}
  })
  -- storage is emitted only when set, so a consumer's own default (pyodide:
  -- feedback-storage) applies otherwise; the browser falls back to local.
  local browserConfig = {mode = str(cfg.mode, "copy"), storage = cfg.storage and str(cfg.storage, nil) or nil,
    baseUrl = str(cfg["base-url"], ""), model = str(cfg.model, "")}
  if cfg["generator-model"] and cfg["generator-model"] ~= "" then browserConfig.generatorModel = cfg["generator-model"] end
  if ctm.settings.bool("ai-feedback", "similar", {default = false}) then browserConfig.similar = true end
  quarto.doc.include_text("before-body", '<script>window.__aiFeedbackConfig = ' .. json(browserConfig) .. ';</script>')
  doc.blocks = walk(doc.blocks, {context = {}, from = {}})
  return doc
end

-- {exercise, name}: the policy name is checked in both builds; without AI
-- feedback (P22) the name is left out.
function M.selection(block, opts, key)
  requireSettings("selection")
  local selection = policy.selection(block, opts, key)
  if not M.enabled() then selection.name = "" end
  return selection
end
-- {mode, refs, text}: the exercise's learning context (none without AI feedback).
function M.context(block, opts, pyodide)
  requireSettings("context")
  if not M.enabled() then return {mode = "none", refs = "", text = ""} end
  local ref = opts["feedback-context"] or opts["context"] or "auto"
  ref = tostring(ref):gsub('^"(.*)"$', '%1'):gsub("^'(.*)'$", "%1")
  if ref == "" or (pyodide and (ref == "setup" or ref == "output" or ref == "interactive")) then ref = "auto" end
  return {mode = ref == "none" and "none" or (ref == "auto" and "auto" or "explicit"),
    refs = ref, text = block.attributes["data-ai-feedback-context"] or ""}
end
return M
end
