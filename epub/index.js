(function () {
  // ===== State =====
  var isRendering = false;
  var book;
  var rendition;
  var cfiString;
  var pageProgressionDirection;
  var isLoadToc = false;

  // ===== Utils =====
  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function isFixedLayout(book) {
    try {
      return book && book.package && book.package.metadata &&
             book.package.metadata.layout === "pre-paginated";
    } catch (_) {
      return false;
    }
  }

  function applyThemeDataAttribute(themeValue) {
    const root = document.documentElement;
    root.setAttribute("data-theme", themeValue || "light");
  }

  // ===== Chrome: progress bar + page badge =====
  (function injectReaderChrome() {
    const v = document.getElementById("viewer");
    if (!v || v.querySelector("#progressBarWrap")) return;
    const barWrap = document.createElement("div");
    barWrap.id = "progressBarWrap";
    const bar = document.createElement("div");
    bar.id = "progressBar";
    barWrap.appendChild(bar);

    const badge = document.createElement("div");
    badge.id = "pageBadge";
    badge.textContent = "—";

    v.appendChild(barWrap);
    v.appendChild(badge);
  })();

  function updateProgressAndPage(loc) {
    try {
      let percent = 0;
      if (book && book.locations && book.locations.percentageFromCfi && loc?.start?.cfi) {
        percent = book.locations.percentageFromCfi(loc.start.cfi) * 100;
      } else if (loc && typeof loc.percentage === "number") {
        percent = loc.percentage * 100;
      }
      const p = Math.max(0, Math.min(100, Math.round(percent)));
      const bar = document.getElementById("progressBar");
      if (bar) bar.style.width = p + "%";

      const badge = document.getElementById("pageBadge");
      if (badge) {
        const page = loc?.displayed?.page;
        const total = loc?.displayed?.total;
        badge.textContent = (page && total) ? `${page} / ${total}` : p + "%";
      }
    } catch (_) {}
  }

  // ===== Layout helpers =====
  function setupTool() {
    // 只對齊 #viewer_event 與 #toc；#toolButton 交由 CSS 固定右上角
    var viewerDiv = document.getElementById("viewer");
    if (!viewerDiv) return;
    var viewerRect = viewerDiv.getBoundingClientRect();

    var viewerEvent = document.getElementById("viewer_event");
    if (viewerEvent) {
      viewerEvent.style.top = viewerRect.top + "px";
      viewerEvent.style.left = viewerRect.left + "px";
      viewerEvent.style.height = viewerRect.height + "px";
      viewerEvent.style.width = viewerRect.width + "px";
    }

    var toolDiv = document.getElementById("toolDiv");
    if (toolDiv) {
      toolDiv.style.top = viewerRect.top + "px";
      toolDiv.style.left = viewerRect.left + "px";
      toolDiv.style.height = viewerRect.height - 30 + "px";
      toolDiv.style.width = viewerRect.width * 0.8 + "px";
    }

    var tocDiv = document.getElementById("toc");
    if (tocDiv && tocDiv.style.display !== "none") {
      tocDiv.style.top = viewerRect.top + "px";
      tocDiv.style.left = viewerRect.left + "px";
      tocDiv.style.height = viewerRect.height - 30 + "px";
      tocDiv.style.width = viewerRect.width / 2 + "px";
    }
  }

  // ===== Style controls =====
  function changeFontSize() {
    var selectedFontSize = document.getElementById("fontSize").value;
    rendition.themes.fontSize(selectedFontSize);
  }

  function changeTheme() {
    var theme = document.querySelector('input[name="theme"]:checked').value;
    applyThemeDataAttribute(theme);
    rendition.themes.select(theme);
  }

  function changeLetterSpacing() {
    var selectedLetterSpacing = document.getElementById("letterSpacing").value;
    rendition.themes.default({
      body: { "letter-spacing": selectedLetterSpacing }
    });
    rendition.themes.update("default");
  }

  function changeLineHeight() {
    var selectedLineHeight = document.getElementById("lineHeight").value;
    rendition.themes.default({
      "*": { "line-height": selectedLineHeight }
    });
    rendition.themes.update("default");
  }

  // ===== Navigation =====
  function goToPreviousPage() {
    if (isRendering) return;
    isRendering = true;
    rendition
      .prev()
      .then(() => {
        const loc = rendition.currentLocation();
        if (loc?.start?.cfi) cfiString = loc.start.cfi;
        isRendering = false;
      })
      .catch(() => (isRendering = false));
  }

  function goToNextPage() {
    if (isRendering) return;
    isRendering = true;
    rendition
      .next()
      .then(() => {
        const loc = rendition.currentLocation();
        if (loc?.start?.cfi) cfiString = loc.start.cfi;
        isRendering = false;
      })
      .catch(() => (isRendering = false));
  }

  // ===== TOC =====
  function loadToc() {
    isLoadToc = true;
    var tocList = document.getElementById("tocList");
    tocList.innerHTML = "";

    book.loaded.navigation.then(function (toc) {
      function createTocItem(chapter, level) {
        var li = document.createElement("li");
        var button = document.createElement("button");
        button.innerHTML = chapter.label;
        button.onclick = function () {
          rendition.display(chapter.href);
          closeToc();
        };

        li.style.paddingLeft = level * 20 + "px";
        li.appendChild(button);
        tocList.appendChild(li);

        if (chapter.subitems) {
          chapter.subitems.forEach(function (subitem) {
            createTocItem(subitem, level + 1);
          });
        }
      }
      toc.forEach(function (chapter) {
        createTocItem(chapter, 0);
      });
    });
  }

  function showToc() {
    const toolDiv = document.getElementById("toolDiv");
    if (toolDiv && toolDiv.style.display !== "none") closeTool();

    var tocDiv = document.getElementById("toc");
    if (tocDiv && tocDiv.style.display !== "none") {
      closeToc();
      return;
    }
    tocDiv.style.display = "block";
    setupTool();
    if (!isLoadToc) loadToc();
  }
  function closeToc() {
    var tocDiv = document.getElementById("toc");
    tocDiv.style.display = "none";
  }

  // ===== Tool panel =====
  function showTool() {
    const toc = document.getElementById("toc");
    if (toc && toc.style.display !== "none") closeToc();

    var toolDiv = document.getElementById("toolDiv");
    if (toolDiv && toolDiv.style.display !== "none") {
      closeTool();
      return;
    }
    toolDiv.style.display = "block";
    setupTool();
  }
  function closeTool() {
    var toolDiv = document.getElementById("toolDiv");
    toolDiv.style.display = "none";
  }

  // ===== DOM scaffold (buttons / panels / overlay) =====
  function createElements() {
    // toolButton（固定右上角由 CSS 控制）
    if (!document.getElementById("toolButton")) {
      const toolButton = document.createElement("div");
      toolButton.id = "toolButton";
      toolButton.innerHTML = `
        <a id="setup_button" title="樣式">⚙</a>
        <a id="show_toc" title="目錄">▥</a>
      `;
      document.body.appendChild(toolButton);
    }

    if (!document.getElementById("toc")) {
      const toc = document.createElement("div");
      toc.id = "toc";
      toc.style.display = "none";
      toc.innerHTML = `
        <button id="closeToc" aria-label="關閉">×</button>
        <h3>目錄</h3>
        <ul id="tocList"></ul>
      `;
      document.body.appendChild(toc);
    }

    if (!document.getElementById("toolDiv")) {
      const toolDiv = document.createElement("div");
      toolDiv.id = "toolDiv";
      toolDiv.style.display = "none";
      toolDiv.innerHTML = `
        <button id="closeTool" aria-label="關閉">×</button>
        <h3>樣式調整</h3>

        <div id="tool_layout_div">
          <label>版式</label>
          <label><input type="radio" name="layout" value="auto" checked> 自動</label>
          <label><input type="radio" name="layout" value="none"> 單欄</label>
          <label><input type="radio" name="layout" value="always"> 雙欄</label>
        </div>

        <div id="tool_theme_div">
          <label>背景色</label>
          <label><input type="radio" name="theme" value="light" checked> 白色</label>
          <label><input type="radio" name="theme" value="mi"> 米色</label>
          <label><input type="radio" name="theme" value="dark"> 黑暗</label>
        </div>

        <div id="tool_lineHeigh_div">
          <label for="lineHeight">行距</label>
          <button class="adjust-btn">-</button>
          <select id="lineHeight">
            <option value="unset">預設</option>
            <option value="1">1</option>
            <option value="1.5">1.5</option>
            <option value="2">2</option>
          </select>
          <button class="adjust-btn">+</button>
        </div>

        <div id="tool_letterSpacing_div">
          <label for="letterSpacing">字距</label>
          <button class="adjust-btn">-</button>
          <select id="letterSpacing">
            <option value="unset" selected>預設</option>
            <option value="0.1em">0.1em</option>
            <option value="0.2em">0.2em</option>
            <option value="0.3em">0.3em</option>
            <option value="0.4em">0.4em</option>
            <option value="0.5em">0.5em</option>
          </select>
          <button class="adjust-btn">+</button>
        </div>

        <div id="tool_fontSize_div">
          <label for="fontSize">文字大小</label>
          <button class="adjust-btn">-</button>
          <select id="fontSize">
            <option value="unset" selected>預設</option>
            <option value="16px">16px</option>
            <option value="18px">18px</option>
            <option value="20px">20px</option>
            <option value="22px">22px</option>
            <option value="24px">24px</option>
            <option value="26px">26px</option>
            <option value="28px">28px</option>
            <option value="30px">30px</option>
          </select>
          <button class="adjust-btn">+</button>
        </div>
      `;
      document.body.appendChild(toolDiv);
    }

    if (!document.getElementById("viewer_event")) {
      const viewerEvent = document.createElement("div");
      viewerEvent.id = "viewer_event";
      document.body.appendChild(viewerEvent);
    }
  }

  // ===== Start / Init =====
  function changeLayout() {
    if (book) book.destroy();
    start("viewer", "book2/item/standard.opf");
  }

  function start(containerId, bookUrl) {
    // 載入過場
    document.documentElement.classList.add("is-loading");

    var layout = document.querySelector('input[name="layout"]:checked').value;

    book = ePub(bookUrl);
    book.ready.then(function () {
      // 方向資訊
      const packageDocument = book.package;
      pageProgressionDirection = packageDocument?.metadata?.direction || "ltr";

      // 建立 rendition
      const fixedLayout = isFixedLayout(book);
      rendition = book.renderTo(containerId, {
        spread: layout,
        width: "100%",
        height: "100%"
      });

      // 固定版面不顯示文字樣式控制
      if (fixedLayout) {
        document.getElementById("tool_theme_div").style.display = "none";
        document.getElementById("tool_lineHeigh_div").style.display = "none";
        document.getElementById("tool_letterSpacing_div").style.display = "none";
        document.getElementById("tool_fontSize_div").style.display = "none";
      }

      // 主題
      rendition.themes.register("dark", { body: { color: "white", "background-color": "black" } });
      rendition.themes.register("light", { body: { color: "black", "background-color": "white" } });
      rendition.themes.register("mi", { body: { color: "black", "background-color": "Beige" } });

      // 系統偏好→預設主題
      try {
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        const target = document.querySelector(`input[name="theme"][value="${prefersDark ? "dark" : "light"}"]`);
        if (target) target.checked = true;
      } catch (_) {}

      // 套用控制
      changeFontSize();
      changeTheme();
      changeLetterSpacing();
      changeLineHeight();

      // 定位 overlay 等
      setupTool();

      // 生成 locations（進度需要，量可依需要調整）
      try {
        book.locations.generate(1000).catch(() => {});
      } catch (_) {}

      // relocated → 更新進度與 cfi
      rendition.on("relocated", function (loc) {
        updateProgressAndPage(loc);
        if (loc?.start?.cfi) cfiString = loc.start.cfi;
      });

      // 顯示第一頁 / cfi
      var displayPromise = cfiString ? rendition.display(cfiString) : rendition.display();
      displayPromise.finally(() => {
        isRendering = false;
        document.documentElement.classList.remove("is-loading");
        const v = document.getElementById("viewer");
        if (v) {
          v.classList.remove("viewer-fade-in");
          void v.offsetWidth; // reflow
          v.classList.add("viewer-fade-in");
        }
      });

      // ---- 自動填入書名／出版社／ISBN 到 #bookInfo ----
      (async function fillHeaderFromMeta() {
        try {
          const meta = await book.loaded.metadata;
          const title = (meta?.title || "").trim();
          const pub = (meta?.publisher || "").trim();
          const isbn = (meta?.identifier || "").trim();

          const titleEl = document.querySelector("#bookInfo .book-title");
          const metaEl = document.querySelector("#bookInfo .book-meta");
          if (titleEl && title) titleEl.textContent = title;

          const parts = [];
          if (pub) parts.push(`出版社：${pub}`);
          if (isbn) parts.push(`ISBN：${isbn}`);
          if (metaEl) metaEl.textContent = parts.join(" · ");
        } catch (_) {}
      })();
    });
  }

  function init(containerId, bookUrl) {
    createElements();

    // 設定初始 data-theme（與 radio 同步）
    (function () {
      try {
        const checked = document.querySelector('input[name="theme"]:checked');
        applyThemeDataAttribute(checked ? checked.value : "light");
      } catch (_) {}
    })();

    // 啟動
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        start(containerId, bookUrl);
        setupEventListeners();
      });
    } else {
      start(containerId, bookUrl);
      setupEventListeners();
    }
  }

  // ===== Events =====
  function setupEventListeners() {
    // UI buttons
    document.getElementById("setup_button").addEventListener("click", showTool);
    document.getElementById("show_toc").addEventListener("click", showToc);
    document.getElementById("closeToc").addEventListener("click", closeToc);
    document.getElementById("closeTool").addEventListener("click", closeTool);

    // Responsive
    window.addEventListener("resize", debounce(setupTool, 150));
    window.addEventListener("orientationchange", debounce(setupTool, 150));

    // 鍵盤：← → 翻頁；ESC 收起面板（僅處理必要鍵，不攔截全部）
    document.addEventListener("keydown", function (e) {
      const toolDiv = document.getElementById("toolDiv");
      const toc = document.getElementById("toc");

      if (e.key === "Escape") {
        if (toolDiv && toolDiv.style.display !== "none") closeTool();
        if (toc && toc.style.display !== "none") closeToc();
        return;
      }

      // 面板開啟時不攔截翻頁
      if (toolDiv && toolDiv.style.display !== "none") return;
      if (toc && toc.style.display !== "none") return;

      if (e.key === "ArrowRight") {
        if (pageProgressionDirection === "rtl") {
          goToPreviousPage();
        } else {
          goToNextPage();
        }
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        if (pageProgressionDirection === "rtl") {
          goToNextPage();
        } else {
          goToPreviousPage();
        }
        e.preventDefault();
      }
    });

    // 點擊翻頁（左右半區）
    var viewerEvent = document.getElementById("viewer_event");
    viewerEvent.addEventListener("click", function (event) {
      event.stopPropagation();

      var toolDiv = document.getElementById("toolDiv");
      var toc = document.getElementById("toc");
      if (toolDiv && toolDiv.style.display !== "none") {
        closeTool();
        return;
      }
      if (toc && toc.style.display !== "none") {
        closeToc();
        return;
      }

      var rect = viewerEvent.getBoundingClientRect();
      var clickX = event.clientX;
      var goNext =
        pageProgressionDirection === "rtl"
          ? clickX < rect.left + rect.width / 2
          : clickX > rect.left + rect.width / 2;

      if (goNext) goToNextPage();
      else goToPreviousPage();
    });

    // 觸控左右滑翻頁
    let startX = 0,
      startY = 0;
    viewerEvent.addEventListener("touchstart", function (event) {
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    });
    viewerEvent.addEventListener("touchend", function (event) {
      const toolDiv = document.getElementById("toolDiv");
      const toc = document.getElementById("toc");
      if (toolDiv && toolDiv.style.display !== "none") return;
      if (toc && toc.style.display !== "none") return;

      const touch = event.changedTouches[0];
      const diffX = touch.clientX - startX;
      const diffY = touch.clientY - startY;

      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 200) {
        const goNext = diffX > 0
          ? (pageProgressionDirection === "ltr")
          : (pageProgressionDirection === "rtl");
        if (goNext) goToNextPage();
        else goToPreviousPage();
      }
    });

    // 目錄 / 版面 / 主題 / 行距 / 字距 / 字級
    document.querySelectorAll('input[name="layout"]').forEach((input) => {
      input.addEventListener("change", changeLayout);
    });
    document.querySelectorAll('input[name="theme"]').forEach((input) => {
      input.addEventListener("change", changeTheme);
    });
    document.getElementById("lineHeight").addEventListener("change", changeLineHeight);
    document.getElementById("letterSpacing").addEventListener("change", changeLetterSpacing);
    document.getElementById("fontSize").addEventListener("change", changeFontSize);

    document.querySelectorAll(".adjust-btn").forEach((button) => {
      button.addEventListener("click", function () {
        const selectId = this.parentElement.querySelector("select").id;
        const direction = this.textContent === "+" ? 1 : -1;
        const select = document.getElementById(selectId);
        if (!select) return;
        const options = Array.from(select.options);
        const newIndex = select.selectedIndex + direction;
        if (newIndex >= 0 && newIndex < options.length) {
          select.selectedIndex = newIndex;
          select.dispatchEvent(new Event("change"));
        }
      });
    });

    // 禁止右鍵如需保留可開啟，這裡不強制攔截鍵盤/滑鼠，以免影響讀取
    // document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  }

  // ===== Public API =====
  window.EPUBReader = { init: init };
})();
