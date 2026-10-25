-- Shared layout dependency and an actual end-of-content marker. Components
-- register the dependency; the existing finalization path owns marker order.
return function(ctm)
  local M, registered = {}, false
  local marker = '<!--ctm-layout-generated--><span id="ctm-layout-ready" hidden></span>'
  function M.use()
    if not quarto.doc.is_format("html:js") or registered then return end
    registered = true
    ctm.locale.use("ui")
    ctm.deps.html({name = "ctm-layout", scripts = {"ui/ctm-layout.js", "ui/ctm-settings.js"}, stylesheets = {"ui/ctm-ui.css"}})
  end
  function M.finalize(doc)
    if not registered then return doc end
    -- The umbrella end filter runs after every component. Standalone
    -- components can re-finalize; replace the old marker at the new end.
    if rawget(_G, "__ctmLibsEnd") and not rawget(_G, "__ctmLibsEndRan") then return doc end
    local blocks = pandoc.Blocks({})
    for _, block in ipairs(doc.blocks) do
      if not (block.t == "RawBlock" and block.text == marker) then blocks:insert(block) end
    end
    blocks:insert(pandoc.RawBlock("html", marker))
    doc.blocks = blocks
    return doc
  end
  return M
end
