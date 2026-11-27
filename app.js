/* WrestleWorld+ app. Data: catalog.json {series:[[brand,name,type]], v:[[id,title,secs,seriesIdx,year,date,kind]]},
   wrestlers.json [[name,[videoIdx..]]], channels.json {epoch, channels:[{id,name,desc,items:[videoIdx..],total}]}.
   Hash routes: #/ · #/promotions · #/b/<brand>[/<tab>] · #/s/<seriesIdx> · #/y/<brand>/<year> · #/search/<q> · #/w/<wrestlerIdx> · #/live[/<ch>] */
(function () {
  "use strict";
  var B = window.WW_BRANDS, ORDER = window.WW_ORDER, $ = function (s, r) { return (r || document).querySelector(s); };
  var CAT, V, S, WR, CH, EPOCH, NORM = [], SERIES_BY_BRAND = {}, BY_BRAND = {}, YT_READY = null;
  var app = $("#app"), sheet = $("#sheet");
  var UAS = navigator.userAgent || "";
  var IS_TV = !!window.TVNative || /AndroidTV-WebApp|AFT[A-Z]|BRAVIA|GoogleTV|Google TV|Android TV|SMART-TV|SmartTV|CrKey|Tizen|Web0S/i.test(UAS);
  var IS_IOS = /iPad|iPhone|iPod/.test(UAS) || (/Macintosh/.test(UAS) && navigator.maxTouchPoints > 1);
  if (IS_TV) document.documentElement.classList.add("tv");
  if (IS_IOS) document.documentElement.classList.add("ios");
  var KIND = { e: "Full Event", p: "Full Episode", m: "Full Match", s: "Special" }, KINDS = { e: "Full Events", p: "Full Episodes", m: "Full Matches", s: "Specials" };
  var ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
    tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 2l4 4 4-4"/></svg>'
  };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g, " ").trim(); }
  function dur(s) { s = Math.round(s || 0); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + "h " + (m < 10 ? "0" : "") + m + "m" : m + "m"; }
  function clock(s) { s = Math.max(0, Math.floor(s)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (x < 10 ? "0" : "") + x; }
  function fdate(v) {
    if (v[5]) { var p = v[5].split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
    return v[4] ? String(v[4]) : "Undated";
  }
  function tod(ts) { return new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  function thumb(id, hq) { return "https://i.ytimg.com/vi/" + id + "/" + (hq ? "hqdefault" : "mqdefault") + ".jpg"; }
  function brandOf(i) { return S[V[i][3]][0]; }
  function bvars(b) { var x = B[b]; return "--b1:" + x.b1 + ";--bink:" + (x.bink || "#fff") + ";--b1x:" + (x.b1x || x.b1) + ";--hbg:" + x.bg + (x.font ? ";--hfont:" + x.font : "") + (x.tt ? ";--htt:" + x.tt : "") + (x.ls ? ";--hls:" + x.ls : "") + (x.hw ? ";--hw:" + x.hw : ""); }
  function seed(n) { var t = n >>> 0; return function () { t += 0x6D2B79F5; var r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
  function pick(arr, n, rnd) { var a = arr.slice(), o = []; while (a.length && o.length < n) o.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return o; }
  function dayseed() { var d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

  /* ---------------- storage: continue watching + autoplay ---------------- */
  var LS = { get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  function cwAll() { return msess() && msess().access_token ? LS.get("ww_cw", {}) : {}; }
  function cwSave(id, t, d) {
    var c = cwAll();
    if (!signedIn()) return;
    if (d && t > d - 25) { if (c[id]) cwPush(id, 0, 0, true); delete c[id]; } else if (t > 20) { c[id] = { t: Math.floor(t), d: Math.floor(d || 0), at: Date.now() }; cwPush(id, t, d); }
    var ks = Object.keys(c).sort(function (a, b) { return c[b].at - c[a].at; }); ks.slice(40).forEach(function (k) { delete c[k]; });
    LS.set("ww_cw", c);
  }
  var IDX = {};
  function autoplayOn() { return LS.get("ww_auto", true); }

  /* ---------------- data ---------------- */
  function load() {
    var f = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }); };
    return Promise.all([f("catalog.json?v=" + window.WW_VER), f("wrestlers.json?v=" + window.WW_VER), f("channels.json?v=" + window.WW_VER)]).then(function (r) {
      CAT = r[0]; V = CAT.v; S = CAT.series; WR = r[1]; CH = r[2].channels; EPOCH = r[2].epoch;
      ORDER.forEach(function (b) { SERIES_BY_BRAND[b] = []; BY_BRAND[b] = []; });
      S.forEach(function (s, i) { s.push(0, 9999, 0, []); SERIES_BY_BRAND[s[0]].push(i); }); // s[3]=count s[4]=minY s[5]=maxY s[6]=videos
      for (var i = 0; i < V.length; i++) {
        var v = V[i], s = S[v[3]];
        IDX[v[0]] = i; s[3]++; s[6].push(i); if (v[4]) { if (v[4] < s[4]) s[4] = v[4]; if (v[4] > s[5]) s[5] = v[4]; }
        BY_BRAND[s[0]].push(i);
        NORM[i] = " " + norm(v[1] + " " + s[1] + " " + B[s[0]].name + " " + B[s[0]].full + " " + (v[4] || "")) + " ";
      }
      WR.forEach(function (w) { w.push(" " + norm(w[0]) + " "); });
      CH.forEach(function (c) { if (c.events) return; var acc = 0; c.starts = c.items.map(function (i) { var s = acc; acc += V[i][2]; return s; }); c.total = acc; });
    });
  }

  /* ---------------- shared bits ---------------- */
  function blogo(b, cls) { return '<img class="' + (cls || "") + '" src="' + B[b].logo + '" alt="' + esc(B[b].name) + '" loading="lazy">'; }
  function th(i, extra) {
    var v = V[i], b = brandOf(i), c = cwAll()[v[0]];
    return '<div class="th" style="' + bvars(b) + '"><img src="' + thumb(v[0]) + '" alt="" loading="lazy" onerror="this.style.opacity=0">' +
      (extra ? '<span class="bl">' + blogo(b) + "</span>" : "") + '<span class="dur">' + dur(v[2]) + "</span>" + '<span class="wlb' + (wlHas(v[0]) ? " on" : "") + '" data-wl="' + v[0] + '" role="button" aria-label="' + (wlHas(v[0]) ? "Remove from Watch Later" : "Save to Watch Later") + '"></span>' +
      (c && c.d ? '<span class="pg"><i style="width:' + Math.min(100, Math.round(c.t / c.d * 100)) + '%"></i></span>' : "") + "</div>";
  }
  function kb(k) { return '<span class="kb ' + k + '">' + KIND[k] + "</span>"; }
  function card(i, q) { var v = V[i]; return '<a class="vc" href="#" data-play="' + i + '"' + (q ? ' data-q="' + q + '"' : "") + ">" + th(i, true) + "<h3>" + esc(v[1]) + "</h3><p>" + esc(B[brandOf(i)].name) + " · " + esc(fdate(v)) + "</p></a>"; }
  function row(i, q, opts) {
    var v = V[i], o = opts || {};
    return '<a class="vr' + (o.cur ? " cur" : "") + '" href="#" data-play="' + i + '"' + (q ? ' data-q="' + q + '"' : "") + ">" + th(i, o.logo) + '<div class="tx"><h4>' + esc(v[1]) + "</h4><p>" + kb(v[6]) + "<span>" + esc(fdate(v)) + "</span>" + (o.series ? "<span>· " + esc(S[v[3]][1]) + "</span>" : "") + "</p></div></a>";
  }
  var QUEUES = {}, qn = 0;
  function queue(list) { var k = "q" + (++qn); QUEUES[k] = list; return k; }
  function yr(s) { return s[4] === 9999 ? "Undated" : (s[4] === s[5] ? s[4] : s[4] + "–" + s[5]); }
  function seriesCard(si, big) {
    var s = S[si], b = s[0], f = s[6][Math.floor(s[6].length / 2)];
    return '<a class="sc' + (big ? " big" : "") + '" href="#/s/' + si + '" style="' + bvars(b) + '">' + (big ? '<span class="thumbs"><img src="' + thumb(V[f][0]) + '" alt="" loading="lazy" onerror="this.remove()"></span>' : "") +
      "<div><h3>" + esc(s[1]) + '</h3></div><p><span class="yr">' + yr(s) + "</span><br>" + s[3].toLocaleString() + " video" + (s[3] === 1 ? "" : "s") + "</p></a>";
  }
  function setTitle(t) { document.title = t ? t + " · WrestleWorld+" : "WrestleWorld+ · Every promotion. One place."; }
  function nav(on) { document.querySelectorAll("[data-nav]").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-nav") === on); }); }

  /* ---------------- channels: deterministic clock schedule ---------------- */
  function chNow(c, t) {
    t = t == null ? Date.now() / 1000 : t;
    var pos = ((t - EPOCH) % c.total + c.total) % c.total, lo = 0, hi = c.items.length - 1;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (c.starts[m] <= pos) lo = m; else hi = m - 1; }
    var off = pos - c.starts[lo];
    return { k: lo, i: c.items[lo], off: off, left: V[c.items[lo]][2] - off, began: t - off };
  }
  function chById(id) { if (id === "wwe-eotn" || id === "tna-eotn") id = "ww-eotn";  // 2026-11-27: the two EOTN channels merged into WrestleWorld+ Event of the Night
    for (var i = 0; i < CH.length; i++) if (CH[i].id === id) return CH[i]; return CH[0]; }
  /* ---------------- Event of the Night: scheduled channels (same schedule + timing as WWE Unlimited / TNA Stream) ---------------- */
  // events: [startUnix (entry 'time' ET, default 8 PM, + part offset), videoId, title, secs, posterTitle, posterSub, promotionBrand]
  function evNow(c, t) { t = t == null ? Date.now() / 1000 : t; for (var i = 0; i < c.events.length; i++) { var e = c.events[i]; if (e[0] <= t && t < e[0] + e[3]) return e; } return null; }
  function evNext(c, t) { t = t == null ? Date.now() / 1000 : t; for (var i = 0; i < c.events.length; i++) if (c.events[i][0] > t) return c.events[i]; return null; }
  function etDk(x) { return new Date(x * 1000).toLocaleDateString("en-US", { timeZone: "America/New_York" }); }
  function etTime(x) { try { return new Date(x * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET"; } catch (e) { return tod(x); } }
  function etDay(x) {
    var n = Date.now() / 1000;
    try { if (etDk(x) === etDk(n)) return "Tonight"; if (etDk(x) === etDk(n + 86400)) return "Tomorrow";
      return new Date(x * 1000).toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" }); } catch (e) { return ""; }
  }
  function evPromo(e) { return e && e[6] && B[e[6]] ? e[6] : null; }  // promotion of a pick (WWE / TNA ...), from the schedule's "brand"
  function evKick(e) { var p = evPromo(e); return "Event of the Night" + (p ? " \u00b7 " + B[p].name : ""); }
  function evIdle(c) {  // no pick on the air and none scheduled: "That's a wrap" after tonight's pick ended, else "No event tonight"
    var now = Date.now() / 1000, wrap = c.events.some(function (x) { return x[0] + x[3] <= now && etDk(x[0]) === etDk(now - 6 * 3600) && now - x[0] < 86400; });
    return wrap ? { h: "That\u2019s a wrap for tonight", p: "The next Event of the Night will be announced soon" }
                : { h: "No event tonight", p: "Event of the Night usually airs at 8:00 PM ET \u00b7 next pick coming soon" };
  }
  function evMetaLogo(c, e) { var p = evPromo(e); return p ? blogo(p).replace("<img", '<img style="height:18px;width:auto;max-width:70px;object-fit:contain"') : blogo(c.brand).replace("<img", '<img style="height:26px;width:auto;max-width:110px;object-fit:contain"'); }
  function evTitle(e) { return e[4] || String(e[2]).replace(/\s+\u00b7\s+Part\s.*$/, ""); }
  function evSub(e) { return e[4] && !e[5] ? e[2] : e[5]; }
  function evPoster(e) { return "https://i.ytimg.com/vi/" + e[1] + "/hqdefault.jpg"; }
  function evState(c) {  // {live, ev, next, label, cd}
    var t = Date.now() / 1000, ev = evNow(c, t), nx = evNext(c, t);
    if (ev) return { live: true, ev: ev, next: nx, off: t - ev[0], left: ev[0] + ev[3] - t };
    return { live: false, ev: nx, next: nx, cd: nx ? nx[0] - t : 0, label: nx ? "Coming " + etDay(nx[0]).replace("Tonight", "tonight").replace("Tomorrow", "tomorrow") + " at " + etTime(nx[0]) : "Next Event of the Night coming soon" };
  }
  function evCard(c) {
    var st = evState(c), e = st.ev, b = c.brand, x = B[b];
    var art = ' style="' + bvars(b) + ';background-image:' + (e ? "url(" + evPoster(e) + ")," : "") + "linear-gradient(135deg," + x.b1 + ',#0B0B16 70%)"';
    var idle = e ? null : evIdle(c);
    return '<a class="lc eotn ch-' + c.id + '" href="#/live/' + c.id + '" data-ch="' + c.id + '" style="' + bvars(b) + '"><div class="art"' + art + '><span class="tag">' + (st.live ? '<i class="dot"></i>Live · ' : "") + esc(evKick(e)) + "</span>" + blogo(b, "evlogo") +
      '<div class="chn"><b>' + esc(c.name) + "</b><small>" + (e ? (st.live ? "Now: " : (etDay(e[0]) === "Tonight" ? "Tonight: " : etDay(e[0]) + ": ")) + esc(evTitle(e)) : esc(idle.h)) + '</small></div></div><div class="bar"><i style="width:' + (st.live ? Math.round(st.off / e[3] * 100) : 0) + '%"></i></div><div class="nx">' +
      (st.live ? "<b>On the air</b> · ends " + etTime(e[0] + e[3]) : "<b>" + esc(st.label) + "</b>" + (st.cd ? ' · <span data-evcd="' + e[0] + '">starts in ' + clock(st.cd) + "</span>" : "")) + "</div></a>";
  }
  function liveCard(c) {
    if (c.events) return evCard(c);
    var n = chNow(c), v = V[n.i], nx = V[c.items[(n.k + 1) % c.items.length]];
    var art = ' style="background-image:' + (c.id === "network" ? "radial-gradient(120% 90% at 0% 0%,#22E4FF55,transparent 55%),radial-gradient(120% 90% at 100% 100%,#FF3D7F55,transparent 55%)," : "") + "url(" + thumb(v[0], 1) + '),linear-gradient(135deg,' + B[brandOf(n.i)].b1 + ',#0B0B16 70%)"';
    return '<a class="lc ch-' + c.id + '" href="#/live/' + c.id + '" data-ch="' + c.id + '"><div class="art"' + art + '><span class="tag"><i class="dot"></i>Live · ' + esc(c.name) + '</span><div class="chn"><b>' + esc(c.name) + "</b><small>Now: " + esc(v[1]) + '</small></div></div><div class="bar"><i style="width:' + Math.round(n.off / v[2] * 100) + '%"></i></div><div class="nx"><b>Next ' + tod(Date.now() / 1000 + n.left) + "</b> · " + esc(nx[1]) + "</div></a>";
  }

  /* ---------------- members: shared Supabase accounts (same as Blockbuster+ / WWE Unlimited / TNA Stream / WatchUFC) ----------------
     Session lives in localStorage "hvplus_session" on this origin, so a member signed in on the old sites is already signed in here.
     Members unlock Continue Watching + Watch Later (synced: public.ww_continue / public.ww_watch_later, own rows only; localStorage is the cache)
     and live chat on the channels (public.comments site='ww', video_key='live:<channel>'). */
  var SB = "https://cubbuiahnhgfpdeubldu.supabase.co", SBK = "sb_publishable_Sj8SNl5Zi0AwjxsIrNGNtQ_B--yHhYi", SKEY = "hvplus_session", PHONE_DOMAIN = "phone.blockbuster-plus.app";
  var M = { after: null, msg: "", sync: 0, cwPush: {} };
  function msess() { try { return JSON.parse(localStorage.getItem(SKEY) || "null"); } catch (e) { return null; } }
  function msave(s) { try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch (e) {} }
  function signedIn() { var s = msess(); return !!(s && s.access_token && s.user && s.user.id); }
  function muser() { var s = msess(); return (s && s.user) || {}; }
  function mname() { var u = muser(), m = u.user_metadata || {}, e = u.email || ""; return m.display_name || (/@phone\./.test(e) ? "Member" : e.split("@")[0]) || "Member"; }
  function mwho() { var e = muser().email || ""; return /@phone\.blockbuster-plus\.app$/.test(e) ? "+" + e.slice(1, e.indexOf("@")) : e; }
  function sbPost(path, body) {
    return fetch(SB + path, { method: "POST", headers: { apikey: SBK, "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.text().then(function (t) { var j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) {} if (!r.ok) { var er = new Error(j.msg || j.error_description || j.message || ("Error " + r.status)); er.code = j.error_code || j.code; throw er; } return j; }); });
  }
  function setSess(x) {
    var s = x && x.session && x.session.access_token ? x.session : x;
    if (!s || !s.access_token) return false;
    msave({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: s.user || x.user });
    return true;
  }
  function mtoken() {
    var s = msess(); if (!s || !s.access_token) return Promise.resolve(null);
    if ((s.expires_at || 0) - Date.now() / 1000 > 60) return Promise.resolve(s);
    return sbPost("/auth/v1/token?grant_type=refresh_token", { refresh_token: s.refresh_token }).then(function (j) { return setSess(j) ? msess() : null; }, function (e) {
      if (/invalid|not found|revoked|expired/i.test(String(e.message) + e.code)) { msave(null); mcheck(); }
      return null;
    });
  }
  function sbRest(method, path, body, prefer) {
    return mtoken().then(function (s) {
      if (!s) throw new Error("signin");
      return fetch(SB + "/rest/v1/" + path, { method: method, headers: { apikey: SBK, Authorization: "Bearer " + s.access_token, "Content-Type": "application/json", Prefer: prefer || "return=minimal" }, body: body ? JSON.stringify(body) : undefined })
        .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.status === 204 ? null : r.text().then(function (t) { return t ? JSON.parse(t) : null; }); });
    });
  }
  function toEmail(id) {
    id = String(id || "").trim();
    if (id.indexOf("@") > 0) return { email: id.toLowerCase(), phone: "" };
    var dg = id.replace(/\D/g, ""); if (dg.length === 10) dg = "1" + dg; if (dg.length < 11) return null;
    return { email: "p" + dg + "@" + PHONE_DOMAIN, phone: "+" + dg };
  }
  function friendly(e) {
    var m = String(e && e.message || ""), c = String(e && e.code || "");
    if (/invalid_credentials|Invalid login/i.test(c + m)) return "That email/phone and password don't match.";
    if (/already|exists|registered/i.test(c + m)) return "That email or phone already has an account. Sign in instead.";
    if (/weak|least 6|password/i.test(c + m)) return "Password needs at least 6 characters.";
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Can't reach the server. Check your connection.";
    return m || "Something went wrong. Try again.";
  }
  function mcheck() {  // a different (or no) member on this device: drop the other member's cached lists
    var id = signedIn() ? muser().id : "";
    if (LS.get("ww_uid", "") !== id) { LS.set("ww_cw", {}); LS.set("ww_wl", []); LS.set("ww_uid", id); }
    updAcct();
  }
  function updAcct() {
    var hd = $("header.top .wrap"); if (!hd) return;
    var a = $("a.acct", hd);
    if (!a) { hd.insertAdjacentHTML("beforeend", '<a class="acct" href="#/account"></a>'); a = $("a.acct", hd); var ib = $("a.ib", hd); if (ib) hd.insertBefore(a, ib); }
    if (signedIn()) { a.innerHTML = "<i>" + esc(mname().charAt(0).toUpperCase()) + "</i><span>" + esc(mname()) + "</span>"; a.setAttribute("aria-label", "Account: " + mname()); a.classList.add("in"); }
    else { a.innerHTML = "<span>Sign in</span>"; a.setAttribute("aria-label", "Sign in or sign up"); a.classList.remove("in"); }
  }
  function askSignIn(why) { M.msg = why || ""; M.after = location.hash || "#/"; location.hash = "#/account"; }
  function unlockCard(what) {
    return '<section class="sec unlock"><div class="unl"><b>Sign up free to unlock ' + esc(what || "Continue Watching, Watch Later and live chat") + '</b><p>Same account as WWE Unlimited, TNA Stream and Blockbuster+. Free, no card.</p><div class="acts"><a class="btn" href="#/account" data-auth="up">Sign up free</a><a class="btn gh" href="#/account" data-auth="in">Sign in</a></div></div></section>';
  }
  /* --- Watch Later + Continue Watching sync --- */
  function wlAll() { return signedIn() ? LS.get("ww_wl", []) : []; }
  function wlHas(id) { return wlAll().some(function (x) { return x.id === id; }); }
  function wlToggle(id) {
    if (!signedIn()) { askSignIn("Watch Later"); return; }
    var l = LS.get("ww_wl", []), on = l.some(function (x) { return x.id === id; });
    if (on) { l = l.filter(function (x) { return x.id !== id; }); sbRest("DELETE", "ww_watch_later?video_id=eq." + encodeURIComponent(id)).catch(function () {}); }
    else { l.unshift({ id: id, at: Date.now() }); sbRest("POST", "ww_watch_later?on_conflict=user_id,video_id", { video_id: id, added_at: new Date().toISOString() }, "resolution=merge-duplicates,return=minimal").catch(function () {}); }
    LS.set("ww_wl", l.slice(0, 300));
    document.querySelectorAll('[data-wl="' + id + '"]').forEach(wlPaint);
    return !on;
  }
  function wlPaint(b) {
    var on = wlHas(b.getAttribute("data-wl"));
    b.classList.toggle("on", on);
    if (b.classList.contains("chip")) b.innerHTML = (on ? "✓ Saved to Watch Later" : "＋ Watch Later");
    b.setAttribute("aria-label", on ? "Remove from Watch Later" : "Save to Watch Later");
  }
  function cwPush(id, t, d, gone) {
    if (!signedIn()) return;
    if (gone) { sbRest("DELETE", "ww_continue?video_id=eq." + encodeURIComponent(id)).catch(function () {}); return; }
    var now = Date.now(); if (now - (M.cwPush[id] || 0) < 15000) return; M.cwPush[id] = now;
    sbRest("POST", "ww_continue?on_conflict=user_id,video_id", { video_id: id, pos: Math.floor(t), dur: Math.floor(d || 0), updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=minimal").catch(function () {});
  }
  function msync() {
    if (!signedIn()) return Promise.resolve(false);
    var n = ++M.sync;
    return Promise.all([sbRest("GET", "ww_watch_later?select=video_id,added_at&order=added_at.desc&limit=300"), sbRest("GET", "ww_continue?select=video_id,pos,dur,updated_at&order=updated_at.desc&limit=40")]).then(function (r) {
      if (n !== M.sync || !signedIn()) return false;
      var before = JSON.stringify([LS.get("ww_wl", []), LS.get("ww_cw", {})]);
      LS.set("ww_wl", (r[0] || []).map(function (x) { return { id: x.video_id, at: Date.parse(x.added_at) }; }));
      var c = LS.get("ww_cw", {});
      (r[1] || []).forEach(function (x) { var at = Date.parse(x.updated_at); if (!c[x.video_id] || c[x.video_id].at < at) c[x.video_id] = { t: x.pos, d: x.dur, at: at }; });
      LS.set("ww_cw", c);
      return before !== JSON.stringify([LS.get("ww_wl", []), LS.get("ww_cw", {})]);
    }, function () { return false; });
  }
  window.WW_M = { cwSave: function (a, b, c) { cwSave(a, b, c); }, msync: function () { return msync(); }, wlToggle: function (id) { return wlToggle(id); }, rest: function (m, p, b, pr) { return sbRest(m, p, b, pr); } };  // test hooks
  function afterSync(changed) {
    var r = route()[0] || "";
    if (!changed || !sheet.hidden || P.mode) return;
    if (r === "" || r === "home" || r === "later") { var f = tvCur(), k = focusKey(f), y = window.scrollY; if (r === "later") viewLater(); else viewHome(); window.scrollTo(0, y); if (IS_TV) tvFocus(findKey(k, app) || firstContent()); }
  }
  /* --- account page --- */
  function viewAccount(mode) {
    setTitle("Account"); nav("");
    if (signedIn()) {
      app.innerHTML = '<div class="wrap"><div class="sp-h"><span class="kick">Member</span><h1>' + esc(mname()) + '</h1><p>' + esc(mwho()) + '</p></div><div class="acctbox"><p>You\'re signed in. Continue Watching and Watch Later sync across your devices, and you can chat on Live TV.</p><div class="acts"><a class="btn" href="#/later">Watch Later</a><a class="btn gh" href="#/live">Live TV chat</a><button class="btn gh" data-signout>Sign out</button></div></div>' + foot() + "</div>";
      return;
    }
    var up = mode !== "in";
    app.innerHTML = '<div class="wrap"><form class="authf" novalidate><span class="kick">' + (M.msg ? "Members only · " + esc(M.msg) : "WrestleWorld+ members") + "</span><h1>" + (up ? "Sign up free" : "Sign in") + "</h1><p>" +
      (up ? "Unlock Continue Watching, Watch Later and live chat on every channel. Free, no card." : "Welcome back. Your WWE Unlimited, TNA Stream or Blockbuster+ account works here too.") + "</p>" +
      (up ? '<label for="au-name">Display name</label><input id="au-name" autocomplete="nickname" maxlength="40">' : "") +
      '<label for="au-id">Email or phone number</label><input id="au-id" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false" required>' +
      (up ? '<label for="au-ph">Phone (optional, if you used email above)</label><input id="au-ph" type="tel" autocomplete="tel">' : "") +
      '<label for="au-pw">Password</label><input id="au-pw" type="password" autocomplete="' + (up ? "new-password" : "current-password") + '" minlength="6" required>' +
      '<div class="err" role="alert"></div><button class="btn go" type="submit">' + (up ? "Create free account" : "Sign in") + "</button>" +
      '<p class="sw">' + (up ? 'Already a member? <a href="#/account" data-auth="in">Sign in</a>' : 'New here? <a href="#/account" data-auth="up">Sign up free</a>') + "</p></form>" + foot() + "</div>";
    var f = $("form.authf"), err = $(".err", f), go = $(".go", f);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault(); err.textContent = "";
      var who = toEmail($("#au-id", f).value), pw = $("#au-pw", f).value;
      if (!who) { err.textContent = "Enter an email or a full phone number with area code."; return; }
      if (pw.length < 6) { err.textContent = "Password needs at least 6 characters."; return; }
      go.disabled = true; go.textContent = up ? "Creating…" : "Signing in…";
      var p;
      if (up) {
        var nm = ($("#au-name", f).value || "").trim(), ph = ($("#au-ph", f).value || "").trim() || who.phone;
        p = sbPost("/auth/v1/signup", { email: who.email, password: pw, data: { display_name: nm || (who.phone ? "Member" : who.email.split("@")[0]), phone: ph, signup_site: "wrestleworld" } })
          .then(function (j) { if (setSess(j)) return msess(); return sbPost("/auth/v1/token?grant_type=password", { email: who.email, password: pw }); });
      } else p = sbPost("/auth/v1/token?grant_type=password", { email: who.email, password: pw });
      p.then(function (j) {
        if (j && j.access_token && !signedIn()) setSess(j);
        if (!signedIn()) throw new Error("Couldn't sign in.");
        mcheck(); var to = M.after && M.after !== "#/account" ? M.after : "#/"; M.after = null; M.msg = "";
        msync().then(function () { if (location.hash === to) render(); else location.hash = to; });
      }, function (e) { err.textContent = friendly(e); go.disabled = false; go.textContent = up ? "Create free account" : "Sign in"; });
    });
    if (IS_TV) setTimeout(function () { tvFocus($("input", f)); }, 60);
  }
  function signOut() {
    var s = msess();
    if (s && s.access_token) fetch(SB + "/auth/v1/logout", { method: "POST", headers: { apikey: SBK, Authorization: "Bearer " + s.access_token } }).catch(function () {});
    msave(null); mcheck(); location.hash = "#/";
  }
  function viewLater() {
    setTitle("Watch Later"); nav("home");
    if (!signedIn()) { app.innerHTML = '<div class="wrap"><div class="sp-h"><span class="kick">Members</span><h1>Watch Later</h1><p>Save videos to watch later on any device.</p></div>' + unlockCard("Watch Later") + foot() + "</div>"; return; }
    var l = wlAll().map(function (x) { return IDX[x.id]; }).filter(function (i) { return i != null; }), q = queue(l);
    app.innerHTML = '<div class="wrap"><div class="sp-h"><span class="kick">' + esc(mname()) + '</span><h1>Watch Later</h1><p>' + l.length + " saved video" + (l.length === 1 ? "" : "s") + ". Tap ✓ on a video to remove it.</p></div>" +
      (l.length ? '<div class="tools"><button class="chip" data-playq="' + q + '">' + ICON.play.replace("<svg", '<svg width="14" height="14"') + 'Play all</button></div><div class="vl cols">' + l.map(function (i) { return row(i, q, { logo: 1, series: 1 }); }).join("") + "</div>"
        : '<div class="empty">Nothing saved yet. Use “＋ Watch Later” in the player or the bookmark on any video.</div>') + foot() + "</div>";
  }
  /* --- live chat (all 6 channels) --- */
  var CHAT = { key: null, t: null, last: {}, busy: false };
  function chatHtml(c) {
    return '<section class="chat" id="lchat" aria-label="Live chat"><h3><span class="lvb">LIVE</span>Live chat <small>' + esc(c.name) + '</small></h3><ul aria-live="polite"><li class="empty">Loading chat…</li></ul>' +
      (signedIn() ? '<form class="chatf"><input maxlength="300" placeholder="Say something…" aria-label="Chat message" enterkeyhint="send"><button class="btn go" type="submit">Send</button></form><div class="err" role="alert"></div>'
        : '<div class="unl small"><b>Sign up free to chat</b><p>Anyone can read. Members can post.</p><div class="acts"><a class="btn" href="#/account" data-auth="up">Sign up free</a><a class="btn gh" href="#/account" data-auth="in">Sign in</a></div></div>') + "</section>";
  }
  function chatStart(c) {
    clearInterval(CHAT.t); CHAT.key = "live:" + c.id; CHAT.last = {};
    var box = $("#lchat"); if (!box) return;
    var f = $("form.chatf", box);
    if (f) f.addEventListener("submit", function (ev) {
      ev.preventDefault(); var inp = $("input", f), v = (inp.value || "").trim(), er = $(".err", box); if (!v) return;
      er.textContent = ""; inp.disabled = true;
      sbRest("POST", "comments", { site: "ww", video_key: CHAT.key, body: v }, "return=representation").then(function () { inp.value = ""; inp.disabled = false; chatPoll(); },
        function (e) { inp.disabled = false; er.textContent = /signin/.test(e.message) ? "Please sign in again." : "Couldn't send. Try again."; });
    });
    chatPoll(); CHAT.t = setInterval(function () { if (!$("#lchat")) { clearInterval(CHAT.t); return; } if (!document.hidden) chatPoll(); }, 5000);
  }
  function chatPoll() {
    var box = $("#lchat"), key = CHAT.key; if (!box || CHAT.busy) return; CHAT.busy = true;
    var q = SB + "/rest/v1/comments?select=id,user_id,display_name,body,created_at&site=eq.ww&video_key=eq." + encodeURIComponent(key) + "&order=created_at.desc&limit=60";
    mtoken().then(function (s) { return fetch(q, { headers: { apikey: SBK, Authorization: "Bearer " + (s ? s.access_token : SBK) } }); })
      .then(function (r) { return r.ok ? r.json() : []; }, function () { return null; })
      .then(function (l) {
        CHAT.busy = false; if (!l || key !== CHAT.key || !document.contains(box)) return;
        var ul = $("ul", box), me = signedIn() ? muser().id : null, atEnd = ul.scrollTop + ul.clientHeight >= ul.scrollHeight - 30;
        l = l.reverse(); var ids = l.map(function (x) { return x.id; }).join(",");
        if (ids === CHAT.ids) return; CHAT.ids = ids;
        ul.innerHTML = l.length ? l.map(function (c) { return '<li data-id="' + c.id + '"><b>' + esc(c.display_name) + "</b> " + esc(c.body) + (c.user_id === me ? ' <button class="cx" data-cdel="' + c.id + '" aria-label="Delete my message">✕</button>' : "") + "</li>"; }).join("")
          : '<li class="empty">No messages yet. Say hi!</li>';
        if (atEnd || !CHAT.scrolled) { ul.scrollTop = ul.scrollHeight; CHAT.scrolled = true; }
      });
  }

  /* ---------------- Home hero carousel (2026-11-18): EOTN WWE/TNA (+ next night), Recently Added, featured ---------------- */
  function ytImg(id, cls) {  // maxres with hq fallback (also when YouTube answers maxres with its 120px grey placeholder)
    var hq = thumb(id, 1);
    return '<img class="' + (cls || "") + '" src="https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg" alt="" loading="eager" onerror="this.onerror=null;this.src=\'' + hq + '\'" onload="if(this.naturalWidth&&this.naturalWidth<=120){this.onload=null;this.src=\'' + hq + '\'}">';
  }
  function newest(n) {
    var ak = function (i) { var a = V[i][7] || "", d = V[i][5] || ""; return a > d ? a : d; };  // v[7] = date added by the gap crawl (2026-11-20)
    var l = V.map(function (v, i) { return i; }).filter(function (i) { return ak(i) && V[i][6] !== "s"; });
    l.sort(function (a, c) { return ak(c).localeCompare(ak(a)) || (V[c][7] ? 1 : 0) - (V[a][7] ? 1 : 0) || V[c][2] - V[a][2]; });
    return l.slice(0, n);
  }
  function evNextNights(c, max) {  // upcoming nights after the current/upcoming one: first pick of each later ET day (data-driven from the schedule)
    var now = Date.now() / 1000, cur = null, L = c.events, out = [], seen = {};
    for (var k = 0; k < L.length; k++) if (now < L[k][0] + L[k][3]) { cur = L[k]; break; }
    if (!cur) return out;
    seen[etDk(cur[0])] = 1;
    for (k = 0; k < L.length && out.length < (max || 2); k++) if (L[k][0] > cur[0] && !seen[etDk(L[k][0])]) { seen[etDk(L[k][0])] = 1; out.push(L[k]); }
    return out;
  }
  function evNextNight(c) { return evNextNights(c, 1)[0] || null; }
  function etHr(x) { return etTime(x).replace(":00 ", " "); }  // "8 PM ET"
  function vlrQueue() { return (window.WW_VLR || []).map(function (id) { return IDX[id]; }).filter(function (i) { return i != null; }); }
  function brandRecent(b) { var l = BY_BRAND[b].filter(function (i) { return V[i][5] && V[i][2] >= 900; }); l.sort(function (a, c) { return V[c][5].localeCompare(V[a][5]); }); return l[0] != null ? l[0] : BY_BRAND[b][0]; }
  function carSlides() {
    var out = [];
    ["ww-eotn"].forEach(function (id) {
      var c = null; CH.forEach(function (x) { if (x.id === id) c = x; }); if (!c || !c.events) return;
      var st = evState(c), e = st.ev, b = c.brand;
      if (e) out.push({ b: b, img: ytImg(e[1]), logo: 1, tag: (st.live ? '<i class="dot"></i>Live now · ' : "") + esc(evKick(e)),
        title: evTitle(e), sub: (evSub(e) ? evSub(e) + " · " : "") + (st.live ? "On the air now on " + c.name + ". Jump in where everyone else is." : etDay(e[0]) + " at " + etTime(e[0]) + " on " + c.name + ". One event, one night, everyone watching together."),
        badge: st.live ? "● LIVE NOW" : etDay(e[0]) + " · " + etTime(e[0]), btn: st.live ? "Watch live" : "Tune in", act: 'data-ch="' + id + '"', live: st.live });
      if (e) evNextNights(c, 2).forEach(function (nx) { var wd = etDay(nx[0]); out.push({ b: b, img: ytImg(nx[1]), logo: 1, tag: "Coming " + wd + " \u00b7 " + etHr(nx[0]) + (evPromo(nx) ? " \u00b7 " + B[evPromo(nx)].name : ""), title: evTitle(nx),
        sub: (evSub(nx) ? evSub(nx) + " \u00b7 " : "") + wd + " at " + etTime(nx[0]) + " on " + c.name + ".", badge: "Coming " + wd, btn: "See the schedule", act: 'href="#/live/' + id + '"', nextNight: 1 }); });
    });
    var nw = newest(40), qn = queue(nw), brs = [];
    nw.slice(0, 12).forEach(function (i) { var n = B[brandOf(i)].name; if (brs.indexOf(n) < 0) brs.push(n); });
    if (nw.length) out.push({ b: brandOf(nw[0]), img: ytImg(V[nw[0]][0]), tag: "Recently added", title: "Recently Added", sub: "The newest full shows and matches from " + brs.slice(0, 4).join(", ") + (brs.length > 4 ? " and more" : "") + ". Newest first: " + V[nw[0]][1], badge: "New this week", btn: "Play newest", act: 'data-playq="' + qn + '"', btn2: ["See all", "#/new"] });
    var vq = vlrQueue();
    if (vq.length) out.push({ b: "wwe", img: '<img src="vlr_poster.jpg?v=' + window.WW_VER + '" alt="" loading="eager" onerror="this.onerror=null;this.src=\'' + thumb("D8uVqJzqxDQ", 1) + '\'">', tag: "Featured playlist", title: "Viva La Raza", sub: "Eddie Guerrero's greatest matches. " + vq.length + " full matches, 1989 to 2005, free and official.", badge: vq.length + " full matches", btn: "Play Viva La Raza", act: 'data-playq="' + queue(vq) + '"', btn2: ["Eddie Guerrero", "#/search/" + encodeURIComponent("Eddie Guerrero")] });
    [["njpw", "New hub", "New Japan Pro-Wrestling is here: Wrestle Kingdom, G1 Climax and more, in English and Japanese."], ["aaa", "New hub", "Lucha Libre AAA: Triplemanía, weekly shows and full luchas from Mexico."], ["nxt", "Now its own hub", "NXT, from TakeOver to Stand & Deliver, with its own hub."]].forEach(function (f) {
      if (!BY_BRAND[f[0]] || !BY_BRAND[f[0]].length) return; var i = brandRecent(f[0]);
      out.push({ b: f[0], img: ytImg(V[i][0]), logo: 1, tag: f[1], title: B[f[0]].full || B[f[0]].name, sub: f[2] + " " + BY_BRAND[f[0]].length.toLocaleString() + " videos.", badge: BY_BRAND[f[0]].length.toLocaleString() + " videos", btn: "Open " + B[f[0]].name + " hub", act: 'href="#/b/' + f[0] + '"', btn2: ["Shuffle", null, 'data-shuffle="' + f[0] + '"'] });
    });
    var net = chById("network"), n = chNow(net), v = V[n.i];
    out.push({ b: brandOf(n.i), img: ytImg(v[0]), tag: '<i class="dot"></i>Live 24/7', title: net.name, sub: "Every promotion, around the clock. Now: " + v[1], badge: "On now", btn: "Watch " + net.name, act: 'data-ch="network"', live: 1 });
    return out;
  }
  var CAR = { i: 0, n: 0, t: null, hold: false };
  function carHtml() {
    var sl = carSlides(); CAR.n = sl.length; if (CAR.i >= CAR.n) CAR.i = 0;
    return '<section class="car" id="car" aria-roledescription="carousel" aria-label="Featured"><div class="car-track" style="transform:translateX(' + (-CAR.i * 100) + '%)">' + sl.map(function (s, k) {
      return '<div class="slide' + (k === CAR.i ? " on" : "") + '"' + (k === CAR.i ? "" : " inert") + ' style="' + bvars(s.b) + '" aria-roledescription="slide" aria-label="' + (k + 1) + " of " + sl.length + '"><div class="sbg">' + s.img + '</div><div class="sfade"></div><div class="stx">' +
        (s.logo ? blogo(s.b, "slogo") : "") + '<span class="stag">' + s.tag + "</span><h2>" + esc(s.title) + "</h2><p>" + esc(s.sub) + '</p><div class="sacts"><a class="btn car-btn' + (s.live ? " live" : "") + '" ' + (s.act.indexOf("href=") === 0 ? s.act : 'href="#" ' + s.act) + ">" + ICON.play + esc(s.btn) + "</a>" +
        (s.btn2 ? '<a class="btn gh" ' + (s.btn2[2] ? 'href="#" ' + s.btn2[2] : 'href="' + s.btn2[1] + '"') + ">" + esc(s.btn2[0]) + "</a>" : "") + '<span class="sbadge">' + esc(s.badge) + "</span></div></div></div>";
    }).join("") + '</div><button class="car-arr prev" data-car="-1" aria-label="Previous slide">' + ICON.back + '</button><button class="car-arr next" data-car="1" aria-label="Next slide">' + ICON.back + '</button><div class="car-dots">' +
      sl.map(function (s, k) { return '<button class="cdot' + (k === CAR.i ? " on" : "") + '" data-cardot="' + k + '" aria-label="Slide ' + (k + 1) + '"></button>'; }).join("") + "</div></section>";
  }
  function carGo(k, focusBtn) {
    var c = $("#car"); if (!c || !CAR.n) return;
    CAR.i = ((k % CAR.n) + CAR.n) % CAR.n;
    $(".car-track", c).style.transform = "translateX(" + (-CAR.i * 100) + "%)";
    c.querySelectorAll(".slide").forEach(function (s, j) { s.classList.toggle("on", j === CAR.i); if (j === CAR.i) s.removeAttribute("inert"); else s.setAttribute("inert", ""); });
    c.querySelectorAll(".cdot").forEach(function (d, j) { d.classList.toggle("on", j === CAR.i); });
    c.scrollLeft = 0;
    if (focusBtn) tvFocus(c.querySelectorAll(".slide")[CAR.i].querySelector(".car-btn"));
    c.scrollLeft = 0;
    carTimer();
  }
  function carTimer() {
    clearTimeout(CAR.t);
    CAR.t = setTimeout(function () {
      var c = $("#car"); if (!c) return;
      var f = tvCur(), focusedIn = f && c.contains(f);
      if (CAR.hold || focusedIn || document.hidden || !sheet.hidden) return carTimer();
      carGo(CAR.i + 1);
    }, 7000);
  }
  function carInit() {
    var c = $("#car"); if (!c) return;
    if (IS_TV) c.querySelectorAll(".car-arr,.cdot").forEach(function (b) { b.setAttribute("inert", ""); b.tabIndex = -1; });  // TV: D-pad Left/Right on the slide button pages the carousel
    var x0 = null, y0 = 0;
    c.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; CAR.hold = true; }, { passive: true });
    c.addEventListener("touchend", function (e) {
      CAR.hold = false; if (x0 == null) return; var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) carGo(CAR.i + (dx < 0 ? 1 : -1));
    }, { passive: true });
    c.addEventListener("mouseenter", function () { CAR.hold = true; }); c.addEventListener("mouseleave", function () { CAR.hold = false; });
    carTimer();
  }
  function viewNew() {
    setTitle("Recently Added"); nav("home");
    var l = newest(120), q = queue(l);
    app.innerHTML = '<div class="wrap"><div class="sp-h"><span class="kick">Newest first</span><h1>Recently Added</h1><p>The newest full shows, events and matches across every promotion.</p></div><div class="tools"><button class="chip" data-playq="' + q + '">' + ICON.play.replace("<svg", '<svg width="14" height="14"') + 'Play all</button></div><div class="vl cols">' + l.map(function (i) { return row(i, q, { logo: 1, series: 1 }); }).join("") + "</div>" + foot() + "</div>";
  }

  /* ---------------- views ---------------- */
  function viewHome() {
    setTitle(""); nav("home");
    var rnd = seed(dayseed()), h = "";
    var total = V.length, hrs = Math.round(V.reduce(function (a, v) { return a + v[2]; }, 0) / 3600);
    h += '<div class="wrap">' + carHtml() + '<section class="hero"><div class="glow"></div><img class="hlogo" src="logo.svg" alt="WrestleWorld+" width="895" height="180"><span class="kick">' + ORDER.length + ' promotions · one place</span><h1>Every promotion.<br><span>Every era.</span></h1><p>Free, official full matches, shows and pay-per-views from WWE to NJPW — organized by name and year, searchable by wrestler, with 24/7 channels plus the WrestleWorld+ Event of the Night, one hand-picked full event every night.</p>' +
      '<div class="stats"><div><b>' + total.toLocaleString() + "</b>videos</div><div><b>" + hrs.toLocaleString() + "</b>hours</div><div><b>" + WR.length.toLocaleString() + "</b>wrestlers indexed</div></div></section>";
    h += '<section class="sec"><div class="sh"><div><h2>Live now</h2><p>24/7 channels — everyone sees the same thing at the same time.</p></div><a class="more" href="#/live">Guide</a></div><div class="rail" id="liverail">' + CH.map(liveCard).join("") + "</div></section>";
    var cw = cwAll(), ids = Object.keys(cw).filter(function (id) { return IDX[id] != null; }).sort(function (a, b) { return cw[b].at - cw[a].at; }).slice(0, 15).map(function (id) { return IDX[id]; });
    var nw = newest(15), qnw = queue(nw);
    var newRow = '<section class="sec" id="newrow"><div class="sh"><div><h2>Recently Added</h2><p>The newest full shows and matches across every promotion.</p></div><a class="more" href="#/new">See all</a></div><div class="rail">' + nw.map(function (i) { return card(i, qnw); }).join("") + "</div></section>";
    if (!signedIn()) h += unlockCard();
    var wl = wlAll().map(function (x) { return IDX[x.id]; }).filter(function (i) { return i != null; }).slice(0, 20), qwl = queue(wl);
    if (wl.length) h += '<section class="sec" id="wlrow"><div class="sh"><div><h2>Watch Later</h2></div><a class="more" href="#/later">See all</a></div><div class="rail">' + wl.map(function (i) { return card(i, qwl); }).join("") + "</div></section>";
    if (ids.length) h += '<section class="sec" id="cwrow"><div class="sh"><div><h2>Continue watching</h2></div></div><div class="rail">' + ids.map(function (i) { return card(i); }).join("") + "</div></section>";
    h += newRow;
    h += '<section class="sec"><div class="sh"><div><h2>Promotions</h2><p>Each hub is branded to its promotion, sorted by name and year.</p></div></div><div class="pg-grid">' + ORDER.map(ptile).join("") + "</div></section>";
    var legends = [["wwe", "WrestleMania"], ["njpw", "G1 Climax"], ["wcw", "Starrcade"], ["aaa", "Triplemanía"], ["tna", "Bound for Glory"], ["aew", "All In"], ["roh", "Final Battle"], ["ecw", "November to Remember"], ["cmll", "Aniversario"], ["nwa", "Crockett Cup"], ["mlw", "Battle Riot"], ["nxt", "NXT TakeOver"], ["wwe", "Royal Rumble"], ["wcw", "Halloween Havoc"], ["aew", "Full Gear"]];
    var lg = legends.map(function (p) { return findSeries(p[0], p[1]); }).filter(function (x) { return x != null; });
    h += '<section class="sec"><div class="sh"><div><h2>Legendary series</h2><p>Jump straight into a series, year by year.</p></div></div><div class="sg">' + lg.map(function (si, k) { return seriesCard(si, k === 0); }).join("") + "</div></section>";
    var ev = pick(V.map(function (v, i) { return i; }).filter(function (i) { return V[i][6] === "e" && V[i][2] >= 3600; }), 14, rnd);
    var q1 = queue(ev);
    h += '<section class="sec"><div class="sh"><div><h2>Tonight’s main events</h2><p>Full shows from across the world, reshuffled daily.</p></div></div><div class="rail">' + ev.map(function (i) { return card(i, q1); }).join("") + "</div></section>";
    var mt = pick(V.map(function (v, i) { return i; }).filter(function (i) { return V[i][6] === "m"; }), 14, rnd), q2 = queue(mt);
    h += '<section class="sec"><div class="sh"><div><h2>Match roulette</h2><p>Fourteen random full matches. Refreshes every day.</p></div></div><div class="rail">' + mt.map(function (i) { return card(i, q2); }).join("") + "</div></section>";
    h += '<section class="sec"><div class="sh"><div><h2>Find a wrestler</h2><p>Every “X vs. Y” title is indexed — tap a name for their matches across every brand.</p></div><a class="more" href="#/search/">Search</a></div><div class="wchips">' +
      WR.slice(0, 24).map(function (w, k) { return wchip(k); }).join("") + "</div></section>";
    h += foot() + "</div>";
    app.innerHTML = h; carInit();
  }
  function ptile(b) {
    var x = B[b], n = BY_BRAND[b].length;
    return '<a class="pt" href="#/b/' + b + '" style="background:' + x.bg + ";" + bvars(b) + '"><div class="lg">' + blogo(b) + '</div><div class="nm"><b>' + esc(x.name) + "</b><span>" + n.toLocaleString() + "</span></div></a>";
  }
  function wchip(k) { var w = WR[k]; return '<a class="wchip" href="#/w/' + k + '"><i>' + esc(w[0].replace(/^the /i, "").charAt(0).toUpperCase()) + "</i><b>" + esc(w[0]) + "</b><small>" + w[1].length + "</small></a>"; }
  function findSeries(b, name) { var l = SERIES_BY_BRAND[b] || []; for (var k = 0; k < l.length; k++) if (S[l[k]][1] === name) return l[k]; return null; }
  function foot() { return '<footer><div class="wrap" style="padding:0"><b style="color:var(--tx2)">WrestleWorld+</b><span>Plays free, official uploads from each promotion’s own YouTube channel through the YouTube player. No members-only or paid videos. All trademarks belong to their owners.</span></div></footer>'; }

  function viewPromotions() {
    setTitle("Promotions"); nav("promos");
    app.innerHTML = '<div class="wrap"><div class="sp-h"><span class="kick">Hubs</span><h1>Promotions</h1><p>' + ORDER.length + ' promotions, each with its own hub. Inside: events and shows by name, then by year.</p></div><div class="pg-grid" style="margin-top:14px">' + ORDER.map(ptile).join("") + "</div>" + foot() + "</div>";
  }

  function hubHead(b) {
    var x = B[b], l = BY_BRAND[b], ys = l.map(function (i) { return V[i][4]; }).filter(Boolean), mn = Math.min.apply(null, ys), mx = Math.max.apply(null, ys);
    var hrs = Math.round(l.reduce(function (a, i) { return a + V[i][2]; }, 0) / 3600);
    var ch = x.channel ? '<a class="btn" href="#/live/' + x.channel + '" data-ch="' + x.channel + '">' + ICON.tv + "Watch " + esc(chById(x.channel).name) + "</a>" : "";
    return '<header class="hh" style="' + bvars(b) + '"><div class="pat" style="background:' + x.pat + '"></div><div class="wrap"><div class="logo">' + blogo(b) + "</div><h1>" + esc(x.full) + '</h1><p class="tl">' + esc(x.tag) + '</p><div class="stats"><div><b>' + l.length.toLocaleString() + "</b>videos</div><div><b>" + hrs.toLocaleString() + "</b>hours</div><div><b>" + (ys.length ? mn + "–" + mx : "—") + "</b>years</div></div>" +
      '<div class="acts">' + ch + '<button class="btn' + (ch ? " gh" : "") + '" data-shuffle="' + b + '">' + ICON.shuffle + "Shuffle " + esc(x.name) + "</button></div></div></header>";
  }
  function viewHub(b, tab) {
    if (!B[b]) return viewHome();
    var x = B[b]; setTitle(x.name); nav("promos");
    var sl = SERIES_BY_BRAND[b].slice();
    var evs = sl.filter(function (si) { return S[si][2] === "ppv" || S[si][2] === "special"; }), tv = sl.filter(function (si) { return S[si][2] === "tv"; }), more = sl.filter(function (si) { return S[si][2] === "more"; });
    tab = tab || (evs.length ? "events" : "shows");
    var tabs = [["events", "PPVs & Events", evs], ["shows", "TV Shows", tv], ["years", "By Year"], ["more", "More", more]];
    var h = '<div class="hub" style="' + bvars(b) + '">' + hubHead(b) + '<nav class="tabs"><div class="wrap">' + tabs.filter(function (t) { return !t[2] || t[2].length; }).map(function (t) { return '<a href="#/b/' + b + "/" + t[0] + '" class="' + (t[0] === tab ? "on" : "") + '">' + t[1] + "</a>"; }).join("") + '</div></nav><div class="wrap">';
    var bycount = function (a, c) { return S[c][3] - S[a][3]; };
    if (tab === "events" || tab === "shows") {
      var l = (tab === "events" ? evs : tv).sort(bycount), main = l.filter(function (si) { return S[si][2] !== "special"; }), sp = l.filter(function (si) { return S[si][2] === "special"; });
      if (tab === "events") {
        if (main.length) h += '<div class="grp"><h3>Pay-per-views & premium events · A–Z</h3><div class="sg">' + main.slice().sort(function (a, c) { return S[a][1].localeCompare(S[c][1]); }).map(function (si) { return seriesCard(si, false); }).join("") + "</div></div>";
        if (sp.length) h += '<div class="grp"><h3>Specials & supercards</h3><div class="sg">' + sp.map(function (si) { return seriesCard(si, false); }).join("") + "</div></div>";
      } else h += '<div class="grp"><h3>Weekly shows</h3><div class="sg">' + l.map(function (si) { return seriesCard(si, false); }).join("") + "</div></div>";
    } else if (tab === "years") {
      var cnt = {}, und = 0; BY_BRAND[b].forEach(function (i) { var y = V[i][4]; if (y) cnt[y] = (cnt[y] || 0) + 1; else und++; });
      var ys = Object.keys(cnt).map(Number).sort(function (a, c) { return a - c; }), dec = null;
      h += '<div class="grp"><h3>Every year, oldest first</h3><div class="yg">';
      ys.forEach(function (y) { var d = Math.floor(y / 10) * 10; if (d !== dec) { dec = d; h += '<div class="dec">' + d + "s</div>"; } h += '<a class="yt" href="#/y/' + b + "/" + y + '"><b>' + y + "</b><small>" + cnt[y] + "</small></a>"; });
      if (und) h += '<div class="dec">No date in title</div><a class="yt" href="#/y/' + b + '/0"><b>—</b><small>' + und + "</small></a>";
      h += "</div></div>";
    } else {
      h += '<div class="grp"><h3>Everything else, still by year</h3><div class="sg">' + more.sort(bycount).map(function (si) { return seriesCard(si, false); }).join("") + "</div></div>";
    }
    h += foot() + "</div></div>";
    app.innerHTML = h;
  }

  var SER_OPTS = {};
  function viewSeries(si, kindF, desc) {
    var s = S[si]; if (!s) return viewHome();
    var b = s[0], x = B[b]; setTitle(s[1] + " · " + x.name); nav("promos");
    kindF = kindF || "all";
    var vids = s[6].filter(function (i) { return kindF === "all" || V[i][6] === kindF; });
    var kinds = {}; s[6].forEach(function (i) { kinds[V[i][6]] = (kinds[V[i][6]] || 0) + 1; });
    var years = {}; vids.forEach(function (i) { var y = V[i][4] || 0; (years[y] = years[y] || []).push(i); });
    var ys = Object.keys(years).map(Number).sort(function (a, c) { return desc ? (c || -1) - (a || -1) : (a || 1e5) - (c || 1e5); });
    var q = queue(vids.slice().sort(function (a, c) { return (V[a][4] || 1e5) - (V[c][4] || 1e5) || (V[a][5] || "9") .localeCompare(V[c][5] || "9"); }));
    var h = '<div class="hub" style="' + bvars(b) + '"><header class="hh" style="' + bvars(b) + ';padding:16px 0 16px"><div class="pat" style="background:' + x.pat + '"></div><div class="wrap"><a class="crumb" href="#/b/' + b + '" style="display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:#ffffffcc">' + ICON.back.replace("<svg", '<svg width="18" height="18"') + '<img src="' + x.logo + '" alt="" style="height:26px;width:auto;max-width:110px;object-fit:contain"></a><h1>' + esc(s[1]) + '</h1><p class="tl">' + s[3].toLocaleString() + " videos · " + yr(s) + " · " + ({ ppv: "Pay-per-view / premium event", special: "Special event", tv: "Weekly show", more: "Collection" }[s[2]]) + "</p></div></header>";
    h += '<div class="yjump"><div class="wrap"><div class="rail chips">' + ys.map(function (y) { return '<a class="chip" href="#" data-jump="y' + y + '">' + (y || "Undated") + " <small>" + years[y].length + "</small></a>"; }).join("") + "</div></div></div>";
    h += '<div class="wrap"><div class="tools">' + ["all", "e", "p", "m", "s"].filter(function (k) { return k === "all" || kinds[k]; }).map(function (k) {
      return '<a class="chip' + (k === kindF ? " on" : "") + '" href="#" data-kind="' + k + '">' + (k === "all" ? "All" : KINDS[k]) + " <small>" + (k === "all" ? s[3] : kinds[k]) + "</small></a>"; }).join("") +
      '<a class="chip" href="#" data-sort="1">' + (desc ? "Newest first" : "Oldest first") + " ⇅</a><button class=\"chip\" data-playq=\"" + q + "\">" + ICON.play.replace("<svg", '<svg width="14" height="14"') + "Play all</button></div>";
    ys.forEach(function (y) {
      var l = years[y].slice().sort(function (a, c) { return (V[a][5] || "9").localeCompare(V[c][5] || "9") || V[a][1].localeCompare(V[c][1]); }); if (desc) l.reverse();
      var cap = 40;
      h += '<section class="ysec" id="y' + y + '"><h2>' + (y || "Undated") + " <small>" + l.length + " video" + (l.length > 1 ? "s" : "") + "</small></h2><div class=\"vl cols\">" + l.slice(0, cap).map(function (i) { return row(i, q); }).join("") + "</div>" +
        (l.length > cap ? '<button class="showall" data-more="' + si + ":" + y + '">Show all ' + l.length + "</button>" : "") + "</section>";
    });
    h += foot() + "</div></div>";
    app.innerHTML = h; SER_OPTS = { si: si, kind: kindF, desc: desc, q: q };
  }

  function viewYear(b, y) {
    var x = B[b]; if (!x) return viewHome(); y = +y; setTitle((y || "Undated") + " · " + x.name); nav("promos");
    var l = BY_BRAND[b].filter(function (i) { return (V[i][4] || 0) === y; });
    var g = {}; l.forEach(function (i) { (g[V[i][3]] = g[V[i][3]] || []).push(i); });
    var sis = Object.keys(g).map(Number).sort(function (a, c) { var A = S[a][2] === "more", C = S[c][2] === "more"; return A - C || g[c].length - g[a].length; });
    var q = queue(l.slice().sort(function (a, c) { return (V[a][5] || "9").localeCompare(V[c][5] || "9"); }));
    var cnt = {}; BY_BRAND[b].forEach(function (i) { if (V[i][4]) cnt[V[i][4]] = 1; }); var all = Object.keys(cnt).map(Number).sort(function (a, c) { return a - c; });
    var k = all.indexOf(y), prev = all[k - 1], next = all[k + 1];
    var h = '<div class="hub" style="' + bvars(b) + '"><header class="hh" style="' + bvars(b) + ';padding:16px 0"><div class="pat" style="background:' + x.pat + '"></div><div class="wrap"><a href="#/b/' + b + '/years" style="display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:#ffffffcc">' + ICON.back.replace("<svg", '<svg width="18" height="18"') + '<img src="' + x.logo + '" alt="" style="height:26px;width:auto;max-width:110px;object-fit:contain"></a><h1>' + esc(x.name) + " " + (y || "· Undated") + '</h1><p class="tl">' + l.length + " videos across " + sis.length + " series</p>" +
      '<div class="acts">' + (prev ? '<a class="btn gh" href="#/y/' + b + "/" + prev + '">← ' + prev + "</a>" : "") + (next ? '<a class="btn gh" href="#/y/' + b + "/" + next + '">' + next + " →</a>" : "") + '<button class="btn" data-playq="' + q + '">' + ICON.play + "Play year</button></div></div></header><div class=\"wrap\">";
    sis.forEach(function (si) {
      var vl = g[si].sort(function (a, c) { return (V[a][5] || "9").localeCompare(V[c][5] || "9"); });
      h += '<section class="ysec"><h2 style="font-size:19px">' + esc(S[si][1]) + " <small>" + vl.length + '</small></h2><div class="vl cols">' + vl.slice(0, 60).map(function (i) { return row(i, q); }).join("") + "</div>" + (vl.length > 60 ? '<a class="showall" href="#/s/' + si + '">Open ' + esc(S[si][1]) + " →</a>" : "") + "</section>";
    });
    app.innerHTML = h + foot() + "</div></div>";
  }

  /* ---------------- search ---------------- */
  function searchAll(q) {
    var nq = norm(q); if (!nq) return { w: [], s: [], v: [] };
    var toks = nq.split(" "), phrase = " " + nq + " ";
    var w = [];
    WR.forEach(function (x, k) { var n = x[2]; if (n.indexOf(phrase) >= 0 || toks.every(function (t) { return n.indexOf(" " + t) >= 0; })) w.push(k); });
    w.sort(function (a, c) { return (WR[a][2] === phrase ? -1e6 : 0) - (WR[c][2] === phrase ? -1e6 : 0) || WR[c][1].length - WR[a][1].length; });
    var s = []; S.forEach(function (x, si) { var n = " " + norm(x[1] + " " + B[x[0]].name) + " "; if (toks.every(function (t) { return n.indexOf(" " + t) >= 0; })) s.push(si); });
    s.sort(function (a, c) { return S[c][3] - S[a][3]; });
    var inW = {}; w.slice(0, 3).forEach(function (k) { WR[k][1].forEach(function (i) { inW[i] = 1; }); });
    var v = [];
    for (var i = 0; i < V.length; i++) {
      var n = NORM[i], sc = 0;
      if (n.indexOf(phrase) >= 0) sc = 3; else if (toks.every(function (t) { return n.indexOf(" " + t) >= 0; })) sc = 1;
      if (inW[i]) sc = Math.max(sc, 2.5);
      if (sc) { sc += ({ m: .3, e: .5, p: .2, s: 0 })[V[i][6]]; v.push([i, sc]); }
    }
    v.sort(function (a, c) { return c[1] - a[1] || (V[a[0]][4] || 9999) - (V[c[0]][4] || 9999); });
    return { w: w, s: s, v: v.map(function (x) { return x[0]; }) };
  }
  var sTimer;
  function viewSearch(q) {
    setTitle("Search"); nav("search");
    q = q || "";
    app.innerHTML = '<div class="wrap"><div class="sbox">' + ICON.search + '<input id="sq" type="search" placeholder="Wrestler, event, show or year — try “Eddie Guerrero”" value="' + esc(q) + '" autocomplete="off" enterkeyhint="search"></div><div id="sres"></div>' + foot() + "</div>";
    var inp = $("#sq"); inp.addEventListener("input", function () { clearTimeout(sTimer); sTimer = setTimeout(function () { history.replaceState(null, "", "#/search/" + encodeURIComponent(inp.value)); navTop(); renderResults(inp.value); }, 180); });
    inp.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault(); clearTimeout(sTimer); history.replaceState(null, "", "#/search/" + encodeURIComponent(inp.value)); navTop(); renderResults(inp.value);
      inp.blur(); setTimeout(function () { var f = $("#sres a, #sres button"); if (f) tvFocus(f); }, 30);
    });
    renderResults(q); if (!q && !IS_TV) setTimeout(function () { inp.focus(); }, 50);
  }
  function renderResults(q) {
    var box = $("#sres"); if (!box) return;
    if (!norm(q)) { box.innerHTML = '<div class="sec"><div class="sh"><h2>Popular wrestlers</h2></div><div class="wchips">' + WR.slice(0, 40).map(function (w, k) { return wchip(k); }).join("") + "</div></div>"; return; }
    var r = searchAll(q), h = "";
    if (r.w.length) h += '<section class="sec"><div class="sh"><h2>Wrestlers</h2></div><div class="wchips">' + r.w.slice(0, 12).map(wchip).join("") + "</div></section>";
    if (r.s.length) h += '<section class="sec"><div class="sh"><h2>Series</h2></div><div class="sg">' + r.s.slice(0, 8).map(function (si) { return seriesCard(si); }).join("") + "</div></section>";
    if (r.v.length) { var qq = queue(r.v.slice(0, 200)); h += '<section class="sec" id="vres"><div class="sh"><div><h2>Videos</h2><p>' + r.v.length.toLocaleString() + ' results</p></div></div><div class="vl cols">' + r.v.slice(0, 60).map(function (i) { return row(i, qq, { logo: 1, series: 1 }); }).join("") + "</div>" + (r.v.length > 60 ? '<button class="showall" data-smore="60">Show more</button>' : "") + "</section>"; box._r = r; box._q = qq; }
    if (!h) h = '<div class="empty">Nothing found for “' + esc(q) + '”. Try a last name, an event (“Starrcade 1997”) or a brand.</div>';
    box.innerHTML = h; box.setAttribute("data-count", r.v.length); box.setAttribute("data-wcount", r.w.length);
  }
  function viewWrestler(k) {
    var w = WR[k]; if (!w) return viewSearch("");
    setTitle(w[0]); nav("search");
    var extra = searchAll(w[0]).v, set = {}, all = [];
    w[1].concat(extra).forEach(function (i) { if (!set[i]) { set[i] = 1; all.push(i); } });
    var g = {}; all.forEach(function (i) { (g[brandOf(i)] = g[brandOf(i)] || []).push(i); });
    var bs = ORDER.filter(function (b) { return g[b]; }).sort(function (a, c) { return g[c].length - g[a].length; });
    var q = queue(all.slice().sort(function (a, c) { return (V[a][4] || 1e4) - (V[c][4] || 1e4); }));
    var h = '<div class="wrap"><div class="sp-h"><a class="crumb" href="#/search/' + encodeURIComponent(w[0]) + '">' + ICON.back.replace("<svg", '<svg width="18" height="18"') + 'Search</a><h1>' + esc(w[0]) + "</h1><p>" + all.length + " videos across " + bs.length + " promotion" + (bs.length > 1 ? "s" : "") + '</p></div><div class="tools">' + bs.map(function (b) { return '<a class="chip" href="#" data-jump="wb-' + b + '" style="' + bvars(b) + '">' + esc(B[b].name) + " <small>" + g[b].length + "</small></a>"; }).join("") + '<button class="chip" data-playq="' + q + '">' + ICON.play.replace("<svg", '<svg width="14" height="14"') + "Play all</button></div>";
    bs.forEach(function (b) {
      var l = g[b].sort(function (a, c) { return (V[a][4] || 1e4) - (V[c][4] || 1e4) || (V[a][5] || "9").localeCompare(V[c][5] || "9"); });
      h += '<section class="bgrp ysec" id="wb-' + b + '" style="' + bvars(b) + '"><h3>' + blogo(b) + esc(B[b].name) + ' <small style="color:var(--tx3)">' + l.length + '</small></h3><div class="vl cols">' + l.slice(0, 80).map(function (i) { return row(i, q, { series: 1 }); }).join("") + "</div></section>";
    });
    app.innerHTML = h + foot() + "</div>";
  }

  /* ---------------- YouTube: instant playback ----------------
     The IFrame API is preloaded at startup so a tap can create (or reuse) the player synchronously inside the user
     gesture: autoplay=1 + playVideo() in onReady. One persistent player per frame; later items use loadVideoById,
     which keeps the activation (incl. iOS) so autoplay-next / channel transitions continue without a tap.
     If unmuted autoplay is still blocked (not PLAYING/BUFFERING ~1.5s after start) we fall back to mute()+playVideo()
     and show a "Tap to unmute" button. */
  function yt() {
    if (YT_READY) return YT_READY;
    YT_READY = new Promise(function (res) {
      if (window.YT && window.YT.Player && window.YT.loaded) return res(window.YT);
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) try { prev(); } catch (e) {} res(window.YT); };
      var s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true; document.head.appendChild(s);
    });
    return YT_READY;
  }
  function ytLoaded() { return !!(window.YT && window.YT.Player && window.YT.loaded); }
  /* One persistent player for the whole session (2026-11-18 v3). iOS Safari only starts playVideo()/loadVideoById() from a tap
     when the YouTube iframe ALREADY exists and is ready, so the iframe is created once at startup (offscreen, never display:none)
     and a tap only calls loadVideoById()+playVideo() synchronously. The iframe is never moved in the DOM (moving an iframe
     reloads it, which loses the ready player and the one-tap start on WebKit). Instead the dock is position:absolute in
     DOCUMENT coordinates, laid exactly over the frame placeholder (#frame / #lframe): it scrolls with the page like normal
     content (no fixed/JS-tracked float on iOS momentum scroll), sits under the sticky header / tabs / bottom nav (z 25), and is
     only re-measured when the layout changes (ResizeObserver, resize, a slow 500 ms safety tick). No picture-in-picture;
     fullscreen only via YouTube's own button. (2026-11-18 inline fix; was position:fixed + scroll tracking.)
     iOS starts muted (guaranteed inline autoplay) until sound has been unlocked once by "Tap to unmute".
     TV app (window.TVNative): if a video is still not playing after the muted fallback, a native touch is sent to the
     player (= YouTube's own play button), so nobody has to press it. */
  var P = { player: null, ready: false, host: null, i: -1, q: null, tick: null, wd: null, mode: null, onEnd: null, onErr: null, fellBack: false, log: [], want: null, soundOK: false, tapped: 0 };
  function plog(e) { P.log.push([Math.round(performance.now()), e]); if (P.log.length > 60) P.log.shift(); }
  window.WW_P = P; // test hook: WW_P.player.getPlayerState()
  P.nativeTap = function () { return nativeTap(); }; P.ctlSync = function () { ctlSync(); };
  var dock = document.createElement("div"); dock.id = "ytdock"; dock.className = "ytdock off";
  dock.innerHTML = '<iframe id="ytp" title="Video player" aria-hidden="true" tabindex="-1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen ' +
    'src="https://www.youtube.com/embed/?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&autoplay=0&fs=1&origin=' + encodeURIComponent(location.origin) + '"></iframe>';
  document.body.appendChild(dock);
  /* On-air network bug (2026-11-18): translucent logo bottom-right of the player, only while UPN (id wwetv) or
     Spike TV (id tna) live channels play. Lives inside the dock above the iframe, pointer-events:none so taps / remote pass through. */
  var BUG = { wwetv: "bug-upn.svg", tna: "bug-spike-tv.svg" };
  dock.insertAdjacentHTML("beforeend", '<img class="netbug" alt="" aria-hidden="true" draggable="false" hidden>');
  function bugSync() {
    var im = dock.querySelector(".netbug"); if (!im) return;
    var id = P.mode === "live" && P.host && typeof LV !== "undefined" && LV.ch ? LV.ch.id : null, f = id && BUG[id];
    if (f) { if (im.getAttribute("src") !== f) im.setAttribute("src", f); im.className = "netbug nb-" + id; im.hidden = false; }
    else { im.hidden = true; im.className = "netbug"; }
  }
  window.WW_bug = bugSync;
  function initPlayer(YT) {
    if (P.player) return;
    P.player = new YT.Player("ytp", { events: {
      onReady: function () { P.ready = true; plog("ready"); if (P.want) startVid(); },
      onStateChange: function (e) { plog("state:" + e.data); if (e.data === 0 && P.onEnd && P.want) P.onEnd(); if (e.data === 1 && !isMuted(e.target)) unmuteBtn(false); ctlSync(); },
      onError: function (e) { plog("error:" + e.data); clearTimeout(P.wd); if (P.want && P.onErr) P.onErr(e.data); } } });  // 2/5/100/101/150/152/153: skip, never mistake it for an autoplay block
  }
  function place() {
    var h = P.host;
    if (!h || !document.contains(h)) { if (h) hideDock(); return; }
    var r = h.getBoundingClientRect(), s = dock.style;
    if (r.width < 4 || r.height < 4) { if (s.left !== "-10000px") s.left = "-10000px"; return; }
    var L = Math.round((r.left + window.scrollX) * 100) / 100 + "px", T = Math.round((r.top + window.scrollY) * 100) / 100 + "px";
    if (s.left !== L) s.left = L; if (s.top !== T) s.top = T;
    if (s.width !== r.width + "px") s.width = r.width + "px"; if (s.height !== r.height + "px") s.height = r.height + "px";
    var rad = getComputedStyle(h).borderRadius; if (s.borderRadius !== rad) s.borderRadius = rad;
  }
  var placeRO = window.ResizeObserver ? new ResizeObserver(function () { if (P.host) place(); }) : null;
  var placeT = null;
  function showDock(el) {
    if (P.host && P.host !== el) P.host.classList.remove("playing");
    P.host = el; el.classList.add("playing"); dock.classList.remove("off"); place();
    bugSync();
    if (placeRO) { placeRO.disconnect(); placeRO.observe(el); placeRO.observe(document.body); }
    if (!placeT) placeT = setInterval(place, 500);
  }
  function hideDock() {
    if (P.host) P.host.classList.remove("playing");
    P.host = null; dock.classList.add("off"); dock.removeAttribute("style"); clearInterval(placeT); placeT = null; if (placeRO) placeRO.disconnect();
    bugSync();
  }
  window.addEventListener("resize", function () { if (P.host) place(); });
  window.addEventListener("orientationchange", function () { if (P.host) setTimeout(place, 300); });
  function stopPlayer() {
    clearInterval(P.tick); P.tick = null; clearTimeout(P.wd); P.want = null;
    try { if (P.player && P.ready) P.player.stopVideo(); } catch (e) {}
    unmuteBtn(false); hideDock(); ctlSync();
  }
  var destroyPlayer = stopPlayer;
  function unmuteBtn(show) {
    var b = dock.querySelector(".unm");
    if (show && !b) dock.insertAdjacentHTML("beforeend", '<button class="unm" data-unmute>' + ICON.mute + "<span>Tap to unmute</span></button>");
    else if (!show && b) b.remove();
    ctlSync();
  }
  function isMuted(p) { try { return !!(p.isMuted && p.isMuted()); } catch (e) { return false; } }
  function pstate() { try { return P.player && P.ready ? P.player.getPlayerState() : -9; } catch (e) { return -9; } }
  function startVid() {
    var p = P.player, w = P.want; if (!p || !w) return;
    plog("create:" + w.id + "@" + w.start);
    try {
      if (IS_IOS && !P.soundOK) p.mute(); else if (!P.userMuted) p.unMute();
      p.loadVideoById({ videoId: w.id, startSeconds: w.start }); p.playVideo();
    } catch (e) { plog("loadfail"); }
    watchdog();
  }
  function nativeTap() {  // TV app only: a real touch on the player = YouTube's own play button
    var N = window.TVNative, r = dock.getBoundingClientRect();
    if (!N || !N.tapFrac || !P.host || r.width < 4) return false;
    plog("native-tap"); P.tapped++;
    N.tapFrac((r.left + r.width / 2) / innerWidth, (r.top + r.height / 2) / innerHeight);
    setTimeout(function () { var a = document.activeElement; if (a && a.tagName === "IFRAME") a.blur(); try { window.focus(); } catch (e) {} tvRefocus(); }, 400);
    return true;
  }
  function watchdog() {
    clearTimeout(P.wd); var w = P.want;
    P.wd = setTimeout(function () {
      var p = P.player; if (!p || P.want !== w) return;
      var st = pstate();
      if (st === 1 || st === 3) { unmuteBtn(isMuted(p)); return; }
      plog("fallback-muted:" + st); try { p.mute(); p.playVideo(); } catch (e) {}  // sound blocked: start muted instead
      P.fellBack = true; unmuteBtn(true);
      P.wd = setTimeout(function () {
        if (P.want !== w) return; var s2 = pstate();
        if (s2 === 1 || s2 === 3) return;
        if (!P.tapped || P.tapped < 2) { if (nativeTap()) { P.wd = setTimeout(function () { if (P.want === w && pstate() !== 1 && pstate() !== 3) { plog("still:" + pstate()); } }, 2500); return; } }
        plog("needs-tap:" + s2);
      }, 2200);
    }, 1500);
  }
  function mkPlayer(el, id, start, onEnd, onErr) {
    P.onEnd = onEnd; P.onErr = onErr; P.fellBack = false; P.tapped = 0;
    var s0 = Math.max(0, Math.floor((typeof start === "function" ? start() : start) || 0));
    P.want = { id: id, start: s0 };
    showDock(el);
    if (P.ready) startVid();  // synchronous: still inside the tap / key press
    else { plog("pending:" + id); yt().then(initPlayer); }
    return Promise.resolve(P.player);
  }
  function unmute() {
    var p = P.player; if (!p) return;
    P.userMuted = false;
    try { p.unMute(); p.setVolume(100); if (p.getPlayerState() !== 1) p.playVideo(); } catch (e) {}
    P.fellBack = false; unmuteBtn(false);
    setTimeout(function () {  // iOS may pause a video that is unmuted from outside the player: fall back to muted + YouTube's own unmute
      var st = pstate();
      if (st === 1 && !isMuted(p)) { P.soundOK = true; plog("sound-on"); }
      else if (st !== 3) { plog("unmute-blocked:" + st); try { p.mute(); p.playVideo(); } catch (e) {} }
      ctlSync();
    }, 900);
  }
  function togglePlay() {
    var p = P.player; if (!p || !P.want) return false;
    var st = pstate();
    try { if (st === 1 || st === 3) p.pauseVideo(); else p.playVideo(); } catch (e) {}
    setTimeout(ctlSync, 300); return true;
  }
  function seekBy(d) { var p = P.player; if (!p || !P.want || P.mode !== "vod") return; try { p.seekTo(Math.max(0, p.getCurrentTime() + d), true); } catch (e) {} }
  function ctlHtml() { return '<span class="tvctl"><button class="chip" data-pp>' + ICON.play.replace("<svg", '<svg width="14" height="14"') + '<span>Pause</span></button><button class="chip" data-unm2 hidden>' + ICON.mute.replace("<svg", '<svg width="14" height="14"') + "<span>Unmute</span></button></span>"; }
  function ctlSync() {
    var st = pstate(), on = !!P.want, m = on && P.player && isMuted(P.player);
    document.querySelectorAll("[data-pp] span").forEach(function (s) { s.textContent = on && (st === 1 || st === 3) ? "Pause" : "Play"; });
    document.querySelectorAll("[data-unm2]").forEach(function (b) { b.hidden = !m; });
    var lc = $(".lvctl"); if (lc) lc.hidden = !on && !$("#lframe [data-tune]");
  }

  /* ---------------- VOD player sheet ---------------- */
  function openPlayer(i, qk) {
    var fresh = sheet.hidden || P.mode !== "vod";
    if (sheet.hidden) { P.opener = tvCur(); P.openerKey = focusKey(P.opener); }
    if (P.mode === "live") { destroyPlayer(); LV.playing = null; }
    P.mode = "vod"; P.i = i; P.q = qk && QUEUES[qk] ? QUEUES[qk] : S[V[i][3]][6];
    if (P.q.indexOf(i) < 0) P.q = [i].concat(P.q);
    if (sheet.hidden) { P.pageY = window.scrollY; P.openHash = location.hash; }
    sheet.hidden = false; document.documentElement.classList.add("wwsheet");  // in-page view: #app hidden, the page scrolls
    var hdr = $("header.top"); if (IS_TV && hdr) hdr.setAttribute("inert", "");
    if (fresh && location.hash.indexOf("#/watch/") !== 0) history.pushState({ sheet: 1 }, "", location.hash);
    renderSheet(fresh);
  }
  function renderSheet(start) {
    var i = P.i, v = V[i], b = brandOf(i), x = B[b], k = P.q.indexOf(i), cw = cwAll()[v[0]];
    var up = P.q.slice(k + 1, k + 13);
    var names = WR.map(function (w, n) { return [w, n]; }).filter(function (p) { return p[0][1].indexOf(i) >= 0; }).slice(0, 8);
    if (start || !$("#frame", sheet)) sheet.innerHTML = '<div class="ptop"><div class="pbar"><button class="ib" data-close aria-label="Close">' + ICON.x + '</button>' + ctlHtml() + '<span class="sp"></span><img id="plogo" src="' + x.logo + '" alt="" style="height:24px;width:auto;max-width:100px;object-fit:contain"></div><div class="frame" id="frame"></div></div><div id="pbody"></div>';
    else $("#plogo").src = x.logo;
    $("#pbody").innerHTML = '<div class="pinfo" style="' + bvars(b) + '"><h2>' + esc(v[1]) + '</h2><div class="meta">' + kb(v[6]) + "<span>" + esc(fdate(v)) + "</span><span>· " + dur(v[2]) + '</span><a href="#/s/' + v[3] + '" data-close style="color:var(--b1x);font-weight:700">· ' + esc(S[v[3]][1]) + "</a></div>" +
      '<div class="tools"><button class="chip wlc' + (wlHas(v[0]) ? " on" : "") + '" data-wl="' + v[0] + '">' + (wlHas(v[0]) ? "✓ Saved to Watch Later" : "＋ Watch Later") + '</button><button class="tgl' + (autoplayOn() ? " on" : "") + '" data-auto><i></i>Autoplay next</button>' + (cw ? '<span class="kb">Resumed at ' + clock(cw.t) + "</span>" : "") + "</div>" +
      (names.length ? '<div class="wlinks">' + names.map(function (p) { return '<a href="#/w/' + p[1] + '" data-close>' + esc(p[0][0]) + "</a>"; }).join("") + "</div>" : "") +
      (up.length ? '<div class="upn"><h3>Up next</h3><div class="vl">' + up.map(function (j) { return row(j, null, {}); }).join("") + "</div></div>" : "") + "</div>";
    sheet.querySelectorAll(".upn [data-play]").forEach(function (a) { a.setAttribute("data-inq", "1"); });
    window.scrollTo(0, 0);
    function next(force) { if (P.mode === "vod" && P.i === i && (force || autoplayOn()) && P.q[k + 1] != null) { P.i = P.q[k + 1]; renderSheet(); } }
    mkPlayer($("#frame"), v[0], cw && cw.t < v[2] - 30 ? cw.t : 0, function () { cwSave(v[0], v[2], v[2]); next(); }, function () { setTimeout(function () { next(true); }, 1500); });
    if (IS_TV) setTimeout(function () { tvFocus($("[data-pp]", sheet)); }, 30);
    clearInterval(P.tick);
    P.tick = setInterval(function () { try { var p = P.player; if (p && p.getCurrentTime && p.getPlayerState() === 1) cwSave(v[0], p.getCurrentTime(), p.getDuration() || v[2]); } catch (e) {} }, 5000);
  }
  function closeSheet(fromPop, nav) {
    if (sheet.hidden) return; destroyPlayer(); P.mode = null; sheet.hidden = true; sheet.innerHTML = ""; document.documentElement.classList.remove("wwsheet");
    var hdr = $("header.top"); if (hdr) hdr.removeAttribute("inert");
    var oh = P.openHash;  // back on the page the player was opened from: restore its scroll position (not when navigating elsewhere)
    if (!nav && location.hash === oh) { var py = P.pageY || 0; window.scrollTo(0, py); setTimeout(function () { if (sheet.hidden && P.mode !== "vod" && location.hash === oh) window.scrollTo(0, py); }, 30); }
    if (!fromPop && history.state && history.state.sheet) history.back();
    var r = route(); if (r[0] === "" || r[0] === "home") { var row = $("#cwrow"); if (row || Object.keys(cwAll()).length) viewHome(); }
    if (IS_TV && !fromPop) { var op = P.opener; setTimeout(function () { var el = op && document.contains(op) ? op : findKey(P.openerKey, app); tvFocus(el || firstContent()); }, 60); }
  }

  /* ---------------- live channel view ---------------- */
  var LV = { ch: null, timer: null, playing: null, clockI: null, skip: 0 };
  function viewLive(id) {
    var c = chById(id || LS.get("ww_ch", "network")); LS.set("ww_ch", c.id); LV.ch = c;
    setTitle(c.name); nav("live");
    app.innerHTML = '<div class="wrap"><div class="lv-h"><span class="kick">● Live 24/7</span></div><div class="rail chips chsw">' + CH.map(function (x) { return '<a class="chip' + (x.id === c.id ? " on" : "") + '" href="#/live/' + x.id + '" data-ch="' + x.id + '">' + esc(x.name) + "</a>"; }).join("") + '</div>' +
      '<div class="lvgrid" style="margin-top:14px"><div><div class="frame" id="lframe" style="border-radius:16px;overflow:hidden"><div class="tune"><button data-tune>' + "<span>" + ICON.play + "</span>Tune in to " + esc(c.name) + '</button></div></div><div class="lvctl">' + ctlHtml() + '</div><div class="lv-now" id="lnow"></div></div><div><div class="guide" id="lguide"></div>' + chatHtml(c) + '</div></div><p style="color:var(--tx3);font-size:12.5px;margin-top:16px">' + esc(c.desc) + " Schedule is computed from the clock, so it is the same on every device.</p>" + foot() + "</div>";
    if (c.events) { LV.evId = null; evFrame(); }
    chatStart(c); liveInfo(); ctlSync(); clearInterval(LV.timer); LV.timer = setInterval(liveInfo, c.events ? 1000 : 5000);
  }
  function evFrame() {  // not playing: tune button when the event is on the air, otherwise the branded "Coming" slate with countdown
    var c = LV.ch, fr = $("#lframe"); if (!c || !fr || P.mode === "live") return;
    var st = evState(c), e = st.ev, b = c.brand, k = st.live ? "live" : (e ? "c" + e[0] : "none");
    if (fr.getAttribute("data-k") === k) { var cd = fr.querySelector("[data-evcd]"); if (cd) cd.textContent = "Starts in " + clock(+cd.getAttribute("data-evcd") - Date.now() / 1000); return; }
    fr.setAttribute("data-k", k); setTimeout(ctlSync, 0);
    var bg = '<div class="evbg" style="background-image:' + (e ? "url(" + evPoster(e) + ")," : "") + "linear-gradient(135deg," + B[b].b1 + ',#0B0B16 70%)"></div>';
    if (st.live) fr.innerHTML = '<div class="tune evtune" style="' + bvars(b) + '">' + bg + '<button data-tune><span>' + ICON.play + "</span>Watch " + esc(c.name) + "<small>" + esc(evTitle(e)) + " · Live now</small></button></div>";
    else fr.innerHTML = '<div class="tune evtune evslate" style="' + bvars(b) + '">' + bg + '<div class="evsl">' + blogo(b, "evlogo") + '<p class="k">' + (e ? esc(etDay(e[0]) + (evPromo(e) ? " \u00b7 " + B[evPromo(e)].name : "")) : "Event of the Night") + "</p>" +
      (e ? "<h3>" + esc(evTitle(e)) + "</h3>" + (evSub(e) ? "<p>" + esc(evSub(e)) + "</p>" : "") + '<p class="when">' + esc(st.label) + '</p><p class="cd" data-evcd="' + e[0] + '">Starts in ' + clock(st.cd) + "</p>"
         : (function (x) { return "<h3>" + esc(x.h) + '</h3><p class="when">' + esc(x.p) + "</p>"; })(evIdle(c))) + "</div></div>";
  }
  function evInfo(c) {
    var st = evState(c), e = st.ev, now = Date.now() / 1000;
    if (st.live) $("#lnow").innerHTML = '<span class="kick" style="color:var(--c3)">● On the air · ' + esc(evKick(e)) + '</span><h2>' + esc(e[2]) + '</h2><div class="meta">' + evMetaLogo(c, e) + "<span>Started " + etTime(e[0]) + '</span></div><div class="lv-prog"><i style="width:' + (st.off / e[3] * 100).toFixed(1) + '%"></i></div><div class="lv-times"><span>' + clock(st.off) + " in</span><span>" + clock(st.left) + " left · ends " + etTime(e[0] + e[3]) + "</span></div>";
    else { var idl = e ? null : evIdle(c); $("#lnow").innerHTML = '<span class="kick" style="color:var(--c3)">' + esc(evKick(e)) + '</span><h2>' + (e ? esc(evTitle(e)) : esc(idl.h)) + '</h2><div class="meta">' + evMetaLogo(c, e) + "<span>" + (e ? esc(st.label) + " · starts in " + clock(st.cd) : esc(idl.p)) + "</span></div>"; }
    var g = "<ul>", up = c.events.filter(function (x) { return x[0] + x[3] > now; }).slice(0, 8);
    up.forEach(function (x) { g += "<li><b>" + (x === st.ev && st.live ? "Now" : etDay(x[0]) + " " + etTime(x[0])) + "</b><span>" + esc(x[2]) + "</span></li>"; });
    var pk = {}, past = c.events.filter(function (x) { return x[0] + x[3] <= now; }).filter(function (x) {  // one line per pick: part 2s of a double feature folded into part 1
      var k = etDk(x[0]) + "|" + (x[6] || ""); if (pk[k]) return false; pk[k] = 1; return true; }).slice(-4).reverse();  // recently aired (history incl. the WWE/TNA picks before the merge)
    $("#lguide").innerHTML = (up.length ? g : g + "<li><b>Soon</b><span>Next Event of the Night coming soon</span></li>") + "</ul>" +
      (past.length ? '<ul class="evpast"><li class="h"><b>Recently aired</b></li>' + past.map(function (x) { return "<li><b>" + new Date(x[0] * 1000).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" }) + "</b><span>" + (evPromo(x) ? esc(B[evPromo(x)].name) + " \u00b7 " : "") + esc(String(x[2]).replace(/\s+\u00b7\s+Part\s.*$/, "")) + "</span></li>"; }).join("") + "</ul>" : "");
    // follow the schedule: an event started or ended while watching / waiting
    if (P.mode === "live") { var nowId = st.live ? e[0] + e[1] : null; if (nowId !== LV.evId) { if (nowId) tuneLive(); else { destroyPlayer(); P.mode = null; LV.playing = null; LV.evId = null; evFrame(); } } }
    else evFrame();
  }
  function liveInfo() {
    var c = LV.ch; if (!c || !$("#lnow")) { clearInterval(LV.timer); return; }
    if (c.events) return evInfo(c);
    var n = chNow(c), v = V[n.i], b = brandOf(n.i), now = Date.now() / 1000;
    $("#lnow").innerHTML = '<span class="kick" style="color:var(--c3)">Now playing</span><h2>' + esc(v[1]) + '</h2><div class="meta">' + blogo(b).replace("<img", '<img style="height:18px;width:auto;max-width:70px;object-fit:contain"') + "<span>" + esc(S[v[3]][1]) + "</span><span>· " + esc(fdate(v)) + "</span>" + kb(v[6]) + '</div><div class="lv-prog"><i style="width:' + (n.off / v[2] * 100).toFixed(1) + '%"></i></div><div class="lv-times"><span>' + tod(n.began) + " · " + clock(n.off) + " in</span><span>" + clock(n.left) + " left · ends " + tod(now + n.left) + "</span></div>";
    var g = '<ul><li><b>Now</b><span>' + esc(v[1]) + "</span></li>", t = now + n.left;
    for (var k = 1; k <= 10; k++) { var j = c.items[(n.k + k) % c.items.length]; g += "<li><b>" + tod(t) + "</b><span>" + esc(V[j][1]) + "</span></li>"; t += V[j][2]; }
    $("#lguide").innerHTML = g + "</ul>";
    // the clock moved on to a new item: follow it (unless we already rolled into it when the last video ended)
    if (P.mode === "live" && LV.playing != null && n.i !== LV.clockI) { if (n.i === LV.playing) LV.clockI = n.i; else tuneLive(); }
  }
  function tuneLive(advance) {
    if (LV.ch && LV.ch.events) return tuneEvent();
    var c = LV.ch, n = chNow(c), i = n.i, off = n.off, fr = $("#lframe"); if (!c || !fr) return;
    var kk = n.k;
    if (advance && i === LV.playing) { kk = n.k + 1; i = c.items[kk % c.items.length]; off = 0; }  // ended (or failed) a moment before the clock: roll on now
    for (var g = 0; LV.bad && LV.bad[i] && g < 12; g++) { kk++; i = c.items[kk % c.items.length]; off = 0; }  // never retry a video that already failed
    P.mode = "live"; LV.playing = i; LV.clockI = n.i;
    mkPlayer(fr, V[i][0], function () { var m = chNow(c); return m.i === i ? m.off : off; },
      function () { setTimeout(function () { if (P.mode === "live") tuneLive(true); }, 300); },
      function () { LV.bad = LV.bad || {}; LV.bad[i] = 1; LV.skip = (LV.skip || 0) + 1; if (LV.skip < 4) setTimeout(function () { if (P.mode === "live") tuneLive(true); }, 500); });
  }
  function tuneEvent() {  // join the scheduled event at the same offset everyone else is at (instant, inside the tap)
    var c = LV.ch, fr = $("#lframe"), e = evNow(c); if (!c || !fr) return;
    if (!e) { evFrame(); return; }
    fr.removeAttribute("data-k");
    P.mode = "live"; LV.playing = e[1]; LV.evId = e[0] + e[1];
    mkPlayer(fr, e[1], function () { return e[7] ? 0 : Date.now() / 1000 - e[0]; },  // e[7]: live stream, join at the live edge
      function () { setTimeout(function () { if (P.mode === "live") { destroyPlayer(); P.mode = null; LV.playing = null; LV.evId = null; liveInfo(); if (evNow(c) && !e[7]) tuneEvent(); else if (e[7]) evFrame(); } }, 300); },
      function () { destroyPlayer(); P.mode = null; LV.playing = null; LV.evId = null; fr.setAttribute("data-k", "live"); fr.innerHTML = '<div class="tune evtune evslate" style="' + bvars(c.brand) + '"><div class="evsl">' + blogo(c.brand, "evlogo") + '<p class="k">Event of the Night</p><h3>We\'re having trouble with tonight\'s broadcast.</h3><p class="when">Stay tuned to ' + esc(c.site) + '</p><button class="btn" data-tune style="margin:10px auto 0">Try again</button></div></div>'; if (IS_TV) tvFocus(fr.querySelector("[data-tune]")); });
  }
  function goLive(id) {  // tap on a channel card / chip: render the channel and start it inside the same gesture
    var h = "#/live/" + id; if (location.hash !== h) history.pushState(null, "", h);
    render(); LV.skip = 0; tuneLive();
  }

  /* ---------------- TV remote (Fire TV / Google TV app): works with the injected tvnav.js ----------------
     Back: close player -> previous screen -> home -> exit app (only from Home). Media keys drive the player API.
     Focus is kept on the page (the YouTube iframe is never a focus target), restored after the player closes and
     after Back, and never left hidden under the sticky header / tab bars. */
  var NAVSTK = [], FOCUSMEM = {};
  function navTop() { NAVSTK[NAVSTK.length ? NAVSTK.length - 1 : 0] = location.hash || "#/"; }
  function tvCur() { return document.querySelector(".tvnav-focus"); }
  function tvFocus(el) { if (el && window.__tvnav && window.__tvnav.focus) { window.__tvnav.focus(el, false); unhide(el); } }
  function focusKey(el) {
    if (!el) return null;
    var attrs = ["data-play", "data-ch", "data-kind", "data-sort", "data-jump", "data-playq", "data-shuffle", "data-tune", "data-pp", "data-auto", "data-unm2", "data-close", "href"];
    for (var k = 0; k < attrs.length; k++) if (el.hasAttribute(attrs[k])) return [attrs[k], el.getAttribute(attrs[k]), (el.textContent || "").trim().slice(0, 40)];
    return null;
  }
  function findKey(key, root) {
    if (!key) return null; var l = (root || document).querySelectorAll("[" + key[0] + "]");
    var best = null;
    for (var k = 0; k < l.length; k++) if (l[k].getAttribute(key[0]) === key[1]) { if ((l[k].textContent || "").trim().slice(0, 40) === key[2]) return l[k]; best = best || l[k]; }
    return best;
  }
  function firstContent() {
    var l = window.__tvnav ? window.__tvnav.candidates() : [];
    var r = route()[0] || "";
    if (r === "live") { var on = $(".chsw .chip.on"); if (on) return on; }
    if (r === "search") { var q = $("#sq"); if (q) return q; }
    for (var k = 0; k < l.length; k++) if (app.contains(l[k]) && !l[k].closest(".crumb") && l[k].getBoundingClientRect().top < innerHeight) return l[k];
    return l[0] || null;
  }
  function tvAfterRender(mem) {
    setTimeout(function () {
      if (mem) { window.scrollTo(0, mem.y || 0); var el = findKey(mem.key, app); if (el) return tvFocus(el); }
      tvFocus(firstContent());
    }, 40);
  }
  function tvRefocus() { var c = tvCur(); if (c && document.contains(c)) tvFocus(c); }
  function unhide(el) {  // keep the focused element out from under sticky bars and inside the viewport
    if (!el || !el.getBoundingClientRect) return;
    var inSheet = sheet.contains(el), sc = null, top = 0;  // the player view scrolls the page now (no own scroller)
    var bars = inSheet ? [$("header.top")] : [$("header.top"), $(".tabs"), $(".yjump")];
    bars.forEach(function (b) { if (b && !b.contains(el) && b.offsetHeight) { var r = b.getBoundingClientRect(); if (r.top <= 2 + top && r.bottom > top) top = r.bottom; } });
    var r = el.getBoundingClientRect(), dy = 0, pad = 14;
    if (r.top < 80 && !sc) return;  // tvnav.js is already scrolling this one to the centre
    if (r.top < top + pad) dy = r.top - top - pad;
    else if (r.bottom > innerHeight - pad && r.height < innerHeight - top) dy = r.bottom - innerHeight + pad;
    if (dy) { if (sc) sc.scrollTop += dy; else window.scrollBy(0, dy); }
  }
  function stuckBars() {  // sticky bars currently pinned over scrolled content
    var out = [], hd = $("header.top");
    if (hd && window.scrollY > 4) out.push(hd);
    [$(".tabs"), $(".yjump")].forEach(function (b) {
      if (!b || !b.offsetHeight) return; var pv = b.previousElementSibling;
      if (pv && pv.getBoundingClientRect().bottom < b.getBoundingClientRect().top - 2) out.push(b);
    });
    return out;
  }
  function stickyMask(dir) {  // temporarily take hidden-under-a-bar items (or the bars) out of the D-pad's reach
    if (!sheet.hidden || !window.__tvnav) return [];
    var bars = stuckBars(); if (!bars.length) return [];
    var c = tvCur(), inBar = c && bars.some(function (b) { return b.contains(c); }), bot = 0, out = [];
    bars.forEach(function (b) { bot = Math.max(bot, b.getBoundingClientRect().bottom); });
    var list = window.__tvnav.candidates();
    if (inBar) {
      list.forEach(function (e) { if (!bars.some(function (b) { return b.contains(e); }) && e.getBoundingClientRect().top < bot - 2) out.push(e); });
    } else if (c && dir === "up") {
      var ct = c.getBoundingClientRect().top, above = list.some(function (e) { return !bars.some(function (b) { return b.contains(e); }) && e !== c && e.getBoundingClientRect().bottom <= ct + 2; });
      if (above) list.forEach(function (e) { if (bars.some(function (b) { return b.contains(e); })) out.push(e); });
    }
    out = out.filter(function (e) { return !e.hasAttribute("inert"); });
    out.forEach(function (e) { e.setAttribute("inert", ""); });
    return out;
  }
  function installTV() {
    var T = window.__tvnav; if (!T || T.__ww) return !!T;
    T.__ww = 1; IS_TV = true; document.documentElement.classList.add("tv");
    setTimeout(function () { var c = tvCur(); if ((!c || !document.contains(c) || c.closest("header.top")) && app.querySelector("a,button")) tvFocus(firstContent()); }, 60);
    var key0 = T.key, back0 = T.back;
    T.key = function (k, rep) {
      if (k === "playpause") { if (!togglePlay()) { var tb = $("#lframe [data-tune]"); if (tb) { LV.skip = 0; tuneLive(); } } return; }
      if (k === "ff") return seekBy(10);
      var cc = tvCur(), car = $("#car");
      if ((k === "left" || k === "right") && car && cc && cc.classList.contains("car-btn") && car.contains(cc)) { carGo(CAR.i + (k === "right" ? 1 : -1), true); return; }
      if (k === "rw") return seekBy(-10);
      var tmp = (k === "up" || k === "down" || k === "left" || k === "right") ? stickyMask(k) : [];
      var before = tvCur(), br = before && before.getBoundingClientRect();
      var r; try { r = key0.apply(T, arguments); } finally { tmp.forEach(function (e) { e.removeAttribute("inert"); }); }
      var after = tvCur();
      if ((k === "left" || k === "right") && br && after && after !== before && document.contains(before)) {  // end of a row: stay put instead of jumping diagonally (e.g. up into the header)
        var ar = after.getBoundingClientRect();
        if (Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top) <= 0) { T.focus(before, false); return r; }
      }
      if (k !== "enter") setTimeout(function () { unhide(tvCur()); }, k === "menu" ? 450 : 30);
      return r;
    };
    T.back = function () {
      var a = document.activeElement;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return back0.apply(T, arguments);  // close the keyboard first
      if (document.fullscreenElement) return back0.apply(T, arguments);
      if (!sheet.hidden) { closeSheet(); return true; }
      var r = route()[0] || "";
      if (r === "" || r === "home") {
        if (window.TVNative && window.TVNative.exitApp) { window.TVNative.exitApp(); return true; }
        return false;
      }
      var curH = location.hash || "#/"; NAVSTK.pop();
      while (NAVSTK.length && NAVSTK[NAVSTK.length - 1] === curH) NAVSTK.pop();
      var prev = NAVSTK[NAVSTK.length - 1] || "#/"; if (prev === curH) prev = "#/"; if (!NAVSTK.length) NAVSTK.push(prev);
      NAVSTK.push(location.hash || "#/");  // render() sees prev one below the top and treats it as Back
      location.replace(prev.charAt(0) === "#" ? prev : "#/");
      return true;
    };
    return true;
  }
  (function waitNav() { if (!installTV()) setTimeout(waitNav, 300); })();

  /* ---------------- router ---------------- */
  function route() { var h = location.hash.replace(/^#\/?/, ""); return h.split("/").map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } }); }
  function render() {
    var leaving = NAVSTK[NAVSTK.length - 1];
    if (leaving) FOCUSMEM[leaving] = { y: window.scrollY, key: focusKey(tvCur()) };
    var hh = location.hash || "#/", isBack = NAVSTK.length > 1 && NAVSTK[NAVSTK.length - 2] === hh;
    if (isBack) NAVSTK.pop(); else if (leaving !== hh) NAVSTK.push(hh);
    if (NAVSTK.length > 50) NAVSTK.splice(0, NAVSTK.length - 50);
    if (!sheet.hidden) closeSheet(true, true);
    if (P.mode === "live") { destroyPlayer(); P.mode = null; LV.playing = null; }
    clearInterval(LV.timer);
    var r = route();
    switch (r[0]) {
      case "promotions": viewPromotions(); break;
      case "new": viewNew(); break;
      case "later": viewLater(); break;
      case "account": viewAccount(M.mode); M.mode = null; break;
      case "b": viewHub(r[1], r[2]); break;
      case "s": viewSeries(+r[1]); break;
      case "y": viewYear(r[1], r[2]); break;
      case "search": viewSearch(r.slice(1).join("/")); break;
      case "w": viewWrestler(+r[1]); break;
      case "live": viewLive(r[1]); break;
      default: viewHome();
    }
    window.scrollTo(0, 0);
    if (IS_TV) tvAfterRender(isBack ? FOCUSMEM[hh] : null);
  }
  window.addEventListener("hashchange", function () { if (location.hash === "#/account" && !M.after) { var p = NAVSTK[NAVSTK.length - 1]; if (p && p !== "#/account") M.after = p; } render(); });
  window.addEventListener("popstate", function () { if (!sheet.hidden) closeSheet(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-wl],[data-signout],[data-auth],[data-cdel],[data-car],[data-cardot],[data-pp],[data-unm2],[data-unmute],[data-ch],[data-play],[data-close],[data-auto],[data-kind],[data-sort],[data-jump],[data-more],[data-playq],[data-shuffle],[data-tune],[data-smore]");
    if (!a) return;
    if (a.hasAttribute("data-wl")) { e.preventDefault(); e.stopPropagation(); wlToggle(a.getAttribute("data-wl")); return; }
    if (a.hasAttribute("data-signout")) { e.preventDefault(); signOut(); return; }
    if (a.hasAttribute("data-auth")) { e.preventDefault(); M.mode = a.getAttribute("data-auth"); if (route()[0] !== "account") M.after = location.hash || "#/"; if (location.hash === "#/account") render(); else location.hash = "#/account"; return; }
    if (a.hasAttribute("data-cdel")) { e.preventDefault(); var cid = a.getAttribute("data-cdel"); sbRest("DELETE", "comments?id=eq." + cid).then(function () { CHAT.ids = null; chatPoll(); }, function () {}); return; }
    if (a.hasAttribute("data-car")) { e.preventDefault(); carGo(CAR.i + +a.getAttribute("data-car"), IS_TV && false); return; }
    if (a.hasAttribute("data-cardot")) { e.preventDefault(); carGo(+a.getAttribute("data-cardot")); return; }
    if (a.hasAttribute("data-unmute") || a.hasAttribute("data-unm2")) { e.preventDefault(); unmute(); return; }
    if (a.hasAttribute("data-pp")) { e.preventDefault(); if (!togglePlay() && LV.ch && $("#lframe [data-tune]")) { LV.skip = 0; tuneLive(); } return; }
    if (a.hasAttribute("data-ch")) { e.preventDefault(); goLive(a.getAttribute("data-ch")); return; }
    if (a.hasAttribute("data-play")) { e.preventDefault(); var i = +a.getAttribute("data-play"); if (a.hasAttribute("data-inq") && P.mode === "vod") { P.i = i; renderSheet(); } else openPlayer(i, a.getAttribute("data-q")); return; }
    if (a.hasAttribute("data-close")) { var href = a.getAttribute("href"); e.preventDefault(); if (href && href !== "#") { closeSheet(true, true); location.hash = href; } else closeSheet(); return; }
    e.preventDefault();
    if (a.hasAttribute("data-auto")) { LS.set("ww_auto", !autoplayOn()); a.classList.toggle("on", autoplayOn()); }
    else if (a.hasAttribute("data-kind") || a.hasAttribute("data-sort")) {
      var fk = focusKey(a), sy = window.scrollY;
      if (a.hasAttribute("data-kind")) viewSeries(SER_OPTS.si, a.getAttribute("data-kind"), SER_OPTS.desc); else viewSeries(SER_OPTS.si, SER_OPTS.kind, !SER_OPTS.desc);
      if (IS_TV) { if (fk && fk[0] === "data-sort") fk[2] = ""; window.scrollTo(0, sy); var nf = findKey(fk, app) || $(fk && fk[0] === "data-sort" ? "[data-sort]" : "[data-kind]", app); tvFocus(nf || firstContent()); }
    }
    else if (a.hasAttribute("data-jump")) { var t = document.getElementById(a.getAttribute("data-jump")); if (t) { if (IS_TV) { var f0 = t.querySelector("a,button"); t.scrollIntoView({ block: "start" }); if (f0) { window.__tvnav.focus(f0, false); setTimeout(function () { unhide(f0); }, 30); } } else t.scrollIntoView({ behavior: "smooth", block: "start" }); } }
    else if (a.hasAttribute("data-more")) {
      var p = a.getAttribute("data-more").split(":"), sec = a.parentNode, y = +p[1], s = S[+p[0]];
      var l = s[6].filter(function (i) { return (V[i][4] || 0) === y && (SER_OPTS.kind === "all" || V[i][6] === SER_OPTS.kind); }).sort(function (x1, x2) { return (V[x1][5] || "9").localeCompare(V[x2][5] || "9") || V[x1][1].localeCompare(V[x2][1]); });
      if (SER_OPTS.desc) l.reverse();
      sec.querySelector(".vl").innerHTML = l.map(function (i) { return row(i, SER_OPTS.q); }).join(""); a.remove();
      if (IS_TV) tvFocus(sec.querySelectorAll(".vr")[40] || sec.querySelector(".vr"));
    }
    else if (a.hasAttribute("data-smore")) { var box = $("#sres"), n = +a.getAttribute("data-smore"); box.querySelector("#vres .vl").insertAdjacentHTML("beforeend", box._r.v.slice(n, n + 60).map(function (i) { return row(i, box._q, { logo: 1, series: 1 }); }).join("")); if (n + 60 < box._r.v.length) a.setAttribute("data-smore", n + 60); else { a.remove(); if (IS_TV) tvFocus(box.querySelectorAll("#vres .vr")[n]); } }
    else if (a.hasAttribute("data-playq")) { var q = QUEUES[a.getAttribute("data-playq")]; if (q && q.length) openPlayer(q[0], a.getAttribute("data-playq")); }
    else if (a.hasAttribute("data-shuffle")) { var bl = BY_BRAND[a.getAttribute("data-shuffle")].filter(function (i) { return V[i][6] !== "s"; }), rnd = seed(Date.now() % 1e9); var qs = pick(bl, 60, rnd); openPlayer(qs[0], queue(qs)); }
    else if (a.hasAttribute("data-tune")) { LV.skip = 0; tuneLive(); }
  });
  setInterval(function () { var r = $("#liverail"), f = tvCur(); if (r && !document.hidden && !(f && r.contains(f))) r.innerHTML = CH.map(liveCard).join("");
    var c = $("#car"); if (c && !document.hidden && !(f && c.contains(f)) && !CAR.hold) { c.outerHTML = carHtml(); carInit(); } }, 60000);
  setInterval(function () { var n = Date.now() / 1000; document.querySelectorAll("#liverail [data-evcd]").forEach(function (el) { var d = +el.getAttribute("data-evcd") - n; if (d <= 0) { var r = $("#liverail"); if (r) r.innerHTML = CH.map(liveCard).join(""); } else el.textContent = "starts in " + clock(d); }); }, 1000);

  yt().then(initPlayer); // create the one persistent player now, so the first tap only has to call loadVideoById()
  mcheck();
  window.addEventListener("storage", function (e) { if (e.key === SKEY) { mcheck(); } });
  load().then(function () { render(); msync().then(afterSync); setInterval(function () { if (!document.hidden) msync().then(afterSync); }, 120000); }, function (e) { app.innerHTML = '<div class="wrap"><div class="empty">Could not load the catalog (' + esc(e.message) + "). Pull to refresh.</div></div>"; });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
