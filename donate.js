/* DONATE button (added 2026-11-19 for Chase): Cash App $WrestleWorldPlus.
   Shared by WrestleWorld+, WatchCOMBAT+, Dis-Toon-elodeon, Cable and the TV Apps page. Canonical source: /workspace/work/donate/donate.src.js
   (python3 /workspace/work/donate/mk.py writes donate.js with the QR inlined and copies it into each site's source folder).
   - Any element with class "hkd-btn" (an <a href=cash.app> target=_blank) is a DONATE button. Phones/desktop: opens Cash App in a new tab.
   - TV (TV app bridge, TV browser UA, html.tv, ?tv=1): opens a modal with a QR code + the cashtag instead (TVs can't pay); OK/Back/Esc closes.
   - HKDonate.button(cls) returns the button HTML; HKDonate.go() = tap action; HKDonate.open()/close() = the modal. */
(function () {
  "use strict";
  var W = window, D = document;
  if (W.HKDonate) return;
  var URL = "https://cash.app/$WrestleWorldPlus", TAG = "$WrestleWorldPlus";
  var QR = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 33 33' shape-rendering='crispEdges'><path fill='#fff' d='M0 0h33v33h-33z'/><path class='qrline' stroke='#000' d='M2 2.5h7m2 0h1m2 0h1m1 0h1m4 0h1m2 0h7m-29 1h1m5 0h1m1 0h6m3 0h4m1 0h1m5 0h1m-29 1h1m1 0h3m1 0h1m3 0h2m3 0h1m2 0h3m1 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m2 0h5m4 0h3m1 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m1 0h1m2 0h1m1 0h1m2 0h4m2 0h1m1 0h3m1 0h1m-29 1h1m5 0h1m2 0h1m4 0h2m1 0h4m1 0h1m5 0h1m-29 1h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7m-20 1h1m5 0h1m1 0h1m1 0h2m-21 1h1m1 0h1m1 0h1m1 0h1m3 0h3m3 0h2m2 0h1m3 0h1m2 0h1m-28 1h1m4 0h1m1 0h1m1 0h2m1 0h2m1 0h1m1 0h1m2 0h4m1 0h1m2 0h1m-28 1h1m2 0h1m1 0h1m2 0h3m2 0h1m5 0h2m2 0h1m1 0h3m-26 1h2m2 0h1m2 0h1m1 0h3m2 0h2m2 0h4m2 0h1m-28 1h2m2 0h1m1 0h2m6 0h1m6 0h2m2 0h1m1 0h2m-29 1h2m1 0h3m4 0h3m1 0h1m1 0h3m1 0h3m2 0h1m2 0h1m-27 1h1m1 0h1m1 0h1m1 0h1m2 0h3m3 0h1m4 0h2m1 0h1m1 0h2m-29 1h1m1 0h2m1 0h1m1 0h1m1 0h1m2 0h1m2 0h4m1 0h1m2 0h1m1 0h1m1 0h1m-28 1h3m2 0h2m1 0h2m2 0h1m4 0h1m3 0h3m1 0h1m1 0h2m-28 1h2m4 0h5m1 0h1m2 0h1m2 0h2m1 0h1m2 0h2m1 0h1m-29 1h1m2 0h5m1 0h2m1 0h1m1 0h1m1 0h2m2 0h1m1 0h3m2 0h2m-28 1h4m4 0h1m1 0h1m1 0h9m1 0h1m1 0h1m1 0h1m-28 1h1m4 0h3m1 0h1m2 0h1m1 0h4m2 0h5m-17 1h1m5 0h1m1 0h5m3 0h1m1 0h3m-29 1h7m2 0h1m1 0h1m1 0h1m2 0h5m1 0h1m1 0h2m1 0h2m-29 1h1m5 0h1m3 0h1m1 0h1m2 0h1m1 0h1m1 0h2m3 0h2m1 0h2m-29 1h1m1 0h3m1 0h1m1 0h1m2 0h1m5 0h1m2 0h5m3 0h1m-29 1h1m1 0h3m1 0h1m4 0h2m2 0h2m3 0h1m2 0h2m1 0h3m-29 1h1m1 0h3m1 0h1m1 0h2m1 0h1m2 0h1m1 0h1m2 0h1m1 0h1m1 0h3m2 0h1m-29 1h1m5 0h1m3 0h8m1 0h3m2 0h1m2 0h1m-28 1h7m1 0h1m1 0h5m1 0h2m2 0h1m1 0h1m1 0h1m2 0h2'/></svg>";
  var UA = navigator.userAgent || "";
  function isTV() {
    return !!W.TVNative || /[?&]tv=1/.test(location.search) || D.documentElement.classList.contains("tv") ||
      /SMART-TV|SmartTV|Tizen|Web0S|webOS|NetCast|AFT[A-Z]|BRAVIA|GoogleTV|Google TV|Android TV|AndroidTV|CrKey|HbbTV|Roku|AppleTV|Large Screen/i.test(UA);
  }
  var css = "" +
    ".hkd-btn{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;box-sizing:border-box;min-height:36px;padding:5px 14px;" +
    "border-radius:999px;background:linear-gradient(180deg,#1fdb5f,#00b13a);color:#fff!important;text-decoration:none!important;border:2px solid rgba(255,255,255,.85);" +
    "font:800 13px/1.05 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.08em;white-space:nowrap;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.35);" +
    "-webkit-tap-highlight-color:transparent;flex:0 0 auto;vertical-align:middle;text-transform:none;max-width:100%;text-align:center}" +
    ".hkd-btn .hkd-l{display:flex;align-items:center;gap:6px;font-weight:900;letter-spacing:.12em}" +
    ".hkd-btn .hkd-ic{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;background:#fff;color:#00b13a;font:900 12px/1 system-ui,Arial,sans-serif;letter-spacing:0}" +
    ".hkd-btn .hkd-s{font:600 9.5px/1.15 system-ui,-apple-system,Arial,sans-serif;letter-spacing:.01em;opacity:.95;white-space:normal}" +
    ".hkd-btn:hover{filter:brightness(1.08)}" +
    ".hkd-btn:focus,.hkd-btn.focus,.hkd-btn.sel,.hkd-btn.tvfocus,.hkd-btn.tvnav-focus{outline:3px solid #ffd400!important;outline-offset:2px;filter:brightness(1.12)}" +
    ".hkd-btn.hkd-sm{min-height:30px;padding:4px 11px}.hkd-btn.hkd-sm .hkd-s{display:none}" +
    ".hkd-btn.hkd-lg{min-height:50px;padding:7px 22px;font-size:17px}.hkd-btn.hkd-lg .hkd-s{font-size:11.5px}.hkd-btn.hkd-lg .hkd-ic{width:20px;height:20px;font-size:15px}" +
    "html.tv a.hkd-btn[target],html.tv .hkd-btn{display:inline-flex!important}" +
    ".hkd-m{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.78);padding:16px;box-sizing:border-box;" +
    "font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}" +
    ".hkd-m[hidden]{display:none!important}" +
    ".hkd-box{background:#fff;color:#111;border-radius:20px;padding:22px 26px 20px;max-width:min(92vw,560px);max-height:94vh;overflow:auto;box-sizing:border-box;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)}" +
    ".hkd-box h2{margin:0 0 4px;font:900 clamp(20px,3.4vmin,34px)/1.1 system-ui,Arial,sans-serif;letter-spacing:.1em;color:#00a637}" +
    ".hkd-box p{margin:0 0 12px;font-size:clamp(13px,2vmin,19px);line-height:1.35;color:#333}" +
    ".hkd-qr{display:block;width:min(56vmin,300px);height:auto;margin:6px auto 10px;image-rendering:pixelated}.hkd-qr svg{display:block;width:100%;height:auto}" +
    ".hkd-tag{font:900 clamp(22px,4.4vmin,42px)/1.1 system-ui,Arial,sans-serif;color:#00a637;letter-spacing:.02em;margin:2px 0 6px;word-break:break-all}" +
    ".hkd-acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px}" +
    ".hkd-acts a,.hkd-acts button{font:800 clamp(14px,2.2vmin,20px)/1 system-ui,Arial,sans-serif;padding:12px 22px;border-radius:999px;border:2px solid #00b13a;cursor:pointer;text-decoration:none}" +
    ".hkd-acts a{background:#00b13a;color:#fff}.hkd-acts button{background:#fff;color:#0a6b2a}" +
    ".hkd-acts a:focus,.hkd-acts button:focus{outline:4px solid #ffd400;outline-offset:2px}" +
    ".hkd-m.tvm .hkd-open{display:none}";
  function addCSS() { if (D.getElementById("hkd-css")) return; var s = D.createElement("style"); s.id = "hkd-css"; s.textContent = css; (D.head || D.documentElement).appendChild(s); }
  addCSS();
  function button(cls, sub) {
    return '<a class="hkd-btn' + (cls ? " " + cls : "") + '" href="' + URL + '" target="_blank" rel="noopener" aria-label="Donate: support us on Cash App, ' + TAG + '">' +
      '<span class="hkd-l"><span class="hkd-ic" aria-hidden="true">$</span>DONATE</span><span class="hkd-s">' + (sub || "Support us on Cash App \u00b7 " + TAG) + "</span></a>";
  }
  var M = null, prevFocus = null;
  function build() {
    if (M) return M;
    M = D.createElement("div"); M.className = "hkd-m"; M.hidden = true;
    M.setAttribute("role", "dialog"); M.setAttribute("aria-modal", "true"); M.setAttribute("aria-label", "Donate on Cash App");
    M.innerHTML = '<div class="hkd-box"><h2>DONATE</h2><p>Scan with your phone camera to support us on Cash App</p>' +
      '<div class="hkd-qr" role="img" aria-label="QR code for ' + URL + '">' + QR + '</div>' +
      '<div class="hkd-tag">' + TAG + '</div><p style="margin:0">cash.app/' + TAG + '</p>' +
      '<div class="hkd-acts"><a class="hkd-open" href="' + URL + '" target="_blank" rel="noopener">Open Cash App</a><button type="button" class="hkd-x">Close</button></div></div>';
    M.addEventListener("click", function (e) { if (e.target === M || (e.target.closest && e.target.closest(".hkd-x"))) { e.preventDefault(); e.stopPropagation(); close(); } });
    (D.body || D.documentElement).appendChild(M);
    return M;
  }
  function open(from) {
    build(); prevFocus = from || D.activeElement;
    M.classList.toggle("tvm", isTV()); M.hidden = false;
    if (M.parentNode !== D.body && D.body) D.body.appendChild(M); else if (D.body && M !== D.body.lastElementChild) D.body.appendChild(M);
    var x = M.querySelector(".hkd-x"); try { x.focus(); } catch (e) {}
  }
  function close() {
    if (!M || M.hidden) return; M.hidden = true;
    try { if (prevFocus && prevFocus.focus && D.contains(prevFocus)) prevFocus.focus(); } catch (e) {}
  }
  function isOpen() { return !!(M && !M.hidden); }
  function go(from) { if (isTV()) return open(from); var w = null; try { w = W.open(URL, "_blank", "noopener"); } catch (e) {} if (!w) open(from); }
  // DONATE buttons: TV -> QR modal instead of leaving the app/site
  D.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest(".hkd-btn"); if (!a) return;
    e.stopPropagation();
    if (isTV()) { e.preventDefault(); open(a); }
  }, true);
  // modal keys first (window capture): OK on a control, Back/Esc closes, arrows move between the modal's controls; nothing leaks to the page's remote handler
  W.addEventListener("keydown", function (e) {
    if (!isOpen()) {
      var a = D.activeElement;
      if (a && a.classList && a.classList.contains("hkd-btn") && (e.key === "Enter" || e.keyCode === 13 || e.keyCode === 23) && isTV()) { e.preventDefault(); e.stopImmediatePropagation(); open(a); }
      return;
    }
    var k = e.key, kc = e.keyCode;
    e.stopImmediatePropagation();
    if (/^(Escape|Backspace|BrowserBack|GoBack|Back)$/.test(k) || kc === 4 || kc === 8 || kc === 27 || kc === 461 || kc === 10009) { e.preventDefault(); close(); return; }
    var c = [].slice.call(M.querySelectorAll(".hkd-acts a,.hkd-acts button")).filter(function (b) { return b.offsetParent !== null; });
    var i = c.indexOf(D.activeElement);
    if (/^Arrow/.test(k) || (kc >= 37 && kc <= 40) || k === "Tab") { e.preventDefault(); var n = c.length ? c[(i + ((k === "ArrowLeft" || k === "ArrowUp" || (k === "Tab" && e.shiftKey)) ? c.length - 1 : 1)) % c.length] : null; if (i < 0) n = c[c.length - 1]; try { n && n.focus(); } catch (x) {} return; }
    if (k === "Enter" || k === " " || kc === 13 || kc === 23) { e.preventDefault(); var t = c[i] || M.querySelector(".hkd-x"); if (t && t.classList.contains("hkd-x")) close(); else if (t) { try { W.open(URL, "_blank", "noopener"); } catch (x) {} } return; }
  }, true);
  // TV app Back buttons (native -> window.__tvnav.back / window.__cableBack): close the modal first
  function hookBack() {
    var n = W.__tvnav;
    if (n && n.back && !n.back.__hkd) { var ob = n.back; n.back = function () { if (isOpen()) { close(); return true; } return ob.apply(this, arguments); }; n.back.__hkd = 1; }
    var cb = W.__cableBack;
    if (cb && !cb.__hkd) { W.__cableBack = function () { if (isOpen()) { close(); return "handled"; } return cb.apply(this, arguments); }; W.__cableBack.__hkd = 1; }
  }
  if (isTV() || W.TVNative || W.CableNative) setInterval(hookBack, 500); else setTimeout(function () { if (W.__tvnav || W.__cableBack) setInterval(hookBack, 500); }, 3000);
  hookBack();
  W.HKDonate = { url: URL, tag: TAG, isTV: isTV, button: button, open: open, close: close, go: go, isOpen: isOpen };
})();
