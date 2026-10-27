-- The only URL switch for CTM assets. Versions come from assets.json, the
-- runtime's Pyodide constant, and the assessment hook's filled pin values.
return function(ctm)
  local M = {}
  local config, manifest, registered = nil, nil, false
  local INSTALL = "CTM Assessment's installer has no local-asset option yet: local assets are prepared with its offline tooling (docs/offline-install-preparation.md)."
  local function readJSON(path, message)
    local file = io.open(path, "r")
    if not file then ctm.fail(message .. " " .. INSTALL) end
    local text = file:read("*a"); file:close()
    local ok, value = pcall(quarto.json.decode, text)
    if not ok or type(value) ~= "table" then ctm.fail(message .. " " .. INSTALL) end
    return value
  end
  local function root()
    return quarto.project.directory or pandoc.path.directory(quarto.doc.input_file)
  end
  local function offset()
    return (quarto.project and quarto.project.offset ~= nil and quarto.project.offset ~= "") and quarto.project.offset or "."
  end
  function M.mode()
    return ctm.settings.choice("ctm-assessment", "assets", {"cdn", "local"}, {default = "cdn"})
  end
  local function packageBase(url)
    local git, revision = url:match("^(https://cdn%.jsdelivr%.net/gh/[%w_.-]+/[%w_.-]+@([a-f0-9]+)/)")
    if git and #revision == 40 then return git end
    return url:match("^(https://cdn%.jsdelivr%.net/npm/[^@/]+@[^/]+/)")
      or url:match("^(https://cdn%.jsdelivr%.net/npm/@[^/]+/[^@/]+@[^/]+/)")
  end
  local function setup()
    if config then return config end
    local mode = M.mode()
    local table = readJSON(ctm.path("assets.json"), "ctm-libs: assets.json is missing or invalid.")
    if table.v ~= 1 or type(table.assets) ~= "table" then ctm.fail("ctm-libs: unsupported assets.json schema.") end
    config = {v = 1, mode = mode, bases = {}}
    local expected = {}
    local function add(name, version, cdn, localPath)
      expected[name] = version
      config.bases[name] = mode == "local" and (offset() .. "/_ctm-assets/" .. localPath) or cdn
    end
    for name, entry in pairs(table.assets) do
      add(name, entry.version, entry.cdn:gsub("{version}", entry.version), entry["local"]:gsub("{version}", entry.version))
    end
    local pyodide = ctm.runtime.defaultIndexURL()
    local pyVersion = pyodide:match("/v([^/]+)/full/$")
    if not pyVersion then ctm.fail("ctm-libs: cannot read the Pyodide version from its runtime constant.") end
    add("pyodide", pyVersion, pyodide, "pyodide/" .. pyVersion .. "/")
    -- The hook overwrites this private mapping; author-set URLs never acquire
    -- default provenance. Use pins as the source, without another version table.
    local meta = ctm.settings.meta() or {}
    local defaults = meta["_ctm-assessment-pin-defaults"] or {}
    local pins = {}
    local assessment = ctm.deps.folder("ctm-assessment")
    local pinFile = assessment and io.open(pandoc.path.join({assessment, "jsxgraph-pins.yml"}), "r")
    if pinFile then
      local yaml = pinFile:read("*a"); pinFile:close()
      pins = pandoc.read("---\n" .. yaml .. "\n---\n", "markdown").meta.jsxgraph or {}
    end
    local names = {src_jxg = "jsxgraph", src_css = "jsxgraph", src_mjx = "mathjax4", mjx_fonts = "mathjax-newcm-font"}
    for key, value in pairs(pins) do
      local url = pandoc.utils.stringify(value)
      local base = packageBase(url)
      local name = names[key]
      if name and base then
        local localPath = base:gsub("^https://cdn%.jsdelivr%.net/", "")
        local version = base:match("@([^/]+)/$")
        add(name, version, base, localPath)
        if mode == "local" and defaults[key] ~= nil and meta.jsxgraph
          and pandoc.utils.stringify(defaults[key]) == url and pandoc.utils.stringify(meta.jsxgraph[key]) == url then
          meta.jsxgraph[key] = pandoc.MetaString(offset() .. "/_ctm-assets/" .. url:gsub("^https://cdn%.jsdelivr%.net/", ""))
        end
      end
    end
    if mode == "local" then
      manifest = readJSON(pandoc.path.join({root(), "_ctm-assets", "manifest.json"}), "ctm-assessment: the local asset manifest is missing or invalid.")
      if manifest.v ~= 1 or type(manifest.versions) ~= "table" or type(manifest.files) ~= "table" then
        ctm.fail("ctm-assessment: unsupported local asset manifest. " .. INSTALL)
      end
      for name, version in pairs(expected) do
        if manifest.versions[name] ~= version then
          ctm.fail("ctm-assessment: local asset version mismatch for " .. name .. ". " .. INSTALL)
        end
      end
      local packages = ctm.settings.list("pyodide", "packages")
      if #packages > 0 then
        local lock = readJSON(pandoc.path.join({root(), "_ctm-assets", "pyodide", pyVersion, "pyodide-lock.json"}),
          "ctm-assessment: the local Pyodide subset lock is missing or invalid.")
        local available = {}
        for name in pairs(lock.packages or {}) do available[name:lower():gsub("[-_.]+", "-")] = true end
        for _, name in ipairs(packages) do
          if not available[name:lower():gsub("[-_.]+", "-")] then
            ctm.fail("ctm-assessment: pyodide.packages names a package outside the local subset: " .. name .. ". " .. INSTALL)
          end
        end
      end
      if ctm.settings.bool("ai-feedback", "enabled", {default = true}) then
        quarto.log.warning("ctm-assessment: AI feedback needs an internet connection even when assets are local.")
      end
    end
    return config
  end
  function M.url(name, path)
    local base = setup().bases[name]
    if not base then ctm.fail("ctm-libs: unknown asset " .. tostring(name)) end
    path = path or ""
    if type(path) ~= "string" then ctm.fail("ctm-libs: asset paths must be strings.") end
    if path:match("[%z\1-\31\127]") then
      ctm.fail("ctm-libs: asset paths must not contain ASCII controls.")
    end
    local encoded = path:lower()
    if encoded:find("%%2e") or encoded:find("%%2f") or encoded:find("%%5c") then
      ctm.fail("ctm-libs: asset paths must stay inside the selected asset.")
    end
    if path:match("^[%a][%w+.-]*:") or path:match("^[/\\]") or path:match("[?#\\]") then
      ctm.fail("ctm-libs: asset paths must stay inside the selected asset.")
    end
    for part in path:gmatch("[^/]+") do
      if part == ".." then ctm.fail("ctm-libs: asset paths must stay inside the selected asset.") end
    end
    return base .. path
  end
  function M.use()
    if not quarto.doc.is_format("html") then return end
    local current = setup()
    if registered then return end
    registered = true
    local json = quarto.json.encode(current):gsub("<", "\\u003c")
    quarto.doc.include_text("in-header", "<script>globalThis.CTM_ASSETS=" .. json .. ";</script>")
    ctm.deps.html({name = "ctm-assets", scripts = {"assets.js"}})
  end
  -- JSXGraph boards are data: frames: inside one, the board's local MathJax
  -- path has no base and never loads. Until the boards can load local files
  -- (consolidation step 5b), a local build of a page with boards stops instead
  -- of publishing boards without their math.
  function M.check(doc)
    if not quarto.doc.is_format("html") or M.mode() ~= "local" then return end
    if ctm.deps.uses(doc).jsxgraph then
      ctm.fail("ctm-assessment: local assets do not support JSXGraph boards yet (`.jsxgraph` blocks): "
        .. "a board cannot load the local MathJax. Build this page with CDN assets, or remove its boards.")
    end
  end
  function M.prepare(meta)
    if not quarto.doc.is_format("html") then return meta end
    M.use()
    local method = PANDOC_WRITER_OPTIONS.html_math_method
    method = type(method) == "table" and method.method or method
    -- Quarto already supplies the actual MathJax loader through math metadata.
    -- Its legacy template flag only adds an ES6 polyfill without CORS support.
    if tostring(method):lower() == "mathjax" then meta.mathjax = false end
    if M.mode() == "local" and tostring(method):lower() == "mathjax" then
      meta.math = pandoc.MetaBlocks({pandoc.RawBlock("html", '<script src="' .. M.url("mathjax3", "es5/tex-chtml-full.js")
        .. '" id="MathJax-script" async type="text/javascript"></script>')})
    end
    return meta
  end
  return M
end
