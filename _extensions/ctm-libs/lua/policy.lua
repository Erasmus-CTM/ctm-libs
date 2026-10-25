-- Teaching policies: the page's policy files and selections, read and
-- validated by the settings reader (ctm.settings.policies()), emitted for the
-- browser as window.__aiFeedbackPolicies, and an exercise's own selection.
return function(ctm)
  local M = {}
  local fail = ctm.fail

  -- window.__aiFeedbackPolicies for the browser (once per page, by feedback.prepare).
  function M.emit()
    local encoded = ctm.settings.policies().json:gsub('<', '\\u003c'):gsub('>', '\\u003e'):gsub('&', '\\u0026')
    quarto.doc.include_text('before-body', '<script>window.__aiFeedbackPolicies = ' .. encoded .. ';</script>')
  end

  -- {exercise = label or id, name = selected policy}; the name must be defined.
  function M.selection(block, opts, key)
    key = key or "feedback-policy"
    local name = opts[key] or block.attributes[key] or ''
    if type(name) ~= 'string' then fail('ai-feedback: feedback-policy must name an existing YAML policy') end
    name = name:gsub('^"(.*)"$', '%1'):gsub("^'(.*)'$", '%1')
    if name ~= '' and not ctm.settings.policies().names[name] then fail('ai-feedback: unknown feedback-policy ' .. name) end
    local id = opts.label
    if id == nil or id == '' then id = block.identifier or '' end
    id = tostring(id):gsub('^"(.*)"$', '%1'):gsub("^'(.*)'$", '%1')
    return {exercise = id, name = name}
  end

  -- Exercises that only AI feedback can assess (no static check), in a build
  -- without AI feedback (P22). ai-feedback: without-ai decides, read key by
  -- key like every setting (project, profile, _metadata.yml, page; the
  -- nearest wins):
  --   unset       the build stops: one error names every such exercise of the page
  --   text        the question stays, without answer box and Check button, with a note
  --   self-check  the question with a model answer to compare with; no exercise
  --               has one yet, so for now (and later for an exercise without
  --               one) it is text
  --   drop        the exercise is left out (only where the author writes it)
  local WITHOUT_AI = {'text', 'self-check', 'drop'}
  -- The choice (nil when unset) and where it is set; another value stops the render.
  function M.withoutAIChoice()
    return ctm.settings.choice('ai-feedback', 'without-ai', WITHOUT_AI)
  end

  -- The page's such exercises ({name, kind}), in the order they were met.
  local exercises, reported = {}, false

  -- The last filter of the package (ctm-libs-end.lua) reports them; it
  -- announces itself when Quarto loads it (_G.__ctmLibsEnd) and when it runs
  -- (_G.__ctmLibsEndRan). Anything that would add to its report after it ran
  -- is in the wrong order: that stops a build without AI feedback, whose
  -- report would be lost, and is a build warning with AI feedback, where the
  -- end filter has nothing to report (such builds stay as they were).
  local orderWarned = false
  function M.checkOrder(what)
    if not rawget(_G, '__ctmLibsEndRan') then return end
    local message = 'ctm-libs-end.lua ran before ' .. what .. ' on this page. List it last, after every CTM filter, '
      .. 'as the package does (filters: [ctm-assessment] runs ctm-libs, jsxgraph, math-exercise, py-exercise, '
      .. 'pyodide-interaktiv, then ctm-libs-end.lua).'
    if not ctm.feedback.enabled() then fail(message) end
    if not orderWarned then
      orderWarned = true
      quarto.log.warning(message)
    end
  end

  -- An unnamed exercise in messages: the start of its text, cut at a word.
  local function snippet(text)
    local plain = tostring(text or ''):gsub('%s+', ' '):match('^%s*(.-)%s*$')
    if (utf8.len(plain) or 0) > 40 then
      plain = plain:sub(1, utf8.offset(plain, 41) - 1)
      plain = (plain:match('^(.+)%s%S*$') or plain) .. '…'
    end
    return '"' .. plain .. '"'
  end

  -- The note under an exercise shown as text: English, German or Bokmål (the
  -- first of the chain of `tag` that the catalogue has), marked with its
  -- language where the page's differs.
  local function note(tag)
    local lang = ctm.locale.language('common', tag)
    local meta = ctm.settings.meta and ctm.settings.meta()
    local page = meta and meta.lang ~= nil and pandoc.utils.stringify(meta.lang) or 'en'
    local attributes = ctm.locale.normalize(page) ~= lang and {lang = lang} or {}
    return pandoc.Div({pandoc.Para({pandoc.Emph(ctm.locale.text('common', 'withoutAI', lang))})},
      pandoc.Attr('', {'ctm-without-ai'}, attributes))
  end

  -- Records one such exercise and decides (ctm-libs' own activities, without
  -- the early stop of withoutAI below): nil when AI feedback is on, drop, or
  -- else text. Under self-check an exercise is text until it has a model
  -- answer to compare with; none has one yet.
  function M.withoutAIRecord(exercise)
    M.checkOrder(exercise.component or "ctm-libs' preparation")
    if ctm.feedback.enabled() then return nil end
    local name = exercise.name ~= nil and tostring(exercise.name) ~= '' and tostring(exercise.name) or snippet(exercise.text)
    table.insert(exercises, {name = name, kind = exercise.kind or 'exercise'})
    if M.withoutAIChoice() == 'drop' then return {action = 'drop'} end
    return {action = 'text', note = note(exercise.lang)}
  end

  -- For a component: one of its exercises that has no static check, as the
  -- component decides with its own parser.
  --   ctm.policy.withoutAI({component = 'math-exercise',
  --     kind = 'math-exercise in custom mode without a checker',
  --     name = label (nil: the start of text names it), text = question,
  --     lang = the component's interface language})
  -- nil: AI feedback is on; render the exercise as usual. Else {action =
  -- 'text', note = Div}: show the question without answer box and Check
  -- button, followed by the note; or {action = 'drop'}: leave the exercise
  -- out. ctm-libs names it in the page's build message, or in the error that
  -- stops the build when without-ai is unset (the action is then text). A
  -- component checks that the function exists (older ctm-libs have none).
  function M.withoutAI(exercise)
    local decision = M.withoutAIRecord(exercise)
    if decision and M.withoutAIChoice() == nil and not rawget(_G, '__ctmLibsEnd') then
      -- No end filter on this page (component development builds,
      -- filters: [ai-feedback]): stop now, with the exercises known so far.
      fail(M.withoutAIStop())
    end
    return decision
  end

  -- The error that stops the build (without-ai unset), or nil.
  function M.withoutAIStop()
    if #exercises == 0 or M.withoutAIChoice() ~= nil then return nil end
    local list = {}
    for _, exercise in ipairs(exercises) do list[#list + 1] = exercise.name .. ' (' .. exercise.kind .. ')' end
    local _, reason = ctm.feedback.enabled()
    return 'AI feedback is off for this build (' .. tostring(reason) .. '), and ' .. ctm.source.pageName() .. ' has '
      .. (#list == 1 and 'an exercise' or (#list .. ' exercises')) .. ' that only AI feedback can assess: '
      .. table.concat(list, '; ') .. '.\n'
      .. 'Other pages may have such exercises too: the render stops at the first page that has one. '
      .. 'One setting in _quarto.yml decides for every page (or put it in the profile that turns AI feedback '
      .. "off; a page's front matter decides for that page alone):\n\n"
      .. 'ai-feedback:\n  without-ai: text\n\n'
      .. 'text shows each question without answer box and Check button; self-check is the same as text for '
      .. 'now (self-check comes in a later version); drop removes the exercises from their pages (a last resort).'
  end

  -- The page's build message about them (once), or nil.
  function M.withoutAIMessage()
    if reported or #exercises == 0 then return nil end
    local choice, origin = M.withoutAIChoice()
    if choice == nil then return nil end
    reported = true
    local list = {}
    for _, exercise in ipairs(exercises) do list[#list + 1] = exercise.name end
    local setting = 'without-ai: ' .. choice .. (origin and (' in ' .. origin) or '')
    if choice == 'drop' then
      return 'removed from this page (' .. setting .. '): ' .. table.concat(list, '; ')
        .. '. Links and cross-references to them no longer resolve'
    end
    if choice == 'self-check' then setting = setting .. '; self-check comes in a later version' end
    return 'shown as text, without automatic feedback (' .. setting .. '): ' .. table.concat(list, '; ')
  end

  return M
end
