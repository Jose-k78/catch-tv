// Accueil, pages promotion et pages show
import { S, B, ACT, imageFor, changed, prof } from "../state.js";
import { fmtR, esc, cssUrl, okHttp, okDay, fmt, diff, cd, nextWeekday, today, dt, ymd, ICON, stars, docId, MOIS, modal, toast, shAttr } from "../util.js";
import { resolveImage } from "../images.js";
import { PARIS, startOf, endOf, isLive, whenParts, fmtAt, hourAt, cityOf, downloadIcs, parisDay } from "../time.js";
import { hlOf, hlHref, spoilBlock } from "./highlights.js";
import { favAside } from "./favs.js";
import { champHidden, hlHidden } from "../spoil.js";
import { linkNames, namesIn } from "../wrestlers.js";
import { versus, faceRow } from "../photos.js";
import { eventLogo, showLogo } from "../assets.js";
import { discoverTile } from "./discover.js";
import { storylineTile } from "./storyline.js";
import { activitySection, activityList } from "./activity.js";
import { rosterTile } from "./roster.js";
import { openOut } from "../applinks.js";
import { pickable, pickTile } from "./picks.js";
import { pollTile } from "./polls.js";
import { annBar } from "./annonces.js";
import { installBar } from "../push.js";
import { linksOf, linksHTML, defaultLink, playLink, playerHTML, TPLAY } from "../links.js";
import { tournamentTile } from "./tournois.js";
import { allVideos, playerThumb } from "./player.js";
import { rateBtn } from "./mrate.js";

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
// prochaine diffusion d'un show hebdo : jour habituel, sauf épisode déplacé (« no ») ou spécial plus tôt (« e »)
export function nextAir(k, n) {
  const s = S.P[k].s[n], td = ymd(today());
  let d = nextWeekday(s.wd);
  if (Array.isArray(s.no) && s.no.indexOf(d) >= 0) { const x = dt(d); x.setDate(x.getDate() + 7); d = ymd(x); }
  (s.e || []).forEach(e => { if (e && e.d && e.d >= td && e.d < d) d = e.d; });
  return d;
}
export function epis(k, n, nb, na) {
  const pr = S.P[k], s = pr.s[n], out = [], base = dt(nextWeekday(s.wd));
  const mk = (t, d) => ({ kind: "ep", k: k, show: n, t: t, d: d, w: frName({ fr: s.fr || pr.fr, p: s.p }), c: colorOf(k, n), l: s.l, ty: n,
    h: s.h || "", tz: s.tz || "", dur: s.dur || 120, fr: s.fr || pr.fr || [], p: s.p || "", pl: s.l || "", nf: s.nf || "", nfhub: pr.nfhub || "" });
  for (let i = -nb; i < na; i++) {
    const x = new Date(base); x.setDate(x.getDate() + 7 * i);
    const d = ymd(x), sp = (s.e || []).filter(e => e.d === d)[0];
    if (!sp && Array.isArray(s.no) && s.no.indexOf(d) >= 0) continue; // épisode déplacé ou annulé ce jour-là
    out.push(mk(sp ? sp.t : n, d));
  }
  (s.e || []).forEach(e => { if (!out.some(o => o.d === e.d)) out.push(mk(e.t, e.d)); });
  return out;
}
// Page d'un événement dans l'app (PLE, épisode spécial ou épisode d'un show) : #/ev/WWE/PLE/2026-11-07
export const evKey = e => "ev:" + e.k + "|" + (e.show || "PLE") + "|" + (e.d || "");
export function evHref(e) {
  if (!e || !e.k) return "#/";
  return "#/ev/" + encodeURIComponent(e.k) + "/" + encodeURIComponent(e.show || "PLE") + "/" + (okDay(e.d) ? e.d : "-/" + encodeURIComponent(e.t || ""));
}
export function findEvent(k, show, d, t) {
  if (!S.P[k]) return null;
  if (show && show !== "PLE") { const s = S.P[k].s && S.P[k].s[show]; return s && okDay(d) ? epis(k, show, 12, 10).find(e => e.d === d) || null : null; }
  const all = pleOf(k);
  return (okDay(d) ? all.find(e => e.d === d && (!t || e.t === t)) || all.find(e => e.d === d) : all.find(e => !okDay(e.d) && e.t === t)) || null;
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
    '<span class="livego">' + ICON.play + " Regarder" + (frName(e) ? " sur " + esc(frName(e)) : "") + "</span>" + (linksOf(evKey(e)).length ? '<span class="livego alt">▶ Autre visionnage</span>' : "") + "</button>";
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
// une chaîne YouTube (youtube.com/@WWE) -> recherche du show sur cette chaîne (ex. « Main Event » sur la chaîne WWE)
const ytChanSearch = (u, e) => /^https:\/\/(www\.)?youtube\.com\/(@[\w.-]+|channel\/[\w-]+)\/?$/.test(u) ? u.replace(/\/$/, "") + "/search?query=" + encodeURIComponent(e.show || e.t) : u;
export function watchLinks(e) {
  const out = [], seen = {};
  const add = (n, u, extra) => { u = ytChanSearch(u, e); if (!okHttp(u) || seen[u]) return; seen[u] = 1; out.push(Object.assign({ n: n, u: u }, extra || {})); };
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
  // « Voir le show » : un seul choix possible -> on ouvre directement l'appli ou la page (sauf s'il y a un lien du modo en plus)
  const dl = defaultLink(evKey(e));
  if (dl) { playLink(dl.u, e.t + (e.d ? " du " + fmt(e.d) : "")); return; }
  if (el.dataset.direct === "1" && !linksOf(evKey(e)).length) {
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
      (linksOf(evKey(e)).length || S.isAdmin ? '<p class="sub" style="margin:14px 16px 6px">Autre visionnage</p>' + linksHTML(evKey(e), { title: e.t + (e.d ? " du " + fmt(e.d) : ""), href: evHref(e) }) : "") +
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
function seenMark(h) { return h ? (h.comment === "[HL]" ? '<span class="seenmark">🎬 Vu en highlights</span>' : '<span class="seenmark">' + ICON.check + " Déjà vu" + (h.rating ? " " + stars(h.rating) : "") + "</span>") : ""; }
function aired(e) { return e.d && diff(e.d) <= 0; }
const place = e => e.w && e.w !== "—" ? esc(e.w) : "";
// Affiche maison : taille du titre adaptée au mot le plus long, pour qu'il tienne dans la largeur
function fit(title, width, max, poster) {
  if (!poster) return "";
  const w = Math.max.apply(null, String(title).split(/\s+/).map(x => x.length).concat([1]));
  return ' style="font-size:' + Math.max(12, Math.min(max, Math.floor(width / (w * 0.8)))) + 'px"';
}

// Logo d'un événement (Royal Rumble…) ou d'un show (Raw…) : dossier de l'admin, version la plus récente
function logoFor(e) {
  if (!e) return "";
  if (e.kind === "ple" || e.kind === "spec") return eventLogo(e);
  if (e.kind === "promo") return showLogo(e.k, "");
  return e.show ? showLogo(e.k, e.show) : eventLogo(e);
}
function logoImg(e, cls) {
  const src = logoFor(e);
  return src ? '<img class="' + cls + '" src="' + esc(src) + '" alt="" loading="lazy" onerror="this.remove()">' : "";
}
// ---------- vignettes horizontales ----------
function pleCard(e, showK) {
  const h = seenOf(e), n = diff(e.d), lk = look(e);
  return '<div class="card' + (lk.poster ? " poster" : "") + (e.d && n < 0 ? " past" : "") + (h ? " seen" : "") + (S.isAdmin ? " hasedit" : "") + '" style="' + esc(lk.style) + '">' +
    '<a class="cover" href="' + esc(evHref(e)) + '" aria-label="' + esc(e.t) + '"' + shAttr(evCard(e)) + "></a>" +
    '<span class="tag' + (n === 0 ? " hot" : "") + '">' + (showK ? esc(e.k) + " · " : "") + (n === 0 ? dayWord(e) : cd(e.d)) + "</span>" + editBtn(e, e.t) + logoImg(e, "evlogo") +
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
  const href = evHref(e); // une seule page pour un show passé : résumé, résultats, highlights, liens officiels, TCC Play, lecteur
  const tag = recent ? agoLabel(e.ago) : esc(e.k) + " · " + (cat === "ple" ? "PLE" : cat === "spec" ? "Spécial" : esc(e.show));
  return '<div class="card out' + (recent ? " fresh" : " past") + (lk.poster ? " poster" : "") + (h ? " seen" : "") + '" data-cat="' + cat + '" style="' + esc(lk.style) + '"' +
    (!recent && pastF && pastF !== cat ? " hidden" : "") + ">" +
    '<a class="cover" href="' + esc(href) + '" aria-label="' + esc(e.t) + '"' + shAttr(evCard(e)) + "></a>" +
    '<span class="tag' + (recent && e.ago <= 1 ? " hot" : "") + '">' + tag + "</span>" + logoImg(e, e.kind === "ple" || e.kind === "spec" ? "evlogo" : "cardlogo") +
    "<b" + fit(e.t, 126, 27, lk.poster) + ">" + esc(e.t) + "</b><small>" + (recent ? esc(e.k) + " · " : "") + (e.kind === "ep" ? (recent ? "" : "Épisode du ") + fmt(e.d) : fmt(e.d) + (place(e) ? " · " + place(e) : "")) + "</small>" + seenMark(h) +
    '<button class="minibtn" data-act="watch" data-direct="1"' + dataItem(e) + ">" + ICON.play + " Voir le show</button>" +
    (hl ? '<span class="hlmini">' + ICON.play + " Highlights</span>" : "") +
    '<button class="cbtn seen' + (h ? " on" : "") + '" data-act="seen"' + dataItem(e) + ' aria-label="Je l’ai vu">' + (h ? ICON.check : ICON.eye) + "</button></div>";
}
function recentSection(list) {
  list = list.filter(e => e.ago <= RECENT_DAYS - 1);
  return list.length ? '<h2>Sortis récemment</h2><div class="row">' + list.map(e => outCard(e, true)).join("") + "</div>" : "";
}
// « Déjà passés » : un seul rayon (fini « Vient de sortir » / « Déjà sorti » / « Déjà passé ») : les plus récents d'abord
// (étiquette HIER, IL Y A 3 JOURS…), sur l'accueil, la page d'une promotion et celle d'un show ; « Tout voir » -> #/passes
function pastSection(list, opt) {
  opt = opt || {};
  if (!list.length) return opt.empty ? "<h2>Déjà passés</h2>" + opt.empty : "";
  if (pastF && !list.some(e => catOf(e) === pastF)) pastF = "";
  const cats = [["", "Tout"], ["hebdo", "Shows hebdo"], ["ple", "PLE / PPV"], ["spec", "Épisodes spéciaux"]].filter(c => !c[0] || list.some(e => catOf(e) === c[0]));
  const more = "#/passes" + (opt.k ? "/" + encodeURIComponent(opt.k) + (opt.n ? "/" + encodeURIComponent(opt.n) : "") : "");
  return '<h2 class="hh hrow">Déjà passés <a class="linkbtn" href="' + more + '">Tout voir ›</a></h2>' + (cats.length > 2 && !opt.n ? '<nav class="tabs pastf" style="padding-top:0">' + cats.map(c => '<button class="tab' + (pastF === c[0] ? " on" : "") + '" data-act="pastf" data-c="' + c[0] + '">' + c[1] + "</button>").join("") + "</nav>" : "") +
    '<div class="row pastrow">' + list.slice(0, 24).map(e => outCard(e, e.ago <= RECENT_DAYS - 1)).join("") + "</div>";
}
// page « Déjà passés » : tous les shows passés (filtre par promotion / show), chacun ouvre sa page complète
export function pastView(k, n) {
  let list = outItems().filter(e => (!k || e.k === k || PARENT[e.k] === k) && (!n || e.show === n || e.br === n));
  let h = '<a class="back" href="' + (k ? "#/p/" + encodeURIComponent(k) + (n ? "/" + encodeURIComponent(n) : "") : "#/") + '">' + ICON.back + " " + esc(n || k || "Accueil") + "</a><h1>Déjà passés" + (k ? " · " + esc(n || k) : "") + "</h1>";
  h += '<nav class="tabs" style="padding-top:0">' + ['<a class="tab' + (!k ? " on" : "") + '" href="#/passes">Tout</a>'].concat(Object.keys(S.P).filter(x => !PARENT[x]).map(x => '<a class="tab' + (x === k ? " on" : "") + '" href="#/passes/' + encodeURIComponent(x) + '">' + esc(x) + "</a>")).join("") + "</nav>";
  if (!list.length) return h + '<p class="note">Rien pour l’instant.</p>';
  const groups = {}; list.forEach(e => { const g = e.ago <= 0 ? "Aujourd’hui" : e.ago === 1 ? "Hier" : e.ago < 7 ? "Cette semaine" : e.ago < 14 ? "La semaine dernière" : "Plus ancien"; (groups[g] = groups[g] || []).push(e); });
  ["Aujourd’hui", "Hier", "Cette semaine", "La semaine dernière", "Plus ancien"].forEach(g => { if (groups[g]) h += "<h2>" + g + '</h2><div class="row pcolwrap">' + groups[g].map(e => outCard(e, true)).join("") + "</div>"; });
  return h;
}
ACT.pastf = el => {
  pastF = el.dataset.c || "";
  document.querySelectorAll(".pastf .tab").forEach(b => b.classList.toggle("on", b === el));
  document.querySelectorAll(".pastrow .card").forEach(c => { c.hidden = !!pastF && c.dataset.cat !== pastF; });
  const r = document.querySelector(".pastrow"); if (r) r.scrollLeft = 0;
};
function showItem(k, n) { return { kind: "show", k: k, show: n, t: n, c: colorOf(k, n) }; }
// « AUJOURD’HUI » si le show commence entre 6 h et 18 h (heure de Paris), « CETTE NUIT » entre 19 h et 5 h
function dayWord(e) {
  const st = startOf(e); if (!st) return "AUJOURD’HUI";
  const h = parseInt(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Paris" }).format(new Date(st)), 10);
  return h >= 19 || h < 6 ? "CETTE NUIT" : "AUJOURD’HUI";
}
// big = show du jour ou le plus récent (vignette large)
function showCard(k, n, withK, big) {
  const s = S.P[k].s[n], next = nextAir(k, n), lk = look(showItem(k, n));
  let tag = (withK ? esc(k) + " · " : "") + cd(next), extra = "";
  if (big) {
    const isToday = diff(next) === 0, d = isToday ? next : ymd(new Date(dt(next).getTime() - 7 * 864e5));
    tag = (withK ? esc(k) + " · " : "") + (isToday ? dayWord(epis(k, n, 0, 1).find(x => x.d === next) || { k: k, show: n, d: next }) : "DERNIER ÉPISODE");
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
    '<a class="cover" href="#/p/' + encodeURIComponent(k) + "/" + encodeURIComponent(n) + '" aria-label="' + esc(n) + '"' + shAttr({ ty: "show", t: lblK(k, n), s: s.j, h: "#/p/" + encodeURIComponent(k) + "/" + encodeURIComponent(n), k: k }) + "></a>" +
    '<span class="tag' + (big ? " hot" : "") + '">' + tag + "</span>" + editBtn(showItem(k, n), k + " " + n) + (showLogo(k, n) ? '<img class="cardlogo" src="' + esc(showLogo(k, n)) + '" alt="" loading="lazy" onerror="this.remove()">' : "") +
    "<b" + fit(n, big ? 300 : 126, big ? 40 : 27, lk.poster) + ">" + esc(n) + "</b>" + (big ? extra : "<small>" + (withK ? fmt(next) : esc(s.j)) + " · " + esc(frName({ fr: s.fr || S.P[k].fr, p: s.p })) + "</small>") + "</div>";
}
// Rangée des shows : ceux du jour (ou le plus récent) en premier et en grand
function showRow(list, withK) {
  list = list.map(x => Object.assign({ d: nextAir(x.k, x.n) }, x)).sort((a, b) => diff(a.d) - diff(b.d));
  let big = list.filter(x => diff(x.d) === 0);
  if (!big.length && list.length) big = [list.slice().sort((a, b) => diff(b.d) - diff(a.d))[0]]; // le plus récent = celui dont le prochain est le plus loin
  const rest = list.filter(x => big.indexOf(x) < 0);
  return '<div class="row">' + big.map(x => showCard(x.k, x.n, withK, true)).join("") + rest.map(x => showCard(x.k, x.n, withK, false)).join("") + "</div>";
}
function promoCard(k) {
  const e = { kind: "promo", k: k, t: k, c: S.P[k].c }, lk = look(e);
  return '<div class="card' + (lk.poster ? " poster" : "") + (S.isAdmin ? " hasedit" : "") + '" style="' + esc(lk.style) + '"><a class="cover" href="#/p/' + encodeURIComponent(k) + '" aria-label="' + esc(k) + '"' + shAttr({ ty: "show", t: k, s: "Promotion", h: "#/p/" + encodeURIComponent(k), k: k }) + "></a>" + editBtn(e, k) + logoImg(e, "cardlogo") +
    "<b" + fit(k, 126, 27, lk.poster) + ">" + esc(k) + "</b><small>" + S.P[k].e.length + " " + bigWord(k) + "</small></div>";
}
// Vignette « Titres » : champions actuels de la promotion ou du show
export function titlesFor(k, n) {
  const all = (S.titles || []).filter(t => t && (t.k === k || (Array.isArray(t.also) && t.also.indexOf(k) >= 0)));
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
  return '<a class="hero' + (lk.poster ? " poster" : "") + '" style="' + esc(lk.style) + '" href="' + esc(evHref(e)) + '"' + shAttr(evCard(e)) + ">" + logoImg(e, e.kind === "ple" || e.kind === "spec" ? "bigl" : "bigl sq") + "<small>" + label + "</small><b" + fit(e.t, 320, 44, lk.poster) + ">" + esc(e.t) +
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
  return '<div class="matchcard"><small>Carte annoncée</small><ul>' + e.card.map(m => "<li>" + linkNames(m) + "</li>").join("") + "</ul>" +
    (e.kind === "ple" && pickable(e) ? '<button class="btn small pickbtn" data-act="pick"' + itemData(e) + ">🎯 Faire mon pronostic</button>" : "") + "</div>";
}
function epCard(e) {
  const h = seenOf(e), r = recapOf(e), x = e.d ? dt(e.d) : null, past = e.d && diff(e.d) < 0;
  const meta = [e.t !== e.ty ? esc(e.ty) : "", place(e), e.d ? cd(e.d) : ""].filter(Boolean).join(" · ");
  return '<article class="ep' + (past ? " past" : "") + (h ? " seen" : "") + '">' +
    '<div class="epdate" style="' + esc(plain(e.c)) + '">' + (x ? "<b>" + x.getDate() + "</b><small>" + MOIS[x.getMonth()] + "</small>" : "<b>?</b><small>date</small>") + "</div>" +
    '<div class="epbody"><a class="eptitle" href="' + esc(evHref(e)) + '"' + shAttr(evCard(e)) + ">" + esc(e.t) + "</a>" +
    '<small class="epmeta">' + (meta || "À confirmer") + "</small>" + (past ? "" : timeLine(e)) + cardList(e) +
    (r ? faceRow(namesIn(r.txt), 28) + '<p class="recap">' + linkNames(r.txt) + "</p>" + srcLine(r) : "") + seenInfo(h) +
    '<div class="eplinks">' + (aired(e) ? '<button class="hllink watchlink" data-act="watch" data-direct="1"' + itemData(e) + ">" + ICON.play + " Voir le show</button>" + hlBtn(e.k, e.show || "PLE", e.d, "hllink") : "") + (e.kind === "ple" ? remindBtn(e) : "") + "</div></div>" +
    (aired(e) ? '<button class="seenbtn' + (h ? " on" : "") + '" data-act="seen"' + dataItem(e) + ' aria-label="Je l’ai vu">' + (h ? ICON.check : ICON.eye) + "</button>" : "") +
    "</article>";
}
function epList(list) { return '<div class="eps">' + list.map(epCard).join("") + "</div>"; }

// Grande carte « à regarder »
function feature(e, label, next) {
  const h = seenOf(e), r = recapOf(e), lk = look(e, true);
  return '<section class="feature' + (lk.poster ? " poster" : "") + (h ? " seen" : "") + (S.isAdmin ? " hasedit" : "") + '" style="' + esc(lk.style) + '">' + editBtn(e, e.k + " " + (e.show || e.t)) +
    logoImg(e, e.kind === "ple" || e.kind === "spec" ? "bigl" : "bigl sq") + '<span class="eyebrow">' + label + "</span><h2" + fit(e.t, 320, 46, lk.poster) + '><a class="evlink" href="' + esc(evHref(e)) + '"' + shAttr(evCard(e)) + ">" + esc(e.t) + "</a></h2>" +
    "<small>" + fmt(e.d) + (place(e) ? " · " + place(e) : "") + " · " + cd(e.d) + "</small>" + timeLine(e, true) + cardList(e) +
    (r ? faceRow(namesIn(r.txt), 34) + '<p class="recap">' + linkNames(r.txt) + "</p>" : '<p class="recap muted">Le résumé de cet épisode arrive bientôt.</p>') +
    hlBtn(e.k, e.show || "PLE", e.d, "hlbtn side") +
    '<div class="factions"><button class="btn light" data-act="watch"' + itemData(e) + ">Regarder" + (frName(e) ? " sur " + esc(frName(e)) : "") + " ↗</button>" +
    (e.kind === "ple" ? remindBtn(e, "btn glass") : "") +
    (aired(e) ? '<button class="btn glass' + (h ? " on" : "") + '" data-act="seen"' + dataItem(e) + ">" + (h ? ICON.check + " Vu" + (h.rating ? " " + stars(h.rating) : "") : ICON.eye + " Je l’ai vu") + "</button>" : "") + "</div>" +
    (h && h.comment ? '<q class="mycom light">' + esc(h.comment) + "</q>" : "") +
    (r ? srcLine(r) : "") + creditLine(lk.credit) +
    (next ? '<span class="cd">Prochain épisode : ' + fmt(next.d) + " · " + cd(next.d) + "</span>" : "") +
    "</section>";
}

// Cartes à partager (appui long) : événement, article
const lblK = (k, n) => (String(n).indexOf(k) === 0 ? n : k + " " + n);
export const evCard = e => ({ ty: "ev", t: String(e.t || ""), s: [e.k + (e.show && e.show !== e.t ? " · " + e.show : ""), okDay(e.d) ? fmt(e.d) : ""].filter(Boolean).join(" · "), h: evHref(e), k: e.k });
export const artCard = a => ({ ty: "art", t: String(a.t || ""), s: [a.s, okDay(a.d) ? fmt(a.d) : ""].filter(Boolean).join(" · "), u: a.u });

// ---------- page d'un événement (avant : affiche, résumé, pronostic ; après : résultats sous spoiler, highlights) ----------
function watchBtns(e) {
  const links = watchLinks(e), grp = [["Ce show directement", links.filter(x => x.direct)], ["En France", links.filter(x => x.fr && !x.direct)], ["Aux États-Unis", links.filter(x => x.us && !x.direct)], ["", links.filter(x => !x.fr && !x.us && !x.direct)]];
  if (!links.length) return '<p class="note">Pas encore de lien de diffusion pour ce show.</p>';
  return grp.filter(g => g[1].length).map(g => (g[0] ? '<p class="evsub">' + g[0] + "</p>" : "") + g[1].map(x => '<a class="btn wide ghost evwatch" href="' + esc(x.u) + '" target="_blank" rel="noopener">' + ICON.play + " Regarder sur " + esc(x.n) + esc(epNote(e, x)) + " ↗</a>").join("")).join("") +
    (links.some(x => x.nf) && e.kind === "ep" ? '<p class="note small" style="margin-top:6px">Netflix ouvre la page de ' + esc(e.show) + " : choisis l’épisode du " + esc(fmt(e.d)) + " dans la liste.</p>" : "");
}
export function evPageView(k, show, d, t) {
  let h = '<a class="back" href="javascript:history.back()">' + ICON.back + " Retour</a>";
  const e = findEvent(k, show, d, t);
  if (!e) return h + '<p class="empty">Événement introuvable.</p>';
  const lk = look(e, true), seen = seenOf(e), r = recapOf(e), out = isOut(e), live = isLive(e), hl = okDay(e.d) ? hlOf(e.k, e.show || "PLE", e.d) : null;
  if (out && okDay(e.d)) return h + pastPage(e, lk, seen, r, hl);
  const eyebrow = e.kind === "ple" ? (e.br ? "PLE " + e.br : "PLE") + " · " + e.k : e.k + " · " + e.show;
  const place2 = [e.v, e.w && e.w !== "—" ? e.w : ""].filter(Boolean).join(" · ");
  h += '<section class="evpage feature' + (lk.poster ? " poster" : "") + (seen ? " seen" : "") + (S.isAdmin ? " hasedit" : "") + '" style="' + esc(lk.style) + '">' + editBtn(e, e.k + " " + (e.show || e.t)) +
    logoImg(e, e.kind === "ple" || e.kind === "spec" ? "bigl" : "bigl sq") + (live ? '<span class="livebadge"><i></i>EN DIRECT</span>' : '<span class="eyebrow">' + esc(eyebrow) + "</span>") +
    "<h2" + fit(e.t, 320, 46, lk.poster) + ">" + esc(e.t) + "</h2>" +
    "<small>" + (okDay(e.d) ? fmt(e.d) : "Date à confirmer") + (place2 ? " · " + esc(place2) : "") + "</small>" + (out ? "" : timeLine(e, true)) +
    '<span class="cd">' + (live ? "🔴 En direct maintenant" : cd(e.d)) + "</span>" + creditLine(lk.credit) + "</section>";
  // actions
  h += '<div class="evacts">' + (pickable(e) ? '<button class="btn" data-act="pick"' + itemData(e) + ">🎯 Pronostic</button>" : "") +
    (aired(e) ? '<button class="btn ghost' + (seen ? " on" : "") + '" data-act="seen"' + dataItem(e) + ">" + (seen ? ICON.check + " Vu" + (seen.rating ? " " + stars(seen.rating) : "") : ICON.eye + " Je l’ai vu") + "</button>" : remindBtn(e, "btn ghost")) +
    '<button class="btn ghost" data-act="share" data-sh="' + esc(JSON.stringify(evCard(e))) + '">↗ Partager</button></div>';
  // l'affiche (matchs annoncés)
  if (!out && Array.isArray(e.card) && e.card.length) {
    h += "<h2>L’affiche</h2><ul class=\"evcard\">" + e.card.map(m => "<li>" + versus(m, 40) + '<span class="evl">' + linkNames(m) + "</span></li>").join("") + "</ul>";
  } else if (!out && e.kind === "ple") h += "<h2>L’affiche</h2><p class=\"note\">Les matchs seront ajoutés dès qu’ils sont officiellement annoncés.</p>";
  // le résumé d'avant-show (sans spoiler)
  if (r) h += "<h2>Le résumé d’avant-show</h2><div class=\"evrecap\">" + faceRow(namesIn(r.txt), 40) + "<p>" + linkNames(r.txt) + "</p></div>" + (srcLine(r) ? '<div style="margin:0 16px">' + srcLine(r) + "</div>" : "");
  else if (!out) h += '<h2>Le résumé d’avant-show</h2><p class="note">Il arrive avec la mise à jour du matin, dans les jours qui précèdent le show.</p>';
  // après l'événement : résultats et segments sous spoiler, highlights
  if (out && okDay(e.d)) {
    const key = e.k + "|" + (e.show || "PLE") + "|" + e.d;
    h += "<h2>Résultats</h2>";
    if (hl && hlHidden(key, e.k, e.show || "", e.d)) h += '<div class="lockbox"><span class="lockico">🙈</span><b>Mode sans spoiler</b><p>Les résultats restent cachés tant que tu n’as pas marqué ce show comme vu.</p>' +
      '<div class="btns"><button class="btn" data-act="seen"' + dataItem(e) + ">" + ICON.eye + ' Je l’ai vu</button><button class="btn ghost" data-act="unlockhl" data-key="' + esc(key) + '">Afficher quand même</button></div></div>';
    else if (hl && Array.isArray(hl.res) && hl.res.length) {
      h += spoilBlock("Voir les résultats (spoiler)", '<ul class="res">' + hl.res.map(x => "<li>" + linkNames(x) + "</li>").join("") + "</ul>");
      const seg = (Array.isArray(hl.seg) ? hl.seg : []).filter(x => x && (x.t || typeof x === "string"));
      if (seg.length) h += '<div style="height:10px"></div>' + spoilBlock("Voir les segments (spoiler)", '<ul class="segs">' + seg.map(x => "<li>" + (x.k ? '<span class="segk">' + esc(x.k) + "</span>" : "") + "<span>" + linkNames(typeof x === "string" ? x : x.t) + "</span></li>").join("") + "</ul>");
    } else h += '<p class="note">Les résultats seront ajoutés lors de la prochaine mise à jour (vers 8 h 30).</p>';
    if (hl) h += '<div class="btns" style="justify-content:flex-start;margin:12px 16px 0"><a class="btn" href="' + hlHref(e.k, e.show || "PLE", e.d) + '">' + ICON.play + " Highlights et vidéos</a></div>";
  }
  const dl = defaultLink(evKey(e)) || (out ? linksOf(evKey(e)).filter(x => !/youtu/.test(x.u))[0] : null);
  h += "<h2>Où regarder</h2>" + (dl ? '<div class="evplayer">' + playerHTML(dl.u, e.t, { muted: true }) + "</div>" : "") + watchBtns(e) + '<a class="btn wide ghost evwatch" href="#/player/e/' + encodeURIComponent(e.k + "|" + (e.show || "PLE") + "|" + (e.d || "")) + '">' + TPLAY + ' · vidéos et archives</a>' + linksHTML(evKey(e), { title: e.t + (e.d ? " du " + fmt(e.d) : ""), href: evHref(e), ask: out });
  if (okHttp(e.l)) h += '<p class="note small" style="margin-top:12px"><a class="linkbtn" style="padding:0" href="' + esc(e.l) + '" target="_blank" rel="noopener">Site officiel ↗</a></p>';
  return h;
}

// ---------- page d'un show passé (5 nov.) ----------
// 1. la vidéo choisie par défaut tout en haut ; 2. la note du show juste dessous ; 3. les vidéos liées qui défilent ;
// 4. le résumé sans spoiler, puis le résumé avec spoiler (résultats, segments, promos, interviews), chaque match et segment
// se note et les segments se mettent en favori ; 5. où regarder (officiel, TCC Play) ; 6. tout en bas, les liens du modo.
const segId = (key, t) => docId(key + "|" + t).slice(0, 180);
export const isSegNote = x => !!x && typeof x.id === "string" && (x.id.indexOf("g_") === 0 || x.id.indexOf("q_") === 0);
function segBtns(e, key, sg) {
  const txt = typeof sg === "string" ? sg : sg.t, kind = (typeof sg === "object" && sg.k) || "Segment", id = segId(key, txt);
  const mine = S.history["g_" + id], fav = !!S.history["q_" + id];
  if (!S.user) return "";
  return '<span class="segbtns"><button class="mratebtn' + (mine ? " on" : "") + '" data-act="segrate" data-id="' + esc(id) + '" data-kind="' + esc(kind) + '" data-t="' + esc(txt.slice(0, 120)) + '" data-k="' + esc(e.k) + '" data-show="' + esc(e.show || "PLE") + '" data-d="' + esc(e.d) + '">' + (mine && mine.rating ? stars(mine.rating) : mine ? ICON.check : "☆ Noter") + "</button>" +
    '<button class="segfav' + (fav ? " on" : "") + '" data-act="segfav" data-id="' + esc(id) + '" data-kind="' + esc(kind) + '" data-t="' + esc(txt.slice(0, 120)) + '" data-k="' + esc(e.k) + '" data-show="' + esc(e.show || "PLE") + '" data-d="' + esc(e.d) + '" aria-label="Favori">' + (fav ? "♥" : "♡") + "</button></span>";
}
ACT.segrate = el => { const ds = el.dataset; import("../modals.js").then(m => m.editNote({ id: "g_" + ds.id, title: "🎤 " + ds.kind + " · " + ds.t, k: ds.k, show: "Segment", d: ds.d }, () => changed("history"))); };
ACT.segfav = async el => {
  if (!S.user) return; const ds = el.dataset, id = "q_" + ds.id;
  try {
    if (S.history[id]) { await B.unsetSeen(S.user.uid, id); delete S.history[id]; toast("Retiré de tes segments préférés"); }
    else { await B.setSeen(S.user.uid, id, { title: ("🎤 " + ds.kind + " · " + ds.t).slice(0, 150), k: ds.k, show: "SegmentFav", d: ds.d, rating: 0, comment: String(ds.show || "PLE").slice(0, 40) }); toast("♥ Segment ajouté à tes favoris"); }
    changed("history");
  } catch (err) { toast("Impossible pour l’instant"); }
};
const RATES = {};
function pastPage(e, lk, seen, r, hl) {
  const key = e.k + "|" + (e.show || "PLE") + "|" + e.d, lkey = evKey(e);
  const vids = allVideos().filter(v => v.k === e.k && (v.show || "PLE") === (e.show || "PLE") && v.d === e.d);
  const dl = defaultLink(lkey) || linksOf(lkey).filter(x => !/youtu/.test(x.u))[0];
  let h = "";
  // 1. la vidéo par défaut
  if (dl) h += '<div class="pstage">' + playerHTML(dl.u, e.t, { muted: true }) + "</div>";
  else if (vids[0]) h += '<div class="pstage">' + playerHTML("https://youtu.be/" + vids[0].id, vids[0].t, { muted: true }) + "</div>";
  else h += '<section class="evpage feature mini' + (lk.poster ? " poster" : "") + '" style="' + esc(lk.style) + '">' + logoImg(e, "bigl sq") + "</section>";
  h += '<section class="pmeta"><span class="eyebrow">' + esc(e.kind === "ple" ? bigWord(e.k) + " · " + e.k : e.k + " · " + (e.show || "")) + "</span><h1>" + esc(e.t) + "</h1><small>" + fmt(e.d) + " " + e.d.slice(0, 4) + (e.v ? " · " + esc(e.v) : "") + "</small></section>";
  // 2. la note du show
  // notes de tous les membres pour ce show (chargées une fois), en plus de l'activité récente
  const rk = e.k + "|" + e.d; RATES[rk] = RATES[rk] || { list: null };
  if (!RATES[rk].list && !RATES[rk].busy && B.showRates) { RATES[rk].busy = 1; B.showRates(e.k, e.d).then(L => { RATES[rk] = { list: L || [], at: Date.now() }; changed("activity"); }).catch(() => { RATES[rk] = { list: [] }; }); }
  const byU = {}; (RATES[rk].list || []).concat(S.activity || []).forEach(a => { if (a && a.kind === "rate" && a.k === e.k && (a.show || "") === (e.show || "") && a.d === e.d && a.rating) byU[a.uid] = a; });
  const notes = Object.keys(byU).map(u => byU[u]), avg = notes.length ? notes.reduce((x, a) => x + a.rating, 0) / notes.length : 0;
  h += '<div class="shownote"><div><b>Note du show</b>' + (avg ? stars(avg) + "<small>" + fmtR(avg) + " / 5,5 · " + notes.length + " note" + (notes.length > 1 ? "s" : "") + " de membres</small>" : "<small>Pas encore de note de membre</small>") + "</div>" +
    '<button class="btn small' + (seen ? " on" : "") + '" data-act="seen"' + dataItem(e) + ">" + (seen ? (seen.rating ? "Ta note " + stars(seen.rating) : ICON.check + " Vu") : "⭐ Noter le show") + "</button></div>";
  if (notes.length) h += '<div class="rnotes">' + notes.sort((a, b) => b.rating - a.rating).map(a => { const p = prof(a.uid) || {}; return '<a class="rnote" href="#/profil/' + encodeURIComponent(a.uid) + '"><b>' + esc(p.pseudo || "Membre") + "</b>" + stars(a.rating) + "<small>" + fmtR(a.rating) + "</small>" + (a.comment && !/^\[HL\]/.test(a.comment) ? "<i>" + esc(String(a.comment).slice(0, 140)) + "</i>" : "") + "</a>"; }).join("") + "</div>";
  // 3. vidéos liées
  const q = e.t + " " + e.d.slice(0, 4);
  h += "<h2>Vidéos du show</h2>" + (vids.length ? '<div class="prow">' + vids.map(playerThumb).join("") + "</div>" : '<p class="note small">Pas encore de vidéo officielle dans l’app.</p>') +
    '<div class="chips" style="margin:6px 16px"><a class="chip" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(q + " highlights") + '" target="_blank" rel="noopener">▶ Résumés YouTube</a><a class="chip" href="#/player/e/' + encodeURIComponent(key) + '">' + TPLAY + "</a></div>";
  // 4. résumés
  const res = hl && Array.isArray(hl.res) ? hl.res : [], seg = hl && Array.isArray(hl.seg) ? hl.seg.filter(x => x && (x.t || typeof x === "string")) : [];
  const people = namesIn(res.concat(seg.map(x => typeof x === "string" ? x : x.t)).join(" ")).slice(0, 14);
  h += "<h2>Le résumé sans spoiler</h2>" + (r ? '<div class="evrecap">' + faceRow(namesIn(r.txt), 40) + "<p>" + linkNames(r.txt) + "</p></div>" : "") +
    (res.length || seg.length ? '<p class="note">' + res.length + " match" + (res.length > 1 ? "s" : "") + (seg.length ? " et " + seg.length + " segment" + (seg.length > 1 ? "s" : "") + " (promos, interviews…)" : "") + (people.length ? ", avec " + people.slice(0, 8).join(", ") + (people.length > 8 ? "…" : "") : "") + ".</p>" + faceRow(people, 36) : (r ? "" : '<p class="note">Le résumé arrive avec la mise à jour du matin.</p>'));
  h += "<h2>Le résumé avec spoiler</h2>";
  if (hl && hlHidden(key, e.k, e.show || "", e.d)) h += '<div class="lockbox"><span class="lockico">🙈</span><b>Mode sans spoiler</b><p>Les résultats restent cachés tant que tu n’as pas marqué ce show comme vu.</p><div class="btns"><button class="btn" data-act="seen"' + dataItem(e) + ">" + ICON.eye + ' Je l’ai vu</button><button class="btn ghost" data-act="unlockhl" data-key="' + esc(key) + '">Afficher quand même</button></div></div>';
  else if (res.length || seg.length) {
    const inner = (res.length ? '<h3 class="sph">Résultats</h3><ul class="res rated">' + res.map(x => "<li><span>" + linkNames(x) + "</span>" + rateBtn(e.k, x, e.show || e.t, e.d) + "</li>").join("") + "</ul>" : "") +
      (seg.length ? '<h3 class="sph">Segments, promos, interviews</h3><ul class="segs rated">' + seg.map(x => "<li>" + (x.k ? '<span class="segk">' + esc(x.k) + "</span>" : "") + "<span>" + linkNames(typeof x === "string" ? x : x.t) + "</span>" + segBtns(e, key, x) + "</li>").join("") + "</ul>" : "") +
      (hl.u ? '<p class="note small">Source : <a href="' + esc(hl.u) + '" target="_blank" rel="noopener">' + esc(hl.s || "lien") + "</a></p>" : "");
    h += spoilBlock("👀 Voir les résultats et les segments (spoiler)", inner);
  } else h += '<p class="note">Les résultats seront ajoutés lors de la prochaine mise à jour (vers 8 h 30).</p>';
  // 5. où regarder
  h += "<h2>Où regarder</h2>" + watchBtns(e) + (hlOf(e.k, e.show || "PLE", e.d) ? '<a class="btn wide ghost evwatch" href="' + hlHref(e.k, e.show || "PLE", e.d) + '">' + ICON.play + " Highlights</a>" : "");
  h += '<div class="evacts" style="margin-top:10px"><button class="btn ghost" data-act="share" data-sh="' + esc(JSON.stringify(evCard(e))) + '">↗ Partager</button></div>';
  // 6. liens du modo, toujours en bas
  h += "<h2>" + TPLAY + " · liens</h2>" + linksHTML(lkey, { title: e.t + " du " + fmt(e.d), href: evHref(e), ask: true, empty: '<p class="note small">Pas encore de lien.</p>' });
  return h;
}

// ---------- articles ----------
export function articles(tags, n, text) {
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return (S.news.items || []).filter(a => a && typeof a.t === "string" && okHttp(a.u) && Array.isArray(a.tags) && tags.every(t => a.tags.indexOf(t) >= 0) && (!text || norm(a.t).indexOf(norm(text)) >= 0))
    .sort((x, y) => String(y.d || "").localeCompare(String(x.d || ""))).slice(0, n);
}
export function artList(list) {
  return '<div class="list">' + list.map(a => '<a class="item" href="' + esc(a.u) + '" target="_blank" rel="noopener"' + shAttr(artCard(a)) + '><span class="lbl"><b>' + esc(a.t) +
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
// Accueil (refonte du 4 nov.) : 1. aujourd'hui / cette nuit  2. vient de sortir  3. programme de la semaine
// 4. prochain grand événement + à venir  5. jouer avec la communauté  6. infos  7. explorer (promotions, TCC Play, matchs)  8. déjà sorti
// le bon terme : PLE (Premium Live Event) pour la WWE et ce qu'elle possède (AAA), PPV pour les autres promotions
export const bigWord = k => (k === "WWE" || PARENT[k] === "WWE" ? "PLE" : "PPV");
function homeHead(t, sub) { return '<h2 class="hh">' + t + (sub ? "<small>" + sub + "</small>" : "") + "</h2>"; }
export function homeView() {
  const P = S.P, sp = split(allPle());
  const weekly = [];
  Object.keys(P).forEach(k => { const s = P[k].s; if (s) Object.keys(s).forEach(n => weekly.push({ k: k, n: n, d: nextAir(k, n) })); });
  let h = annBar() + installBar() + liveSection();
  // 1. ce qui passe aujourd'hui (shows hebdo + événements du jour pas encore terminés)
  const todayW = weekly.filter(x => diff(x.d) === 0), todayE = sp[0].filter(e => e.d && diff(e.d) === 0 && !isOut(e));
  if (todayW.length || todayE.length) h += homeHead("Aujourd’hui", "Les shows du jour, heure de Paris") + '<div class="row">' + todayE.map(e => pleCard(e, true)).join("") + todayW.map(x => showCard(x.k, x.n, true, true)).join("") + "</div>";
  // 2. vient de sortir
  const out = outItems();
  h += pastSection(out);
  // 3. programme de la semaine (les autres shows, du plus proche au plus lointain)
  const rest = weekly.filter(x => diff(x.d) > 0).sort((a, b) => diff(a.d) - diff(b.d));
  if (rest.length) h += homeHead("Le programme de la semaine", "Les prochains shows hebdo") + '<div class="row">' + rest.map(x => showCard(x.k, x.n, true, false)).join("") + "</div>";
  // 4. prochain grand événement puis la suite
  const up = sp[0].filter(e => e.d && !isOut(e) && diff(e.d) > 0), big = up.filter(e => e.kind === "ple")[0] || up[0];
  if (big) h += homeHead("Prochain " + bigWord(big.k)) + hero(big, esc(big.k) + " · " + bigWord(big.k));
  const more = up.filter(e => e !== big);
  if (more.length) h += homeHead("Les PLE et PPV à venir", "PLE pour la WWE, PPV pour les autres promotions") + '<div class="row">' + more.map(e => pleCard(e, true)).join("") + "</div>";
  // storyline du jour, tournois, matchs à découvrir (aussi dans Membres et Recherche)
  h += storylineTile() + tournamentTile("");
  if (S.matches.length) h += matchTile();
  // la recherche, dans l'accueil (et le bouton 🔍 en haut)
  h += homeHead("Recherche", "Shows, PLE, catcheurs, archives") + '<a class="homesearch" href="#/recherche">' + ICON.search + "<span>Show, PLE, catcheur, catcheuse…</span></a>" +
    (discoverTile() ? '<h2 class="hh">Catcheur à découvrir</h2>' + discoverTile() : "") + exploreHTML(true);
  // les infos (la communauté est dans l'onglet Membres, Explorer et TCC Play dans Recherche)
  h += artSection("Dernières infos", articles([], 6));
  return '<div class="withside"><div class="mainc">' + h + "</div>" + favAside() + "</div>";
}
// Explorer (onglet Recherche) : promotions, TCC Play, tournois, matchs à découvrir
export function exploreHTML(home) {
  let h = '<h2 class="hh">Explorer</h2><div class="row">' + Object.keys(S.P).filter(k => !PARENT[k]).map(promoCard).join("") + "</div>";
  h += '<a class="matchtile ptile" href="#/player"><span class="mt-k">' + TPLAY + '</span><b>Archives et vidéos</b><small>Les shows par promotion et par date, les vidéos officielles</small><span class="mt-go">Ouvrir ›</span></a>';
  if (home) return h; // sur l'accueil, tournois et matchs à découvrir sont déjà plus haut
  h += tournamentTile("");
  if (S.matches.length) h += matchTile();
  if (S.isAdmin) h += '<div class="btns" style="margin:10px 16px"><button class="btn small" data-act="gnew">＋ Nouveau clan / équipe (modo)</button></div>';
  return h;
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
  h += tournamentTile(k) + titlesTile(k, "") + rosterTile(k, "");
  h += "<h2>" + bigWord(k) + " à venir</h2>" + (ple[0].length ? epList(ple[0]) : '<p class="note">Aucun ' + bigWord(k) + " annoncé pour l’instant.</p>");
  if (ep[0].length) h += "<h2>Cette semaine</h2>" + epList(ep[0]);
  h += pastSection(outItems().filter(e => e.k === k || PARENT[e.k] === k), { k: k });
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
  const label = esc(n.toUpperCase()) + " · " + (today ? dayWord(feat) : "DERNIER ÉPISODE");
  let h = liveSection(e => e.k === k && (e.show === n || e.br === n));
  h += feat ? feature(feat, label, today ? null : up.filter(e => e.d)[0]) : "";
  const nx = sp[0].filter(e => e.d && e.kind === "ep")[0], st = nx ? startOf(nx) : 0, fr = (s.fr || pr.fr || []).map(f => f.n).join(", ");
  h += '<p class="note showinfo">' + esc(s.j) + (s.h ? " à " + esc(s.h.replace(":", " h ")) + (s.tz ? " (heure de " + esc(cityOf(s.tz)) + ")" : "") : "") +
    (st ? ", soit <b>" + fmtAt(st, PARIS) + "</b> à Paris pour le prochain" : "") + "<br>" +
    (fr ? "En France : " + esc(fr) + " · " : "") + "Aux États-Unis : " + esc(s.p) + " · " + '<button class="linkbtn inline" data-act="watch"' + (nx ? itemData(nx) : "") + ">Où regarder ↗</button></p>";
  h += titlesTile(k, n) + rosterTile(k, n);
  if (up.length) h += "<h2>À venir</h2>" + epList(up);
  h += pastSection(outItems().filter(e => e.k === k && (e.show === n || e.br === n)), { k: k, n: n, empty: past.length ? epList(past) : "" });
  let al = articles([k, n], 5); if (!al.length) al = articles([k], 5);
  h += artSection("Actualité", al) + xSection(s.x || pr.x);
  return h;
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
export const PARENT = { AAA: "WWE", ROH: "AEW", "NJPW Strong": "NJPW" };
const AFTER = { AAA: "NXT", ROH: "Collision" };
export const hostOf = k => (PARENT[k] && S.P[PARENT[k]] ? PARENT[k] : k);
export function tabsView(route) {
  const cur = route.name === "promo" ? hostOf(route.k) : "Accueil";
  const ORDER = ["WWE", "AEW", "TNA", "NJPW", "CMLL", "Stardom", "Marigold"];
  const top = Object.keys(S.P).filter(k => hostOf(k) === k).sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  const tabsL = ["Accueil"].concat(top).map(t => tab(t, t === "Accueil" ? "#/" : "#/p/" + encodeURIComponent(t), t === cur, t === "Accueil" ? "" : logoOf(t, "")));
  let h = '<nav class="tabs">' + tabsL.join("") +
    '<a class="tab' + (route.name === "autre" ? " on" : "") + '" href="#/autre">Autre</a></nav>';
  if (route.name === "promo" && S.P[cur]) {
    const kids = Object.keys(PARENT).filter(c => PARENT[c] === cur && S.P[c]), shows = Object.keys(S.P[cur].s || {});
    // ordre : Tout, les shows, et chaque promotion rangée juste après le show indiqué (sinon à la fin)
    const items = [shows.length ? "Tout" : cur].concat(shows);
    kids.forEach(c => { const i = items.indexOf(AFTER[c]); items.splice(i >= 0 ? i + 1 : items.length, 0, { kid: c }); });
    if (shows.length || kids.length) h += '<nav class="tabs sub">' + items.map(t => {
      if (t.kid) return tab(t.kid, "#/p/" + encodeURIComponent(t.kid), route.k === t.kid, logoOf(t.kid, ""));
      const all = t === "Tout" || t === cur, on = route.k === cur && ((all && !route.n) || t === route.n);
      return tab(t, "#/p/" + encodeURIComponent(cur) + (all ? "" : "/" + encodeURIComponent(t)), on, all ? (t === cur ? logoOf(cur, "") : "") : logoOf(cur, t));
    }).join("") + "</nav>";
    // les shows de la promotion rangée (Lucha Libre AAA…)
    // (plus de 2e rangée quand la promotion rangée n'a qu'un show : ex. « Lucha Libre AAA » sous AAA, demande de Jose)
    if (route.k !== cur && S.P[route.k].s && Object.keys(S.P[route.k].s).length > 1) h += '<nav class="tabs sub">' + ["Tout " + route.k].concat(Object.keys(S.P[route.k].s)).map((t, i) => {
      const on = (i === 0 && !route.n) || t === route.n;
      return tab(t, "#/p/" + encodeURIComponent(route.k) + (i === 0 ? "" : "/" + encodeURIComponent(t)), on, i === 0 ? "" : logoOf(route.k, t));
    }).join("") + "</nav>";
  }
  return h;
}

// Onglet « Autre » : autres promotions bientôt + légendes WCW / ECW / WWF (archives)
export function autreView() {
  return '<section class="autre"><h1>Autres promotions</h1><p class="note">Bientôt disponible : d’autres promotions arrivent dans l’app.</p>' +
    "<h2>Les légendes : WWF · WCW · ECW</h2>" + '<div class="list">' + [["WWF", "La WWE avant 2002 : Attitude Era, Hulkamania…"], ["WCW", "World Championship Wrestling (1988–2001) : nWo, Monday Nitro…"], ["ECW", "Extreme Championship Wrestling (1992–2001) : le catch hardcore de Philadelphie"]]
    .map(x => '<a class="item" href="#/player/k/' + x[0] + '"><span class="lbl"><b>' + x[0] + "</b><small>" + x[1] + '</small></span><span class="chev">›</span></a>').join("") + "</div>" +
    '<p class="note small" style="margin-top:10px">Leurs grands shows et matchs sont dans le TCC Play, rubrique Archives.</p></section>';
}
