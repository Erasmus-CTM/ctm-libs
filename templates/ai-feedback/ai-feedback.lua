-- `filters: [ai-feedback]` (deprecated): the filters of the ctm-libs next to
-- this folder, located by feedback-quarto.lua. pyodide-interaktiv ships this
-- folder (generated from ctm-libs' templates/ai-feedback/), so that
-- `quarto add Erasmus-CTM/pyodide-interaktiv@feature/shared-feedback-integration` replaces the ai-feedback 0.8.1
-- folder of older projects (step-3 design §18.6, E9 (ii)).
local here = debug.getinfo(1, "S").source:sub(2):match("^(.*)[/\\]")
dofile(pandoc.path.join({here, "feedback-quarto.lua"}))
quarto.log.warning("filters: [ai-feedback] is deprecated: AI feedback is part of pyodide-interaktiv and of CTM Assessment; list pyodide-interaktiv or ctm-assessment instead.")
return _G.__ctmLibs.filters()
