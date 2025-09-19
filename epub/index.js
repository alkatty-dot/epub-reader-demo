(function() {
  // --- State ---
  var isRendering = false;
  var book, rendition, cfiString, pageProgressionDirection;

  // --- Preferences store ---
  const STORE_KEY = 'epubReader.prefs';
  function savePrefs(patch){
    try{
      const cur = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      localStorage.setItem(STORE_KEY, JSON.stringify(Object.assign(cur, patch)));
    }catch(e){}
  }
  function loadPrefs(){
    try{ return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }catch(e){ return {}; }
  }

  // --- Helpers / UI placement ---
  function isFixedLayout(book) {
    return book.package && book.package.metadata && book.package.metadata.layout === 'pre-paginated';
  }

  function setupTool() {
    var viewerDiv = document.getElementById("viewer");
    if (!viewerDiv) return;
    var viewerRect = viewerDiv.getBoundingClientRect();

    var toolButton = document.getElementById("toolButton");
    if (toolButton) {
      toolButton.style.top = viewerRect.top + "px";
      toolButton.style.left = (viewerRect.left + viewerRect.width - toolButton.getBoundingClientRect().width) + "px";
      toolButton.style.height = "100px";
    }

    var viewerEvent = document.getElementById("viewer_event");
    if (viewerEvent) {
      viewerEvent.style.top = (viewerRect.top + 100) + "px";
      viewerEvent.style.left = viewerRect.left + "px";
      viewerEvent.style.width = viewerRect.width + "px";
      viewerEvent.style.height = (viewerRect.height - 100) + "px";
      viewerEvent.style.display = 'block';
    }

    var toc = document.getElementById("toc");
    if (toc && toc.style.display === "block") {
      toc.style.left = (viewerRect.left + viewerRect.width - toc.getBoundingClientRect().width) + "px";
    }

    var toolDiv = document.getElementById("toolDiv");
    if (toolDiv && toolDiv.style.display === "block") {
      toolDiv.style.left = (viewerRect.left + viewerRect.width - toolDiv.getBoundingClientRect().width) + "px";
    }
  }

  // --- TOC ---
  function createTocItem(list, tocItem) {
    var listItem = document.createElement("li");
    var link = document.createElement("a");
    link.textContent = tocItem.label;
    link.href = "#";

    link.onclick = function() {
      if (!rendition) return false;
      isRendering = true;
      rendition.display(tocItem.href).then(function(){
        try { cfiString = rendition.currentLocation().start.cfi; } catch(e){}
        isRendering = false;
        closeToc();
      }).catch(function(){
        console.error("頁面切換時發生錯誤");
        isRendering = false;
      });
      return false;
    };

    listItem.appendChild(link);

    if (tocItem.subitems && tocItem.subitems.length > 0) {
      var subList = document.createElement("ul");
      tocItem.subitems.forEach(function(subItem){
        createTocItem(subList, subItem);
      });
      listItem.appendChild(subList);
    }
    list.appendChild(listItem);
  }

  var mouseDownX = 0;
  var mouseDownX2 = 0;

  function showToc() {
    var tocDiv = document.getElementById("toc");
    var viewer = document.getElementById("viewer");
    if (!tocDiv || !viewer) return;

    var viewerRect = viewer.getBoundingClientRect();
    var width = tocDiv.getBoundingClientRect().width;

    tocDiv.style.top = viewerRect.top + "px";
    tocDiv.style.height = viewerRect.height + "px";
    tocDiv.style.left = (viewerRect.left + viewerRect.width) + "px";
    tocDiv.style.display = "block";

    mouseDownX = viewerRect.left + viewerRect.width - width;
    mouseDownX2 = viewerRect.left + viewerRect.width;

    var currentLeft = (viewerRect.left + viewerRect.width);
    var finalLeft = (viewerRect.left + viewerRect.width - width);
    var step = 30;

    function animateRightToLeft() {
      currentLeft -= step;
      var left = currentLeft < finalLeft ? finalLeft : currentLeft;
      tocDiv.style.left = left + "px";
      if (left > finalLeft) requestAnimationFrame(animateRightToLeft);
    }
    requestAnimationFrame(animateRightToLeft);

    var closeTocDiv = document.getElementById("closeTocDiv");
    if (!closeTocDiv) return;

    closeTocDiv.onmousedown = function(e){
      mouseDownX = e.clientX;
      mouseDownX2 = e.clientX;
      var closeTocHandle = document.getElementById("closeToc");
      if (closeTocHandle) {
        closeTocHandle.style.backgroundColor = 'rgb(64,64,64)';
        closeTocHandle.style.color = 'white';
      }
      e.preventDefault();
    };

    closeTocDiv.onmousemove = function(e){
      if (mouseDownX === 0) return;
      var newX = e.clientX;
      var x = parseInt(tocDiv.style.left, 10) || 0;

      var width = tocDiv.getBoundingClientRect().width;
      var viewerRect = viewer.getBoundingClientRect();
      var minLeft = viewerRect.left + viewerRect.width - width;
      var maxLeft = viewerRect.left + viewerRect.width;
      var next = x + (newX - mouseDownX);

      if (next < minLeft) next = minLeft;
      if (next > maxLeft) next = maxLeft;

      tocDiv.style.left = next + "px";
      mouseDownX = newX;
    };

    closeTocDiv.onmouseup = function(){
      var closeTocHandle = document.getElementById("closeToc");
      if (closeTocHandle) {
        closeTocHandle.style.backgroundColor = 'rgb(232,232,232)';
        closeTocHandle.style.color = 'black';
      }
      var x = parseInt(tocDiv.style.left, 10) || 0;
      var width = tocDiv.getBoundingClientRect().width;
      var viewerRect = viewer.getBoundingClientRect();
      var threshold = viewerRect.left + viewerRect.width - width/2;

      if (x > threshold) {
        tocDiv.style.left = (viewerRect.left + viewerRect.width) + "px";
        tocDiv.style.display = "none";
      } else {
        tocDiv.style.left = (viewerRect.left + viewerRect.width - width) + "px";
      }
      mouseDownX = 0;
      mouseDownX2 = 0;
    };
  }

  function closeToc() {
    var tocDiv = document.getElementById("toc");
    var viewer = document.getElementById("viewer");
    if (!tocDiv || !viewer) return;

    var viewerRect = viewer.getBoundingClientRect();
    var width = tocDiv.getBoundingClientRect().width;
    var currentLeft = viewerRect.left + viewerRect.width - width;
    var finalLeft = viewerRect.left + viewerRect.width;
    var step = 20;

    function animateLeftToRight() {
      currentLeft += step;
      var left = currentLeft > finalLeft ? finalLeft : currentLeft;
      tocDiv.style.left = left + "px";
      if (left < finalLeft) {
        requestAnimationFrame(animateLeftToRight);
      } else {
        tocDiv.style.display = "none";
      }
    }
    requestAnimationFrame(animateLeftToRight);
  }

  function showTool() {
    var toolDiv = document.getElementById("toolDiv");
    var viewer = document.getElementById("viewer");
    if (!toolDiv || !viewer) return;

    var viewerRect = viewer.getBoundingClientRect();
    var width = toolDiv.getBoundingClientRect().width;

    toolDiv.style.top = viewerRect.top + "px";
    toolDiv.style.height = viewerRect.height + "px";
    toolDiv.style.left = (viewerRect.left + viewerRect.width) + "px";
    toolDiv.style.display = "block";

    mouseDownX = viewerRect.left + viewerRect.width - width;
    mouseDownX2 = viewerRect.left + viewerRect.width;

    var currentLeft = (viewerRect.left + viewerRect.width);
    var finalLeft = (viewerRect.left + viewerRect.width - width);
    var step = 30;

    function animateRightToLeft() {
      currentLeft -= step;
      var left = currentLeft < finalLeft ? finalLeft : currentLeft;
      toolDiv.style.left = left + "px";
      if (left > finalLeft) requestAnimationFrame(animateRightToLeft);
    }
    requestAnimationFrame(animateRightToLeft);

    var closeToolDiv = document.getElementById("closeToolDiv");
    if (!closeToolDiv) return;

    closeToolDiv.onmousedown = function(e){
      mouseDownX = e.clientX;
      mouseDownX2 = e.clientX;
      var closeToolHandle = document.getElementById("closeTool");
      if (closeToolHandle) {
        closeToolHandle.style.backgroundColor = 'rgb(64,64,64)';
        closeToolHandle.style.color = 'white';
      }
      e.preventDefault();
    };

    closeToolDiv.onmousemove = function(e){
      if (mouseDownX === 0) return;
      var newX = e.clientX;
      var x = parseInt(toolDiv.style.left, 10) || 0;

      var width = toolDiv.getBoundingClientRect().width;
      var viewerRect = viewer.getBoundingClientRect();
      var minLeft = viewerRect.left + viewerRect.width - width;
      var maxLeft = viewerRect.left + viewerRect.width;
      var next = x + (newX - mouseDownX);

      if (next < minLeft) next = minLeft;
      if (next > maxLeft) next = maxLeft;

      toolDiv.style.left = next + "px";
      mouseDownX = newX;
    };

    closeToolDiv.onmouseup = function(){
      var closeToolHandle = document.getElementById("closeTool");
      if (closeToolHandle) {
        closeToolHandle.style.backgroundColor = 'rgb(232,232,232)';
        closeToolHandle.style.color = 'black';
      }
      var x = parseInt(toolDiv.style.left, 10) || 0;
      var width = toolDiv.getBoundingClientRect().width;
      var viewerRect = viewer.getBoundingClientRect();
      var threshold = viewerRect.left + viewerRect.width - width/2;

      if (x > threshold) {
        toolDiv.style.left = (viewerRect.left + viewerRect.width) + "px";
        toolDiv.style.display = "none";
      } else {
        toolDiv.style.left = (viewerRect.left + viewerRect.width - width) + "px";
      }
      mouseDownX = 0;
      mouseDownX2 = 0;
    };
  }

  function closeTool() {
    var toolDiv = document.getElementById("toolDiv");
    var viewer = document.getElementById("viewer");
    if (!toolDiv || !viewer) return;

    var viewerRect = viewer.getBoundingClientRect();
    var width = toolDiv.getBoundingClientRect().width;
    var currentLeft = viewerRect.left + viewerRect.width - width;
    var finalLeft = viewerRect.left + viewerRect.width;
    var step = 20;

    function animateLeftToRight() {
      currentLeft += step;
      var left = currentLeft > finalLeft ? finalLeft : currentLeft;
      toolDiv.style.left = left + "px";
      if (left < finalLeft) {
        requestAnimationFrame(animateLeftToRight);
      } else {
        toolDiv.style.display = "none";
      }
    }
    requestAnimationFrame(animateLeftToRight);
  }

  // --- UI builders ---
  function createElements() {
    // TOC
    var tocDiv = document.createElement("div");
    tocDiv.id = "toc";
    tocDiv.style.display = "none";

    var closeTocDiv = document.createElement("div");
    closeTocDiv.id = "closeTocDiv";
    var closeToc = document.createElement("div");
    closeToc.id = "closeToc";
    closeToc.innerText = "目錄";
    closeTocDiv.appendChild(closeToc);

    var tocListDiv = document.createElement("div");
    tocListDiv.id = "tocList";
    var tocList = document.createElement("ul");
    tocList.id = "tocItems";
    tocListDiv.appendChild(tocList);

    tocDiv.appendChild(closeTocDiv);
    tocDiv.appendChild(tocListDiv);
    document.body.appendChild(tocDiv);

    // Tool button
    var toolButton = document.createElement("div");
    toolButton.id = "toolButton";
    var toolBtnLeft = document.createElement("div");
    toolBtnLeft.id = "toolBtnLeft";
    toolBtnLeft.innerText = "目\n錄";
    var toolBtnRight = document.createElement("div");
    toolBtnRight.id = "toolBtnRight";
    toolBtnRight.innerText = "設\n定";
    toolButton.appendChild(toolBtnLeft);
    toolButton.appendChild(toolBtnRight);
    document.body.appendChild(toolButton);

    // Tool panel
    var toolDiv = document.createElement("div");
    toolDiv.id = "toolDiv";
    toolDiv.style.display = "none";

    var closeToolDiv = document.createElement("div");
    closeToolDiv.id = "closeToolDiv";
    var closeTool = document.createElement("div");
    closeTool.id = "closeTool";
    closeTool.innerText = "設定";
    closeToolDiv.appendChild(closeTool);

    var toolListDiv = document.createElement("div");
    toolListDiv.id = "toolList";

    // Line-height
    var toolLineHeightDiv = document.createElement("div");
    toolLineHeightDiv.className = "toolItem";
    toolLineHeightDiv.id = "tool_lineHeigh_div";
    var lineHeightLabel = document.createElement("label");
    lineHeightLabel.innerText = "行高";
    var lineHeightSelect = document.createElement("select");
    lineHeightSelect.id = "lineHeight";
    var lineHeights = ["1.3", "1.5", "1.75", "2"];
    lineHeights.forEach(function(v){
      var opt = document.createElement("option");
      opt.value = v; opt.text = v;
      if (v === "1.5") opt.selected = true;
      lineHeightSelect.appendChild(opt);
    });
    var lineHeightAdjust = document.createElement("div");
    lineHeightAdjust.className = "tool-adjust";
    var lineHeightMinus = document.createElement("button");
    lineHeightMinus.className = "adjust-btn";
    lineHeightMinus.innerText = "-";
    var lineHeightPlus = document.createElement("button");
    lineHeightPlus.className = "adjust-btn";
    lineHeightPlus.innerText = "+";
    lineHeightAdjust.appendChild(lineHeightMinus);
    lineHeightAdjust.appendChild(lineHeightPlus);
    toolLineHeightDiv.appendChild(lineHeightLabel);
    toolLineHeightDiv.appendChild(lineHeightSelect);
    toolLineHeightDiv.appendChild(lineHeightAdjust);

    // Letter-spacing
    var toolLetterSpacingDiv = document.createElement("div");
    toolLetterSpacingDiv.className = "toolItem";
    toolLetterSpacingDiv.id = "tool_letterSpacing_div";
    var letterSpacingLabel = document.createElement("label");
    letterSpacingLabel.innerText = "字距";
    var letterSpacingSelect = document.createElement("select");
    letterSpacingSelect.id = "letterSpacing";
    var letterSpacings = ["0", "0.05em", "0.1em", "0.2em"];
    letterSpacings.forEach(function(v){
      var opt = document.createElement("option");
      opt.value = v; opt.text = v;
      letterSpacingSelect.appendChild(opt);
    });
    var letterSpacingAdjust = document.createElement("div");
    letterSpacingAdjust.className = "tool-adjust";
    var letterSpacingMinus = document.createElement("button");
    letterSpacingMinus.className = "adjust-btn";
    letterSpacingMinus.innerText = "-";
    var letterSpacingPlus = document.createElement("button");
    letterSpacingPlus.className = "adjust-btn";
    letterSpacingPlus.innerText = "+";
    letterSpacingAdjust.appendChild(letterSpacingMinus);
    letterSpacingAdjust.appendChild(letterSpacingPlus);
    toolLetterSpacingDiv.appendChild(letterSpacingLabel);
    toolLetterSpacingDiv.appendChild(letterSpacingSelect);
    toolLetterSpacingDiv.appendChild(letterSpacingAdjust);

    // Font-size
    var toolFontSizeDiv = document.createElement("div");
    toolFontSizeDiv.className = "toolItem";
    toolFontSizeDiv.id = "tool_fontSize_div";
    var fontSizeLabel = document.createElement("label");
    fontSizeLabel.innerText = "字級";
    var fontSizeSelect = document.createElement("select");
    fontSizeSelect.id = "fontSize";
    var fontSizes = ["90%", "100%", "110%", "120%", "130%", "150%", "180%", "200%"];
    fontSizes.forEach(function(v){
      var opt = document.createElement("option");
      opt.value = v; opt.text = v;
      if (v === "110%") opt.selected = true;
      fontSizeSelect.appendChild(opt);
    });
    var fontSizeAdjust = document.createElement("div");
    fontSizeAdjust.className = "tool-adjust";
    var fontSizeMinus = document.createElement("button");
    fontSizeMinus.className = "adjust-btn";
    fontSizeMinus.innerText = "-";
    var fontSizePlus = document.createElement("button");
    fontSizePlus.className = "adjust-btn";
    fontSizePlus.innerText = "+";
    fontSizeAdjust.appendChild(fontSizeMinus);
    fontSizeAdjust.appendChild(fontSizePlus);
    toolFontSizeDiv.appendChild(fontSizeLabel);
    toolFontSizeDiv.appendChild(fontSizeSelect);
    toolFontSizeDiv.appendChild(fontSizeAdjust);

    // Theme
    var toolThemeDiv = document.createElement("div");
    toolThemeDiv.className = "toolItem";
    toolThemeDiv.id = "tool_theme_div";
    var themeLabel = document.createElement("label");
    themeLabel.innerText = "主題";
    var themeDiv = document.createElement("div");
    [
      { id: "light", value: "light", text: "亮色", checked: true },
      { id: "mi",    value: "mi",    text: "米黃" },
      { id: "dark",  value: "dark",  text: "暗色" }
    ].forEach(function(t){
      var radioDiv = document.createElement("div");
      var radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "theme";
      radio.id = t.id;
      radio.value = t.value;
      if (t.checked) radio.checked = true;
      var label = document.createElement("label");
      label.htmlFor = t.id;
      label.innerText = t.text;
      radioDiv.appendChild(radio);
      radioDiv.appendChild(label);
      themeDiv.appendChild(radioDiv);
    });
    toolThemeDiv.appendChild(themeLabel);
    toolThemeDiv.appendChild(themeDiv);

    // Layout
    var toolLayoutDiv = document.createElement("div");
    toolLayoutDiv.className = "toolItem";
    var layoutLabel = document.createElement("label");
    layoutLabel.innerText = "版面";
    var layoutDiv = document.createElement("div");
    [
      { id: "auto", value: "auto", text: "自動", checked: true },
      { id: "none", value: "none", text: "單頁" },
      { id: "both", value: "both", text: "跨頁" }
    ].forEach(function(l){
      var radioDiv = document.createElement("div");
      var radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "layout";
      radio.id = l.id;
      radio.value = l.value;
      if (l.checked) radio.checked = true;
      var label = document.createElement("label");
      label.htmlFor = l.id;
      label.innerText = l.text;
      radioDiv.appendChild(radio);
      radioDiv.appendChild(label);
      layoutDiv.appendChild(radioDiv);
    });
    toolLayoutDiv.appendChild(layoutLabel);
    toolLayoutDiv.appendChild(layoutDiv);

    toolListDiv.appendChild(toolThemeDiv);
    toolListDiv.appendChild(toolLineHeightDiv);
    toolListDiv.appendChild(toolLetterSpacingDiv);
    toolListDiv.appendChild(toolFontSizeDiv);
    toolListDiv.appendChild(toolLayoutDiv);
    toolDiv.appendChild(closeToolDiv);
    toolDiv.appendChild(toolListDiv);
    document.body.appendChild(toolDiv);

    // Viewer click layer
    var viewerEvent = document.createElement("div");
    viewerEvent.id = "viewer_event";
    viewerEvent.innerText = "";
    viewerEvent.style.display = "none";
    document.body.appendChild(viewerEvent);
  }

  // --- Core start ---
  function start(containerId, bookUrl) {
    var layoutRadio = document.querySelector('input[name="layout"]:checked');
    var layout = layoutRadio ? layoutRadio.value : 'auto';

    book = ePub(bookUrl);
    book.ready.then(function(){
      var packageDocument = book.package || {};
      pageProgressionDirection = packageDocument.metadata ? packageDocument.metadata['direction'] : undefined;

      const fixedLayout = isFixedLayout(book);
      rendition = book.renderTo(containerId, {
        spread: layout,
        width: "100%",
        height: "100%"
      });

      if (fixedLayout) {
        var hideIds = ["tool_theme_div","tool_lineHeigh_div","tool_letterSpacing_div","tool_fontSize_div"];
        hideIds.forEach(function(id){ var el=document.getElementById(id); if (el) el.style.display='none'; });
      }

      // register themes
      rendition.themes.register('dark',  { "body": { "color": "white", "background-color": "black" }});
      rendition.themes.register('light', { "body": { "color": "black", "background-color": "white" }});
      rendition.themes.register('mi',    { "body": { "color": "black", "background-color": "Beige" }});

      // Load saved prefs -> sync UI
      (function syncPrefsToUI(){
        var prefs = loadPrefs();
        try{
          if (prefs.theme) {
            var r = document.querySelector('input[name="theme"][value="'+prefs.theme+'"]');
            if (r) r.checked = true;
          }
          if (prefs.layout) {
            var rL = document.querySelector('input[name="layout"][value="'+prefs.layout+'"]');
            if (rL) rL.checked = true;
          }
          if (prefs.fontSize) {
            var fs = document.getElementById('fontSize');
            if (fs) fs.value = prefs.fontSize;
          }
          if (prefs.lineHeight) {
            var lh = document.getElementById('lineHeight');
            if (lh) lh.value = prefs.lineHeight;
          }
          if (prefs.letterSpacing) {
            var ls = document.getElementById('letterSpacing');
            if (ls) ls.value = prefs.letterSpacing;
          }
        }catch(e){}
      })();

      // Apply current UI -> rendition
      changeFontSize();
      changeTheme();
      changeLetterSpacing();
      changeLineHeight();
      setupTool();

      var p = cfiString ? rendition.display(cfiString) : rendition.display();
      p.then(function(){ isRendering = false; }).catch(function(){ isRendering = false; });

      function updateCFI() {
        try {
          var location = rendition.currentLocation();
          if (location && location.start && location.start.cfi) {
            cfiString = location.start.cfi;
          }
        } catch(e) {
          console.warn("CFI 取得失敗", e);
        }
      }
      rendition.on("rendered", updateCFI);
    }).catch(function(e){
      console.error("Book loading failed:", e);
    });

    if (!window.isLoadToc) {
      window.isLoadToc = true;
      loadToc();
    }
  }

  function loadToc() {
    var tocList = document.getElementById("tocItems");
    if (!tocList) return;

    if (book && book.navigation && Array.isArray(book.navigation.toc)) {
      book.navigation.toc.forEach(function(item){
        createTocItem(tocList, item);
      });
    } else if (book && book.loaded && book.loaded.navigation) {
      book.loaded.navigation.then(function(toc){
        if (toc && Array.isArray(toc.toc)) {
          toc.toc.forEach(function(item){ createTocItem(tocList, item); });
        }
      }).catch(function(e){ console.error(e); });
    }
  }

  // --- Setting changes (with persistence) ---
  function changeFontSize() {
    if (!rendition) return;
    var sel = document.getElementById("fontSize");
    if (!sel) return;
    var val = sel.value;
    rendition.themes.fontSize(val);
    savePrefs({ fontSize: val });
  }

  function changeTheme() {
    if (!rendition) return;
    var r = document.querySelector('input[name="theme"]:checked');
    var theme = r ? r.value : 'light';
    var toolButton = document.getElementById("toolButton");
    if (toolButton) toolButton.style.color = (theme === 'dark' ? 'white' : 'black');
    rendition.themes.select(theme);
    savePrefs({ theme: theme });
  }

  function changeLineHeight() {
    if (!rendition) return;
    var sel = document.getElementById("lineHeight");
    if (!sel) return;
    var val = sel.value;
    rendition.themes.default({ "*": { "line-height": val }});
    rendition.themes.update('default');
    savePrefs({ lineHeight: val });
  }

  function changeLetterSpacing() {
    if (!rendition) return;
    var sel = document.getElementById("letterSpacing");
    if (!sel) return;
    var val = sel.value;
    rendition.themes.default({ "body": { "letter-spacing": val }});
    rendition.themes.update('default');
    savePrefs({ letterSpacing: val });
  }

  function changeLayout() {
    var r = document.querySelector('input[name="layout"]:checked');
    var layout = r ? r.value : 'auto';
    savePrefs({ layout: layout });
    var viewer = document.getElementById("viewer");
    if (viewer) viewer.innerHTML = "";
    // 依你既有路徑啟動（原專案內用 standard.opf）
    start("viewer", "book2/item/standard.opf");
  }

  // --- Navigation ---
  function goToPreviousPage() {
    if (!rendition) return;
    if (isRendering) return;
    isRendering = true;
    rendition.prev().then(function(){
      try { cfiString = rendition.currentLocation().start.cfi; } catch(e){}
    }).finally(function(){ isRendering = false; });
  }

  function goToNextPage() {
    if (!rendition) return;
    if (isRendering) return;
    isRendering = true;
    rendition.next().then(function(){
      try { cfiString = rendition.currentLocation().start.cfi; } catch(e){}
    }).finally(function(){ isRendering = false; });
  }

  // --- Select stepper (+/-) ---
  function adjustSelect(selectId, direction) {
    var select = document.getElementById(selectId);
    if (!select) return;
    var options = Array.from(select.options).map(function(o){ return o.value; });
    var currentIndex = options.indexOf(select.value);
    var newIndex = Math.min(Math.max(0, currentIndex + direction), options.length - 1);
    select.value = options[newIndex];
    select.dispatchEvent(new Event('change'));
  }

  // --- Init & listeners ---
  function init(containerId, bookUrl) {
    createElements();
    setupEventListeners();
    start(containerId, bookUrl);
  }

  function setupEventListeners() {
    var setupBtn = document.getElementById('setup_button');
    if (setupBtn) setupBtn.addEventListener('click', showTool);
    var tocBtn = document.getElementById('show_toc');
    if (tocBtn) tocBtn.addEventListener('click', showToc);
    var closeTocBtn = document.getElementById('closeToc');
    if (closeTocBtn) closeTocBtn.addEventListener('click', closeToc);
    var closeToolBtn = document.getElementById('closeTool');
    if (closeToolBtn) closeToolBtn.addEventListener('click', closeTool);

    document.querySelectorAll('input[name="layout"]').forEach(function(input){
      input.addEventListener('change', changeLayout);
    });
    document.querySelectorAll('input[name="theme"]').forEach(function(input){
      input.addEventListener('change', changeTheme);
    });

    var lh = document.getElementById('lineHeight');
    if (lh) lh.addEventListener('change', changeLineHeight);
    var ls = document.getElementById('letterSpacing');
    if (ls) ls.addEventListener('change', changeLetterSpacing);
    var fs = document.getElementById('fontSize');
    if (fs) fs.addEventListener('change', changeFontSize);

    document.querySelectorAll('.adjust-btn').forEach(function(button){
      button.addEventListener('click', function(){
        var select = this.parentElement.querySelector('select');
        if (!select) return;
        var direction = this.textContent.trim() === '+' ? 1 : -1;
        adjustSelect(select.id, direction);
      });
    });

    var viewerEvent = document.getElementById("viewer_event");
    if (viewerEvent) {
      viewerEvent.addEventListener("click", function(event) {
        event.stopPropagation();
        var toolDiv = document.getElementById("toolDiv");
        var toc = document.getElementById("toc");
        if (toolDiv && toolDiv.style.display !== "none") { closeTool(); return; }
        if (toc && toc.style.display !== "none") { closeToc(); return; }

        var rect = viewerEvent.getBoundingClientRect();
        var clickX = event.clientX;

        if (clickX > rect.left + rect.width / 2) {
          if (pageProgressionDirection === 'rtl') { goToPreviousPage(); } else { goToNextPage(); }
        } else {
          if (pageProgressionDirection === 'rtl') { goToNextPage(); } else { goToPreviousPage(); }
        }
      });
    }

    // 禁右鍵（你原本就有）
    document.addEventListener("contextmenu", function (event) { event.preventDefault(); });

    // 鍵盤：左右翻頁、Ctrl/Cmd +/- 調字級；不影響輸入元件
    document.addEventListener("keydown", function (event) {
      var tag = (event.target && event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

      if (event.key === "ArrowLeft") {
        if (pageProgressionDirection === 'rtl') { goToNextPage(); } else { goToPreviousPage(); }
        event.preventDefault();
      } else if (event.key === "ArrowRight") {
        if (pageProgressionDirection === 'rtl') { goToPreviousPage(); } else { goToNextPage(); }
        event.preventDefault();
      } else if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) {
        var sel = document.getElementById('fontSize');
        if (sel) {
          var opts = Array.from(sel.options).map(function(o){ return o.value; });
          var idx = Math.max(0, opts.indexOf(sel.value));
          if (idx < opts.length - 1) { sel.value = opts[idx + 1]; changeFontSize(); }
        }
        event.preventDefault();
      } else if ((event.ctrlKey || event.metaKey) && event.key === '-') {
        var sel2 = document.getElementById('fontSize');
        if (sel2) {
          var opts2 = Array.from(sel2.options).map(function(o){ return o.value; });
          var idx2 = Math.max(0, opts2.indexOf(sel2.value));
          if (idx2 > 0) { sel2.value = opts2[idx2 - 1]; changeFontSize(); }
        }
        event.preventDefault();
      }
    });

    // 保留你原本的 keypress 行為，但避免影響輸入元件
    document.addEventListener("keypress", function (event) {
      var tag = (event.target && event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      event.preventDefault();
    });

    // 窗口尺寸變化時重算浮動元件位置
    window.addEventListener('resize', setupTool, { passive: true });
    window.addEventListener('scroll', setupTool, { passive: true });
  }

  // --- Public API ---
  window.EPUBReader = { init: init };
})();
