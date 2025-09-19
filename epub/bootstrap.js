(function(){
  function qs(id){ return document.getElementById(id); }
  function getBookUrl(){
    const url = new URL(window.location.href);
    const qp = url.searchParams.get('book');
    if(qp) return qp;
    // default to an epub in the same folder, if present
    return '外公睡著了.epub';
  }
  function ensureOverlay(){
    const viewer = qs('viewer');
    if(!viewer) return;
    let overlay = qs('viewer_event');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'viewer_event';
      overlay.setAttribute('aria-hidden','true');
      overlay.className = 'viewer-event';
      viewer.appendChild(overlay);
    }
  }
  function callInit(){
    if(!window.EPUBReader || typeof window.EPUBReader.init !== 'function') return;
    window.EPUBReader.init('viewer', getBookUrl());
  }
  function onReady(fn){
    if(document.readyState === 'complete' || document.readyState === 'interactive'){ fn(); }
    else document.addEventListener('DOMContentLoaded', fn, {once:true});
  }
  onReady(function(){
    ensureOverlay();
    callInit();
  });
})();