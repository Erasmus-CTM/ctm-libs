-- ctm-checkers, the Python checker library of CTM Assessment (step-2 design
-- §3.5): a folder of its own, _extensions/[owner/]ctm-checkers, holding
-- checkers.json, the wheel and the page script ctm-checkers.js; the package
-- installs it next to ctm-libs. Components that grade with it use it through
-- this module. An older ctm-libs has no ctm.checkers (feature detection), so a
-- component that needs it stops with the update command there.
return function(ctm)
  local M = {}

  local NAME = "ctm-checkers"
  local INSTALL = "quarto add https://erasmus-ctm.github.io/ctm-assessment/ctm-assessment.tar.gz"

  local manifests = {}

  -- The folder of the installation used: the one next to ctm-libs (the
  -- package) first, else the project's _extensions/[owner/]ctm-checkers; nil
  -- when ctm-checkers is not installed.
  function M.folder()
    return ctm.deps.folder(NAME)
  end

  local function read(folder)
    if not manifests[folder] then
      local path = pandoc.path.join({folder, "checkers.json"})
      local file = io.open(path, "r")
      local text = file and file:read("*a")
      if file then file:close() end
      local ok, manifest = pcall(quarto.json.decode, text or "")
      if not ok or type(manifest) ~= "table" or type(manifest.wheel) ~= "string" or type(manifest.script) ~= "string"
          or manifest.api == nil or manifest.version == nil then
        ctm.fail("ctm-checkers in " .. folder .. " has no valid checkers.json. Install CTM Assessment again: " .. INSTALL)
      end
      manifests[folder] = manifest
    end
    return manifests[folder]
  end

  -- The folder and manifest of the installation; stops the render when
  -- ctm-checkers is not installed (naming the component that needs it).
  local function installation(component)
    local folder = M.folder()
    if not folder then
      ctm.fail((component or "This page") .. " needs ctm-checkers, the checker library of CTM Assessment, which is not"
        .. " installed in this project. Install CTM Assessment: " .. INSTALL)
    end
    return folder, read(folder)
  end

  -- An API level as {major, minor}: 1, "1" or "1.2".
  local function level(value)
    local major, minor = tostring(value):match("^(%d+)%.?(%d*)$")
    if not major then return nil end
    return {tonumber(major), tonumber(minor ~= "" and minor or "0")}
  end

  -- Stops the render unless ctm-checkers is installed with the API level
  -- `api` (same major level, minor level at least the required one); returns
  -- its manifest.
  function M.require(component, api)
    component = component and tostring(component) or "This page"
    local folder, manifest = installation(component)
    local need, have = level(api), level(manifest.api)
    if not need then ctm.fail(component .. ": ctm.checkers.require needs an API level such as 1, not " .. tostring(api)) end
    if not have or have[1] ~= need[1] or have[2] < need[2] then
      ctm.fail(component .. " needs ctm-checkers API " .. tostring(api) .. "; " .. folder .. " has ctm-checkers "
        .. tostring(manifest.version) .. " (API " .. tostring(manifest.api) .. "). Update CTM Assessment: " .. INSTALL)
    end
    return manifest
  end

  -- checkers.json of the installation: name, version, api, dependency, wheel,
  -- sha256, script, and from ctm-checkers 0.2 `parts` (the STACK engine's
  -- wheel and page script: parts.stack).
  function M.manifest()
    local _, manifest = installation()
    return manifest
  end

  -- The entry of `part` in the manifest (`nil`: ctm-checkers itself); stops
  -- the render when this ctm-checkers has no such part (older than 0.2).
  local function entry(manifest, folder, part)
    if part == nil then return manifest end
    local found = type(manifest.parts) == "table" and manifest.parts[part] or nil
    if type(found) ~= "table" or type(found.wheel) ~= "string" or type(found.script) ~= "string" then
      ctm.fail("ctm-checkers " .. tostring(manifest.version) .. " in " .. folder .. " has no " .. tostring(part)
        .. " part (it comes with ctm-checkers 0.2). Update CTM Assessment: " .. INSTALL)
    end
    return found
  end

  -- The absolute path of the wheel (Python imports from it: zipimport): of
  -- ctm-checkers, or of its `part` ("stack": the STACK engine's own wheel).
  function M.wheel(part)
    local folder, manifest = installation()
    local wheel = pandoc.path.join({folder, entry(manifest, folder, part).wheel})
    local file = io.open(wheel, "rb")
    if not file then ctm.fail("ctm-checkers' wheel " .. wheel .. " is missing. Install CTM Assessment again: " .. INSTALL) end
    file:close()
    return wheel
  end

  -- `env` (default: this process's environment) with the wheel first on
  -- PYTHONPATH (";" between entries on Windows) and CTM_CHECKERS_WHEEL, for
  -- pandoc.system.with_environment around a build-time Python run. With
  -- `part` ("stack"), that part's wheel follows the first on PYTHONPATH
  -- (ctm_checkers joins them: python -m ctm_checkers.stack.cli works).
  function M.environment(env, part)
    local result = {}
    for key, value in pairs(env or pandoc.system.environment()) do result[key] = value end
    local wheel = M.wheel()
    local separator = pandoc.system.os == "mingw32" and ";" or ":"
    local wheels = part and (wheel .. separator .. M.wheel(part)) or wheel
    local path = result.PYTHONPATH
    result.PYTHONPATH = (path and path ~= "") and (wheels .. separator .. path) or wheels
    result.CTM_CHECKERS_WHEEL = wheel
    return result
  end

  -- Registers the page script as the HTML dependency "ctm-checkers" (a
  -- classic script in the head; Quarto keeps one dependency per name). Its
  -- version is checkers.json's `dependency`: a release's version, or for a
  -- development version X.Y.Z.devN+<sha8 of the wheel>, so the path
  -- site_libs/quarto-contrib/ctm-checkers-<dependency>/ changes with the wheel.
  -- The page's runtime installs it into Pyodide (MathExerciseRuntime.ensureCheckers).
  -- With `part` ("stack"), that part's page script follows as the HTML
  -- dependency "ctm-checkers-<part>" (version: its `dependency`); a page with
  -- math-exercise alone never carries it (ctm-checkers 0.2: the STACK engine
  -- has its own wheel and script).
  -- A local build stops at part "stack" (ctm.assets.requireOnline), whatever
  -- the order of the page's filters.
  function M.use(part)
    if part == "stack" then ctm.assets.requireOnline("stack") end
    local folder, manifest = installation()
    ctm.deps.html({name = NAME, version = tostring(manifest.dependency or manifest.version),
      scripts = {pandoc.path.join({folder, manifest.script})}})
    if part ~= nil then
      local found = entry(manifest, folder, part)
      ctm.deps.html({name = NAME .. "-" .. tostring(part), version = tostring(found.dependency or manifest.version),
        scripts = {pandoc.path.join({folder, found.script})}})
    end
  end

  return M
end
