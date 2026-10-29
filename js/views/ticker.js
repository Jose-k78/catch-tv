// Bandeau défilant sous les onglets : à l'accueil toutes les infos, dans l'onglet d'une promotion seulement les siennes
// (la WWE avec la AAA, l'AEW avec la ROH), dans un show les infos de ce show et les PLE de la promotion.
// Changements de titre du 2e au 7e jour, masqués tant qu'on n'a pas touché (ou vu le show). Pas d'info : pas de bandeau.
// En revenant sur un onglet, le bandeau reprend où il en était (ou à l'info suivante si quelque chose a changé).
import { S, ACT, changed } from "../state.js";
import { esc, fmt, okDay, today, dt, lsGet, lsSet, modal } from "../util.js";
import { allPle, PARENT } from "./catalog.js";
import { startOf, fmtAt, PARIS } from "../time.js";
import { seenDay, noSpoil } from "../spoil.js";
import { allPolls, isOpen, babiesLast } from "./polls.js";
import { pickable, lockAt } from "./picks.js";

const SPEED = 70; // pixels par seconde
const days = d => Math.round((today() - dt(d)) / 864e5);
const lbl = (k, n) => (String(n).indexOf(k) === 0 ? n : k + " " + n);
// le show où le titre a changé : un show hebdo du même nom, sinon le PLE de ce jour-là
function showOfTitle(t) {
  const pr = S.P[t.k]; if (!pr) return null;
  const sh = pr.s || {}, ev = String(t.ev || "");
  const n = Object.keys(sh).find(x => ev && (ev === x || ev.indexOf(x) === 0));
  if (n) return { show: n, label: lbl(t.k, n) };
  const ple = (pr.e || []).find(e => e.d === t.since);
  if (ple) return { show: "", label: lbl(t.k, ple.t) };
  const key = Object.keys(S.highlights || {}).find(k => k.indexOf(t.k + "|") === 0 && k.slice(-10) === t.since);
  if (key) { const s = key.split("|")[1]; return { show: s === "PLE" ? "" : s, label: lbl(t.k, s === "PLE" ? (ev || "PLE") : s) }; }
  return { show: null, label: t.k + (ev ? " " + ev : "") };
}
const REV = "ctv.tkrev";
const revealed = () => { try { return JSON.parse(lsGet(REV) || "{}"); } catch (e) { return {}; } };
function reveal(id) { const r = revealed(); r[id] = 1; const ks = Object.keys(r); ks.slice(0, Math.max(0, ks.length - 60)).forEach(k => delete r[k]); lsSet(REV, JSON.stringify(r)); }

function titleItems() {
  return (S.titles || []).filter(t => okDay(t.since) && Array.isArray(t.hist) && t.hist[0] && t.hist[0].c && days(t.since) >= 0 && days(t.since) <= 7).map(t => {
    const so = showOfTitle(t), seen = so && so.show !== null && seenDay(t.k, so.show, t.since);
    const age = days(t.since), id = "t:" + t.id + ":" + t.since;
    // avant le 2e jour : seulement pour ceux qui ont déjà vu le show
    if (age < 2 && !seen) return null;
    const open = seen || revealed()[id];
    const txt = "🏆 " + t.c + " a remporté le " + t.n + " face à " + t.hist[0].c;
    return { id: id, tid: t.id, k: t.k, show: (so && so.show) || t.show || "", masked: !open, seen: seen, label: so ? so.label : t.k, d: t.since,
      html: open ? esc(txt) : "🙈 Spoiler · " + esc(so ? so.label : t.k) + " du " + esc(fmt(t.since)) + " — touche pour voir" };
  }).filter(Boolean);
}
const upcoming = () => { const now = Date.now(), td = new Date().toISOString().slice(0, 10); return allPle().filter(e => okDay(e.d) && (startOf(e) ? startOf(e) > now : e.d >= td)).sort((a, b) => a.d.localeCompare(b.d)); };
const pleItem = e => { const n = -days(e.d); return { id: "ple:" + e.k + ":" + e.d, k: e.k, show: "", href: "#/p/" + encodeURIComponent(e.k), html: "⏳ " + esc(e.t) + " (" + esc(e.k) + ") " + (n <= 0 ? "aujourd’hui" : n === 1 ? "demain" : "dans " + n + " jours") }; };
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
function items(scope) {
  const T = titleItems(), up = upcoming();
  if (scope === "home") {
    const out = T.slice();
    const bl = babiesLast(); if (bl) out.push({ id: "babies", k: "", href: "#/sondages", html: "👑 Babies " + esc(bl.label) + " : <b>" + esc(bl.n) + "</b>" });
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

// ---------- affichage, avec reprise de la position ----------
const mem = {};                 // scope -> { sig, el (ms écoulées), first (info en tête) }
let cur = { scope: "", sig: "" }, keepPos = false;
function snapshot() {
  const mv = document.querySelector("#ticker .tkmove"); if (!mv || !cur.scope) return;
  const dur = +mv.dataset.dur || 0, half = +mv.dataset.half || 0; if (!dur || !half) return;
  let el = 0;
  try { const a = mv.getAnimations && mv.getAnimations()[0]; if (a && a.currentTime != null) el = a.currentTime; } catch (e) {}
  if (!el && mv.dataset.t0) el = Date.now() - +mv.dataset.t0;
  el = ((el % dur) + dur) % dur;
  const px = el / dur * half; let first = "";
  mv.querySelectorAll(".tk").forEach(b => { if (b.offsetLeft <= px + 4 && b.offsetLeft < half) first = b.dataset.i; });
  mem[cur.scope] = { sig: cur.sig, el: el, first: first };
}
export function mountTicker(route) {
  const box = document.getElementById("ticker"); if (!box) return;
  const scope = scopeOf(route);
  const list = scope ? items(scope) : [];
  const html = list.map(x => '<button class="tk' + (x.masked ? " masked" : x.tid ? " title" : "") + '" data-act="tk" data-i="' + esc(x.id) + '"' + (x.href ? ' data-h="' + esc(x.href) + '"' : "") + (x.tid ? ' data-t="' + esc(x.tid) + '"' : "") + ">" + x.html + "</button>").join('<span class="tksep">•</span>');
  if (scope === cur.scope && html === cur.sig) return;
  snapshot();
  const keep = keepPos && scope === cur.scope; keepPos = false;
  cur = { scope: scope, sig: html };
  if (!html) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  box.innerHTML = '<div class="tkrail"><div class="tkmove" style="animation:none">' + html + '<span class="tksep">•</span>' + html + '<span class="tksep">•</span></div></div>';
  const mv = box.querySelector(".tkmove");
  requestAnimationFrame(() => {
    const half = mv.scrollWidth / 2, dur = Math.max(12, half / SPEED) * 1000, m = mem[scope];
    let delay = 0;
    if (m && (m.sig === html || keep)) delay = -m.el;
    else if (m && m.first) {
      // quelque chose a changé : on reprend à l'info qui suivait celle qu'on voyait
      const bs = Array.from(mv.querySelectorAll(".tk")).filter(b => b.offsetLeft < half), i = bs.findIndex(b => b.dataset.i === m.first);
      const nx = i >= 0 ? bs[(i + 1) % bs.length] : null;
      if (nx) delay = -(nx.offsetLeft / SPEED) * 1000;
    }
    mv.dataset.dur = dur; mv.dataset.half = half; mv.dataset.t0 = Date.now() + delay;
    mv.style.animation = "tkscroll " + (dur / 1000).toFixed(2) + "s linear " + (delay / 1000).toFixed(2) + "s infinite";
  });
}
ACT.tk = el => {
  const id = el.dataset.i, it = titleItems().find(x => x.id === id);
  if (it && it.masked) {
    const go = () => { reveal(id); keepPos = true; changed("tick"); };
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
