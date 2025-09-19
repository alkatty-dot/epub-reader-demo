/* EPUB Reader UI + Logic
 * EPUB 檔案放在 ../外公睡著了.epub （父資料夾）
 */

(function () {
  const $ = (sel, el = document) => el.querySelector(sel);

  // Elements
  const main = $(".main");
  const btnToc = $("#btnToc");
  const btnCloseToc = $("#btnCloseToc");
  const tocPanel = $("#tocPanel");
  const tocList = $("#tocList");
  const btnPrev = $("#btnPrev");
  const btnNext = $("#btnNext");
  const fontSize = $("#fontSize");
  const themeSelect = $("#themeSelect");
  const viewer = $("#viewer");

  // State
  let book, rendition, currentTheme = "light";
  // --- Zoom/Spread State ---
  let zoomState = { mode: (document.getElementById('zoomMode')?.value || 'fit-width'), scale: 1 };
  function setZoomMode(v){ zoomState.mode = v; relayout(); }
  function setCustomZoomFromRange(){ if (zoomMode?.value==='custom') zoomState.mode='custom'; relayout(); }

  // Ensure the iframe has a non-trivial size and trigger resizes if needed
  async function ensureVisible() {
    for (const t of [0, 50, 150, 300]) {
      await new Promise(r => setTimeout(r, t));
      const iframe = document.querySelector('#viewer iframe');
      const w = iframe?.clientWidth || document.getElementById('viewer').clientWidth;
      const h = iframe?.clientHeight || document.getElementById('viewer').clientHeight;
      if (w > 320 && h > 200) {
        try {
          const loc = rendition.currentLocation();
          rendition.resize(document.getElementById('viewer').clientWidth, document.getElementById('viewer').clientHeight);
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
    const w = document.getElementById('viewer').clientWidth || 0;
    const isFXL = detectFXL();
    // Heuristic: wide screens show both, narrow single
    if (isFXL) return (w >= 900 ? 'both' : 'none');
    return (w >= 900 ? 'both' : 'none'); // for reflow paginated as well
  }

  function applyLayoutByMode(mode) {
    // mode: 'none' | 'auto' | 'both'  (UI semantics)
    // for reflow: keep paginated, spread depends on mode
    // for FXL: force paginated; 'auto' -> 'both' (對頁), 'none' -> 'none'
    const isFXL = detectFXL();
    let spreadMode = (mode==='auto') ? autoMapSpread() : mode;
    if (isFXL) {
      rendition.flow('paginated');
      if (mode === 'auto') spreadMode = 'both'; // FXL 預設對頁顯示
    } else {
      rendition.flow('paginated');
    }
    try { rendition.spread(spreadMode); } catch(e) {}
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
  const zoomMode = document.getElementById('zoomMode');
  const zoomRange = document.getElementById('zoomRange');
  let currentScale = 1;

  function setSpread(mode){
    try{ rendition.spread(mode); }catch(e){}
    relayout();
  }

  function fitFixedLayout(){
    const isFXL = book?.package?.metadata?.layout === 'pre-paginated' || book?.package?.metadata?.fixed_layout;
    if (!isFXL) return;
    const iframe = document.querySelector('#viewer iframe');
    if (!iframe) return;
    const cw = iframe.contentWindow, doc = cw?.document;
    if (!doc) return;
    const vw = document.getElementById('viewer').clientWidth;
    const vh = document.getElementById('viewer').clientHeight;
    const dw = doc.documentElement.scrollWidth || 0;
    const dh = doc.documentElement.scrollHeight || 0;
    if (!dw || !dh || !vw || !vh) return;

    let s = 1;
    if (zoomMode?.value === 'fit-height') s = vh / dh;
    else if (zoomMode?.value === 'custom') s = (parseInt(zoomRange.value,10)||100)/100;
    else s = vw / dw;

    currentScale = s;
    doc.documentElement.style.transformOrigin = '0 0';
    doc.documentElement.style.transform = 'scale(' + s + ')';
    const w = Math.ceil(dw * s), h = Math.ceil(dh * s);
    iframe.style.width = w + 'px';
    iframe.style.height = h + 'px';
  }

  function relayout(){

    const isFXL = book?.package?.metadata?.layout === 'pre-paginated' || book?.package?.metadata?.fixed_layout;
    if (isFXL){
      const iframe = document.querySelector('#viewer iframe');
      const viewerEl = document.getElementById('viewer');
      if (iframe && viewerEl){
        const vw = viewerEl.clientWidth, vh = viewerEl.clientHeight;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc){
          const dw = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth);
          const dh = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
          let s = 1;
          if (zoomState.mode === 'fit-height') s = vh / (dh || vh);
          else if (zoomState.mode === 'custom') s = (parseInt(zoomRange?.value||'100',10))/100;
          else s = vw / (dw || vw); // fit-width
          zoomState.scale = s;
          doc.documentElement.style.transformOrigin = '0 0';
          doc.documentElement.style.transform = 'scale(' + s + ')';
          iframe.style.width = Math.ceil((dw||vw) * s) + 'px';
          iframe.style.height = Math.ceil((dh||vh) * s) + 'px';
        }
      }
    } else {
      const iframe = document.querySelector('#viewer iframe');
      if (iframe){ iframe.style.width='100%'; iframe.style.height='100%'; }
    }

    if (book?.package?.metadata?.layout === 'pre-paginated' || book?.package?.metadata?.fixed_layout){
      fitFixedLayout();
    } else {
      const iframe = document.querySelector('#viewer iframe');
      if (iframe){
        iframe.style.width = '100%';
        iframe.style.height = '100%';
      }
    }
  }

  spreadSelect?.addEventListener('change', () => applyLayoutByMode(spreadSelect.value));
  zoomMode?.addEventListener('change', () => { relayout(); });
  zoomRange?.addEventListener('input', () => { if (zoomMode.value==='custom') relayout(); });


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
    // EPUB 在父資料夾
    
    // ---- Resolve book path from URL or global selected_book (set by ../get_data.js) ----
    function getQueryParam(name) {
      const p = new URLSearchParams(window.location.search);
      return p.get(name);
    }
    const qpFile = getQueryParam("file") || getQueryParam("path");
    const qpId = getQueryParam("id");

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

    rendition = book.renderTo("viewer", {
      width: "100%",
      height: "100%",
      spread: "auto",
      flow: "scrolled-doc",
      allowScriptedContent: true
    });

    registerThemes();

  function isDesktop(){ return window.innerWidth >= 1024; }
  function forceDesktopToc(){
    if (isDesktop()){
      try{
        tocPanel.removeAttribute('hidden');
        main.classList.add('sidebar-open');
      }catch(e){}
    }
  }
  forceDesktopToc();
  window.addEventListener('resize', forceDesktopToc);

    await rendition.display();

    // Force TOC open on first load (temp workaround)
    try{
      
    }catch(e){}

await ensureVisible();

    // Choose flow after package is loaded: reflow -> paginated; fixed-layout -> scrolled-doc
    async function autoChooseFlow() {
      try {
        await book.ready;
        const isFXL = book?.package?.metadata?.layout === 'pre-paginated' || book?.package?.metadata?.fixed_layout;
        if (isFXL) {
          rendition.flow("scrolled-doc");
        } else {
          rendition.flow("paginated");
        }
      } catch (e) {}
    }
    

relayout();

    applyMetadata();
    relayout();
    rendition.on('rendered', () => { relayout(); });
    rendition.on('relocated', () => { relayout(); });
    rendition.on('displayed', () => { relayout(); });

maybeFixLayout();

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

    wireControls();
    window.addEventListener("resize", handleResize);
window.addEventListener('resize', () => { 
    // If UI is on 'auto', recompute spread
    if (document.getElementById('spreadSelect')?.value === 'auto'){
      applyLayoutByMode('auto');
    }
});

  // ---- Auto resize when #viewer size changes (sidebar toggle, window resize, etc.) ----
  const viewerEl = document.getElementById('viewer');
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
    if (tocPanel.hasAttribute("hidden")) openToc();
    else closeToc();
  }
  function openToc() {
    tocPanel.removeAttribute("hidden");
    main.classList.add("sidebar-open");

    // re-apply after sidebar transition
    setTimeout(() => { 
      const loc = rendition.currentLocation();
      if (loc) rendition.display(loc.start.cfi);
      relayout();
    try{ const loc = rendition.currentLocation(); rendition.resize(viewer.clientWidth, viewer.clientHeight); if (loc) rendition.display(loc.start.cfi);}catch(e){}
    }, 50);

  }
  function closeToc() {
  if (window.innerWidth >= 1024) { return; }
    tocPanel.setAttribute("hidden", "");
    main.classList.remove("sidebar-open");

    // re-apply after sidebar transition
    setTimeout(() => { 
      const loc = rendition.currentLocation();
      if (loc) rendition.display(loc.start.cfi);
      relayout();
    try{ const loc = rendition.currentLocation(); rendition.resize(viewer.clientWidth, viewer.clientHeight); if (loc) rendition.display(loc.start.cfi);}catch(e){}
    }, 50);

  }

  function onKeydown(e) {
    if (e.key === "ArrowLeft") rendition.prev();
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

  book?.ready?.catch(err => {
    console.error(err);
    viewer.innerHTML = `無法載入 EPUB：<code>../外公睡著了.epub</code><br/>請確認檔案存在於父資料夾，並以 HTTP 伺服器開啟。`;
  });
})();

    // If pagination renders overly narrow columns, switch to 'scrolled-doc'
    function maybeFixLayout() {
      try {
        const iframe = document.querySelector("#viewer iframe");
        if (!iframe) return;
        const cw = iframe.contentWindow;
        const docWidth = cw.document.documentElement.clientWidth || 0;
        if (docWidth && docWidth < 320) {
          // Too narrow → use scrolled-doc
          rendition.flow("scrolled-doc");
          // re-display current location
          const loc = rendition.currentLocation();
          if (loc) rendition.display(loc.start.cfi);
        }
      } catch (e) {}
    }
    
