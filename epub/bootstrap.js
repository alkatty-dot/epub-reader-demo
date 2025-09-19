// bootstrap.js（保留父層結構；優先吃 index.html/父層腳本提供的書檔）
(function () {
  function qs(id){ return document.getElementById(id); }

  // 盡量從你既有的父層腳本/頁面取書檔，再退回 URL 參數，最後才用父層預設相對路徑
  function resolveBookUrl(){
    // 1) 你的父層腳本可能丟進來的常見寫法（任選其一即可命中）
    if (typeof window.getBookUrl === 'function') {
      try { const u = window.getBookUrl(); if (u) return u; } catch(_) {}
    }
    if (window.BOOK_URL) return window.BOOK_URL;
    if (window.bookUrl)  return window.bookUrl;
    if (window.__EPUB__ && window.__EPUB__.url) return window.__EPUB__.url;

    // 2) URL 參數 ?book=...
    try {
      const u = new URL(window.location.href).searchParams.get('book');
      if (u) return u;
    } catch (_) {}

    // 3) 最後退回：父資料夾的預設檔名（依你現在的放置方式）
    return '../外公睡著了.epub';
  }

  function ensureOverlay(){
    const viewer = qs('viewer');
    if (!viewer) return;
    let overlay = document.getElementById('viewer_event');
    if (!overlay){
      overlay = document.createElement('div');
      overlay.id = 'viewer_event';
      overlay.className = 'viewer-event';
      // 給 index.js 綁手勢用
      viewer.appendChild(overlay);
    }
  }

  // 等待 epub.min.js 與 index.js 都載好，且 EPUBReader.init 可用
  function whenReady(cb){
    const start = Date.now();
    (function tick(){
      const readyDOM = (document.readyState === 'complete' || document.readyState === 'interactive');
      const readyAPI = (window.EPUBReader && typeof window.EPUBReader.init === 'function');
      if (readyDOM && readyAPI) return cb();
      if (Date.now() - start > 8000) return cb(); // 最長等 8 秒，避免卡死
      setTimeout(tick, 50);
    })();
  }

  function boot(){
    ensureOverlay();
    const bookUrl = resolveBookUrl();
    try {
      // 直接呼叫你現成的初始化
      window.EPUBReader.init('viewer', bookUrl);
    } catch (e) {
      console.error('EPUBReader.init 失敗：', e);
    }
  }

  whenReady(boot);
})();
