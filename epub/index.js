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

  document.addEventListener("DOMContentLoaded", init, { once: true });

  async function init() {
    // EPUB 在父資料夾
    const bookPath = encodeURI("../外公睡著了.epub");
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
maybeFixLayout();

    // Global content CSS injected into book iframe
    rendition.themes.default({
      "html, body": { "margin": "0", "padding": "1rem" },
      "*": { "box-sizing": "border-box" },
      "img, svg, video, canvas": { "max-width": "100%", "height": "auto" },
      "figure": { "margin": "0" },
      "a": { "text-decoration": "none", "color": "inherit" },
      "p": { "margin": "0 0 1em 0" },
      "h1, h2, h3, h4, h5, h6": { "margin": "1.2em 0 .6em" },
      "@page": { "margin": "0 0 1rem 0" }
    });
    

    const nav = await book.loaded.navigation;
    buildToc(nav);

    wireControls();
    window.addEventListener("resize", handleResize);
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
  }
  function closeToc() {
    tocPanel.setAttribute("hidden", "");
    main.classList.remove("sidebar-open");
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
    
