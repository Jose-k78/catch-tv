// Bandeau défilant sous les onglets : à l'accueil toutes les infos, dans l'onglet d'une promotion seulement les siennes
// (la WWE avec la AAA, l'AEW avec la ROH), dans un show les infos de ce show et les PLE de la promotion. Pas d'info : pas de bandeau.
// Chaque info passe UNE fois par tour : le tour suivant ne commence que quand toutes les infos de l'onglet sont passées.
// Les infos déjà passées sont retenues sur l'appareil, d'un onglet à l'autre (et d'une ouverture à l'autre) :
// un onglet commence par les infos qu'on n'a pas encore vues. La même info n'est jamais deux fois à l'écran.
// Défenses et changements de titre : dès la mise à jour, pendant 5 jours, avec le même texte neutre sous spoiler
// (« 🙈 Défense de titre · Raw du 27 oct. »), que le champion ait gardé ou perdu son titre.
import { S, ACT, changed } from "../state.js";
import { esc, fmt, okDay, today, dt, lsGet, lsSet, modal } from "../util.js";
import { allPle, PARENT, evHref } from "./catalog.js";
import { startOf, fmtAt, PARIS } from "../time.js";
import { seenDay, noSpoil } from "../spoil.js";
import { allPolls, isOpen, babiesLast } from "./polls.js";
import { pickable, lockAt } from "./picks.js";
import { defensesOf } from "./titles.js";
import { norm } from "../wrestlers.js";

const SPEED = 70;   // pixels par seconde
const DAYS = 5;     // durée d'affichage d'une défense ou d'un changement de titre
const days = d => Math.round((today() - dt(d)) / 864e5);
const lbl = (k, n) => (String(n).indexOf(k) === 0 ? n : k + " " + n);
// Show où le titre a été mis en jeu : un show hebdo de ce nom, sinon le PLE de ce jour-là
function where(k, ev, d) {
  const pr = S.P[k]; if (!pr) return { show: null, label: k };
  const sh = pr.s || {}, e = String(ev || "");
  const n = Object.keys(sh).find(x => e && (e === x || e.indexOf(x) === 0));
  if (n) return { show: n, label: lbl(k, n) };
  const ple = (pr.e || []).find(x => x.d === d);
  if (ple) return { show: "", label: lbl(k, ple.t) };
  const key = Object.keys(S.highlights || {}).find(x => x.indexOf(k + "|") === 0 && x.slice(-10) === d);
  if (key) { const s = key.split("|")[1]; return { show: s === "PLE" ? "" : s, label: lbl(k, s === "PLE" ? (e || "PLE") : s) }; }
  return { show: null, label: k + (e ? " " + e : "") };
}
const REV = "ctv.tkrev";
const revealed = () => { try { return JSON.parse(lsGet(REV) || "{}"); } catch (e) { return {}; } };
function reveal(id) { const r = revealed(); r[id] = 1; const ks = Object.keys(r); ks.slice(0, Math.max(0, ks.length - 80)).forEach(k => delete r[k]); lsSet(REV, JSON.stringify(r)); }
const champ = t => String(t.c || "").replace(/\s*\(.*\)$/, "") || t.c;

function titleItem(t, kind, d, ev, txt, vac) {
  const so = where(t.k, ev, d), seen = so.show !== null && seenDay(t.k, so.show, d), id = "t:" + t.id + ":" + d + ":" + kind;
  const open = seen || !!revealed()[id];
  return { id: id, tid: t.id, k: t.k, show: so.show == null ? (t.show || "") : so.show, masked: !open, label: so.label, d: d,
    // masqué : le même texte que le titre ait changé de mains ou non
    html: open ? esc(txt) : "🙈 " + (vac ? "Match pour le titre" : "Défense de titre") + " · " + esc(so.label) + " du " + esc(fmt(d)) + " — touche pour voir" };
}
export function titleItems() {
  const out = [];
  (S.titles || []).forEach(t => {
    if (!t || !t.id || !t.c) return;
    const hist = Array.isArray(t.hist) ? t.hist : [];
    if (okDay(t.since) && days(t.since) >= 0 && days(t.since) <= DAYS) {
      const prev = String((hist[0] && hist[0].c) || ""), vac = !prev || /vacan/i.test(prev);
      out.push(titleItem(t, "c", t.since, t.ev, "🏆 " + t.c + " a remporté le " + t.n + (vac ? " (titre vacant)" : " face à " + prev), vac));
    }
    defensesOf(t).forEach(x => {
      if (!x || !okDay(x.d) || days(x.d) < 0 || days(x.d) > DAYS) return;
      out.push(titleItem(t, "d" + norm(x.vs || "").replace(/[^a-z0-9]+/g, "").slice(0, 24), x.d, x.ev || (x.show && x.show !== "PLE" ? x.show : ""),
        "🛡️ " + champ(t) + " a conservé le " + t.n + (x.vs ? " face à " + x.vs : ""), false));
    });
  });
  const seen = {};
  return out.filter(x => (seen[x.id] ? false : (seen[x.id] = 1))).sort((a, b) => b.d.localeCompare(a.d));
}
const upcoming = () => { const now = Date.now(), td = new Date().toISOString().slice(0, 10); return allPle().filter(e => okDay(e.d) && (startOf(e) ? startOf(e) > now : e.d >= td)).sort((a, b) => a.d.localeCompare(b.d)); };
const pleItem = e => { const n = -days(e.d); return { id: "ple:" + e.k + ":" + e.d, k: e.k, show: "", href: evHref(e), html: "⏳ " + esc(e.t) + " (" + esc(e.k) + ") " + (n <= 0 ? "aujourd’hui" : n === 1 ? "demain" : "dans " + n + " jours") }; };
const pickItem = e => ({ id: "pick:" + e.k + ":" + e.d, k: e.k, show: "", href: "#/pronostic/" + encodeURIComponent(e.k) + "/" + e.d, html: "🎯 Pronostics de " + esc(e.t) + " ouverts jusqu’au " + esc(startOf(e) ? fmtAt(lockAt(e), PARIS) : fmt(e.d)) });
const pollItem = p => ({ id: "poll:" + p.id, k: p.k || "", show: "", href: "#/sondages", html: "📊 " + esc(p.q) });
const storyItem = s => ({ id: "story:" + (s.id || s.t), k: s.k || "", show: "", href: "#/storyline/" + encodeURIComponent(s.id || ""), html: "📖 Storyline du jour : " + esc(s.t) });

// ---------- les infos d'un onglet ----------
// scope : "home", "p:WWE" (onglet, avec les promotions rangées dedans), "p:AAA" (promotion rangée), "s:WWE|Raw" (show)
function scopeOf(route) {
  if (route.name === "home") return "home";
  if (route.name !== "promo" || !S.P[route.k]) return "";
  return route.n ? "s:" + route.k + "|" + route.n : "p:" + route.k;
}
export function items(scope) {
  const T = titleItems(), up = upcoming();
  if (scope === "home") {
    const out = T.slice();
    const bl = babiesLast(); if (bl) out.push({ id: "babies:" + bl.label, k: "", href: "#/sondages", html: "👑 Babies " + esc(bl.label) + " : <b>" + esc(bl.n) + "</b>" });
    if (up[0]) out.push(pleItem(up[0]));
    const pk = up.find(e => pickable(e)); if (pk) out.push(pickItem(pk));
    const po = allPolls().filter(isOpen)[0]; if (po) out.push(pollItem(po));
    const st = (S.storylines || [])[0]; if (st) out.push(storyItem(st));
    return out;
  }
  const show = scope.indexOf("s:") === 0, key = scope.slice(2), k = show ? key.split("|")[0] : key, n = show ? key.slice(k.length + 1) : "";
  // l'onglet d'une promotion compte aussi les promotions rangées dedans (WWE + AAA, AEW + ROH)
  const ks = [k].concat(show ? [] : Object.keys(PARENT).filter(c => PARENT[c] === k && S.P[c]));
  const out = T.filter(x => ks.indexOf(x.k) >= 0 && (!show || x.show === n || x.show === ""));
  ks.forEach(kk => {
    const e = up.find(x => x.k === kk); if (e) out.push(pleItem(e));
    const pk = up.find(x => x.k === kk && pickable(x)); if (pk) out.push(pickItem(pk));
    if (!show) {
      const po = allPolls().filter(p => isOpen(p) && p.k === kk)[0]; if (po) out.push(pollItem(po));
      const st = (S.storylines || []).slice(0, 7).find(s => s.k === kk); if (st) out.push(storyItem(st));
    }
  });
  return out;
}

// ---------- mémoire des tours (sur l'appareil) ----------
// p : info -> moment où elle est entrée dans le bandeau la dernière fois qu'elle est passée en entier
// t : onglet -> début du tour en cours ; une info est « déjà passée » dans l'onglet si p >= t
const STORE = "ctv.tk2";
let mem = null, saveT = null;
function store() {
  if (!mem) { try { mem = JSON.parse(lsGet(STORE) || "{}") || {}; } catch (e) { mem = {}; } mem.p = mem.p || {}; mem.t = mem.t || {}; }
  return mem;
}
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { const m = store(), lim = Date.now() - 12 * 864e5; Object.keys(m.p).forEach(k => { if (m.p[k] < lim) delete m.p[k]; }); lsSet(STORE, JSON.stringify(m)); }, 500);
}
const tourOf = sc => store().t[sc] || 0;
function passed(el) { const id = el.dataset.i; if (!id) return; store().p[id] = +el.dataset.app || Date.now(); save(); }

// ---------- défilement ----------
let st = null; // { scope, list, box, rail, track, off, cur, raf, last, paused, hold }
const btnHTML = x => '<button class="tk' + (x.masked ? " masked" : x.tid ? " title" : "") + '" data-act="tk" data-i="' + esc(x.id) + '"' + (x.href ? ' data-h="' + esc(x.href) + '"' : "") + (x.tid ? ' data-t="' + esc(x.tid) + '"' : "") + ">" + x.html + "</button>";
function itemEl(x) {
  const w = document.createElement("span");
  w.className = "tkit"; w.dataset.i = x.id; w.dataset.app = String(Date.now()); w.dataset.sig = btnHTML(x);
  w.innerHTML = w.dataset.sig + '<span class="tksep">•</span>';
  return w;
}
const onTrack = () => Array.from(st.track.children).filter(c => c.dataset.i);
// prochaine info : dans l'ordre, la première pas encore passée dans ce tour et pas déjà à l'écran
function pick() {
  const L = st.list; if (!L.length) return null;
  const els = onTrack(), on = {}; els.forEach(c => { on[c.dataset.i] = +c.dataset.app || 0; });
  const m = store(), T = tourOf(st.scope);
  const due = x => !(m.p[x.id] && m.p[x.id] >= T);
  const scan = () => {
    for (let i = 0; i < L.length; i++) { const j = (st.cur + i) % L.length, x = L[j]; if (due(x) && on[x.id] == null) { st.cur = (j + 1) % L.length; return x; } }
    return null;
  };
  const x = scan(); if (x) return x;
  // toutes les infos sont passées (ou en train de passer dans ce tour) : nouveau tour
  if (L.every(y => !due(y) || (on[y.id] != null && on[y.id] >= T))) { m.t[st.scope] = Date.now(); save(); return scan(); }
  return null; // une info du tour précédent est encore à l'écran : on attend qu'elle sorte
}
const endOf = () => { const l = st.track.lastElementChild; return st.off + (l ? l.offsetLeft + l.offsetWidth : 0); };
function fill() {
  const W = st.rail.clientWidth || 360;
  for (let g = 0; g < 24; g++) {
    if (!st.track.lastElementChild && !st.init) st.off = W; // bandeau vide : la suivante entre par la droite
    st.init = false;
    const end = endOf(); if (end > W + 40) break;
    const x = pick(); if (!x) break;
    // jamais une info qui surgit au milieu : elle entre par le bord droit
    if (st.track.lastElementChild && end < W) { const sp = document.createElement("span"); sp.className = "tkgap"; sp.style.width = Math.ceil(W - end) + "px"; st.track.appendChild(sp); }
    st.track.appendChild(itemEl(x));
  }
}
function frame(ts) {
  if (!st) return;
  const step = st.last ? Math.min(ts - st.last, 100) : 0; st.last = ts;
  if (!st.paused && !st.hold && !document.hidden) st.off -= SPEED * step / 1000;
  // sortie à gauche : l'info est passée en entier
  let f = st.track.firstElementChild;
  while (f && st.off + f.offsetLeft + f.offsetWidth < 0) {
    if (f.dataset.i) passed(f);
    const w = f.offsetWidth; f.remove(); st.off += w; f = st.track.firstElementChild;
  }
  fill();
  st.track.style.transform = "translate3d(" + st.off.toFixed(1) + "px,0,0)";
  st.raf = requestAnimationFrame(frame);
}
// en quittant un onglet : les infos déjà en train de sortir comptent comme passées
function stop() {
  if (!st) return;
  cancelAnimationFrame(st.raf);
  onTrack().forEach(c => { if (st.off + c.offsetLeft < 0) passed(c); });
  st = null;
}
export function mountTicker(route) {
  const box = document.getElementById("ticker"); if (!box) return;
  const scope = scopeOf(route), list = scope ? items(scope) : [];
  if (!list.length) { stop(); box.hidden = true; box.innerHTML = ""; return; }
  if (st && st.scope === scope && box.contains(st.track)) {
    // même onglet : on garde le défilement, les infos sont mises à jour sur place (spoiler dévoilé, « demain » -> « aujourd’hui »…)
    const curId = st.list[(st.cur + st.list.length - 1) % st.list.length];
    st.list = list;
    const ci = curId ? list.findIndex(x => x.id === curId.id) : -1; st.cur = ci >= 0 ? (ci + 1) % list.length : 0;
    onTrack().forEach(c => { const x = list.find(y => y.id === c.dataset.i); if (x && c.dataset.sig !== btnHTML(x)) { c.dataset.sig = btnHTML(x); c.firstElementChild.outerHTML = c.dataset.sig; } });
    return;
  }
  stop();
  box.hidden = false;
  box.innerHTML = '<div class="tkrail"><div class="tktrack"></div></div>';
  const rail = box.firstElementChild, track = rail.firstElementChild;
  st = { scope: scope, list: list, box: box, rail: rail, track: track, off: 10, cur: 0, raf: 0, last: 0, paused: false, hold: false, init: true };
  fill();
  st.raf = requestAnimationFrame(frame);
}
// pause sous la souris ; au doigt, pause le temps de toucher
document.addEventListener("mouseover", e => { if (st) st.paused = !!(e.target.closest && e.target.closest("#ticker")); }, { passive: true });
let holdT = null;
document.addEventListener("touchstart", e => { if (st && e.target.closest && e.target.closest("#ticker")) { st.hold = true; clearTimeout(holdT); } }, { passive: true });
document.addEventListener("touchend", () => { clearTimeout(holdT); holdT = setTimeout(() => { if (st) st.hold = false; }, 1200); }, { passive: true });

ACT.tk = el => {
  const id = el.dataset.i, it = titleItems().find(x => x.id === id);
  if (it && it.masked) {
    const go = () => { reveal(id); changed("tick"); };
    // mode sans spoiler : on demande confirmation tant que le show n'est pas vu
    if (noSpoil()) return modal((box, close) => {
      box.innerHTML = '<h3>Spoiler</h3><p class="sub">Tu n’as pas encore marqué « ' + esc(it.label) + " » du " + esc(fmt(it.d)) + ' comme vu. Afficher quand même ?</p><button class="btn wide" data-ok>Afficher</button><button class="btn wide ghost" style="margin-top:10px" data-no>Non merci</button>';
      box.addEventListener("click", e => { if (e.target.closest("[data-ok]")) { close(); go(); } else if (e.target.closest("[data-no]")) close(); });
    });
    return go();
  }
  if (el.dataset.t) { location.hash = "#/titre/" + encodeURIComponent(el.dataset.t); return; }
  if (el.dataset.h) location.hash = el.dataset.h;
};
