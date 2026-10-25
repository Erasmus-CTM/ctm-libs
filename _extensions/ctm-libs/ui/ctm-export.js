/* Browser-only page export. Text and copy remain primary when downloads are blocked. */
(function () {
  'use strict';
  if (window.CTMExport) return;
  function escape(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function image(value) { return /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\s]+$/.test(value || ''); }
  function fence(value,language) {
    value=String(value == null ? '' : value);
    var tick=String.fromCharCode(96), runs=value.match(new RegExp(tick+'+','g')) || [], size=3;
    runs.forEach(function(run){size=Math.max(size,run.length+1);});
    return tick.repeat(size)+(language || '')+'\n'+value+'\n'+tick.repeat(size);
  }
  function serialize(items,info) {
    var markdown=['# '+info.course,'## '+info.title,info.at], html=[
      '<!doctype html><html><head><meta charset="utf-8"><title>'+escape(info.title)+'</title>',
      '<style>body{font:1rem system-ui;max-width:70rem;margin:2rem auto;padding:0 1rem}pre{white-space:pre-wrap;overflow-wrap:anywhere}img{max-width:100%}</style></head><body>',
      '<h1>'+escape(info.course)+'</h1><h2>'+escape(info.title)+'</h2><p>'+escape(info.at)+'</p>'
    ], plots=0;
    items.forEach(function(item,index) {
      var title=item.title || String(index+1);
      markdown.push('### '+title); html.push('<section><h3>'+escape(title)+'</h3>');
      (item.parts || []).forEach(function(part) {
        if(part.label) {markdown.push(String(part.label));html.push('<p>'+escape(part.label)+'</p>');}
        if(part.kind==='image') {
          if(!image(part.dataURL))return;
          var filename='plot-'+(++plots)+'.png';
          markdown.push('!['+String(part.label || filename).replace(/[\[\]]/g,'')+']('+filename+')');
          html.push('<img alt="'+escape(part.label || filename)+'" src="'+escape(part.dataURL)+'">');
        } else if(part.kind==='code' || part.kind==='output' || part.kind==='answer') {
          markdown.push(fence(part.text,part.kind==='code'?'python':'text'));
          html.push('<pre><code>'+escape(part.text)+'</code></pre>');
        }
      });
      html.push('</section>');
    });
    html.push('</body></html>');
    return {markdown:markdown.join('\n\n')+'\n',html:html.join('\n')};
  }
  // B6 replaces this compatibility read with exportItem registration. It reads
  // live code from public cell objects, and output/plots from their current DOM.
  function legacyCells() {
    var container=window.qpyodideCellContainer, result=[];
    if(!container || !Array.isArray(container.cells))return result;
    container.cells.forEach(function(cell) {
      if(cell.options && cell.options.context==='setup')return;
      var units=cell.units || (cell.primaryUnit?[cell.primaryUnit]:[cell]);
      units.forEach(function(unit,index) {
        var host=unit.hostDiv || cell.insertionLocation,parts=[];
        if(unit.ctmStoreHandle)return;
        if(typeof unit.getCode==='function')parts.push({kind:'code',text:unit.getCode()});
        else if(typeof cell.code==='string')parts.push({kind:'code',text:cell.code});
        if(unit.outputCodeDiv && unit.outputCodeDiv.textContent.trim())parts.push({kind:'output',text:unit.outputCodeDiv.textContent});
        if(unit.outputGraphDiv)Array.prototype.forEach.call(unit.outputGraphDiv.querySelectorAll('img'),function(plot) {
          if(image(plot.src))parts.push({kind:'image',label:plot.alt || '',dataURL:plot.src});
        });
        if(parts.length)result.push({title:cell.options && (cell.options.title || cell.options.label) || String(cell.id)+(index?':'+(index+1):''),parts:parts,element:host});
      });
    });
    return result;
  }
  function items() {
    var result=window.CTMStore?CTMStore.exportItems():[];
    return result.concat(legacyCells()).sort(function(a,b) {
      if(!a.element || !b.element || a.element===b.element)return 0;
      return a.element.compareDocumentPosition(b.element)&2?1:-1;
    });
  }
  function open() {
    var node=document.getElementById('ctm-store-manifest'),config={};
    try{config=node?JSON.parse(node.textContent):{};}catch(error){/* defaults */}
    var messages=config.messages || {},t=function(key,fallback){return messages[key] || fallback;};
    var previous=document.activeElement,old=document.getElementById('ctm-export-view');
    if(previous && previous.closest('dialog#ctm-settings')) previous=document.querySelector('.ctm-settings-toolbar button');
    if(old)old.remove();
    var heading=document.querySelector('main h1') || document.querySelector('h1');
    var data=serialize(items(),{course:window.CTMStore?CTMStore.course:location.pathname,title:heading?heading.textContent:document.title,at:new Date().toISOString()});
    var panel=document.createElement('section'),title=document.createElement('h2'),area=document.createElement('textarea'),actions=document.createElement('div');
    panel.id='ctm-export-view';panel.className='ctm-export-view';panel.setAttribute('role','region');
    panel.setAttribute('aria-label',t('exportTitle','Export my answers'));
    title.textContent=t('exportTitle','Export my answers');
    area.value=data.markdown;area.readOnly=true;area.rows=20;area.setAttribute('aria-label',title.textContent);
    function button(label,action) {
      var element=document.createElement('button');element.type='button';element.textContent=label;element.setAttribute('aria-label',label);
      element.addEventListener('click',action);actions.appendChild(element);return element;
    }
    button(t('copyAll','Copy all'),function(){window.CTMCopy.text(data.markdown,{label:t('copyAll','Copy all')});});
    function download(content,mime,filename) {
      var url=URL.createObjectURL(new Blob([content],{type:mime})),link=document.createElement('a');
      link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
      setTimeout(function(){URL.revokeObjectURL(url);},10000);
    }
    button(t('downloadMarkdown','Download .md'),function(){download(data.markdown,'text/markdown;charset=utf-8','my-answers.md');});
    button(t('downloadHTML','Download .html'),function(){download(data.html,'text/html;charset=utf-8','my-answers.html');});
    button(t('exportClose','Close'),function(){panel.remove();if(previous && previous.focus)previous.focus({preventScroll:true});});
    panel.append(title,actions,area);
    var bar=document.querySelector('.ctm-save-bar');
    if(bar && !bar.closest('dialog'))bar.insertAdjacentElement('afterend',panel);else(document.querySelector('main') || document.body).prepend(panel);
    if(window.CTMSettings)window.CTMSettings.close();
    area.focus();area.select();return data;
  }
  window.CTMExport={version:1,open:open,serialize:serialize};
  document.addEventListener('click',function(event) {
    var button=event.target.closest && event.target.closest('[data-ctm-export]');
    if(button)open();
  });
})();
