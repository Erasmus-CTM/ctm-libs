-- ctm-libs: the internal library of CTM Assessment. This file returns the
-- page's instance; every filter of the page (ctm-libs.lua, the components'
-- ctm-bootstrap.lua, the standalone forwarder) gets the same one, because
-- filters share Lua globals. Modules (settings, locale, deps, runtime,
-- feedback, policy, sections, source, ui, assets) load on first use: ctm.<module>.
--
-- Rules for the modules: paths only from this installation (ctm.path), never
-- quarto.utils.resolve_path or relative dependency paths (both resolve against
-- the running filter, i.e. a component); HTML only (neutral values for other
-- formats); authoring errors stop the render through ctm.fail(message).
local dir = debug.getinfo(1, "S").source:sub(2):match("^(.*)[/\\]lua[/\\][^/\\]+$")

-- Stops the render with a message for authors, without a Lua file and line
-- in front of it. (In Quarto's filters, `error` only logs; assert on a string
-- would name ctm-libs' own source line.)
local function fail(message)
  assert(false, setmetatable({}, {__tostring = function() return tostring(message) end}))
end

local function manifestVersion(folder)
  local file = io.open(pandoc.path.join({folder, "_extension.yml"}), "r")
  local found = file and file:read("*a"):match("\nversion:%s*['\"]?([%w%.%-]+)") or "unknown"
  if file then file:close() end
  return found
end

local cached = rawget(_G, "__ctmLibs")
if cached then
  if pandoc.path.normalize(cached.dir) ~= pandoc.path.normalize(dir) and cached.version ~= manifestVersion(dir) then
    fail("This page combines two CTM installations: " .. cached.dir .. " (" .. cached.version .. ") and "
      .. dir .. " (" .. manifestVersion(dir) .. "). List only ctm-assessment in filters, or remove the separately added copy.")
  end
  return cached
end

-- api: the interface level components require (ctm-bootstrap.lua checks it,
-- against its API or the component's opts.api). 2: the Python worker
-- (CTMWorker, ctm.runtime.worker, ctm.runtime.indexURL), the pyodide settings
-- section and settings.bool's digits option, the pyodide-interaktiv catalogue.
-- 3: saved-answer registration, manifest, progress and shared copy.
local ctm = {dir = dir, version = manifestVersion(dir), api = 3}
ctm.fail = fail

-- Absolute path of a file of this installation.
function ctm.path(...)
  return pandoc.path.join({dir, ...})
end

setmetatable(ctm, {__index = function(self, name)
  if type(name) ~= "string" or not name:match("^%a+$") then return nil end
  local path = pandoc.path.join({dir, "lua", name .. ".lua"})
  local file = io.open(path, "r")
  if not file then return nil end
  file:close()
  local module = dofile(path)(self)
  rawset(self, name, module)
  return module
end})

-- The passes of the ctm-libs filter (ctm-libs.lua and the standalone forwarder):
-- settings, callouts, the page's interface (reveals, the switch, embeds, tab
-- links: lua/ui.lua), then AI feedback's preparation, which sees reveals as
-- the <details> scopes they become.
function ctm.filters()
  local filters = {
    {Meta = function(meta) ctm.settings.load(meta); return ctm.assets.prepare(meta) end},
    {Callout = function(c) return ctm.feedback.markCallout(c) end},
  }
  for _, pass in ipairs(ctm.ui.passes()) do filters[#filters + 1] = pass end
  filters[#filters + 1] = {Pandoc = function(doc) ctm.assets.check(doc); return ctm.feedback.prepare(doc) end}
  return filters
end

_G.__ctmLibs = ctm
return ctm
