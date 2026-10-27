// Accueil, pages promotion et pages show
import { S } from "../state.js";
import { esc, cssUrl, okHttp, okDay, fmt, diff, cd, nextWeekday, dt, ymd, ICON, stars, docId, MOIS } from "../util.js";
import { resolveImage, usedCredits } from "../images.js";

// ---------- données ----------
export function seenId(e) { return docId(e.k + "|" + (e.show || "PLE") + "|" + (e.d || "") + "|" + e.t); }
function seenOf(e) { return S.history[seenId(e)] || null; }
export function recapOf(e) {
  const r = S.recaps[e.k + "|" + (e.show || "PLE") + "|" + (e.d || "")];
  return r && typeof r.txt === "string" ? r : null;
}
function colorOf(k, n) { const pr = S.P[k], s = n && pr.s && pr.s[n]; return (s && s.c) || pr.c; }

function pleOf(k) {
  const pr = S.P[k];
  return pr.e.map(e => ({ kind: "ple", k: k, show: "", br: e.br || "", t: e.t, d: e.d, w: e.w, v: e.v || "", card: e.card || null,
    c: colorOf(k, e.br), l: pr.l, ty: e.br ? "PLE " + e.br : "PLE" }));
}
export function allPle() { let a = []; Object.keys(S.P).forEach(k => { a = a.concat(pleOf(k)); }); return a; }
export function epis(k, n, nb, na) {
  const pr = S.P[k], s = pr.s[n], out = [], base = dt(nextWeekday(s.wd));
  const mk = (t, d) => ({ kind: "ep", k: k, show: n, t: t, d: d, w: s.p, c: colorOf(k, n), l: s.l, ty: n });
  for (let i = -nb; i < na; i++) {
    const x = new Date(base); x.setDate(x.getDate() + 7 * i);
    const d = ymd(x), sp = (s.e || []).filter(e => e.d === d)[0];
    out.push(mk(sp ? sp.t : n, d));
  }
  (s.e || []).forEach(e => { if (!out.some(o => o.d === e.d)) out.push(mk(e.t, e.d)); });
  return out;
}
function sortUp(a) { return a.slice().sort((x, y) => diff(x.d) - diff(y.d)); }
function split(a) {
  return [sortUp(a.filter(e => !e.d || diff(e.d) >= 0)), a.filter(e => e.d && diff(e.d) < 0).sort((x, y) => diff(y.d) - diff(x.d))];
}
export function showOptions() {
  const o = [];
  Object.keys(S.P).forEach(k => { const s = S.P[k].s; if (s) Object.keys(s).forEach(n => o.push(k + " " + n)); else o.push(k); });
  return o;
}

// ---------- fonds : image (héritée ou libre) ou affiche maison ----------
function colors(c) {
  // drapeau à 3 couleurs : voilé pour que le texte blanc reste lisible sur la bande claire
  if (c.length >= 3) return "linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,.42)),linear-gradient(120deg," + c[0] + " 0 34%," + c[1] + " 34% 66%," + c[2] + " 66% 100%)";
  return "linear-gradient(160deg," + c[0] + "," + c[1] + ")";
}
// strong = voile sombre sur toute la surface (pour du texte long par-dessus)
function look(e, strong) {
  const im = resolveImage(e);
  const shade = strong ? "linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.8))"
    : im.src ? "linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,.12) 62%)" : "linear-gradient(to top,rgba(0,0,0,.6),rgba(0,0,0,0) 64%)";
  return { style: "background:" + shade + "," + (im.src ? cssUrl(im.src) + " center/cover," : "") + colors(e.c), poster: !!im.poster, credit: im.credit || null };
}
const plain = c => "background:linear-gradient(to top,rgba(0,0,0,.35),rgba(0,0,0,0))," + colors(c);
function creditLine(cr) {
  return cr ? '<small class="credit">Photo : ' + (okHttp(cr.link) ? '<a href="' + esc(cr.link) + '" target="_blank" rel="noopener">' + esc(cr.author) + "</a>" : esc(cr.author)) + " · " + esc(cr.lic) + "</small>" : "";
}
function dataItem(e) { return ' data-k="' + esc(e.k) + '" data-show="' + esc(e.show || "") + '" data-d="' + esc(e.d || "") + '" data-t="' + esc(e.t) + '"'; }
function editBtn(e, label) {
  return S.isAdmin ? '<button class="cbtn edit" data-act="img" data-kind="' + esc(e.kind) + '" data-k="' + esc(e.k) + '" data-show="' + esc(e.show || "") + '" data-br="' + esc(e.br || "") +
    '" data-t="' + esc(e.t || "") + '" data-d="' + esc(e.d || "") + '" data-label="' + esc(label) + '" aria-label="Changer l’image">' + ICON.img + "</button>" : "";
}
function seenMark(h) { return h ? '<span class="seenmark">' + ICON.check + " Déjà vu" + (h.rating ? " " + stars(h.rating) : "") + "</span>" : ""; }
function aired(e) { return e.d && diff(e.d) <= 0; }
const place = e => e.w && e.w !== "—" ? esc(e.w) : "";
// Affiche maison : taille du titre adaptée au mot le plus long, pour qu'il tienne dans la largeur
function fit(title, width, max, poster) {
  if (!poster) return "";
  const w = Math.max.apply(null, String(title).split(/\s+/).map(x => x.length).concat([1]));
  return ' style="font-size:' + Math.max(12, Math.min(max, Math.floor(width / (w * 0.8)))) + 'px"';
}

// ---------- vignettes horizontales ----------
function pleCard(e, showK) {
  const h = seenOf(e), n = diff(e.d), lk = look(e);
  return '<div class="card' + (lk.poster ? " poster" : "") + (e.d && n < 0 && !h ? " done" : "") + (S.isAdmin ? " hasedit" : "") + '" style="' + esc(lk.style) + '">' +
    '<a class="cover" href="' + esc(e.l) + '" target="_blank" rel="noopener" aria-label="' + esc(e.t) + '"></a>' +
    '<span class="tag">' + (showK ? esc(e.k) + " · " : "") + cd(e.d) + "</span>" + editBtn(e, e.t) +
    "<b" + fit(e.t, 126, 27, lk.poster) + ">" + esc(e.t) + "</b><small>" + fmt(e.d) + (place(e) ? " · " + place(e) : "") + "</small>" + seenMark(h) +
    (aired(e) ? '<button class="cbtn seen' + (h ? " on" : "") + '" data-act="seen"' + dataItem(e) + ' aria-label="Je l’ai vu">' + (h ? ICON.check : ICON.eye) + "</button>" : "") +
    "</div>";
}
function showItem(k, n) { return { kind: "show", k: k, show: n, t: n, c: colorOf(k, n) }; }
// big = show du jour ou le plus récent (vignette large)
function showCard(k, n, withK, big) {
  const s = S.P[k].s[n], next = nextWeekday(s.wd), lk = look(showItem(k, n));
  let tag = (withK ? esc(k) + " · " : "") + cd(next), extra = "";
  if (big) {
    const isToday = diff(next) === 0, d = isToday ? next : ymd(new Date(dt(next).getTime() - 7 * 864e5));
    tag = (withK ? esc(k) + " · " : "") + (isToday ? "CE SOIR" : "DERNIER ÉPISODE");
    const r = recapOf({ k: k, show: n, d: d });
    extra = '<small class="when">' + fmt(d) + " · " + esc(s.p) + "</small>" + (r ? '<p class="snip">' + esc(r.txt) + "</p>" : "");
  }
  return '<div class="card' + (big ? " big" : "") + (lk.poster ? " poster" : "") + (S.isAdmin ? " hasedit" : "") + '" style="' + esc(lk.style) + '">' +
    '<a class="cover" href="#/p/' + encodeURIComponent(k) + "/" + encodeURIComponent(n) + '" aria-label="' + esc(n) + '"></a>' +
    '<span class="tag' + (big ? " hot" : "") + '">' + tag + "</span>" + editBtn(showItem(k, n), k + " " + n) +
    "<b" + fit(n, big ? 270 : 126, big ? 34 : 27, lk.poster) + ">" + esc(n) + "</b>" + (big ? extra : "<small>" + (withK ? fmt(next) : esc(s.j)) + " · " + esc(s.p) + "</small>") + "</div>";
}
// Rangée des shows : ceux du jour (ou le plus récent) en premier et en grand
function showRow(list, withK) {
  list = list.map(x => Object.assign({ d: nextWeekday(S.P[x.k].s[x.n].wd) }, x)).sort((a, b) => diff(a.d) - diff(b.d));
  let big = list.filter(x => diff(x.d) === 0);
  if (!big.length && list.length) big = [list.slice().sort((a, b) => diff(b.d) - diff(a.d))[0]]; // le plus récent = celui dont le prochain est le plus loin
  const rest = list.filter(x => big.indexOf(x) < 0);
  return '<div class="row">' + big.map(x => showCard(x.k, x.n, withK, true)).join("") + rest.map(x => showCard(x.k, x.n, withK, false)).join("") + "</div>";
}
function promoCard(k) {
  const e = { kind: "promo", k: k, t: k, c: S.P[k].c }, lk = look(e);
  return '<div class="card' + (lk.poster ? " poster" : "") + (S.isAdmin ? " hasedit" : "") + '" style="' + esc(lk.style) + '"><a class="cover" href="#/p/' + encodeURIComponent(k) + '" aria-label="' + esc(k) + '"></a>' + editBtn(e, k) +
    "<b" + fit(k, 126, 27, lk.poster) + ">" + esc(k) + "</b><small>" + S.P[k].e.length + " événement(s)</small></div>";
}
function matchTile() {
  return '<a class="matchtile" href="#/matchs"><span class="mt-k">Matchs à revoir</span><b>La sélection de la semaine</b><small>' + S.matches.length +
    " matchs complets sur les chaînes officielles · un match au hasard</small><span class=\"mt-go\">Voir ›</span></a>";
}
function hero(e, label) {
  const lk = look(e);
  return '<a class="hero' + (lk.poster ? " poster" : "") + '" style="' + esc(lk.style) + '" href="' + esc(e.l) + '" target="_blank" rel="noopener"><small>' + label + "</small><b" + fit(e.t, 320, 44, lk.poster) + ">" + esc(e.t) +
    "</b><small>" + fmt(e.d) + (place(e) ? " · " + place(e) : "") + '</small><span class="cd">' + cd(e.d) + "</span>" + (lk.credit ? creditLine(lk.credit).replace(/<a [^>]*>|<\/a>/g, "") : "") + "</a>";
}

// ---------- cartes verticales ----------
function seenInfo(h) {
  if (!h) return "";
  return '<div class="seeninfo"><span class="vu">' + ICON.check + " Vu</span>" + (h.rating ? stars(h.rating) : "") +
    (h.comment ? '<q class="mycom">' + esc(h.comment) + "</q>" : "") + "</div>";
}
function srcLine(r) { return r && r.s ? '<small class="src">Source : ' + (okHttp(r.u) ? '<a href="' + esc(r.u) + '" target="_blank" rel="noopener">' + esc(r.s) + "</a>" : esc(r.s)) + "</small>" : ""; }
function cardList(e) {
  if (!e.card || !e.card.length || (e.d && diff(e.d) < 0)) return "";
  return '<div class="matchcard"><small>Carte annoncée</small><ul>' + e.card.map(m => "<li>" + esc(m) + "</li>").join("") + "</ul></div>";
}
function epCard(e) {
  const h = seenOf(e), r = recapOf(e), x = e.d ? dt(e.d) : null, past = e.d && diff(e.d) < 0;
  const meta = [e.t !== e.ty ? esc(e.ty) : "", place(e), e.d ? cd(e.d) : ""].filter(Boolean).join(" · ");
  return '<article class="ep' + (past ? " past" : "") + '">' +
    '<div class="epdate" style="' + esc(plain(e.c)) + '">' + (x ? "<b>" + x.getDate() + "</b><small>" + MOIS[x.getMonth()] + "</small>" : "<b>?</b><small>date</small>") + "</div>" +
    '<div class="epbody"><a class="eptitle" href="' + esc(e.l) + '" target="_blank" rel="noopener">' + esc(e.t) + "</a>" +
    '<small class="epmeta">' + (meta || "À confirmer") + "</small>" + cardList(e) +
    (r ? '<p class="recap">' + esc(r.txt) + "</p>" + srcLine(r) : "") + seenInfo(h) + "</div>" +
    (aired(e) ? '<button class="seenbtn' + (h ? " on" : "") + '" data-act="seen"' + dataItem(e) + ' aria-label="Je l’ai vu">' + (h ? ICON.check : ICON.eye) + "</button>" : "") +
    "</article>";
}
function epList(list) { return '<div class="eps">' + list.map(epCard).join("") + "</div>"; }

// Grande carte « à regarder »
function feature(e, label, next) {
  const h = seenOf(e), r = recapOf(e), lk = look(e, true);
  return '<section class="feature' + (lk.poster ? " poster" : "") + (S.isAdmin ? " hasedit" : "") + '" style="' + esc(lk.style) + '">' + editBtn(e, e.k + " " + (e.show || e.t)) +
    '<span class="eyebrow">' + label + "</span><h2" + fit(e.t, 320, 46, lk.poster) + ">" + esc(e.t) + "</h2>" +
    "<small>" + fmt(e.d) + (place(e) ? " · " + place(e) : "") + " · " + cd(e.d) + "</small>" + cardList(e) +
    (r ? '<p class="recap">' + esc(r.txt) + "</p>" : '<p class="recap muted">Le résumé de cet épisode arrive bientôt.</p>') +
    '<div class="factions"><a class="btn light" href="' + esc(e.l) + '" target="_blank" rel="noopener">Regarder ↗</a>' +
    (aired(e) ? '<button class="btn glass' + (h ? " on" : "") + '" data-act="seen"' + dataItem(e) + ">" + (h ? ICON.check + " Vu" + (h.rating ? " " + stars(h.rating) : "") : ICON.eye + " Je l’ai vu") + "</button>" : "") + "</div>" +
    (h && h.comment ? '<q class="mycom light">' + esc(h.comment) + "</q>" : "") +
    (r ? srcLine(r) : "") + creditLine(lk.credit) +
    (next ? '<span class="cd">Prochain épisode : ' + fmt(next.d) + " · " + cd(next.d) + "</span>" : "") +
    "</section>";
}

// ---------- articles ----------
export function articles(tags, n, text) {
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return (S.news.items || []).filter(a => a && typeof a.t === "string" && okHttp(a.u) && Array.isArray(a.tags) && tags.every(t => a.tags.indexOf(t) >= 0) && (!text || norm(a.t).indexOf(norm(text)) >= 0))
    .sort((x, y) => String(y.d || "").localeCompare(String(x.d || ""))).slice(0, n);
}
export function artList(list) {
  return '<div class="list">' + list.map(a => '<a class="item" href="' + esc(a.u) + '" target="_blank" rel="noopener"><span class="lbl"><b>' + esc(a.t) +
    "</b><small>" + esc(a.s || "") + '</small></span><span class="rt">' + (okDay(a.d) ? fmt(a.d) : "") + "</span></a>").join("") + "</div>";
}
function artSection(title, list) {
  let h = "<h2>" + title + "</h2>";
  h += list.length ? artList(list) : '<p class="note">Pas d’article récent en français pour l’instant.</p>';
  if (okDay(S.news.updated)) h += '<p class="note small" style="margin-top:8px">Articles mis à jour le ' + fmt(S.news.updated) + "</p>";
  return h;
}
function xSection(hs) {
  if (!hs || !hs.length) return "";
  return '<h2>Sur X</h2><div class="row">' + hs.map(x => '<a class="news" href="https://x.com/' + encodeURIComponent(x) + '" target="_blank" rel="noopener"><span class="nh">@' + esc(x) +
    '</span><small>Les derniers posts du compte officiel</small><span class="go">Ouvrir sur X ↗</span></a>').join("") + "</div>";
}

// ---------- pages ----------
export function homeView() {
  const P = S.P, sp = split(allPle());
  const weekly = [];
  Object.keys(P).forEach(k => { const s = P[k].s; if (s) Object.keys(s).forEach(n => weekly.push({ k: k, n: n })); });
  let first = sp[0].filter(e => e.d)[0], h = "";
  if (first) h += hero(first, "PROCHAIN ÉVÉNEMENT · " + esc(first.k));
  h += '<h2>À venir</h2><div class="row">' + sp[0].map(e => pleCard(e, true)).join("") + "</div>";
  h += "<h2>Shows de la semaine</h2>" + showRow(weekly, true);
  h += artSection("Dernières infos", articles([], 6));
  h += '<h2>Promotions</h2><div class="row">' + Object.keys(P).map(promoCard).join("") + "</div>";
  if (S.matches.length) h += matchTile();
  if (sp[1].length) h += '<h2>Déjà sorti</h2><div class="row">' + sp[1].map(e => pleCard(e, true)).join("") + "</div>";
  return h;
}
export function promoView(k) {
  const pr = S.P[k]; if (!pr) return '<p class="empty">Promotion introuvable.</p>';
  let eps = [], h = "";
  if (pr.s) Object.keys(pr.s).forEach(n => { eps = eps.concat(epis(k, n, 1, 1)); });
  const ple = split(pleOf(k)), ep = split(eps.filter(e => diff(e.d) < 7));
  const first = sortUp(ple[0].concat(ep[0]).filter(e => e.d))[0];
  if (first) h += hero(first, "PROCHAINEMENT · " + esc(k));
  if (pr.s) h += "<h2>Shows hebdo</h2>" + showRow(Object.keys(pr.s).map(n => ({ k: k, n: n })), false);
  h += "<h2>PLE à venir</h2>" + (ple[0].length ? epList(ple[0]) : '<p class="note">Aucun PLE annoncé pour l’instant.</p>');
  if (ep[0].length) h += "<h2>Cette semaine</h2>" + epList(ep[0]);
  const past = split(ple[1].concat(ep[1]))[1];
  if (past.length) h += "<h2>Déjà passé</h2>" + epList(past);
  h += artSection("Actualité", articles([k], 6)) + xSection(pr.x);
  return h;
}
export function showView(k, n) {
  const pr = S.P[k], s = pr && pr.s && pr.s[n]; if (!s) return promoView(k);
  const all = epis(k, n, 4, 4).concat(pleOf(k).filter(p => p.br === n));
  const today = all.filter(e => e.d && diff(e.d) === 0)[0];
  const sp = split(all);
  const feat = today || sp[1][0];
  const up = sp[0].filter(e => e !== feat), past = sp[1].filter(e => e !== feat);
  const label = esc(n.toUpperCase()) + " · " + (today ? (feat.show ? "CE SOIR" : "AUJOURD’HUI") : "DERNIER ÉPISODE");
  let h = feat ? feature(feat, label, today ? null : up.filter(e => e.d)[0]) : "";
  h += '<p class="note showinfo">' + esc(s.j) + " · " + esc(s.p) + " · " + '<a href="' + esc(s.l) + '" target="_blank" rel="noopener">Où regarder ↗</a></p>';
  if (up.length) h += "<h2>À venir</h2>" + epList(up);
  if (past.length) h += "<h2>Épisodes précédents</h2>" + epList(past);
  let al = articles([k, n], 5); if (!al.length) al = articles([k], 5);
  h += artSection("Actualité", al) + xSection(s.x || pr.x);
  return h;
}
export function creditsView() {
  const list = usedCredits();
  return '<a class="back" href="#/">' + ICON.back + " Accueil</a><h1>Crédits photos</h1>" +
    '<p class="note" style="margin-bottom:14px">Les photos ajoutées automatiquement viennent de Wikimedia Commons, sous licence libre.</p>' +
    (list.length ? '<div class="list">' + list.map(f => '<a class="item" href="' + esc(okHttp(f.link) ? f.link : "#") + '" target="_blank" rel="noopener"><span class="lbl"><b>' + esc(f.title || f.q) +
      "</b><small>" + esc(f.author) + " · " + esc(f.lic) + '</small></span><span class="chev">↗</span></a>').join("") + "</div>"
      : '<p class="note">Aucune photo libre utilisée pour l’instant.</p>');
}
export function tabsView(route) {
  const cur = route.name === "promo" ? route.k : "Accueil";
  let h = '<nav class="tabs">' + ["Accueil"].concat(Object.keys(S.P)).map(t =>
    '<a class="tab' + (t === cur ? " on" : "") + '" href="' + (t === "Accueil" ? "#/" : "#/p/" + encodeURIComponent(t)) + '">' + esc(t) + "</a>").join("") + "</nav>";
  if (route.name === "promo" && S.P[route.k] && S.P[route.k].s) {
    h += '<nav class="tabs sub">' + ["Tout"].concat(Object.keys(S.P[route.k].s)).map(t => {
      const on = (t === "Tout" && !route.n) || t === route.n;
      return '<a class="tab' + (on ? " on" : "") + '" href="#/p/' + encodeURIComponent(route.k) + (t === "Tout" ? "" : "/" + encodeURIComponent(t)) + '">' + esc(t) + "</a>";
    }).join("") + "</nav>";
  }
  return h;
}
