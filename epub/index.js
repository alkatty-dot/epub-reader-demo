(function () {
  // ===== Global State =====
  var isRendering = false;
  var book, rendition, cfiString, pageProgressionDirection;

  // ===== Preferences =====
  var STORE_KEY = 'epubReader.prefs';
  function savePrefs(patch) {
    try {
      var cur = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      localStorage.setItem(STORE_KEY, JSON.stringify(Object.assign(cur, patch)));
    } catch (e) {}
  }
  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  // ===== Utils =====
  function isFixedLayout(bk) {
    return !!(bk && bk.package && bk.package.metadata && bk.package.metadata.layout === 'pre-paginated');
  }
  function $(id) { return document.getElementById(id); }

  // ===== Floating UI positioning =====
  function setupTool() {
    var viewerDiv = $('viewer');
    if (!viewerDiv) return;
    var rect = viewerDiv.getBoundingClientRect();

    var toolButton = $('toolButton');
    if (toolButton) {
      var w = toolButton.getBoundingClientRect().width;
      toolButton.style.top = rect.top + 'px';
      toolButton.style.left = (rect.left + rect.width - w) + 'px';
      toolButton.style.height = '100px';
    }

    var viewerEvent = $('viewer_event');
    if (viewerEvent) {
      viewerEvent.style.top = (rect.top + 100) + 'px';
      viewerEvent.style.left = rect.left + 'px';
      viewerEvent.style.width = rect.width + 'px';
      viewerEvent.style.height = (rect.height - 100) + 'px';
      viewerEvent.style.display = 'block';
    }

    var toc = $('toc');
    if (toc && toc.style.display === 'block') {
      var tw = toc.getBoundingClientRect().width;
      toc.style.left = (rect.left + rect.width - tw) + 'px';
    }

    var toolDiv = $('toolDiv');
    if (toolDiv && toolDiv.style.display === 'block') {
      var uw = toolDiv.getBoundingClientRect().width;
      toolDiv.style.left = (rect.left + rect.width - uw) + 'px';
    }
  }

  // ===== TOC =====
  function createTocItem(list, tocItem) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.textContent = tocItem.label;
    a.href = '#';
    a.onclick = function () {
      if (!rendition) return false;
      isRendering = true;
      rendition.display(tocItem.href).then(function () {
        try { cfiString = rendition.currentLocation().start.cfi; } catch (e) {}
        isRendering = false;
        closeToc();
      }).catch(function () {
        isRendering = false;
      });
      return false;
    };
    li.appendChild(a);

    if (tocItem.subitems && tocItem.subitems.length) {
      var ul = document.createElement('ul');
      tocItem.subitems.forEach(function (child) { createTocItem(ul, child); });
      li.appendChild(ul);
    }
    list.appendChild(li);
  }

  var dragX = 0, dragStartX = 0;
  function slideIn(panelId) {
    var panel = $(panelId), viewer = $('viewer');
    if (!panel || !viewer) return;

    var vr = viewer.getBoundingClientRect();
    var w = panel.getBoundingClientRect().width;
    panel.style.top = vr.top + 'px';
    panel.style.height = vr.height + 'px';
    panel.style.left = (vr.left + vr.width) + 'px';
    panel.style.display = 'block';

    var current = vr.left + vr.width;
    var target = vr.left + vr.width - w;
    var step = 30;
    function anim() {
      current -= step;
      var left = current < target ? target : current;
      panel.style.left = left + 'px';
      if (left > target) requestAnimationFrame(anim);
    }
    requestAnimationFrame(anim);

    var gripId = panelId === 'toc' ? 'closeTocDiv' : 'closeToolDiv';
    var grip = $(gripId);
    if (!grip) return;

    grip.onmousedown = function (e) {
      dragX = e.clientX;
      dragStartX = e.clientX;
      var headId = panelId === 'toc' ? 'closeToc' : 'closeTool';
      var head = $(headId);
      if (head) { head.style.backgroundColor = 'rgb(64,64,64)'; head.style.color = 'white'; }
      e.preventDefault();
    };
    grip.onmousemove = function (e) {
      if (!dragX) return;
      var x = parseInt(panel.style.left, 10) || 0;
      var newX = e.clientX;
      var width = panel.getBoundingClientRect().width;
      var minL = vr.left + vr.width - width;
      var maxL = vr.left + vr.width;
      var next = x + (newX - dragX);
      if (next < minL) next = minL;
      if (next > maxL) next = maxL;
      panel.style.left = next + 'px';
      dragX = newX;
    };
    grip.onmouseup = function () {
      var headId = panelId === 'toc' ? 'closeToc' : 'closeTool';
      var head = $(headId);
      if (head) { head.style.backgroundColor = 'rgb(232,232,232)'; head.style.color = 'black'; }
      var x = parseInt(panel.style.left, 10) || 0;
      var width = panel.getBoundingClientRect().width;
      var threshold = vr.left + vr.width - width / 2;
      if (x > threshold) {
        panel.style.left = (vr.left + vr.width) + 'px';
        panel.style.display = 'none';
      } else {
        panel.style.left = (vr.left + vr.width - width) + 'px';
      }
      dragX = 0; dragStartX = 0;
    };
  }
  function showToc()  { slideIn('toc');  }
  function showTool() { slideIn('toolDiv'); }
  function closeWithAnim(panelId) {
    var panel = $(panelId), viewer = $('viewer');
    if (!panel || !viewer) return;
    var vr = viewer.getBoundingClientRect();
    var w = panel.getBoundingClientRect().width;
    var current = vr.left + vr.width - w;
    var target  = vr.left + vr.width;
    var step = 20;
    function anim() {
      current += step;
      var left = current > target ? target : current;
      panel.style.left = left + 'px';
      if (left < target) requestAnimationFrame(anim);
      else panel.style.display = 'none';
    }
    requestAnimationFrame(anim);
  }
  function closeToc()  { closeWithAnim('toc'); }
  function closeTool() { closeWithAnim('toolDiv'); }

  // ===== Build UI (same IDs your code expects) =====
  function createElements() {
    // TOC
    var tocDiv = document.createElement('div'); tocDiv.id = 'toc'; tocDiv.style.display = 'none';
    var closeTocDiv = document.createElement('div'); closeTocDiv.id = 'closeTocDiv';
    var closeTocHead = document.createElement('div'); closeTocHead.id = 'closeToc'; closeTocHead.innerText = '目錄';
    closeTocDiv.appendChild(closeTocHead);
    var tocListDiv = document.createElement('div'); tocListDiv.id = 'tocList';
    var ul = document.createElement('ul'); ul.id = 'tocItems';
    tocListDiv.appendChild(ul);
    tocDiv.appendChild(closeTocDiv); tocDiv.appendChild(tocListDiv);
    document.body.appendChild(tocDiv);

    // Tool button
    var toolButton = document.createElement('div'); toolButton.id = 'toolButton';
    var left = document.createElement('div'); left.id = 'toolBtnLeft'; left.innerText = '目\n錄';
    var right= document.createElement('div'); right.id = 'toolBtnRight'; right.innerText = '設\n定';
    toolButton.appendChild(left); toolButton.appendChild(right);
    document.body.appendChild(toolButton);

    // Tool panel
    var toolDiv = document.createElement('div'); toolDiv.id = 'toolDiv'; toolDiv.style.display = 'none';
    var closeToolDiv = document.createElement('div'); closeToolDiv.id = 'closeToolDiv';
    var closeToolHead = document.createElement('div'); closeToolHead.id = 'closeTool'; closeToolHead.innerText = '設定';
    closeToolDiv.appendChild(closeToolHead);
    var toolList = document.createElement('div'); toolList.id = 'toolList';

    // 行高
    var lhWrap = document.createElement('div'); lhWrap.className = 'toolItem'; lhWrap.id = 'tool_lineHeigh_div';
    var lhLabel = document.createElement('label'); lhLabel.innerText = '行高';
    var lhSel = document.createElement('select'); lhSel.id = 'lineHeight';
    ['1.3','1.5','1.75','2'].forEach(function(v){
      var o = document.createElement('option'); o.value=v; o.text=v; if (v==='1.5') o.selected = true; lhSel.appendChild(o);
    });
    var lhAdj = document.createElement('div'); lhAdj.className = 'tool-adjust';
    var lhMinus = document.createElement('button'); lhMinus.className='adjust-btn'; lhMinus.innerText='-';
    var lhPlus  = document.createElement('button'); lhPlus.className='adjust-btn';  lhPlus.innerText='+';
    lhAdj.appendChild(lhMinus); lhAdj.appendChild(lhPlus);
    lhWrap.appendChild(lhLabel); lhWrap.appendChild(lhSel); lhWrap.appendChild(lhAdj);

    // 字距
    var lsWrap = document.createElement('div'); lsWrap.className='toolItem'; lsWrap.id='tool_letterSpacing_div';
    var lsLabel = document.createElement('label'); lsLabel.innerText='字距';
    var lsSel = document.createElement('select'); lsSel.id = 'letterSpacing';
    ['0','0.05em','0.1em','0.2em'].forEach(function(v){
      var o=document.createElement('option'); o.value=v; o.text=v; lsSel.appendChild(o);
    });
    var lsAdj = document.createElement('div'); lsAdj.className='tool-adjust';
    var lsMinus=document.createElement('button'); lsMinus.className='adjust-btn'; lsMinus.innerText='-';
    var lsPlus=document.createElement('button'); lsPlus.className='adjust-btn'; lsPlus.innerText='+';
    lsAdj.appendChild(lsMinus); lsAdj.appendChild(lsPlus);
    lsWrap.appendChild(lsLabel); lsWrap.appendChild(lsSel); lsWrap.appendChild(lsAdj);

    // 字級
    var fsWrap = document.createElement('div'); fsWrap.className='toolItem'; fsWrap.id='tool_fontSize_div';
    var fsLabel = document.createElement('label'); fsLabel.innerText='字級';
    var fsSel = document.createElement('select'); fsSel.id='fontSize';
    ['90%','100%','110%','120%','130%','150%','180%','200%'].forEach(function(v){
      var o=document.createElement('option'); o.value=v; o.text=v; if (v==='110%') o.selected=true; fsSel.appendChild(o);
    });
    var fsAdj=document.createElement('div'); fsAdj.className='tool-adjust';
    var fsMinus=document.createElement('button'); fsMinus.className='adjust-btn'; fsMinus.innerText='-';
    var fsPlus=document.createElement('button'); fsPlus.className='adjust-btn'; fsPlus.innerText='+';
    fsAdj.appendChild(fsMinus); fsAdj.appendChild(fsPlus);
    fsWrap.appendChild(fsLabel); fsWrap.appendChild(fsSel); fsWrap.appendChild(fsAdj);

    // 主題
    var thWrap = document.createElement('div'); thWrap.className='toolItem'; thWrap.id='tool_theme_div';
    var thLabel = document.createElement('label'); thLabel.innerText='主題';
    var thDiv = document.createElement('div');
    [
      { id:'light', value:'light', text:'亮色', checked:true },
      { id:'mi',    value:'mi',    text:'米黃' },
      { id:'dark',  value:'dark',  text:'暗色' }
    ].forEach(function(t){
      var node = document.createElement('div');
      var r = document.createElement('input'); r.type='radio'; r.name='theme'; r.id=t.id; r.value=t.value; if (t.checked) r.checked=true;
      var l = document.createElement('label'); l.htmlFor=t.id; l.innerText=t.text;
      node.appendChild(r); node.appendChild(l); thDiv.appendChild(node);
    });
    thWrap.appendChild(thLabel); thWrap.appendChild(thDiv);

    // 版面
    var loWrap = document.createElement('div'); loWrap.className='toolItem';
    var loLabel = document.createElement('label'); loLabel.innerText='版面';
    var loDiv = document.createElement('div');
    [
      { id:'auto', value:'auto', text:'自動', checked:true },
      { id:'none', value:'none', text:'單頁' },
      { id:'both', value:'both', text:'跨頁' }
    ].forEach(function(x){
      var node=document.createElement('div');
      var r=document.createElement('input'); r.type='radio'; r.name='layout'; r.id=x.id; r.value=x.value; if (x.checked) r.checked=true;
      var l=document.createElement('label'); l.htmlFor=x.id; l.innerText=x.text;
      node.appendChild(r); node.appendChild(l); loDiv.appendChild(node);
    });
    loWrap.appendChild(loLabel); loWrap.appendChild(loDiv);

    toolList.appendChild(thWrap);
    toolList.appendChild(lhWrap);
    toolList.appendChild(lsWrap);
    toolList.appendChild(fsWrap);
    toolList.appendChild(loWrap);
    toolDiv.appendChild(closeToolDiv);
    toolDiv.appendChild(toolList);
    document.body.appendChild(toolDiv);

    // Viewer click layer
    var ve = document.createElement('div'); ve.id='viewer_event'; ve.innerText=''; ve.style.display='none';
    document.body.appendChild(ve);
  }

  // ===== Core start =====
  function start(containerId, bookUrl) {
    var layoutRadio = document.querySelector('input[name="layout"]:checked');
    var layout = layoutRadio ? layoutRadio.value : 'auto';

    book = ePub(bookUrl);
    book.ready.then(function () {
      var pack = book.package || {};
      pageProgressionDirection = pack.metadata ? pack.metadata['direction'] : undefined;

      var fixed = isFixedLayout(book);
      rendition = book.renderTo(containerId, { spread: layout, width: '100%', height: '100%' });

      if (fixed) {
        ['tool_theme_div','tool_lineHeigh_div','tool_letterSpacing_div','tool_fontSize_div']
          .forEach(function (id) { var el = $(id); if (el) el.style.display = 'none'; });
      }

      // themes
      rendition.themes.register('dark',  { body: { color: 'white',  'background-color': 'black' }});
      rendition.themes.register('light', { body: { color: 'black',  'background-color': 'white' }});
      rendition.themes.register('mi',    { body: { color: 'black',  'background-color': 'Beige' }});

      // sync saved prefs -> UI
      (function () {
        var p = loadPrefs();
        try {
          if (p.theme) { var r = document.querySelector('input[name="theme"][value="'+p.theme+'"]'); if (r) r.checked = true; }
          if (p.layout){ var r2= document.querySelector('input[name="layout"][value="'+p.layout+'"]'); if (r2) r2.checked = true; }
          if (p.fontSize) { var fs = $('fontSize'); if (fs) fs.value = p.fontSize; }
          if (p.lineHeight) { var lh = $('lineHeight'); if (lh) lh.value = p.lineHeight; }
          if (p.letterSpacing) { var ls = $('letterSpacing'); if (ls) ls.value = p.letterSpacing; }
        } catch (e) {}
      })();

      // apply UI -> rendition
      changeFontSize(); changeTheme(); changeLetterSpacing(); changeLineHeight();
      setupTool();

      var disp = cfiString ? rendition.display(cfiString) : rendition.display();
      disp.finally(function () { isRendering = false; });

      rendition.on('rendered', function () {
        try {
          var loc = rendition.currentLocation();
          if (loc && loc.start && loc.start.cfi) cfiString = loc.start.cfi;
        } catch (e) {}
      });
    }).catch(function (e) {
      console.error('Book loading failed:', e);
    });

    if (!window.isLoadToc) {
      window.isLoadToc = true;
      loadToc();
    }
  }

  function loadToc() {
    var list = $('tocItems'); if (!list) return;
    if (book && book.navigation && Array.isArray(book.navigation.toc)) {
      book.navigation.toc.forEach(function (item) { createTocItem(list, item); });
    } else if (book && book.loaded && book.loaded.navigation) {
      book.loaded.navigation.then(function (toc) {
        if (toc && Array.isArray(toc.toc)) toc.toc.forEach(function (item) { createTocItem(list, item); });
      }).catch(function (e) { console.error(e); });
    }
  }

  // ===== Appearance changes =====
  function changeFontSize() {
    if (!rendition) return;
    var sel = $('fontSize'); if (!sel) return;
    var val = sel.value;
    rendition.themes.fontSize(val);
    savePrefs({ fontSize: val });
  }
  function changeTheme() {
    if (!rendition) return;
    var r = document.querySelector('input[name="theme"]:checked');
    var theme = r ? r.value : 'light';
    var btn = $('toolButton');
    if (btn) btn.style.color = (theme === 'dark' ? 'white' : 'black');
    rendition.themes.select(theme);
    savePrefs({ theme: theme });
  }
  function changeLineHeight() {
    if (!rendition) return;
    var sel = $('lineHeight'); if (!sel) return;
    var val = sel.value;
    rendition.themes.default({ '*': { 'line-height': val } });
    rendition.themes.update('default');
    savePrefs({ lineHeight: val });
  }
  function changeLetterSpacing() {
    if (!rendition) return;
    var sel = $('letterSpacing'); if (!sel) return;
    var val = sel.value;
    rendition.themes.default({ 'body': { 'letter-spacing': val } });
    rendition.themes.update('default');
    savePrefs({ letterSpacing: val });
  }
  function changeLayout() {
    var r = document.querySelector('input[name="layout"]:checked');
    var layout = r ? r.value : 'auto';
    savePrefs({ layout: layout });
    var viewer = $('viewer'); if (viewer) viewer.innerHTML = '';
    // 依你的結構重新啟動（你原本就是這條路徑）
    start('viewer', 'book2/item/standard.opf');
  }

  // ===== Navigation =====
  function goToPreviousPage() {
    if (!rendition || isRendering) return;
    isRendering = true;
    rendition.prev().finally(function () {
      try { cfiString = rendition.currentLocation().start.cfi; } catch (e) {}
      isRendering = false;
    });
  }
  function goToNextPage() {
    if (!rendition || isRendering) return;
    isRendering = true;
    rendition.next().finally(function () {
      try { cfiString = rendition.currentLocation().start.cfi; } catch (e) {}
      isRendering = false;
    });
  }

  // ===== Select stepper =====
  function adjustSelect(selectId, direction) {
    var sel = $(selectId); if (!sel) return;
    var opts = Array.prototype.map.call(sel.options, function (o) { return o.value; });
    var idx = Math.max(0, opts.indexOf(sel.value));
    var n = Math.min(Math.max(0, idx + direction), opts.length - 1);
    sel.value = opts[n];
    sel.dispatchEvent(new Event('change'));
  }

  // ===== Init & Events =====
  function init(containerId, bookUrl) {
    createElements();
    setupEventListeners();
    start(containerId, bookUrl);
  }

  function setupEventListeners() {
    var setupBtn = $('setup_button'); if (setupBtn) setupBtn.addEventListener('click', showTool);
    var tocBtn = $('show_toc'); if (tocBtn) tocBtn.addEventListener('click', showToc);
    var cT = $('closeToc'); if (cT) cT.addEventListener('click', closeToc);
    var cU = $('closeTool'); if (cU) cU.addEventListener('click', closeTool);

    document.querySelectorAll('input[name="layout"]').forEach(function (i) { i.addEventListener('change', changeLayout); });
    document.querySelectorAll('input[name="theme"]').forEach(function (i) { i.addEventListener('change', changeTheme); });
    var lh = $('lineHeight'); if (lh) lh.addEventListener('change', changeLineHeight);
    var ls = $('letterSpacing'); if (ls) ls.addEventListener('change', changeLetterSpacing);
    var fs = $('fontSize'); if (fs) fs.addEventListener('change', changeFontSize);

    document.addEventListener('click', function (e) {
      var ve = $('viewer_event');
      if (!ve || e.target !== ve) return;
      e.stopPropagation();

      var toolDiv = $('toolDiv'), toc = $('toc');
      if (toolDiv && toolDiv.style.display !== 'none') { closeTool(); return; }
      if (toc && toc.style.display !== 'none') { closeToc(); return; }

      var rect = ve.getBoundingClientRect();
      var rightSide = e.clientX > (rect.left + rect.width / 2);
      var rtl = (pageProgressionDirection === 'rtl');
      if (rightSide) { rtl ? goToPreviousPage() : goToNextPage(); }
      else { rtl ? goToNextPage() : goToPreviousPage(); }
    });

    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    document.addEventListener('keydown', function (event) {
      var tag = (event.target && event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

      if (event.key === 'ArrowLeft') {
        (pageProgressionDirection === 'rtl') ? goToNextPage() : goToPreviousPage();
        event.preventDefault();
      } else if (event.key === 'ArrowRight') {
        (pageProgressionDirection === 'rtl') ? goToPreviousPage() : goToNextPage();
        event.preventDefault();
      } else if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) {
        var selUp = $('fontSize');
        if (selUp) {
          var opts = Array.prototype.map.call(selUp.options, function (o) { return o.value; });
          var idx = Math.max(0, opts.indexOf(selUp.value));
          if (idx < opts.length - 1) { selUp.value = opts[idx + 1]; changeFontSize(); }
        }
        event.preventDefault();
      } else if ((event.ctrlKey || event.metaKey) && event.key === '-') {
        var selDn = $('fontSize');
        if (selDn) {
          var opts2 = Array.prototype.map.call(selDn.options, function (o) { return o.value; });
          var idx2 = Math.max(0, opts2.indexOf(selDn.value));
          if (idx2 > 0) { selDn.value = opts2[idx2 - 1]; changeFontSize(); }
        }
        event.preventDefault();
      }
    });

    document.addEventListener('keypress', function (event) {
      var tag = (event.target && event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      event.preventDefault();
    });

    window.addEventListener('resize', setupTool, { passive: true });
    window.addEventListener('scroll', setupTool, { passive: true });
  }

  // ===== Public API =====
  window.EPUBReader = { init: init };

  // ===== Signal Ready =====
  (function signalReady() {
    function fire() { document.dispatchEvent(new Event('EPUBReaderReady')); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fire, { once: true });
    else setTimeout(fire, 0);
  })();

})();
