// Accueil, pages promotion et pages show
import { S, ACT, imageFor } from "../state.js";
import { esc, cssUrl, okHttp, okDay, fmt, diff, cd, nextWeekday, dt, ymd, ICON, stars, docId, MOIS, modal, toast } from "../util.js";
import { resolveImage, usedCredits } from "../images.js";
import { PARIS, startOf, endOf, isLive, whenParts, fmtAt, hourAt, cityOf, downloadIcs, parisDay } from "../time.js";
import { hlOf, hlHref } from "./highlights.js";
import { favAside } from "./favs.js";
import { champHidden } from "../spoil.js";
import { discoverTile } from "./discover.js";
import { storylineTile } from "./storyline.js";
import { activitySection, activityList } from "./activity.js";
import { rosterTile } from "./roster.js";
import { openOut } from "../applinks.js";
import { pickable, pickTile } from "./picks.js";
import { pollTile } from "./polls.js";

// ---------- données ----------
export function seenId(e) { return docId(e.k + "|" + (e.show || "PLE") + "|" + (e.d || "") + "|" + e.t); }
function seenOf(e) { return S.history[seenId(e)] || null; }
export function recapOf(e) {
  const r = S.recaps[e.k + "|" + (e.show || "PLE") + "|" + (e.d || "")];
  return r && typeof r.txt === "string" ? r : null;
}
export function colorOf(k, n) { const pr = S.P[k], s = n && pr.s && pr.s[n]; return (s && s.c) || pr.c; }

function pleOf(k) {
  const pr = S.P[k];
  return pr.e.map(e => {
    const bs = e.br && pr.s && pr.s[e.br];
    return { kind: "ple", k: k, show: "", br: e.br || "", t: e.t, d: e.d, w: e.w, v: e.v || "", card: e.card || null,
      c: colorOf(k, e.br), l: pr.l, ty: e.br ? "PLE " + e.br : "PLE",
      h: e.h || "", tz: e.tz || "", dur: e.dur || 240, city: e.w && e.w !== "—" && !/habituel|confirmer/.test(e.w) ? e.w : "",
      fr: e.fr || (bs && bs.fr) || pr.fr || [], p: "", pl: "", nf: e.nf || "", nfhub: pr.nfhub || "", wl: Array.isArray(e.wl) ? e.wl : null };
  });
}
export function allPle() { let a = []; Object.keys(S.P).forEach(k => { a = a.concat(pleOf(k)); }); return a; }
export function epis(k, n, nb, na) {
  const pr = S.P[k], s = pr.s[n], out = [], base = dt(nextWeekday(s.wd));
  const mk = (t, d) => ({ kind: "ep", k: k, show: n, t: t, d: d, w: frName({ fr: s.fr || pr.fr, p: s.p }), c: colorOf(k, n), l: s.l, ty: n,
    h: s.h || "", tz: s.tz || "", dur: s.dur || 120, fr: s.fr || pr.fr || [], p: s.p || "", pl: s.l || "", nf: s.nf || "", nfhub: pr.nfhub || "" });
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
// ---------- diffusion, horaires, direct ----------
export function frName(e) { const f = (e.fr || [])[0]; return (f && f.n) || e.p || ""; }
// Ligne « 🕗 mar. 4 nov. 02 h 00 à Paris · lun. 3 nov. 20 h 00 à New York » (événements à venir ou du jour)
export function timeLine(e, light) {
  if (!e.d || diff(e.d) < -1) return "";
  const w = whenParts(e);
  if (!w) return e.d && diff(e.d) >= 0 && e.kind === "ple" ? '<small class="when2' + (light ? " light" : "") + '">🕗 Horaire à confirmer</small>' : "";
  return '<small class="when2' + (light ? " light" : "") + '">🕗 <b>' + w.paris + "</b> à Paris" + (w.local ? '<span class="loc"> · ' + esc(w.local) + "</span>" : "") + "</small>";
}
// Date courte d'une vignette : heure de Paris si connue
function shortWhen(e) { const t = startOf(e); return t ? fmtAt(t, PARIS) : fmt(e.d); }
export function liveNow() {
  let a = allPle();
  Object.keys(S.P).forEach(k => { const s = S.P[k].s; if (s) Object.keys(s).forEach(n => { a = a.concat(epis(k, n, 1, 1)); }); });
  const seen = {};
  return a.filter(e => isLive(e)).filter(e => { const id = e.k + e.show + e.d + e.t; if (seen[id]) return false; return (seen[id] = true); });
}
function findItem(d) {
  let a = allPle();
  if (d.show) a = epis(d.k, d.show, 6, 2);
  return a.find(e => e.k === d.k && (e.show || "") === (d.show || "") && e.d === d.d && (!d.t || e.t === d.t)) || null;
}
function itemData(e) { return ' data-k="' + esc(e.k) + '" data-show="' + esc(e.show || "") + '" data-d="' + esc(e.d || "") + '" data-t="' + esc(e.t) + '"'; }
function liveCard(e) {
  const lk = look(e, true);
  return '<button class="live' + (lk.poster ? " poster" : "") + '" style="' + esc(lk.style) + '" data-act="watch"' + itemData(e) + ">" +
    '<span class="livebadge"><i></i>EN DIRECT</span><b' + fit(e.t, 320, 44, lk.poster) + ">" + esc(e.t) + "</b>" +
    "<small>" + esc(e.k) + (e.show ? " · " + esc(e.show) : "") + " · depuis " + hourAt(startOf(e), PARIS) + " · jusqu’à " + hourAt(endOf(e), PARIS) + " environ (heure de Paris)</small>" +
    '<span class="livego">' + ICON.play + " Regarder" + (frName(e) ? " sur " + esc(frName(e)) : "") + "</span></button>";
}
export function liveSection(filter) {
  const list = liveNow().filter(filter || (() => true));
  return list.length ? '<div class="lives">' + list.map(liveCard).join("") + "</div>" : "";
}
// Netflix : page du show (Raw, SmackDown, NXT, chaque PLE), sinon la page WWE de Netflix, sinon la recherche
const NFID = /^\d{5,10}$/;
export function netflixUrl(e) {
  if (NFID.test(e.nf || "")) return "https://www.netflix.com/title/" + e.nf;
  if (NFID.test(e.nfhub || "")) return "https://www.netflix.com/browse/genre/" + e.nfhub;
  return "https://www.netflix.com/search?q=" + encodeURIComponent(e.k + " " + (e.show || e.t));
}
// Où regarder : lien direct de l'épisode (préparé par la mise à jour), plateformes officielles en France, puis aux États-Unis
export function watchLinks(e) {
  const out = [], seen = {};
  const add = (n, u, extra) => { if (!okHttp(u) || seen[u]) return; seen[u] = 1; out.push(Object.assign({ n: n, u: u }, extra || {})); };
  const h = e.d ? hlOf(e.k, e.show || "PLE", e.d) : null;
  (h && Array.isArray(h.w) ? h.w : []).forEach(x => { if (x) add(x.n || "Vidéo", x.u, { direct: true }); });
  (Array.isArray(e.wl) ? e.wl : []).forEach(x => { if (x) add(x.n || "Vidéo", x.u, { direct: true }); });
  (e.fr || []).forEach(f => { if (!okHttp(f.u)) return; const nf = /netflix\.com/.test(f.u); add(f.n, nf ? netflixUrl(e) : f.u, { fr: true, nf: nf }); });
  if (e.p && okHttp(e.pl)) { const nf = /netflix\.com/.test(e.pl); add(e.p, nf ? netflixUrl(e) : e.pl, { us: true, nf: nf }); }
  if (!out.length && okHttp(e.l)) add("Site officiel", e.l, {});
  return out;
}
// Netflix ne donne pas de lien par épisode : la page du show s'ouvre, on indique la date à choisir
const epNote = (e, x) => x.nf && e.kind === "ep" ? " · épisode du " + fmt(e.d) : "";
function openLink(u) { if (!openOut(u)) window.open(u, "_blank", "noopener"); }
ACT.watch = el => {
  const e = findItem(el.dataset); if (!e) return;
  const links = watchLinks(e), fr = links.filter(x => x.fr), us = links.filter(x => x.us), direct = links.filter(x => x.direct), other = links.filter(x => !x.fr && !x.us && !x.direct);
  // « Voir le show » : un seul choix possible -> on ouvre directement l'appli ou la page
  if (el.dataset.direct === "1") {
    const one = direct[0] || (fr.length === 1 ? fr[0] : null) || (links.length === 1 ? links[0] : null);
    if (one) { if (one.nf && e.kind === "ep") toast("Netflix : choisis l’épisode du " + fmt(e.d) + " dans la liste", { ms: 4500 }); openLink(one.u); return; }
  }
  const btn = (x, ghost) => '<a class="btn wide' + (ghost ? " ghost" : "") + '" href="' + esc(x.u) + '" target="_blank" rel="noopener">Regarder sur ' + esc(x.n) + esc(epNote(e, x)) + " ↗</a>";
  modal((box, close) => {
    box.innerHTML = "<h3>" + esc(e.t) + '</h3><p class="sub">' + (isLive(e) ? "🔴 En direct maintenant" : esc(e.k) + (e.d ? " · " + fmt(e.d) : "")) + "</p>" +
      (direct.length ? '<p class="sub" style="margin-bottom:6px">Ce show directement</p>' + direct.map(x => btn(x)).join("") : "") +
      (fr.length ? '<p class="sub" style="margin:' + (direct.length ? "14px 16px 6px" : "0 0 6px") + '">En France</p>' + fr.map(x => btn(x, direct.length > 0)).join("") : "") +
      (fr.some(x => x.nf) && e.kind === "ep" ? '<p class="note small" style="margin:6px 16px 0">Netflix ouvre la page de ' + esc(e.show) + " : choisis l’épisode du " + esc(fmt(e.d)) + " dans la liste.</p>" : "") +
      (us.length ? '<p class="sub" style="margin:14px 16px 6px">Aux États-Unis</p>' + us.map(x => btn(x, true)).join("") : "") +
      other.map(x => '<a class="btn wide" href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.n) + " ↗</a>").join("") +
      '<button class="btn wide ghost" style="margin-top:12px" data-close>Fermer</button>';
    box.addEventListener("click", ev => { if (ev.target.closest("[data-close]")) close(); });
  });
};
// « Me rappeler » : ajoute l'événement au calendrier du téléphone
function remindBtn(e, cls) {
  if (!e.d || diff(e.d) < 0) return "";
  return '<button class="' + (cls || "remind") + '" data-act="remind"' + itemData(e) + ' aria-label="Me rappeler">' + ICON.bell + (cls && cls.indexOf("btn ") !== 0 ? "" : " Me rappeler") + "</button>";
}
ACT.remind = el => {
  const e = findItem(el.dataset); if (!e) return;
  const fr = frName(e);
  downloadIcs(e, (fr ? "À regarder sur " + fr + ". " : "") + "Ajouté depuis TCC TV.");
  toast("Ouvre le fichier pour l’ajouter à ton calendrier" + (startOf(e) ? " (rappel 1 h avant)" : ""), { ms: 4000 });
};
// Bouton « Highlights » (vidéos + résultats) d'un show passé
function hlBtn(k, show, d, cls) {
  if (!d || !hlOf(k, show, d)) return "";
  return '<a class="' + (cls || "hlbtn") + '" href="' + hlHref(k, show, d) + '" aria-label="Highlights">' + ICON.play + "<span>Highlights</span></a>";
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
export const plain = c => "background:linear-gradient(to top,rgba(0,0,0,.35),rgba(0,0,0,0))," + colors(c);
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
  return '<div class="card' + (lk.poster ? " poster" : "") + (e.d && n < 0 ? " past" : "") + (h ? " seen" : "") + (S.isAdmin ? " hasedit" : "") + '" style="' + esc(lk.style) + '">' +
    '<a class="cover" href="' + esc(e.l) + '" target="_blank" rel="noopener" aria-label="' + esc(e.t) + '"></a>' +
    '<span class="tag">' + (showK ? esc(e.k) + " · " : "") + cd(e.d) + "</span>" + editBtn(e, e.t) +
    "<b" + fit(e.t, 126, 27, lk.poster) + ">" + esc(e.t) + "</b><small>" + (n >= 0 ? shortWhen(e) : fmt(e.d)) + (place(e) ? " · " + place(e) : "") + "</small>" + seenMark(h) +
    (n >= 0 && pickable(e) ? '<button class="minibtn" data-act="pick"' + dataItem(e) + ">🎯 Pronostic</button>" : "") +
    (aired(e) ? '<button class="cbtn seen' + (h ? " on" : "") + '" data-act="seen"' + dataItem(e) + ' aria-label="Je l’ai vu">' + (h ? ICON.check : ICON.eye) + "</button>" : remindBtn(e, "cbtn seen")) +
    "</div>";
}
// ---------- Sortis récemment (7 derniers jours), puis Déjà sorti ----------
const RECENT_DAYS = 7, PAST_DAYS = 28;
// Jours écoulés depuis la diffusion (jour de Paris quand l'heure est connue)
function agoDays(e) {
  const t = startOf(e);
  if (t) return Math.round((Date.parse(parisDay() + "T12:00:00Z") - Date.parse(parisDay(t) + "T12:00:00Z")) / 864e5);
  return -diff(e.d);
}
// Diffusé et terminé (sans heure connue : à partir du lendemain)
function isOut(e) { const t = endOf(e); return t ? Date.now() >= t : !!e.d && diff(e.d) < 0; }
function agoLabel(n) { return n <= 0 ? "AUJOURD’HUI" : n === 1 ? "HIER" : "IL Y A " + n + " JOURS"; }
function catOf(e) { return e.kind === "ple" ? "ple" : e.t !== e.show ? "spec" : "hebdo"; }
function outItems() {
  let a = allPle().filter(e => okDay(e.d));
  Object.keys(S.P).forEach(k => { const s = S.P[k].s; if (s) Object.keys(s).forEach(n => { a = a.concat(epis(k, n, Math.ceil(PAST_DAYS / 7) + 1, 1)); }); });
  const seen = {};
  return a.filter(e => okDay(e.d) && isOut(e))
    .filter(e => { const id = e.k + "|" + (e.show || "PLE") + "|" + e.d; if (seen[id]) return false; return (seen[id] = true); })
    .map(e => Object.assign({ ago: agoDays(e) }, e)).filter(e => e.kind === "ple" || e.ago <= PAST_DAYS)
    .sort((x, y) => y.d.localeCompare(x.d) || (startOf(y) - startOf(x)));
}
let pastF = "";
function outCard(e, recent) {
  const h = seenOf(e), lk = look(e), sh = e.show || "PLE", hl = hlOf(e.k, sh, e.d), cat = catOf(e);
  const href = hl ? hlHref(e.k, sh, e.d) : e.kind === "ple" ? e.l : "#/p/" + encodeURIComponent(e.k) + "/" + encodeURIComponent(e.show);
  const ext = !hl && e.kind === "ple";
  const tag = recent ? agoLabel(e.ago) : esc(e.k) + " · " + (cat === "ple" ? "PLE" : cat === "spec" ? "Spécial" : esc(e.show));
  return '<div class="card out' + (recent ? " fresh" : " past") + (lk.poster ? " poster" : "") + (h ? " seen" : "") + '" data-cat="' + cat + '" style="' + esc(lk.style) + '"' +
    (!recent && pastF && pastF !== cat ? " hidden" : "") + ">" +
    '<a class="cover" href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ' aria-label="' + esc(e.t) + '"></a>' +
    '<span class="tag' + (recent && e.ago <= 1 ? " hot" : "") + '">' + tag + "</span>" +
    "<b" + fit(e.t, 126, 27, lk.poster) + ">" + esc(e.t) + "</b><small>" + (recent ? esc(e.k) + " · " : "") + (e.kind === "ep" ? (recent ? "" : "Épisode du ") + fmt(e.d) : fmt(e.d) + (place(e) ? " · " + place(e) : "")) + "</small>" + seenMark(h) +
    '<button class="minibtn" data-act="watch" data-direct="1"' + dataItem(e) + ">" + ICON.play + " Voir le show</button>" +
    (hl ? '<span class="hlmini">' + ICON.play + " Highlights</span>" : "") +
    '<button class="cbtn seen' + (h ? " on" : "") + '" data-act="seen"' + dataItem(e) + ' aria-label="Je l’ai vu">' + (h ? ICON.check : ICON.eye) + "</button></div>";
}
function recentSection(list) {
  list = list.filter(e => e.ago <= RECENT_DAYS - 1);
  return list.length ? '<h2>Sortis récemment</h2><div class="row">' + list.map(e => outCard(e, true)).join("") + "</div>" : "";
}
function pastSection(list) {
  list = list.filter(e => e.ago > RECENT_DAYS - 1);
  if (!list.length) return "";
  if (pastF && !list.some(e => catOf(e) === pastF)) pastF = "";
  const cats = [["", "Tout"], ["hebdo", "Shows hebdo"], ["ple", "PLE"], ["spec", "Épisodes spéciaux"]].filter(c => !c[0] || list.some(e => catOf(e) === c[0]));
  return "<h2>Déjà sorti</h2>" + (cats.length > 2 ? '<nav class="tabs pastf" style="padding-top:0">' + cats.map(c => '<button class="tab' + (pastF === c[0] ? " on" : "") + '" data-act="pastf" data-c="' + c[0] + '">' + c[1] + "</button>").join("") + "</nav>" : "") +
    '<div class="row pastrow">' + list.map(e => outCard(e, false)).join("") + "</div>";
}
ACT.pastf = el => {
  pastF = el.dataset.c || "";
  document.querySelectorAll(".pastf .tab").forEach(b => b.classList.toggle("on", b === el));
  document.querySelectorAll(".pastrow .card").forEach(c => { c.hidden = !!pastF && c.dataset.cat !== pastF; });
  const r = document.querySelector(".pastrow"); if (r) r.scrollLeft = 0;
};
function showItem(k, n) { return { kind: "show", k: k, show: n, t: n, c: colorOf(k, n) }; }
// big = show du jour ou le plus récent (vignette large)
function showCard(k, n, withK, big) {
  const s = S.P[k].s[n], next = nextWeekday(s.wd), lk = look(showItem(k, n));
  let tag = (withK ? esc(k) + " · " : "") + cd(next), extra = "";
  if (big) {
    const isToday = diff(next) === 0, d = isToday ? next : ymd(new Date(dt(next).getTime() - 7 * 864e5));
    tag = (withK ? esc(k) + " · " : "") + (isToday ? "CE SOIR" : "DERNIER ÉPISODE");
    const r = recapOf({ k: k, show: n, d: d });
    big = S.history[seenId({ k: k, show: n, d: d, t: (s.e || []).filter(x => x.d === d).map(x => x.t)[0] || n })] ? "seen" : true;
    const ep = epis(k, n, 1, 1).find(x => x.d === d) || { d: d };
    const st = startOf(ep);
    extra = '<small class="when">' + fmt(d) + " · " + esc(frName(ep) || s.p) + (st && diff(d) >= 0 ? " · " + fmtAt(st, PARIS) + " à Paris" : "") + "</small>" + (r ? '<p class="snip">' + esc(r.txt) + "</p>" : "");
    // highlights de cet épisode, sinon du précédent
    const prev = ymd(new Date(dt(d).getTime() - 7 * 864e5));
    extra += hlBtn(k, n, d, "hlbtn side") || hlBtn(k, n, prev, "hlbtn side");
  }
  return '<div class="card' + (big ? " big" : "") + (big === "seen" ? " seen" : "") + (lk.poster ? " poster" : "") + (S.isAdmin ? " hasedit" : "") + '" style="' + esc(lk.style) + '">' +
    '<a class="cover" href="#/p/' + encodeURIComponent(k) + "/" + encodeURIComponent(n) + '" aria-label="' + esc(n) + '"></a>' +
    '<span class="tag' + (big ? " hot" : "") + '">' + tag + "</span>" + editBtn(showItem(k, n), k + " " + n) +
    "<b" + fit(n, big ? 300 : 126, big ? 40 : 27, lk.poster) + ">" + esc(n) + "</b>" + (big ? extra : "<small>" + (withK ? fmt(next) : esc(s.j)) + " · " + esc(frName({ fr: s.fr || S.P[k].fr, p: s.p })) + "</small>") + "</div>";
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
// Vignette « Titres » : champions actuels de la promotion ou du show
export function titlesFor(k, n) {
  const all = (S.titles || []).filter(t => t && t.k === k);
  if (!n) return all;
  const own = all.filter(t => t.show === n || (Array.isArray(t.shows) && t.shows.indexOf(n) >= 0));
  return own.length ? own : all.filter(t => !t.show);
}
function titlesTile(k, n) {
  const list = titlesFor(k, n); if (!list.length) return "";
  const names = list.some(champHidden) ? "champions masqués (mode sans spoiler)" : list.slice(0, 3).map(t => t.c.replace(/\s*\(.*\)$/, "")).join(", ");
  return '<a class="titletile" href="#/titres/' + encodeURIComponent(k) + (n ? "/" + encodeURIComponent(n) : "") + '"><span class="tt-belt" style="' + esc(plain(colorOf(k, n))) + '">🏆</span>' +
    '<span class="tt-txt"><b>Titres' + (n ? " de " + esc(n) : " " + esc(k)) + "</b><small>" + list.length + " ceinture" + (list.length > 1 ? "s" : "") + " · " + esc(names) + (list.length > 3 ? "…" : "") + "</small></span>" +
    '<span class="chev">›</span></a>';
}
function matchTile() {
  return '<a class="matchtile" href="#/matchs"><span class="mt-k">Matchs à découvrir</span><b>La sélection de la semaine</b><small>' + S.matches.length +
    " matchs complets sur les chaînes officielles · un match au hasard</small><span class=\"mt-go\">Voir ›</span></a>";
}
function hero(e, label) {
  const lk = look(e);
  return '<a class="hero' + (lk.poster ? " poster" : "") + '" style="' + esc(lk.style) + '" href="' + esc(e.l) + '" target="_blank" rel="noopener"><small>' + label + "</small><b" + fit(e.t, 320, 44, lk.poster) + ">" + esc(e.t) +
    "</b><small>" + fmt(e.d) + (place(e) ? " · " + place(e) : "") + "</small>" + timeLine(e, true) + '<span class="cd">' + cd(e.d) + "</span>" + (lk.credit ? creditLine(lk.credit).replace(/<a [^>]*>|<\/a>/g, "") : "") + "</a>";
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
  return '<div class="matchcard"><small>Carte annoncée</small><ul>' + e.card.map(m => "<li>" + esc(m) + "</li>").join("") + "</ul>" +
    (e.kind === "ple" && pickable(e) ? '<button class="btn small pickbtn" data-act="pick"' + itemData(e) + ">🎯 Faire mon pronostic</button>" : "") + "</div>";
}
function epCard(e) {
  const h = seenOf(e), r = recapOf(e), x = e.d ? dt(e.d) : null, past = e.d && diff(e.d) < 0;
  const meta = [e.t !== e.ty ? esc(e.ty) : "", place(e), e.d ? cd(e.d) : ""].filter(Boolean).join(" · ");
  return '<article class="ep' + (past ? " past" : "") + (h ? " seen" : "") + '">' +
    '<div class="epdate" style="' + esc(plain(e.c)) + '">' + (x ? "<b>" + x.getDate() + "</b><small>" + MOIS[x.getMonth()] + "</small>" : "<b>?</b><small>date</small>") + "</div>" +
    '<div class="epbody"><a class="eptitle" href="' + esc(e.l) + '" target="_blank" rel="noopener">' + esc(e.t) + "</a>" +
    '<small class="epmeta">' + (meta || "À confirmer") + "</small>" + (past ? "" : timeLine(e)) + cardList(e) +
    (r ? '<p class="recap">' + esc(r.txt) + "</p>" + srcLine(r) : "") + seenInfo(h) +
    '<div class="eplinks">' + (aired(e) ? '<button class="hllink watchlink" data-act="watch" data-direct="1"' + itemData(e) + ">" + ICON.play + " Voir le show</button>" + hlBtn(e.k, e.show || "PLE", e.d, "hllink") : "") + (e.kind === "ple" ? remindBtn(e) : "") + "</div></div>" +
    (aired(e) ? '<button class="seenbtn' + (h ? " on" : "") + '" data-act="seen"' + dataItem(e) + ' aria-label="Je l’ai vu">' + (h ? ICON.check : ICON.eye) + "</button>" : "") +
    "</article>";
}
function epList(list) { return '<div class="eps">' + list.map(epCard).join("") + "</div>"; }

// Grande carte « à regarder »
function feature(e, label, next) {
  const h = seenOf(e), r = recapOf(e), lk = look(e, true);
  return '<section class="feature' + (lk.poster ? " poster" : "") + (h ? " seen" : "") + (S.isAdmin ? " hasedit" : "") + '" style="' + esc(lk.style) + '">' + editBtn(e, e.k + " " + (e.show || e.t)) +
    '<span class="eyebrow">' + label + "</span><h2" + fit(e.t, 320, 46, lk.poster) + ">" + esc(e.t) + "</h2>" +
    "<small>" + fmt(e.d) + (place(e) ? " · " + place(e) : "") + " · " + cd(e.d) + "</small>" + timeLine(e, true) + cardList(e) +
    (r ? '<p class="recap">' + esc(r.txt) + "</p>" : '<p class="recap muted">Le résumé de cet épisode arrive bientôt.</p>') +
    hlBtn(e.k, e.show || "PLE", e.d, "hlbtn side") +
    '<div class="factions"><button class="btn light" data-act="watch"' + itemData(e) + ">Regarder" + (frName(e) ? " sur " + esc(frName(e)) : "") + " ↗</button>" +
    (e.kind === "ple" ? remindBtn(e, "btn glass") : "") +
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
  let first = sp[0].filter(e => e.d)[0], h = liveSection();
  if (first) h += hero(first, "PROCHAIN ÉVÉNEMENT · " + esc(first.k));
  h += "<h2>Shows de la semaine</h2>" + showRow(weekly, true);
  const out = outItems();
  h += recentSection(out);
  h += '<h2>À venir</h2><div class="row">' + sp[0].map(e => pleCard(e, true)).join("") + "</div>";
  const st = storylineTile(), dc = discoverTile();
  if (st || dc) h += '<div class="tiles2">' + st + dc + "</div>";
  const pt = pollTile(), pk = pickTile();
  if (pt || pk) h += '<div class="tiles2 play">' + pt + pk + "</div>";
  h += artSection("Dernières infos", articles([], 6));
  h += '<div class="actsec">' + activitySection() + "</div>";
  h += '<h2>Promotions</h2><div class="row">' + Object.keys(P).map(promoCard).join("") + "</div>";
  if (S.matches.length) h += matchTile();
  h += pastSection(out);
  const side = favAside().replace("</aside>", S.user ? '<h2>Activité des membres</h2>' + activityList(12) + "</aside>" : "</aside>");
  return '<div class="withside"><div class="mainc">' + h + "</div>" + side + "</div>";
}
export function promoView(k) {
  const pr = S.P[k]; if (!pr) return '<p class="empty">Promotion introuvable.</p>';
  let eps = [], h = "";
  if (pr.s) Object.keys(pr.s).forEach(n => { eps = eps.concat(epis(k, n, 1, 1)); });
  const ple = split(pleOf(k)), ep = split(eps.filter(e => diff(e.d) < 7));
  const first = sortUp(ple[0].concat(ep[0]).filter(e => e.d))[0];
  h += liveSection(e => e.k === k);
  if (first) h += hero(first, "PROCHAINEMENT · " + esc(k));
  if (pr.s) h += "<h2>Shows hebdo</h2>" + showRow(Object.keys(pr.s).map(n => ({ k: k, n: n })), false);
  h += titlesTile(k, "") + rosterTile(k, "");
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
  let h = liveSection(e => e.k === k && (e.show === n || e.br === n));
  h += feat ? feature(feat, label, today ? null : up.filter(e => e.d)[0]) : "";
  const nx = sp[0].filter(e => e.d && e.kind === "ep")[0], st = nx ? startOf(nx) : 0, fr = (s.fr || pr.fr || []).map(f => f.n).join(", ");
  h += '<p class="note showinfo">' + esc(s.j) + (s.h ? " à " + esc(s.h.replace(":", " h ")) + (s.tz ? " (heure de " + esc(cityOf(s.tz)) + ")" : "") : "") +
    (st ? ", soit <b>" + fmtAt(st, PARIS) + "</b> à Paris pour le prochain" : "") + "<br>" +
    (fr ? "En France : " + esc(fr) + " · " : "") + "Aux États-Unis : " + esc(s.p) + " · " + '<button class="linkbtn inline" data-act="watch"' + (nx ? itemData(nx) : "") + ">Où regarder ↗</button></p>";
  h += titlesTile(k, n) + rosterTile(k, n);
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
// Logo d'un onglet : choisi par l'admin, sinon celui du calendrier (img/logos/…), sinon rien (nom écrit)
export function logoOf(k, n) {
  const own = imageFor("logo:" + k + (n ? "|" + n : ""));
  if (own) return own;
  const pr = S.P[k], f = n ? (pr && pr.s && pr.s[n] && pr.s[n].logo) : (pr && pr.logo);
  return typeof f === "string" && (/^img\/[\w\/.-]+\.(png|jpe?g|webp|svg)$/.test(f) || /^data:image\//.test(f)) ? f : "";
}
function tab(label, href, on, logo) {
  if (label === "Accueil") return '<a class="tab home' + (on ? " on" : "") + '" href="' + href + '" aria-label="Accueil">' + ICON.home + "</a>";
  return logo ? '<a class="tab logo' + (on ? " on" : "") + '" href="' + href + '" aria-label="' + esc(label) + '"><img src="' + esc(logo) + '" alt="' + esc(label) + '"></a>'
    : '<a class="tab' + (on ? " on" : "") + '" href="' + href + '">' + esc(label) + "</a>";
}
// Promotions rangées dans l'onglet d'une autre : la AAA dans la WWE (après NXT), la ROH dans l'AEW (après Collision)
export const PARENT = { AAA: "WWE", ROH: "AEW" };
const AFTER = { AAA: "NXT", ROH: "Collision" };
export const hostOf = k => (PARENT[k] && S.P[PARENT[k]] ? PARENT[k] : k);
export function tabsView(route) {
  const cur = route.name === "promo" ? hostOf(route.k) : "Accueil";
  const top = Object.keys(S.P).filter(k => hostOf(k) === k);
  let h = '<nav class="tabs">' + ["Accueil"].concat(top).map(t => tab(t, t === "Accueil" ? "#/" : "#/p/" + encodeURIComponent(t), t === cur, t === "Accueil" ? "" : logoOf(t, ""))).join("") + "</nav>";
  if (route.name === "promo" && S.P[cur]) {
    const kids = Object.keys(PARENT).filter(c => PARENT[c] === cur && S.P[c]), shows = Object.keys(S.P[cur].s || {});
    // ordre : Tout, les shows, et chaque promotion rangée juste après le show indiqué (sinon à la fin)
    const items = ["Tout"].concat(shows);
    kids.forEach(c => { const i = items.indexOf(AFTER[c]); items.splice(i >= 0 ? i + 1 : items.length, 0, { kid: c }); });
    if (shows.length || kids.length) h += '<nav class="tabs sub">' + items.map(t => {
      if (t.kid) return tab(t.kid, "#/p/" + encodeURIComponent(t.kid), route.k === t.kid, logoOf(t.kid, ""));
      const on = route.k === cur && ((t === "Tout" && !route.n) || t === route.n);
      return tab(t, "#/p/" + encodeURIComponent(cur) + (t === "Tout" ? "" : "/" + encodeURIComponent(t)), on, t === "Tout" ? "" : logoOf(cur, t));
    }).join("") + "</nav>";
    // les shows de la promotion rangée (Lucha Libre AAA…)
    if (route.k !== cur && S.P[route.k].s) h += '<nav class="tabs sub">' + ["Tout " + route.k].concat(Object.keys(S.P[route.k].s)).map((t, i) => {
      const on = (i === 0 && !route.n) || t === route.n;
      return tab(t, "#/p/" + encodeURIComponent(route.k) + (i === 0 ? "" : "/" + encodeURIComponent(t)), on, i === 0 ? "" : logoOf(route.k, t));
    }).join("") + "</nav>";
  }
  return h;
}
