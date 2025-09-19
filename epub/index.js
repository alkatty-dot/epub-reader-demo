/* EPUB Reader UI + Logic
 * EPUB 檔案放在 ../外公睡著了.epub （父資料夾）
 */

(function () {
  const $ = (sel, el = document) => el.querySelector(sel);

  // Elements
  const main        = $(".main");
  const btnToc      = $("#btnToc");
  const btnCloseToc = $("#btnCloseToc");
  const tocPanel    = $("#tocPanel");
  const tocList     = $("#tocList");
  const btnPrev     = $("#btnPrev");
  const btnNext     = $("#btnNext");
  const fontSize    = $("#fontSize");
  const themeSelect = $("#themeSelect");
  const viewer      = $("#viewer");

  // State
  let book, rendition, currentTheme = "light";

  // --- Zoom/Spread State ---
  function defaultZoomMode(){
    return (window.innerWidth >= 1024 ? 'fit-best' : 'fit-width');
  }
  let zoomState = { mode: (document.getElementById('zoomMode')?.value || defaultZoomMode()), scale: 1 };
  function setZoomMode(v){ zoomState.mode = v; relayout(); }
  function setCustomZoomFromRange(){ if (zoomMode?.value==='custom') zoomState.mode='custom'; relayout(); }

  // 取得 iframe 內頁的自然寬高（未縮放）
  function getNaturalSize(iframe) {
    const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
    if (!doc) return { w: 0, h: 0 };
    const w = Math.max(doc.documentElement.scrollWidth || 0, doc.body.scrollWidth || 0);
    const h = Math.max(doc.documentElement.scrollHeight || 0, doc.body.scrollHeight || 0);
    return { w, h };
  }

  // Ensure the iframe has a non-trivial size and trigger resizes if needed
  async function ensureVisible() {
    for (const t of [0, 50, 150, 300]) {
      await new Promise(r => setTimeout(r, t));
      const iframe = document.querySelector('#viewer iframe');
      const w = iframe?.clientWidth || viewer.clientWidth;
      const h = iframe?.clientHeight || viewer.clientHeight;
      if (w > 320 && h > 200) {
        try {
          const loc = rendition.currentLocation();
          rendition.resize(viewer.clientWidth, viewer.clientHeight);
          if (loc) await rendition.display(loc.start.cfi);
        } catch(e){}
        break;
      }
    }
  }

  function detectFXL() {
    const md = book?.package?.metadata || {};
    return md.layout === 'pre-paginated' || md.fixed_layout === true;
  }

  function autoMapSpread() {
    const w = viewer.clientWidth || 0;
    // wide → both (對頁), narrow → none（單頁）
    return (w >= 900 ? 'both' : 'none');
  }

  function applyLayoutByMode(mode) {
    // mode: 'none' | 'auto' | 'both'
    const isFXL = detectFXL();
    let spreadMode = (mode==='auto') ? autoMapSpread() : mode;
    // FXL 預設對頁體驗較佳
    rendition.flow('paginated');
    if (isFXL && mode === 'auto') spreadMode = 'both';
    try { rendition.spread(spreadMode); } catch(e) {}
    relayout();
  }

  // ---------- Metadata to header ----------
  async function applyMetadata() {
    try {
      const meta = await book.loaded.metadata;
      const title = meta?.title || '';
      const publisher = meta?.publisher || '';
      // Try to find ISBN in identifiers
      let isbn = '';
      const idents = (meta?.identifiers || []);
      idents.forEach(it => {
        const v = (it?.value || it || '').toString();
        if (/97[89]\d{10}/.test(v)) isbn = v;
      });
      const tEl = document.getElementById('bookTitle');
      const mEl = document.getElementById('bookMeta');
      if (tEl) tEl.textContent = title || 'EPUB Reader';
      if (mEl) {
        const bits = [];
        if (publisher) bits.push(publisher);
        if (isbn) bits.push('ISBN: ' + isbn);
        mEl.textContent = bits.length ? '｜' + bits.join(' ｜ ') : '';
      }
    } catch (e) {}
  }

  // ---------- Spread & Zoom ----------
  const spreadSelect = document.getElementById('spreadSelect');
  const zoomMode     = document.getElementById('zoomMode');
  const zoomRange    = document.getElementById('zoomRange');

  // FXL：以「整組 spread」算唯一倍率，左右頁一致
  function fitFixedLayout(){
    const isFXL = detectFXL();
    if (!isFXL) return;

    const iframes = Array.from(document.querySelectorAll('#viewer iframe'));
    if (!iframes.length) return;

    const vw = viewer.clientWidth;
    const vh = viewer.clientHeight;

    // 蒐集目前畫面上的頁面（單頁=1, 跨頁=2）
    const pages = iframes
      .map(iframe => ({ iframe, ...getNaturalSize(iframe) }))
      .filter(p => p.w && p.h);

    if (!pages.length || !vw || !vh) return;

    // 頁間距（可依喜好改 16/24/32）
    const GAP = pages.length > 1 ? 24 : 0;

    // 以「整組 spread」來算唯一倍率 s
    const totalW = pages.reduce((s,p)=> s + p.w, 0);
    const maxH   = pages.reduce((m,p)=> Math.max(m, p.h), 0);

    const mode = (zoomMode?.value) || (zoomState?.mode) || 'fit-width';
    let s = 1;
    if (mode === 'fit-height') {
      s = vh / maxH;
    } else if (mode === 'custom') {
      s = (parseInt(zoomRange?.value || '100', 10)) / 100;
    } else if (mode === 'fit-best') {
      s = Math.min((vw - GAP) / totalW, vh / maxH);
    } else { // fit-width（預設）
      s = (vw - GAP) / totalW;
    }

    zoomState.scale = s;

    // 將同一個 s 套到每一頁 → 左右頁一致
    pages.forEach(p => {
      p.iframe.style.width  = Math.floor(p.w * s) + 'px';
      p.iframe.style.height = Math.floor(p.h * s) + 'px';
    });
  }

  function relayout(){
    if (detectFXL()){
      fitFixedLayout();
    } else {
      const iframe = document.querySelector('#viewer iframe');
      if (iframe){ iframe.style.width='100%'; iframe.style.height='100%'; }
    }
  }

  spreadSelect?.addEventListener('change', () => applyLayoutByMode(spreadSelect.value));
  zoomMode?.addEventListener('change', () => { setZoomMode(zoomMode.value); });
  zoomRange?.addEventListener('input', () => { if (zoomMode.value==='custom') setCustomZoomFromRange(); });

  document.addEventListener("DOMContentLoaded", init, { once: true });

  // v9: observe header height and write to CSS var so main area is correctly sized on mobile
  function updateAppbarHeightVar(){
    try{
      const h = document.querySelector('.appbar')?.offsetHeight || 56;
      document.documentElement.style.setProperty('--appbar-h', h + 'px');
    }catch(e){}
  }
  updateAppbarHeightVar();
  if (window.ResizeObserver){
    const ro = new ResizeObserver(updateAppbarHeightVar);
    const appbar = document.querySelector('.appbar');
    if (appbar) ro.observe(appbar);
  }
  window.addEventListener('resize', updateAppbarHeightVar);

  async function init() {
    // ---- Resolve book path from URL or global selected_book (set by ../get_data.js) ----
    function getQueryParam(name) {
      const p = new URLSearchParams(window.location.search);
      return p.get(name);
    }
    const qpFile = getQueryParam("file") || getQueryParam("path");
    const qpId   = getQueryParam("id");

    let bookPath;
    if (qpFile) {
      // If index.html passes explicit file name/path
      bookPath = qpFile;
      if (!/^https?:\/\//.test(bookPath)) {
        // relative to epub.html -> prefer parent folder root
        bookPath = "../" + bookPath;
      }
    } else if (typeof selected_book === "object" && selected_book && selected_book.file) {
      // Loaded from data.js + get_data.js
      bookPath = "../" + selected_book.file;
    } else if (qpId) {
      // Fallback: try to map id to booksData if available
      const found = (typeof booksData !== "undefined") ? booksData.find(b => String(b.number) === String(qpId) || String(b.id) === String(qpId)) : null;
      bookPath = found && found.file ? ("../" + found.file) : "../外公睡著了.epub";
    } else {
      // Last resort
      bookPath = "../外公睡著了.epub";
    }
    bookPath = encodeURI(bookPath);

    book = ePub(bookPath);

    // 注意：初始化用 paginated；是否要 scrolled-doc 由 autoChooseFlow 判斷
    rendition = book.renderTo("viewer", {
      width: "100%",
      height: "100%",
      spread: "auto",
      flow: "paginated",
      allowScriptedContent: true
    });

    registerThemes();

    function applyDesktopBestZoom(){
      try{
        const isFXL = detectFXL();
        if (window.innerWidth >= 1024 && isFXL){
          const zm = document.getElementById('zoomMode');
          if (zm && (!zm.value || zm.value === 'fit-width')) { zm.value = 'fit-best'; zoomState.mode = 'fit-best'; }
        }
      }catch(e){}
    }

    function isDesktop(){ return window.innerWidth >= 1024; }
    function forceDesktopToc(){
      if (isDesktop()){
        try{
          tocPanel?.removeAttribute('hidden');
          main?.classList.add('sidebar-open');
        }catch(e){}
      }
    }

    forceDesktopToc();
    window.addEventListener('resize', forceDesktopToc);

    await rendition.display();
    updateAppbarHeightVar();

    await ensureVisible();

    // Choose flow after package is loaded: reflow -> paginated；固定版面 → paginated（對頁由 spread 控）
    async function autoChooseFlow() {
      try {
        await book.ready;
        const isFXL = detectFXL();
        if (isFXL) {
          rendition.flow("paginated");
        } else {
          rendition.flow("paginated"); // 文字書保留分頁（若你想用滾動可改成 scrolled-doc）
        }
      } catch (e) {}
    }
    await autoChooseFlow();

    applyMetadata();

    // Global content CSS injected into book iframe
    rendition.themes.default({
      "html, body": { "margin": "0", "padding": "1rem" },
      "*": { "box-sizing": "border-box" },
      "img, svg, video, canvas": { "max-width": "100%", "height": "auto" },
      "figure": { "margin": "0" },
      "a": { "text-decoration": "none", "color": "inherit" },
      "p": { "margin": "0 0 1em 0" },
      "body": { "max-width": "100%", "word-break": "break-word" },
      "img": { "display":"block" },
      "html, body": { "column-gap": "2rem" },
      "h1, h2, h3, h4, h5, h6": { "margin": "1.2em 0 .6em" },
      "@page": { "margin": "0 0 1rem 0" }
    });

    const nav = await book.loaded.navigation;
    buildToc(nav);

    // 初始 layout 設定
    applyLayoutByMode(document.getElementById('spreadSelect')?.value || 'auto');

    wireControls();

    // Resize handlers
    window.addEventListener("resize", handleResize);
    window.addEventListener('resize', () => {
      // If UI is on 'auto', recompute spread
      if (document.getElementById('spreadSelect')?.value === 'auto'){
        applyLayoutByMode('auto');
      }
    });

    // ---- Auto resize when #viewer size changes (sidebar toggle, window resize, etc.) ----
    const viewerEl = viewer;
    if (window.ResizeObserver && viewerEl){
      const ro = new ResizeObserver(() => {
        try {
          const loc = rendition.currentLocation();
          rendition.resize(viewerEl.clientWidth, viewerEl.clientHeight);
          if (loc) rendition.display(loc.start.cfi);
        } catch(e){}
      });
      ro.observe(viewerEl);
    }

    window.addEventListener("resize", maybeFixLayout);
    document.addEventListener("keydown", onKeydown);

    // Render hooks
    rendition.on('rendered',  () => { relayout(); });
    rendition.on('relocated', () => { relayout(); });
    rendition.on('displayed', () => { relayout(); });
  }

  function registerThemes() {
    rendition.themes.register("light", {
      body: { background: "#ffffff", color: "#111827", "line-height": "1.6" }
    });
    rendition.themes.register("dark", {
      body: { background: "#0b1020", color: "#e5e7eb", "line-height": "1.6" }
    });
    rendition.themes.register("mi", {
      body: { background: "#f5efe6", color: "#3b3b3b", "line-height": "1.6" }
    });
    setTheme(currentTheme);
  }

  function setTheme(name) {
    currentTheme = name;
    rendition.themes.select(name);
    if (name === "dark") document.documentElement.setAttribute("data-ui-theme", "dark");
    else document.documentElement.removeAttribute("data-ui-theme");
  }

  function buildToc(nav) {
    if (!tocList) return;
    tocList.innerHTML = "";
    if (!nav || !nav.toc) return;
    nav.toc.forEach(item => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.textContent = item.label || "章節";
      a.href = "#";
      a.addEventListener("click", e => {
        e.preventDefault();
        rendition.display(item.href);
        closeToc();
      });
      li.appendChild(a);
      tocList.appendChild(li);
    });
  }

  function wireControls() {
    btnPrev?.addEventListener("click", () => rendition.prev());
    btnNext?.addEventListener("click", () => rendition.next());
    fontSize?.addEventListener("change", () => rendition.themes.fontSize(fontSize.value));
    themeSelect?.addEventListener("change", () => setTheme(themeSelect.value));
    btnToc?.addEventListener("click", toggleToc);
    btnCloseToc?.addEventListener("click", closeToc);
  }

  function toggleToc() {
    if (tocPanel?.hasAttribute("hidden")) openToc();
    else closeToc();
  }
  function openToc() {
    tocPanel?.removeAttribute("hidden");
    main?.classList.add("sidebar-open");

    // re-apply after sidebar transition
    setTimeout(() => {
      const loc = rendition.currentLocation();
      if (loc) rendition.display(loc.start.cfi);
      relayout();
      try{
        const loc2 = rendition.currentLocation();
        rendition.resize(viewer.clientWidth, viewer.clientHeight);
        if (loc2) rendition.display(loc2.start.cfi);
      }catch(e){}
    }, 50);
  }
  function closeToc() {
    // 桌機固定開啟（避免空白）；行動裝置可關
    if (window.innerWidth >= 1024) { return; }
    tocPanel?.setAttribute("hidden", "");
    main?.classList.remove("sidebar-open");

    // re-apply after sidebar transition
    setTimeout(() => {
      const loc = rendition.currentLocation();
      if (loc) rendition.display(loc.start.cfi);
      relayout();
      try{
        const loc2 = rendition.currentLocation();
        rendition.resize(viewer.clientWidth, viewer.clientHeight);
        if (loc2) rendition.display(loc2.start.cfi);
      }catch(e){}
    }, 50);
  }

  function onKeydown(e) {
    if (e.key === "ArrowLeft")  rendition.prev();
    if (e.key === "ArrowRight") rendition.next();
  }

  let resizeTimer = null;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (rendition) {
        const loc = rendition.currentLocation();
        rendition.resize(viewer.clientWidth, viewer.clientHeight);
        if (loc) rendition.display(loc.start.cfi);
      }
    }, 100);
  }

  // If pagination renders overly narrow columns, switch to 'scrolled-doc'
  function maybeFixLayout() {
    try {
      const iframe = document.querySelector("#viewer iframe");
      if (!iframe) return;
      const cw = iframe.contentWindow;
      const docWidth = cw?.document?.documentElement?.clientWidth || 0;
      if (docWidth && docWidth < 320) {
        // Too narrow → use scrolled-doc
        rendition.flow("scrolled-doc");
        // re-display current location
        const loc = rendition.currentLocation();
        if (loc) rendition.display(loc.start.cfi);
      }
    } catch (e) {}
  }

  // Basic error surface（非致命）
  book?.ready?.catch(err => {
    console.error(err);
    viewer.innerHTML = `無法載入 EPUB：<code>../外公睡著了.epub</code><br/>請確認檔案存在於父資料夾，並以 HTTP 伺服器開啟。`;
  });

})();
