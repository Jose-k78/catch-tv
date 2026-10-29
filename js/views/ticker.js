// Bandeau défilant sous les onglets de l'accueil : prochain PLE, pronostics, sondage, storyline, Babies du mois…
// et les changements de titre, du 2e au 7e jour, masqués tant qu'on n'a pas touché (ou vu le show).
// Le bandeau défile tous les jours : sa présence ne trahit pas un changement de titre.
import { S, ACT, changed } from "../state.js";
import { esc, fmt, okDay, today, dt, lsGet, lsSet, modal } from "../util.js";
import { allPle } from "./catalog.js";
import { startOf, fmtAt, PARIS } from "../time.js";
import { seenDay, noSpoil } from "../spoil.js";
import { allPolls, isOpen, babiesLast } from "./polls.js";
import { pickable, lockAt } from "./picks.js";

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
function reveal(id) { const r = revealed(); r[id] = 1; Object.keys(r).forEach(k => { if (Object.keys(r).length > 60) delete r[k]; }); lsSet(REV, JSON.stringify(r)); }

function titleItems() {
  return (S.titles || []).filter(t => okDay(t.since) && Array.isArray(t.hist) && t.hist[0] && t.hist[0].c && days(t.since) >= 0 && days(t.since) <= 7).map(t => {
    const so = showOfTitle(t), seen = so && so.show !== null && seenDay(t.k, so.show, t.since);
    const age = days(t.since), id = "t:" + t.id + ":" + t.since;
    // avant le 2e jour : seulement pour ceux qui ont déjà vu le show
    if (age < 2 && !seen) return null;
    const open = seen || revealed()[id];
    const txt = "🏆 " + t.c + " a remporté le " + t.n + " face à " + t.hist[0].c;
    return { id: id, tid: t.id, masked: !open, seen: seen, show: so ? so.label : t.k, d: t.since,
      html: open ? esc(txt) : "🙈 Spoiler · " + esc(so ? so.label : t.k) + " du " + esc(fmt(t.since)) + " — touche pour voir" };
  }).filter(Boolean);
}
function items() {
  const out = [], now = Date.now();
  out.push(...titleItems());
  // Babies du mois : annonce les 3 premiers jours du mois
  const bl = babiesLast(); if (bl) out.push({ href: "#/sondages", html: "👑 Babies " + esc(bl.label) + " : <b>" + esc(bl.n) + "</b>" });
  // prochain PLE
  const up = allPle().filter(e => okDay(e.d) && (startOf(e) ? startOf(e) > now : e.d >= new Date().toISOString().slice(0, 10))).sort((a, b) => a.d.localeCompare(b.d));
  if (up[0]) { const n = -days(up[0].d); out.push({ href: "#/p/" + encodeURIComponent(up[0].k), html: "⏳ " + esc(up[0].t) + " (" + esc(up[0].k) + ") " + (n <= 0 ? "aujourd’hui" : n === 1 ? "demain" : "dans " + n + " jours") }); }
  // pronostics ouverts
  const pk = up.find(e => pickable(e));
  if (pk) out.push({ href: "#/pronostic/" + encodeURIComponent(pk.k) + "/" + pk.d, html: "🎯 Pronostics de " + esc(pk.t) + " ouverts jusqu’au " + esc(startOf(pk) ? fmtAt(lockAt(pk), PARIS) : fmt(pk.d)) });
  // sondage du jour
  const po = allPolls().filter(isOpen)[0];
  if (po) out.push({ href: "#/sondages", html: "📊 " + esc(po.q) });
  // storyline du jour
  const st = (S.storylines || [])[0];
  if (st) out.push({ href: "#/storyline", html: "📖 Storyline du jour : " + esc(st.t) });
  return out;
}
let sig = "";
export function mountTicker(route) {
  const box = document.getElementById("ticker"); if (!box) return;
  if (route.name !== "home") { if (sig) { box.innerHTML = ""; box.hidden = true; sig = ""; } return; }
  const list = items(); if (!list.length) { box.hidden = true; box.innerHTML = ""; sig = ""; return; }
  const one = list.map(x => '<button class="tk' + (x.masked ? " masked" : x.tid ? " title" : "") + '" data-act="tk" data-i="' + esc(x.id || x.href) + '"' + (x.href ? ' data-h="' + esc(x.href) + '"' : "") + (x.tid ? ' data-t="' + esc(x.tid) + '"' : "") + ">" + x.html + "</button>").join('<span class="tksep">•</span>');
  const s = one; if (s === sig) return; sig = s;
  box.hidden = false;
  box.innerHTML = '<div class="tkrail"><div class="tkmove">' + one + '<span class="tksep">•</span>' + one + '<span class="tksep">•</span></div></div>';
  const mv = box.querySelector(".tkmove");
  requestAnimationFrame(() => { const w = mv.scrollWidth / 2; mv.style.setProperty("--tkdur", Math.max(18, Math.round(w / 55)) + "s"); });
}
ACT.tk = el => {
  const id = el.dataset.i, it = titleItems().find(x => x.id === id);
  if (it && it.masked) {
    const go = () => { reveal(id); sig = ""; changed("tick"); };
    // mode sans spoiler : on demande confirmation tant que le show n'est pas vu
    if (noSpoil()) return modal((box, close) => {
      box.innerHTML = '<h3>Spoiler</h3><p class="sub">Tu n’as pas encore marqué « ' + esc(it.show) + " » du " + esc(fmt(it.d)) + ' comme vu. Afficher quand même ?</p><button class="btn wide" data-ok>Afficher</button><button class="btn wide ghost" style="margin-top:10px" data-no>Non merci</button>';
      box.addEventListener("click", e => { if (e.target.closest("[data-ok]")) { close(); go(); } else if (e.target.closest("[data-no]")) close(); });
    });
    return go();
  }
  if (el.dataset.t) { location.hash = "#/titre/" + encodeURIComponent(el.dataset.t); return; }
  if (el.dataset.h) location.hash = el.dataset.h;
};
