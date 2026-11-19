-- Optional extensions a page can use (JSXGraph), and HTML dependencies with
-- files of this installation. From the components' former feedback-loader.lua;
-- ai-feedback needs no locating any more: it is part of ctm-libs.
return function(ctm)
  local M = {}

  M.INSTALL = {jsxgraph = "quarto add jsxgraph/jsxgraph-quarto"}

  local function exists(path)
    local file = path and io.open(path, "r")
    if file then file:close(); return true end
    return false
  end

  -- Every installation of `name` in the project: _extensions/<name>/ and
  -- _extensions/<owner>/<name>/ (nearest _extensions folder for single files).
  local function installations(name)
    local found = {}
    local base = quarto.project.directory or pandoc.path.directory(quarto.doc.input_file)
    while base and base ~= "" do
      local extensions = pandoc.path.join({base, "_extensions"})
      local candidates = {pandoc.path.join({extensions, name, "_extension.yml"})}
      local ok, entries = pcall(pandoc.system.list_directory, extensions)
      if ok then
        for _, owner in ipairs(entries) do
          table.insert(candidates, pandoc.path.join({extensions, owner, name, "_extension.yml"}))
        end
      end
      for _, path in ipairs(candidates) do
        if exists(path) then table.insert(found, path) end
      end
      if #found > 0 or quarto.project.directory then break end
      local parent = pandoc.path.directory(base)
      if parent == base then break end
      base = parent
    end
    return found
  end

  -- The installation next to ctm-libs (the CTM Assessment package, or one owner folder).
  local function sibling(name)
    local path = pandoc.path.join({pandoc.path.directory(ctm.dir), name, "_extension.yml"})
    return exists(path) and path or nil
  end

  -- True when `name` is installed for this project (nothing is loaded).
  function M.installed(name)
    return sibling(name) ~= nil or #installations(name) > 0
  end

  -- The folder of `name`: the installation next to ctm-libs first (the
  -- package), else the project's _extensions/[owner/]<name>; nil when it is
  -- not installed.
  function M.folder(name)
    local manifest = sibling(name) or installations(name)[1]
    return manifest and pandoc.path.directory(manifest) or nil
  end

  -- What the page's source uses: `.ai-feedback` activities, `.jsxgraph`
  -- blocks and STACK questions (`.stack-question` blocks, ctm-stack).
  function M.uses(doc)
    local used = {}
    doc.blocks:walk({
      Div = function(div) if div.classes:includes("ai-feedback") then used["ai-feedback"] = true end end,
      CodeBlock = function(block)
        if block.classes:includes("jsxgraph") then used.jsxgraph = true end
        if block.classes:includes("stack-question") then used.stack = true end
      end,
    })
    return used
  end

  -- Stops the render when the page uses JSXGraph without the extension:
  -- the boards would be published as plain code.
  function M.requireUsed(doc, component)
    if M.uses(doc).jsxgraph and not M.installed("jsxgraph") then
      ctm.fail(component .. ": this page uses JSXGraph boards (`.jsxgraph` blocks), but the jsxgraph"
        .. " extension is not installed. Run: " .. M.INSTALL.jsxgraph)
    end
  end

  -- quarto.doc.add_html_dependency for files of this installation: `scripts`
  -- and `stylesheets` are paths relative to ctm-libs (strings, or tables with
  -- `path` and the usual options), or absolute paths of a file of another
  -- installation (ctm-checkers' page script); version defaults to ctm-libs'
  -- version.
  local function located(file)
    return pandoc.path.is_absolute(file) and file or ctm.path(file)
  end
  function M.html(spec)
    if not quarto.doc.is_format("html") then return end
    local dependency = {}
    for key, value in pairs(spec) do dependency[key] = value end
    dependency.version = spec.version or ctm.version
    for _, kind in ipairs({"scripts", "stylesheets"}) do
      if spec[kind] then
        local files = {}
        for _, file in ipairs(spec[kind]) do
          if type(file) == "table" then
            local copy = {}
            for key, value in pairs(file) do copy[key] = value end
            copy.path = located(file.path)
            table.insert(files, copy)
          else
            table.insert(files, located(file))
          end
        end
        dependency[kind] = files
      end
    end
    quarto.doc.add_html_dependency(dependency)
  end

  return M
end
