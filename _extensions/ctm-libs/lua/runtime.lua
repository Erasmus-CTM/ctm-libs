-- The page-wide Python runtime (runtime/pyodide-runtime.js, global
-- MathExerciseRuntime): one cacheable file, loaded once whatever the mix of
-- components on the page (Quarto keeps one dependency per name). The Python
-- worker (runtime/pyodide-worker.js, global CTMWorker) for components that run
-- Python in a Web Worker (pyodide-interaktiv).
return function(ctm)
  local M = {}

  -- Registers the ctm-runtime dependency (a classic script in the head).
  function M.use()
    ctm.locale.use("common")
    ctm.assets.use()
    ctm.deps.html({name = "ctm-runtime", scripts = {"runtime/pyodide-runtime.js"}})
    ctm.deps.html({name = "ctm-worker", scripts = {"runtime/pyodide-worker.js"},
      resources = {ctm.path("runtime", "pyodide-worker-core.js")}})
  end

  -- Seconds after which a running check offers Stop (worker runtimes only):
  -- `<component>: stop-after:` for one component, `ctm-assessment: stop-after:`
  -- for all components; default 20.
  function M.stopAfter(component)
    return (ctm.settings.number(component, "stop-after", {shared = true, default = 20, positive = true, unit = "seconds"}))
  end

  -- Pyodide's base URL: the one constant in runtime/pyodide-runtime.js, which
  -- the browser uses too (E12: ctm-libs owns the Pyodide version).
  local index = nil
  function M.defaultIndexURL()
    if index then return index end
    local file = io.open(ctm.path("runtime", "pyodide-runtime.js"), "r")
    local text = file and file:read("*a") or ""
    if file then file:close() end
    index = text:match("\n%s*var indexURL = '([^']+)';")
    assert(index, "ctm-libs: runtime/pyodide-runtime.js has no `var indexURL = '...';` line")
    return index
  end

  function M.indexURL()
    return ctm.assets.url("pyodide")
  end

  -- Registers the worker (ctm-runtime, then ctm-worker, classic scripts in
  -- the head) and coi-serviceworker.js, once per page: the file goes to the
  -- project's output directory (next to the page for a single file), and the
  -- page loads it relative to the project root (quarto.project.offset), at
  -- every nesting depth. It makes pages cross-origin isolated on hosts
  -- without COOP/COEP headers (GitHub Pages), which input() and a graceful
  -- Stop need. Under embed-resources the script is inlined and cannot
  -- register itself; Python works without it (Stop restarts the worker).
  local registered = false
  function M.worker()
    if not quarto.doc.is_format("html") then return end
    M.use()
    if registered then return end
    registered = true
    local source = io.open(ctm.path("runtime", "coi-serviceworker.js"), "r")
    assert(source, "ctm-libs: runtime/coi-serviceworker.js is missing; install ctm-libs again")
    local content = source:read("*a")
    source:close()
    local target = "coi-serviceworker.js"
    if quarto.project and quarto.project.output_directory then
      target = quarto.project.output_directory .. "/coi-serviceworker.js"
    end
    local out = io.open(target, "w")
    if out then
      out:write(content)
      out:close()
    end
    local offset = "."
    if quarto.project and quarto.project.offset ~= nil and quarto.project.offset ~= "" then
      offset = quarto.project.offset
    end
    quarto.doc.include_text("in-header", '<script src="' .. offset .. '/coi-serviceworker.js"></script>')
  end

  -- Standalone consumers require this P13 capability rather than silently
  -- accepting a library whose runtime still evaluates Python on the page.
  function M.page()
    M.worker()
  end

  return M
end
