/* EPUB Reader UI + Logic
 * EPUB 檔案放在 ../外公睡著了.epub （父資料夾）
 */

(function () {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

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

  // Controls
  const spreadSelect = document.getElementById('spreadSelect');
  const zoomModeSel  = document.getElementById('zoomMode');
  const zoomRange    = document.getElementById('zoomRange');

  // State
  let book, rendition, currentTheme = "light";
  function defaultZoomMode(){ return (window.innerWidth >= 1024 ? 'fit-best' : 'fit-width'); }
  let zoomState = { mode: (zoomModeSel?.value || defaultZoomMode()), scale: 1 };

  // ===== Utilities =====
  function detectFXL() {
    const md = book?.package?.metadata || {};
    return md.layout === 'pre-paginated' || md.fixed_layout === true;
  }
  function getQueryParam(name) { const p = new URLSearchParams(window.location.search); return p.get(name); }

  // 取得固定版面頁面的「自然尺寸」
  // 1) 試讀 <meta name="viewport" content="width=...,height=...">
  // 2) 若頁面為單一大圖，取圖的 naturalWidth/Height
  // 3) 否則退回 scrollWidth/Height
  function getFXLNaturalSizeFromDoc(doc) {
    try {
      // meta viewport
      const meta = doc.querySelector('meta[name=viewport]')?.getAttribute('content') || '';
      if (meta) {
        const m = Object.fromEntries(meta.split(',').map(s => s.trim().split('=')));
        const w = parseFloat(m.width), h = parseFloat(m.height);
        if (w > 0 && h > 0) return { w, h };
      }
      // single large image
      const imgs = doc.images || [];
      if (imgs.length === 1) {
        const img = imgs[0];
        if (img.naturalWidth && img.naturalHeight) {
          return { w: img.naturalWidth, h: img.naturalHeight };
        }
      }
      // fallback: scroll size
      const w = Math.max(doc.documentElement.scrollWidth || 0, doc.body.scrollWidth || 0);
      const h = Math.max(doc.documentElement.scrollHeight || 0, doc.body.scrollHeight || 0);
      if (w && h) return { w, h };
    } catch(e) {}
    return { w: 0, h: 0 };
  }

  function getNaturalSizeFromIframe(iframe) {
    const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
    if (!doc) return { w: 0, h: 0 };
    return getFXLNaturalSizeFromDoc(doc);
  }

  // 確保第一次顯示時容器已有實際尺寸，必要時重 display
  async function ensureVisible() {
    for (const t of [0, 60, 160, 320]) {
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

  function autoMapSpread() {
    const w = viewer.clientWidth || 0;
    return (w >= 900 ? 'both' : 'none'); // 寬螢幕對頁、窄螢幕單頁
  }

  // ===== Metadata to header =====
  async function applyMetadata() {
    try {
      const meta = await book.loaded.metadata;
      const title = meta?.title || '';
      const publisher = meta?.publisher || '';
      let isbn = '';
      (meta?.identifiers || []).forEach(it => {
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

  // ===== Spread/Zoom 核心：固定版面一致倍率，模式正確生效 =====
  // 對目前 viewer 裡的 .epub-view（通常 1 或 2 個）取「自然尺寸」，用同一倍率 s 縮放
  function fitFixedLayout(){
    if (!detectFXL()) return;

    // 只抓目前顯示中的 view
    const views = $$('#viewer .epub-view');
    if (!views.length) return;

    const vw = viewer.clientWidth;
    const vh = viewer.clientHeight;
    if (!vw || !vh) return;

    // 取自然尺寸
    const pages = views.map(v => {
      const iframe = v.querySelector('iframe');
      const sz = getNaturalSizeFromIframe(iframe);
      return { v, iframe, w: sz.w, h: sz.h };
    }).filter(p => p.w && p.h);

    if (!pages.length) return;

    // 跨頁間距（可調整）
    const N = pages.length;
    const GAP = (N > 1 ? 12 : 0); // ← 預設 12px，避免「跨頁很開」
    // 單位：自然寬總和、最大高
    const totalW = pages.reduce((s,p)=> s + p.w, 0);
    const maxH   = pages.reduce((m,p)=> Math.max(m, p.h), 0);

    // 算縮放倍率：不同模式對應不同取值
    const mode = (zoomModeSel?.value) || zoomState.mode || 'fit-width';
    let sW = (vw - GAP * (N - 1)) / totalW;
    if (!isFinite(sW) || sW <= 0) sW = 1;
    let sH = vh / maxH;
    if (!isFinite(sH) || sH <= 0) sH = 1;

    let s = 1;
    if (mode === 'fit-height') {
      s = sH;
    } else if (mode === 'custom') {
      const val = parseInt(zoomRange?.value || '100', 10);
      s = Math.max(0.1, val / 100);
    } else if (mode === 'fit-best') {
      s = Math.min(sW, sH);
    } else { // fit-width
      s = sW;
    }
    zoomState.scale = s;

    // 套用：先把每頁恢復到自然寬高做基礎，再以 transform 縮放，並加上 gap
    // 用 flex 置中，避免視覺偏移
    const spreadWrap = views[0]?.parentElement;
    if (spreadWrap) {
      spreadWrap.style.display = 'flex';
      spreadWrap.style.alignItems = 'flex-start';
      spreadWrap.style.justifyContent = 'center';
      spreadWrap.style.gap = (N > 1 ? `${GAP}px` : '0');
    }

    pages.forEach(p => {
      // 基礎寬高（自然尺寸）
      p.v.style.width  = `${p.w}px`;
      p.v.style.height = `${p.h}px`;
      // 使用 transform 縮放，避免 iframe 尺寸被庫改寫
      p.v.style.transformOrigin = '0 0';
      p.v.style.transform = `scale(${s})`;
      // 讓內部 iframe 吃滿其父容器（自然大小），由父容器縮放
      if (p.iframe) {
        p.iframe.style.width  = '100%';
        p.iframe.style.height = '100%';
      }
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

  // ===== TOC & 控制 =====
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

    // Spread 切換 → 先套用，再顯示當前位置，最後重排
    spreadSelect?.addEventListener('change', () => {
      const mode = spreadSelect.value || 'auto';
      const loc  = rendition.currentLocation();
      try { applyLayoutByMode(mode); } catch(e){}
      if (loc) rendition.display(loc.start.cfi);
      relayout();
    });

    // 縮放模式切換
    zoomModeSel?.addEventListener('change', () => {
      zoomState.mode = zoomModeSel.value || defaultZoomMode();
      relayout();
    });
    // 自訂倍率
    zoomRange?.addEventListener('input', () => {
      if ((zoomModeSel?.value || '') === 'custom') {
        zoomState.mode = 'custom';
        relayout();
      }
    });
  }

  function toggleToc() {
    if (tocPanel?.hasAttribute("hidden")) openToc();
    else closeToc();
  }
  function openToc() {
    tocPanel?.removeAttribute("hidden");
    main?.classList.add("sidebar-open");
    setTimeout(() => {
      const loc = rendition.currentLocation();
      rendition.resize(viewer.clientWidth, viewer.clientHeight);
      if (loc) rendition.display(loc.start.cfi);
      relayout();
    }, 50);
  }
  function closeToc() {
    if (window.innerWidth >= 1024) { return; } // 桌機固定開啟，避免容器變 0
    tocPanel?.setAttribute("hidden", "");
    main?.classList.remove("sidebar-open");
    setTimeout(() => {
      const loc = rendition.currentLocation();
      rendition.resize(viewer.clientWidth, viewer.clientHeight);
      if (loc) rendition.display(loc.start.cfi);
      relayout();
    }, 50);
  }

  function onKeydown(e) {
    if (e.key === "ArrowLeft")  rendition.prev();
    if (e.key === "ArrowRight") rendition.next();
  }

  // ===== 初始化 =====
  document.addEventListener("DOMContentLoaded", init, { once: true });

  // 動態 header 高度 -> CSS 變數，避免工具列壓住內容
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
    // ---- Resolve book path ----
    const qpFile = getQueryParam("file") || getQueryParam("path");
    const qpId   = getQueryParam("id");
    let bookPath;
    if (qpFile) {
      bookPath = /^https?:\/\//.test(qpFile) ? qpFile : ("../" + qpFile);
    } else if (typeof selected_book === "object" && selected_book?.file) {
      bookPath = "../" + selected_book.file;
    } else if (qpId && typeof booksData !== "undefined") {
      const found = booksData.find(b => String(b.number) === String(qpId) || String(b.id) === String(qpId));
      bookPath = found?.file ? ("../" + found.file) : "../外公睡著了.epub";
    } else {
      bookPath = "../外公睡著了.epub";
    }
    bookPath = encodeURI(bookPath);

    book = ePub(bookPath);
    rendition = book.renderTo("viewer", {
      width: "100%",
      height: "100%",
      spread: "auto",
      flow: "paginated",
      allowScriptedContent: true
    });

    registerThemes();

    await rendition.display();
    updateAppbarHeightVar();
    await ensureVisible();

    // 依書型設定 flow（FXL 仍用 paginated，reflow 也用 paginated；若你想 reflow 滾動可改 scrolled-doc）
    await book.ready;
    rendition.flow("paginated");

    applyMetadata();

    // 內頁通用 CSS
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

    // 初始 spread & zoom 模式
    applyLayoutByMode(spreadSelect?.value || 'auto');
    // 桌機 FXL 預設給「最佳」
    if (window.innerWidth >= 1024 && detectFXL()) {
      if (zoomModeSel && (!zoomModeSel.value || zoomModeSel.value === 'fit-width')) {
        zoomModeSel.value = 'fit-best';
        zoomState.mode = 'fit-best';
      }
    }

    wireControls();

    // Resize handlers
    window.addEventListener("resize", () => {
      const loc = rendition.currentLocation();
      rendition.resize(viewer.clientWidth, viewer.clientHeight);
      if (loc) rendition.display(loc.start.cfi);
      if (spreadSelect?.value === 'auto') applyLayoutByMode('auto');
      relayout();
    });

    // ResizeObserver：監聽 viewer 尺寸變化（開/關目錄、RWD）
    if (window.ResizeObserver && viewer){
      const ro = new ResizeObserver(() => {
        try {
          const loc = rendition.currentLocation();
          rendition.resize(viewer.clientWidth, viewer.clientHeight);
          if (loc) rendition.display(loc.start.cfi);
          relayout();
        } catch(e){}
      });
      ro.observe(viewer);
    }

    // render hooks：每次排版/換頁都重排，讓縮放模式真正生效
    rendition.on('rendered',  () => { relayout(); });
    rendition.on('relocated', () => { relayout(); });
    rendition.on('displayed', () => { relayout(); });

    document.addEventListener("keydown", onKeydown);
  }

  // ===== Themes =====
  function registerThemes() {
    rendition.themes.register("light", { body: { background: "#ffffff", color: "#111827", "line-height": "1.6" }});
    rendition.themes.register("dark",  { body: { background: "#0b1020", color: "#e5e7eb", "line-height": "1.6" }});
    rendition.themes.register("mi",    { body: { background: "#f5efe6", color: "#3b3b3b", "line-height": "1.6" }});
    setTheme(currentTheme);
  }
  function setTheme(name) {
    currentTheme = name;
    rendition.themes.select(name);
    if (name === "dark") document.documentElement.setAttribute("data-ui-theme", "dark");
    else document.documentElement.removeAttribute("data-ui-theme");
  }

  // ===== Layout fallback：過窄欄位時退到滾動（保險） =====
  function maybeFixLayout() {
    try {
      const iframe = document.querySelector("#viewer iframe");
      if (!iframe) return;
      const cw = iframe.contentWindow;
      const docWidth = cw?.document?.documentElement?.clientWidth || 0;
      if (docWidth && docWidth < 320) {
        rendition.flow("scrolled-doc");
        const loc = rendition.currentLocation();
        if (loc) rendition.display(loc.start.cfi);
      }
    } catch (e) {}
  }

})();
