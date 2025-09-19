// bootstrap.js (穩定版：保留父層結構，修正路徑/中文檔名/父子層相對定位)
(function () {
  function $(id){ return document.getElementById(id); }

  // 對最後一段做安全編碼，但避免重複編碼
  function safeEncodeLastSegment(p){
    try {
      const u = new URL(p, document.baseURI); // 統一處理 ./ ../ 結構
      return u.href; // 如果是完整 URL 直接回傳
    } catch(_) {
      // 非 URL => 視為相對路徑
      const parts = p.split('/');
      if (parts.length === 0) return p;
      const last = parts.pop();
      let decoded = last;
      try { decoded = decodeURIComponent(last); } catch(_) {}
      const reencoded = encodeURIComponent(decoded);
      parts.push(reencoded);
      return parts.join('/');
    }
  }

  function resolveBookFromParent(){
    // 你既有父層提供的多種可能
    if (typeof window.getBookUrl === 'function') {
      try { const u = window.getBookUrl(); if (u) return u; } catch(_) {}
    }
    if (window.BOOK_URL) return window.BOOK_URL;
    if (window.bookUrl)  return window.bookUrl;
    if (window.__EPUB__ && window.__EPUB__.url) return window.__EPUB__.url;
    return null;
  }

  function resolveBookUrl(){
    // 1) 先吃父層
    let candidate = resolveBookFromParent();

    // 2) 再吃 ?book=
    if (!candidate) {
      try {
        const qs = new URL(window.location.href).searchParams.get('book');
        if (qs) candidate = qs;
      } catch(_) {}
    }

    // 3) 都沒有 => 你的慣例：父層預設檔名
    if (!candidate) candidate = '../外公睡著了.epub';

    // ★關鍵：若父層只給純檔名（不含斜線），而你的書確實放在父層，幫你自動補 ../
    if (!/[/\\]/.test(candidate)) {
      candidate = '../' + candidate;
    }

    // 把相對路徑「正規化成絕對URL」，並處理中文檔名
    try {
      const abs = new URL(candidate, document.baseURI).href;
      return safeEncodeLastSegment(abs);
    } catch(_) {
      // 萬一瀏覽器不支援 URL（理論上都支援），退回原字串的末段編碼
      return safeEncodeLastSegment(candidate);
    }
  }

  function ensureOverlay(){
    const viewer = $('viewer');
    if (!viewer) return;
    let overlay = $('viewer_event');
    if (!overlay){
      overlay = document.createElement('div');
      overlay.id = 'viewer_event';
      overlay.className = 'viewer-event';
      viewer.appendChild(overlay);
    }
  }

  function whenReady(cb){
    const t0 = Date.now();
    (function wait(){
      const domReady = (document.readyState === 'complete' || document.readyState === 'interactive');
      const apiReady = (window.EPUBReader && typeof window.EPUBReader.init === 'function');
      if (domReady && apiReady) return cb();
      if (Date.now() - t0 > 8000) return cb(); // 最長等 8 秒
      setTimeout(wait, 50);
    })();
  }

  function boot(){
    ensureOverlay();
    const bookUrl = resolveBookUrl();
    // 方便你在 Console 直接看到實際要抓的最終 URL
    console.log('[EPUB] resolved book URL =>', bookUrl);
    try {
      window.EPUBReader.init('viewer', bookUrl);
    } catch (e) {
      console.error('EPUBReader.init 失敗：', e);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') whenReady(boot);
  else document.addEventListener('DOMContentLoaded', function(){ whenReady(boot); }, {once:true});
})();
