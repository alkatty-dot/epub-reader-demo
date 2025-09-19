/* EPUB Reader UI + Image/Spread Fixes
 * 讀取父資料夾的 EPUB（保留你原本的路徑解析）
 * 重點：移除 transform 縮放；壓縮跨頁間距；統一圖片等比填滿
 */

(function () {
  const $ = (sel, el = document) => el.querySelector(sel);

  // ====== 可調整參數 ======
  const WIDE_SCREEN = 900;          // ≥ 此寬度採對頁
  const COLUMN_GAP_REM = 0.75;      // 跨頁間距（reflow 的欄間距），可調小到 0 但建議保留一點
  const BODY_PADDING_REM = 0.5;     // 頁面邊界留白（避免貼邊裁切）
  // =======================

  // Elements（保留你的 UI）
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

  let book, rendition, currentTheme = "light";

  // 跟 index_0.js 一樣，直接交給 ePub.js paginated + spread，別再 transform。:contentReference[oaicite:5]{index=5}
  function isFXL() {
    const md = book?.package?.metadata || {};
    return md.layout === "pre-paginated" || md.fixed_layout === true;
  }

  function autoSpread() {
    return (viewer.clientWidth >= WIDE_SCREEN ? "both" : "none");
  }

  function applyFlowAndSpread() {
    try {
      if (isFXL()) {
        // 固定版面：用 paginated，spread 依寬度決定單頁/對頁
        rendition.flow("paginated");
        rendition.spread(autoSpread());
      } else {
        // Reflow：同樣 paginated，避免 scrolled-doc 導致尺寸感不一致
        rendition.flow("paginated");
        rendition.spread(autoSpread());
      }
    } catch (e) {}
  }

  // 章節內通用樣式：統一圖片與跨頁間距（覆寫你先前造成縫隙過大的樣式）。:contentReference[oaicite:6]{index=6}
  function injectReadingCSS() {
    const gap = COLUMN_GAP_REM + "rem";
    const pad = BODY_PADDING_REM + "rem";

    // 注意：這些是注入到章節 iframe（book content）內，而不是你的主頁 CSS
    rendition.themes.default({
      "html, body": {
        margin: "0",
        padding: pad,
        "box-sizing": "border-box"
      },
      // 關鍵：欄位間距（跨頁縫隙）
      "html": { "column-gap": gap },

      // 圖片統一規則：等比縮放至容器最大、不可超過，避免忽大忽小
      "img, svg, canvas, video": {
        display: "block",
        "max-width": "100%",
        width: "100%",
        height: "auto",
        "image-rendering": "auto",
        "object-fit": "contain"
      },
      "figure": { margin: "0", padding: "0" },

      // 文字排版的基本安全值
      "p": { margin: "0 0 1em 0" },
      "*": { "box-sizing": "border-box" },

      // 固定版面書常見：有些頁面會有內建邊界，這裡不再額外加大
      "@page": { margin: "0" }
    });
  }

  function registerThemes() {
    rendition.themes.register("light", { body: { background: "#ffffff", color: "#111827", "line-height": "1.6" } });
    rendition.themes.register("dark",  { body: { background: "#0b1020", color: "#e5e7eb", "line-height": "1.6" } });
    rendition.themes.register("mi",    { body: { background: "#f5efe6", color: "#3b3b3b", "line-height": "1.6" } });
    setTheme(currentTheme);
  }
  function setTheme(name) {
    currentTheme = name;
    rendition.themes.select(name);
    if (name === "dark") document.documentElement.setAttribute("data-ui-theme", "dark");
    else document.documentElement.removeAttribute("data-ui-theme");
  }

  async function applyMetadata() {
    try {
      const meta = await book.loaded.metadata;
      const title = meta?.title || "";
      const publisher = meta?.publisher || "";
      let isbn = "";
      const idents = (meta?.identifiers || []);
      idents.forEach(it => {
        const v = (it?.value || it || "").toString();
        if (/97[89]\d{10}/.test(v)) isbn = v;
      });
      const tEl = document.getElementById("bookTitle");
      const mEl = document.getElementById("bookMeta");
      if (tEl) tEl.textContent = title || "EPUB Reader";
      if (mEl) {
        const bits = [];
        if (publisher) bits.push(publisher);
        if (isbn) bits.push("ISBN: " + isbn);
        mEl.textContent = bits.length ? "｜" + bits.join(" ｜ ") : "";
      }
    } catch (e) {}
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
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKeydown);
  }
  function onKeydown(e) {
    if (e.key === "ArrowLeft") rendition.prev();
    if (e.key === "ArrowRight") rendition.next();
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      try {
        applyFlowAndSpread();
        const loc = rendition.currentLocation();
        rendition.resize(viewer.clientWidth, viewer.clientHeight);
        if (loc) rendition.display(loc.start.cfi);
      } catch (e) {}
    }, 100);
  }

  function toggleToc() {
    if (tocPanel.hasAttribute("hidden")) openToc();
    else closeToc();
  }
  function openToc() {
    tocPanel.removeAttribute("hidden");
    main?.classList.add("sidebar-open");
    setTimeout(() => {
      try {
        applyFlowAndSpread();
        const loc = rendition.currentLocation();
        rendition.resize(viewer.clientWidth, viewer.clientHeight);
        if (loc) rendition.display(loc.start.cfi);
      } catch (e) {}
    }, 50);
  }
  function closeToc() {
    if (window.innerWidth >= 1024) return; // 桌機維持開啟
    tocPanel.setAttribute("hidden", "");
    main?.classList.remove("sidebar-open");
    setTimeout(() => {
      try {
        applyFlowAndSpread();
        const loc = rendition.currentLocation();
        rendition.resize(viewer.clientWidth, viewer.clientHeight);
        if (loc) rendition.display(loc.start.cfi);
      } catch (e) {}
    }, 50);
  }

  function getQueryParam(name) {
    const p = new URLSearchParams(window.location.search);
    return p.get(name);
  }

  document.addEventListener("DOMContentLoaded", init, { once: true });

  async function init() {
    // ===== 保留你的路徑解析邏輯（父層 ../*.epub） =====  :contentReference[oaicite:7]{index=7}
    const qpFile = getQueryParam("file") || getQueryParam("path");
    const qpId = getQueryParam("id");
    let bookPath;
    if (qpFile) {
      bookPath = /^https?:\/\//.test(qpFile) ? qpFile : "../" + qpFile;
    } else if (typeof selected_book === "object" && selected_book?.file) {
      bookPath = "../" + selected_book.file;
    } else if (qpId) {
      const found = (typeof booksData !== "undefined") ?
        booksData.find(b => String(b.number) === String(qpId) || String(b.id) === String(qpId)) : null;
      bookPath = found?.file ? ("../" + found.file) : "../外公睡著了.epub";
    } else {
      bookPath = "../外公睡著了.epub";
    }
    bookPath = encodeURI(bookPath);

    book = ePub(bookPath);

    // 關鍵：一開始就用 paginated；spread 由螢幕寬度決定；不做 transform。:contentReference[oaicite:8]{index=8}
    rendition = book.renderTo("viewer", {
      width: "100%",
      height: "100%",
      flow: "paginated",
      spread: autoSpread(),
      allowScriptedContent: true
    });

    // 主題及章節樣式
    registerThemes();
    injectReadingCSS();

    await rendition.display();
    applyMetadata();

    // 章節載入/定位時套版（避免頁面改變後間距還是舊值）
    rendition.on("rendered", () => {
      injectReadingCSS();
      applyFlowAndSpread();
    });
    rendition.on("relocated", () => {
      // 避免跳頁後欄距/對頁又變寬
      applyFlowAndSpread();
    });

    // TOC
    const nav = await book.loaded.navigation;
    buildToc(nav);
    wireControls();

    // 首次桌機自動打開 TOC（保留你的行為）
    try {
      if (window.innerWidth >= 1024) {
        tocPanel?.removeAttribute("hidden");
        main?.classList.add("sidebar-open");
      }
    } catch (e) {}
  }

  // 讀取失敗訊息
  book?.ready?.catch(err => {
    console.error(err);
    viewer.innerHTML = `無法載入 EPUB：<code>../外公睡著了.epub</code><br/>請確認檔案存在於父資料夾，並以 HTTP 伺服器開啟。`;
  });
})();
