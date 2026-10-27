-- ai-feedback is part of pyodide-interaktiv and of CTM Assessment: this
-- forwarder keeps `filters: [ai-feedback]` and the loaders of older
-- components working. They load this file; it returns the feedback module of
-- the ctm-libs installed next to this folder (the page's one instance).
local here = debug.getinfo(1, "S").source:sub(2):match("^(.*)[/\\]")
local entry = pandoc.path.join({pandoc.path.directory(here), "ctm-libs", "lua", "ctm.lua"})
local f = io.open(entry, "r")
assert(f, "ai-feedback is now part of pyodide-interaktiv and of CTM Assessment, and their library ctm-libs is missing next to "
  .. here .. ". Install pyodide-interaktiv again (quarto add Erasmus-CTM/pyodide-interaktiv@feature/shared-feedback-integration) or CTM Assessment "
  .. "(quarto add https://erasmus-ctm.github.io/ctm-assessment/ctm-assessment.tar.gz).")
f:close()
return dofile(entry).feedback
