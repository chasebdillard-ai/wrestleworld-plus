/* WrestleWorld+ app. Data: catalog.json {series:[[brand,name,type]], v:[[id,title,secs,seriesIdx,year,date,kind]]},
   wrestlers.json [[name,[videoIdx..]]], channels.json {epoch, channels:[{id,name,desc,items:[videoIdx..],total}]}.
   Hash routes: #/ · #/promotions · #/b/<brand>[/<tab>] · #/s/<seriesIdx> · #/y/<brand>/<year> · #/search/<q> · #/w/<wrestlerIdx> · #/live[/<ch>] */
(function () {
  "use strict";
  var B = window.WW_BRANDS, ORDER = window.WW_ORDER, $ = function (s, r) { return (r || document).querySelector(s); };
  var CAT, V, S, WR, CH, EPOCH, NORM = [], SERIES_BY_BRAND = {}, BY_BRAND = {}, YT_READY = null;
  var app = $("#app"), sheet = $("#sheet");
  var KIND = { e: "Full Event", p: "Full Episode", m: "Full Match", s: "Special" }, KINDS = { e: "Full Events", p: "Full Episodes", m: "Full Matches", s: "Specials" };
  var ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
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
  function cwAll() { return LS.get("ww_cw", {}); }
  function cwSave(id, t, d) {
    var c = cwAll();
    if (d && t > d - 25) delete c[id]; else if (t > 20) c[id] = { t: Math.floor(t), d: Math.floor(d || 0), at: Date.now() };
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
      CH.forEach(function (c) { var acc = 0; c.starts = c.items.map(function (i) { var s = acc; acc += V[i][2]; return s; }); c.total = acc; });
    });
  }

  /* ---------------- shared bits ---------------- */
  function blogo(b, cls) { return '<img class="' + (cls || "") + '" src="' + B[b].logo + '" alt="' + esc(B[b].name) + '" loading="lazy">'; }
  function th(i, extra) {
    var v = V[i], b = brandOf(i), c = cwAll()[v[0]];
    return '<div class="th" style="' + bvars(b) + '"><img src="' + thumb(v[0]) + '" alt="" loading="lazy" onerror="this.style.opacity=0">' +
      (extra ? '<span class="bl">' + blogo(b) + "</span>" : "") + '<span class="dur">' + dur(v[2]) + "</span>" +
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
  function chById(id) { for (var i = 0; i < CH.length; i++) if (CH[i].id === id) return CH[i]; return CH[0]; }
  function liveCard(c) {
    var n = chNow(c), v = V[n.i], nx = V[c.items[(n.k + 1) % c.items.length]];
    var art = ' style="background-image:' + (c.id === "network" ? "radial-gradient(120% 90% at 0% 0%,#22E4FF55,transparent 55%),radial-gradient(120% 90% at 100% 100%,#FF3D7F55,transparent 55%)," : "") + "url(" + thumb(v[0], 1) + '),linear-gradient(135deg,' + B[brandOf(n.i)].b1 + ',#0B0B16 70%)"';
    return '<a class="lc ch-' + c.id + '" href="#/live/' + c.id + '" data-ch="' + c.id + '"><div class="art"' + art + '><span class="tag"><i class="dot"></i>Live · ' + esc(c.name) + '</span><div class="chn"><b>' + esc(c.name) + "</b><small>Now: " + esc(v[1]) + '</small></div></div><div class="bar"><i style="width:' + Math.round(n.off / v[2] * 100) + '%"></i></div><div class="nx"><b>Next ' + tod(Date.now() / 1000 + n.left) + "</b> · " + esc(nx[1]) + "</div></a>";
  }

  /* ---------------- views ---------------- */
  function viewHome() {
    setTitle(""); nav("home");
    var rnd = seed(dayseed()), h = "";
    var total = V.length, hrs = Math.round(V.reduce(function (a, v) { return a + v[2]; }, 0) / 3600);
    h += '<div class="wrap"><section class="hero"><div class="glow"></div><span class="kick">11 promotions · one place</span><h1>Every promotion.<br><span>Every era.</span></h1><p>Free, official full matches, shows and pay-per-views from WWE to NJPW — organized by name and year, searchable by wrestler, with four channels running 24/7.</p>' +
      '<div class="stats"><div><b>' + total.toLocaleString() + "</b>videos</div><div><b>" + hrs.toLocaleString() + "</b>hours</div><div><b>" + WR.length.toLocaleString() + "</b>wrestlers indexed</div></div></section>";
    h += '<section class="sec"><div class="sh"><div><h2>Live now</h2><p>24/7 channels — everyone sees the same thing at the same time.</p></div><a class="more" href="#/live">Guide</a></div><div class="rail" id="liverail">' + CH.map(liveCard).join("") + "</div></section>";
    var cw = cwAll(), ids = Object.keys(cw).filter(function (id) { return IDX[id] != null; }).sort(function (a, b) { return cw[b].at - cw[a].at; }).slice(0, 15).map(function (id) { return IDX[id]; });
    if (ids.length) h += '<section class="sec" id="cwrow"><div class="sh"><div><h2>Continue watching</h2></div></div><div class="rail">' + ids.map(function (i) { return card(i); }).join("") + "</div></section>";
    h += '<section class="sec"><div class="sh"><div><h2>Promotions</h2><p>Each hub is branded to its promotion, sorted by name and year.</p></div></div><div class="pg-grid">' + ORDER.map(ptile).join("") + "</div></section>";
    var legends = [["wwe", "WrestleMania"], ["njpw", "G1 Climax"], ["wcw", "Starrcade"], ["aaa", "Triplemanía"], ["tna", "Bound for Glory"], ["aew", "All In"], ["roh", "Final Battle"], ["ecw", "November to Remember"], ["cmll", "Aniversario"], ["nwa", "Crockett Cup"], ["mlw", "Battle Riot"], ["wwe", "Royal Rumble"], ["wcw", "Halloween Havoc"], ["aew", "Full Gear"]];
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
    app.innerHTML = h;
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
    var ch = x.channel ? '<a class="btn" href="#/live/' + x.channel + '">' + ICON.tv + "Watch " + esc(chById(x.channel).name) + "</a>" : "";
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
        h += '<div class="grp"><h3>Pay-per-views & premium events · A–Z</h3><div class="sg">' + main.slice().sort(function (a, c) { return S[a][1].localeCompare(S[c][1]); }).map(function (si) { return seriesCard(si, false); }).join("") + "</div></div>";
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
    var inp = $("#sq"); inp.addEventListener("input", function () { clearTimeout(sTimer); sTimer = setTimeout(function () { history.replaceState(null, "", "#/search/" + encodeURIComponent(inp.value)); renderResults(inp.value); }, 180); });
    renderResults(q); if (!q) setTimeout(function () { inp.focus(); }, 50);
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

  /* ---------------- YouTube ---------------- */
  function yt() {
    if (YT_READY) return YT_READY;
    YT_READY = new Promise(function (res) {
      if (window.YT && window.YT.Player) return res(window.YT);
      window.onYouTubeIframeAPIReady = function () { res(window.YT); };
      var s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
    });
    return YT_READY;
  }
  var P = { player: null, i: -1, q: null, tick: null, mode: null };
  function destroyPlayer() { clearInterval(P.tick); if (P.player && P.player.destroy) { try { P.player.destroy(); } catch (e) {} } P.player = null; }
  function mkPlayer(el, id, start, onEnd, onErr) {
    destroyPlayer();
    el.innerHTML = '<div id="ytp"></div>';
    return yt().then(function (YT) {
      P.player = new YT.Player("ytp", { videoId: id, playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(start || 0) },
        events: { onStateChange: function (e) { if (e.data === 0 && onEnd) onEnd(); }, onError: function () { if (onErr) onErr(); } } });
      return P.player;
    });
  }

  /* ---------------- VOD player sheet ---------------- */
  function openPlayer(i, qk) {
    P.mode = "vod"; P.i = i; P.q = qk && QUEUES[qk] ? QUEUES[qk] : S[V[i][3]][6];
    if (P.q.indexOf(i) < 0) P.q = [i].concat(P.q);
    sheet.hidden = false; document.documentElement.style.overflow = "hidden";
    if (location.hash.indexOf("#/watch/") !== 0) history.pushState({ sheet: 1 }, "", location.hash);
    renderSheet(true);
  }
  function renderSheet(start) {
    var i = P.i, v = V[i], b = brandOf(i), x = B[b], k = P.q.indexOf(i), cw = cwAll()[v[0]];
    var up = P.q.slice(k + 1, k + 13);
    var names = WR.map(function (w, n) { return [w, n]; }).filter(function (p) { return p[0][1].indexOf(i) >= 0; }).slice(0, 8);
    sheet.innerHTML = '<div class="ptop"><div class="pbar"><button class="ib" data-close aria-label="Close">' + ICON.x + '</button><span class="sp"></span><img src="' + x.logo + '" alt="" style="height:24px;width:auto;max-width:100px;object-fit:contain"></div><div class="frame" id="frame"></div></div>' +
      '<div class="pinfo" style="' + bvars(b) + '"><h2>' + esc(v[1]) + '</h2><div class="meta">' + kb(v[6]) + "<span>" + esc(fdate(v)) + "</span><span>· " + dur(v[2]) + '</span><a href="#/s/' + v[3] + '" data-close style="color:var(--b1x);font-weight:700">· ' + esc(S[v[3]][1]) + "</a></div>" +
      '<div class="tools"><button class="tgl' + (autoplayOn() ? " on" : "") + '" data-auto><i></i>Autoplay next</button>' + (cw ? '<span class="kb">Resumed at ' + clock(cw.t) + "</span>" : "") + "</div>" +
      (names.length ? '<div class="wlinks">' + names.map(function (p) { return '<a href="#/w/' + p[1] + '" data-close>' + esc(p[0][0]) + "</a>"; }).join("") + "</div>" : "") +
      (up.length ? '<div class="upn"><h3>Up next</h3><div class="vl">' + up.map(function (j) { return row(j, null, {}); }).join("") + "</div></div>" : "") + "</div>";
    sheet.querySelectorAll(".upn [data-play]").forEach(function (a) { a.setAttribute("data-inq", "1"); });
    sheet.scrollTop = 0;
    mkPlayer($("#frame"), v[0], cw ? cw.t : 0, function () { cwSave(v[0], v[2], v[2]); if (autoplayOn() && P.q[k + 1] != null) { P.i = P.q[k + 1]; renderSheet(); } }, null).then(function () {
      P.tick = setInterval(function () { try { var p = P.player; if (p && p.getCurrentTime && p.getPlayerState() === 1) cwSave(v[0], p.getCurrentTime(), p.getDuration() || v[2]); } catch (e) {} }, 5000);
    });
  }
  function closeSheet(fromPop) {
    if (sheet.hidden) return; destroyPlayer(); sheet.hidden = true; sheet.innerHTML = ""; document.documentElement.style.overflow = "";
    if (!fromPop && history.state && history.state.sheet) history.back();
    var r = route(); if (r[0] === "" || r[0] === "home") { var row = $("#cwrow"); if (row || Object.keys(cwAll()).length) viewHome(); }
  }

  /* ---------------- live channel view ---------------- */
  var LV = { ch: null, timer: null };
  function viewLive(id) {
    var c = chById(id || LS.get("ww_ch", "network")); LS.set("ww_ch", c.id); LV.ch = c;
    setTitle(c.name); nav("live");
    app.innerHTML = '<div class="wrap"><div class="lv-h"><span class="kick">● Live 24/7</span></div><div class="rail chips chsw">' + CH.map(function (x) { return '<a class="chip' + (x.id === c.id ? " on" : "") + '" href="#/live/' + x.id + '">' + esc(x.name) + "</a>"; }).join("") + '</div>' +
      '<div class="lvgrid" style="margin-top:14px"><div><div class="frame" id="lframe" style="border-radius:16px;overflow:hidden"><div class="tune"><button data-tune>' + "<span>" + ICON.play + "</span>Tune in to " + esc(c.name) + '</button></div></div><div class="lv-now" id="lnow"></div></div><div class="guide" id="lguide"></div></div><p style="color:var(--tx3);font-size:12.5px;margin-top:16px">' + esc(c.desc) + " Schedule is computed from the clock, so it is the same on every device.</p>" + foot() + "</div>";
    liveInfo(); clearInterval(LV.timer); LV.timer = setInterval(liveInfo, 5000);
  }
  function liveInfo() {
    var c = LV.ch; if (!c || !$("#lnow")) { clearInterval(LV.timer); return; }
    var n = chNow(c), v = V[n.i], b = brandOf(n.i), now = Date.now() / 1000;
    $("#lnow").innerHTML = '<span class="kick" style="color:var(--c3)">Now playing</span><h2>' + esc(v[1]) + '</h2><div class="meta">' + blogo(b).replace("<img", '<img style="height:18px;width:auto;max-width:70px;object-fit:contain"') + "<span>" + esc(S[v[3]][1]) + "</span><span>· " + esc(fdate(v)) + "</span>" + kb(v[6]) + '</div><div class="lv-prog"><i style="width:' + (n.off / v[2] * 100).toFixed(1) + '%"></i></div><div class="lv-times"><span>' + tod(n.began) + " · " + clock(n.off) + " in</span><span>" + clock(n.left) + " left · ends " + tod(now + n.left) + "</span></div>";
    var g = '<ul><li><b>Now</b><span>' + esc(v[1]) + "</span></li>", t = now + n.left;
    for (var k = 1; k <= 10; k++) { var j = c.items[(n.k + k) % c.items.length]; g += "<li><b>" + tod(t) + "</b><span>" + esc(V[j][1]) + "</span></li>"; t += V[j][2]; }
    $("#lguide").innerHTML = g + "</ul>";
    if (LV.playing && LV.playing !== n.i && P.mode === "live") tuneLive();
  }
  function tuneLive() {
    var c = LV.ch, n = chNow(c); P.mode = "live"; LV.playing = n.i;
    mkPlayer($("#lframe"), V[n.i][0], n.off, function () { setTimeout(tuneLive, 400); }, function () { LV.skip = (LV.skip || 0) + 1; if (LV.skip < 4) { var nn = chNow(c, Date.now() / 1000 + n.left + 1); LV.playing = nn.i; mkPlayer($("#lframe"), V[nn.i][0], 0, function () { setTimeout(tuneLive, 400); }); } });
  }

  /* ---------------- router ---------------- */
  function route() { var h = location.hash.replace(/^#\/?/, ""); return h.split("/").map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } }); }
  function render() {
    if (!sheet.hidden) closeSheet(true);
    if (P.mode === "live") { destroyPlayer(); P.mode = null; LV.playing = null; }
    clearInterval(LV.timer);
    var r = route();
    switch (r[0]) {
      case "promotions": viewPromotions(); break;
      case "b": viewHub(r[1], r[2]); break;
      case "s": viewSeries(+r[1]); break;
      case "y": viewYear(r[1], r[2]); break;
      case "search": viewSearch(r.slice(1).join("/")); break;
      case "w": viewWrestler(+r[1]); break;
      case "live": viewLive(r[1]); break;
      default: viewHome();
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", render);
  window.addEventListener("popstate", function () { if (!sheet.hidden) closeSheet(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-play],[data-close],[data-auto],[data-kind],[data-sort],[data-jump],[data-more],[data-playq],[data-shuffle],[data-tune],[data-smore]");
    if (!a) return;
    if (a.hasAttribute("data-play")) { e.preventDefault(); var i = +a.getAttribute("data-play"); if (a.hasAttribute("data-inq") && P.mode === "vod") { P.i = i; renderSheet(); } else openPlayer(i, a.getAttribute("data-q")); return; }
    if (a.hasAttribute("data-close")) { var href = a.getAttribute("href"); e.preventDefault(); if (href && href !== "#") { closeSheet(true); location.hash = href; } else closeSheet(); return; }
    e.preventDefault();
    if (a.hasAttribute("data-auto")) { LS.set("ww_auto", !autoplayOn()); a.classList.toggle("on", autoplayOn()); }
    else if (a.hasAttribute("data-kind")) viewSeries(SER_OPTS.si, a.getAttribute("data-kind"), SER_OPTS.desc);
    else if (a.hasAttribute("data-sort")) viewSeries(SER_OPTS.si, SER_OPTS.kind, !SER_OPTS.desc);
    else if (a.hasAttribute("data-jump")) { var t = document.getElementById(a.getAttribute("data-jump")); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else if (a.hasAttribute("data-more")) {
      var p = a.getAttribute("data-more").split(":"), sec = a.parentNode, y = +p[1], s = S[+p[0]];
      var l = s[6].filter(function (i) { return (V[i][4] || 0) === y && (SER_OPTS.kind === "all" || V[i][6] === SER_OPTS.kind); }).sort(function (x1, x2) { return (V[x1][5] || "9").localeCompare(V[x2][5] || "9") || V[x1][1].localeCompare(V[x2][1]); });
      if (SER_OPTS.desc) l.reverse();
      sec.querySelector(".vl").innerHTML = l.map(function (i) { return row(i, SER_OPTS.q); }).join(""); a.remove();
    }
    else if (a.hasAttribute("data-smore")) { var box = $("#sres"), n = +a.getAttribute("data-smore"); box.querySelector("#vres .vl").insertAdjacentHTML("beforeend", box._r.v.slice(n, n + 60).map(function (i) { return row(i, box._q, { logo: 1, series: 1 }); }).join("")); if (n + 60 < box._r.v.length) a.setAttribute("data-smore", n + 60); else a.remove(); }
    else if (a.hasAttribute("data-playq")) { var q = QUEUES[a.getAttribute("data-playq")]; if (q && q.length) openPlayer(q[0], a.getAttribute("data-playq")); }
    else if (a.hasAttribute("data-shuffle")) { var bl = BY_BRAND[a.getAttribute("data-shuffle")].filter(function (i) { return V[i][6] !== "s"; }), rnd = seed(Date.now() % 1e9); var qs = pick(bl, 60, rnd); openPlayer(qs[0], queue(qs)); }
    else if (a.hasAttribute("data-tune")) tuneLive();
  });
  setInterval(function () { var r = $("#liverail"); if (r && !document.hidden) r.innerHTML = CH.map(liveCard).join(""); }, 30000);

  load().then(render, function (e) { app.innerHTML = '<div class="wrap"><div class="empty">Could not load the catalog (' + esc(e.message) + "). Pull to refresh.</div></div>"; });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
