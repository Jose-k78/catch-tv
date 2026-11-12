// TCCCG — Roster (cahier du 12 nov.) : toutes ses cartes rangées comme dans un classeur (pages de 9), tri et filtres,
// onglets Cartes · Éveil · Entraînement · Évolution · Doublons · Médailles · Objets · Virer ; fiche d'une carte (stats,
// finisher, équipement, actions) ; appui long = sélection de plusieurs cartes (favori ou virer). Une favorite ne se vire pas.
import { S, ACT, changed } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { RAR, LVMAX, AWAKE, items, itemById, defOf, statsOf, RNAME, ARCH, ARCHS, STATS, cardById, evolutionsOf, finLv } from "./data.js";
import { me, commit, owned, cardXp, CXP, bump } from "./store.js";
import { cardHTML, itemIc } from "./card.js";
import { beltsSection } from "./evo.js";
import { burst, rays, flash, mid } from "./phaser.js";
import { SFX } from "./sfx.js";

const SELL = { N: 50, R: 120, SR: 300, SSR: 800, UR: 2000, LR: 5000 };
const PAGE = 9;
let sub = "", rf = "", rt = "", rp = "", rs = "rar", page = 0;
export const baseOf = id => (id || "").split(/[@#~]/)[0];
const baseName = c => { const b = cardById(baseOf(c)); return b ? b.name : (defOf(c) || {}).name || ""; };
const isFav = (d, iid) => d.fav.indexOf(iid) >= 0;
// sélection multiple (appui long) : favori ou virer
let sel = null, lpT = 0, lpUp = 0, lpOn = false, lpIid = "";
export const selecting = () => !!sel;
export function askConfirm(title, text, yes, fn) {
  modal((box, close) => {
    box.innerHTML = "<h3>" + esc(title) + '</h3><p class="sub">' + text + '</p><button class="btn wide" data-y>' + esc(yes) + '</button><button class="btn wide ghost" style="margin-top:6px" data-close>Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) return close(); if (e.target.closest("[data-y]")) { close(); fn(); } });
  });
}
export const resBar = () => ""; // les ressources sont dans la barre du haut
// une carte virée / fusionnée / en médaille rend son équipement au sac
const freeEq = (d, inst) => { if (inst && inst.eq) { d.items[inst.eq] = (d.items[inst.eq] || 0) + 1; delete inst.eq; } };
const drop = (d, iid) => { const it = d.cards[iid]; if (!it) return; freeEq(d, it); delete d.cards[iid]; d.fav = d.fav.filter(x => x !== iid); };

const TABS = [["", "Cartes"], ["eveil", "Éveil"], ["entrainement", "Entraînement"], ["evolution", "Évolution"], ["doublons", "Doublons"], ["medailles", "Médailles"], ["objets", "Objets"], ["virer", "Virer"]];
export function rosterView(tab, id) {
  const nsub = tab || ""; if (nsub !== sub) { sel = nsub === "virer" ? new Set() : null; page = 0; } sub = nsub;
  const d = me(), L = owned(d);
  if (sel) [...sel].forEach(i => { if (!d.cards[i]) sel.delete(i); });
  let h = '<section class="tccghead"><h1>Roster</h1></section><nav class="tsub tsubx">' + TABS.map(x => '<a class="' + (sub === x[0] ? "on" : "") + '" href="#/tccg/roster' + (x[0] ? "/" + x[0] : "") + '">' + x[1] + "</a>").join("") + "</nav>";
  if (sub === "objets") return h + objetsView(d);
  if (sub === "medailles") return h + medalsView(d);
  if (sub === "entrainement" && ACT.tcgtrainview) return h + ACT.tcgtrainview(id);
  if (!L.length) return h + '<p class="tnote">Pas encore de carte. Ouvre tes boosters gratuits dans Call Up !</p><a class="btn" style="margin:8px 16px" href="#/tccg/callup">Aller au Call Up</a>';
  if (sub === "eveil") return h + awakeView(d, L);
  if (sub === "doublons") return h + dupsView(d, L);
  if (sub === "evolution") return h + evoView(d, L);
  return h + binder(d, L);
}
// ---------- le classeur ----------
function binder(d, L) {
  const P = Array.from(new Set(L.map(x => (defOf(x.c) || {}).k).filter(Boolean))).sort();
  let V = L.filter(x => { const f = defOf(x.c); return (!rf || x.r === rf) && (!rt || f.arch === rt) && (!rp || f.k === rp); });
  const pw = x => statsOf(x).reduce((a, b) => a + b, 0);
  V.sort((a, b) => rs === "lv" ? b.lv - a.lv : rs === "nom" ? defOf(a.c).name.localeCompare(defOf(b.c).name) : rs === "pv" ? pw(b) - pw(a) : rs === "type" ? ARCHS.indexOf(defOf(a.c).arch) - ARCHS.indexOf(defOf(b.c).arch) : rs === "new" ? b.iid.localeCompare(a.iid) : RAR.indexOf(b.r) - RAR.indexOf(a.r) || b.lv - a.lv);
  const pages = Math.max(1, Math.ceil(V.length / PAGE)); if (page >= pages) page = pages - 1;
  const dupC = {}; L.forEach(x => { dupC[baseOf(x.c)] = 1; });
  let h = '<p class="tnote">' + L.length + " carte" + (L.length > 1 ? "s" : "") + " · " + Object.keys(dupC).length + " catcheurs" + (sub === "virer" ? " · touche les cartes à virer (les favorites ⭐ ne se virent pas)" : "") + "</p>" +
    '<div class="tfilt">' + ['<button class="chip' + (!rf ? " on" : "") + '" data-act="tcgrf" data-r="">Toutes</button>'].concat(RAR.map(r => '<button class="chip tcr r-' + r + (rf === r ? " on" : "") + '" data-act="tcgrf" data-r="' + r + '">' + r + " " + L.filter(x => x.r === r).length + "</button>")).join("") + "</div>" +
    '<div class="tfilt">' + ['<button class="chip' + (!rt ? " on" : "") + '" data-act="tcgrt" data-t="">Tous les types</button>'].concat(ARCHS.map(a => '<button class="chip' + (rt === a ? " on" : "") + '" data-act="tcgrt" data-t="' + a + '" style="--tc:' + ARCH[a].c + '"><i class="tdotc"></i>' + a + "</button>")).join("") + "</div>" +
    '<div class="tsortbar"><select data-act="tcgrp" aria-label="Promotion"><option value="">Toutes les promotions</option>' + P.map(k => "<option" + (rp === k ? " selected" : "") + ">" + esc(k) + "</option>").join("") + "</select>" +
    '<select data-act="tcgrs" aria-label="Trier">' + [["rar", "Rareté"], ["lv", "Niveau"], ["pv", "Puissance"], ["type", "Type"], ["nom", "Nom"], ["new", "Plus récentes"]].map(x => '<option value="' + x[0] + '"' + (rs === x[0] ? " selected" : "") + ">Trier : " + x[1] + "</option>").join("") + "</select></div>";
  if (sel) { const S2 = [...sel], gain = S2.reduce((a, i) => a + (isFav(d, i) ? 0 : SELL[(d.cards[i] || {}).r] || 0), 0);
    h += '<div class="tselbar"><b>' + sel.size + " carte" + (sel.size > 1 ? "s" : "") + '</b><button class="btn small ghost" data-act="tcgselall">Page</button><button class="btn small ghost" data-act="tcgselfav"' + (sel.size ? "" : " disabled") + '>⭐ Favori</button><button class="btn small danger" data-act="tcgselfire"' + (sel.size ? "" : " disabled") + ">💸 +" + gain + '</button><button class="btn small ghost" data-act="tcgselx" aria-label="Annuler">✕</button></div>'; }
  else h += '<p class="tnote thint">Appui long sur une carte pour en choisir plusieurs (favori ou virer).</p>';
  const P0 = V.slice(page * PAGE, page * PAGE + PAGE);
  h += '<div class="tbinder"><div class="tbpage trgrid tlong' + (sel ? " tselmode" : "") + '">' + P0.map(x => '<div class="tpocket">' + cardHTML(x, { small: true, act: "tcgcard", iid: x.iid, cls: (sel && sel.has(x.iid) ? "pick" : "") + (isFav(d, x.iid) ? " isfav" : "") }) + "</div>").join("") +
    Array.from({ length: PAGE - P0.length }, () => '<div class="tpocket empty"></div>').join("") + "</div>" +
    '<div class="tbnav"><button class="btn small ghost" data-act="tcgpg" data-v="-1"' + (page ? "" : " disabled") + '>‹</button><span>Page ' + (page + 1) + " / " + pages + '</span><button class="btn small ghost" data-act="tcgpg" data-v="1"' + (page < pages - 1 ? "" : " disabled") + ">›</button></div></div>";
  return h;
}
ACT.tcgpg = el => { page = Math.max(0, page + (+el.dataset.v || 0)); changed("tcg"); };
ACT.tcgrf = el => { rf = el.dataset.r || ""; page = 0; changed("tcg"); };
ACT.tcgrt = el => { rt = el.dataset.t || ""; page = 0; changed("tcg"); };
ACT.tcgrp = el => { if (el.tagName !== "SELECT") return; rp = el.value || ""; page = 0; changed("tcg"); };
ACT.tcgrs = el => { if (el.tagName !== "SELECT") return; rs = el.value || "rar"; page = 0; changed("tcg"); };
document.addEventListener("change", e => { const t = e.target; if (t && t.tagName === "SELECT" && (t.dataset.act === "tcgrp" || t.dataset.act === "tcgrs")) ACT[t.dataset.act](t); });
// glisser le classeur à gauche / à droite pour tourner la page
if (typeof document !== "undefined") {
  let x0 = null;
  document.addEventListener("touchstart", e => { x0 = e.target.closest && e.target.closest(".tbinder") ? e.touches[0].clientX : null; }, { passive: true });
  document.addEventListener("touchend", e => { if (x0 == null || sel) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) ACT.tcgpg({ dataset: { v: dx < 0 ? 1 : -1 } }); });
}
ACT.tcgselx = () => { sel = sub === "virer" ? new Set() : null; changed("tcg"); };
ACT.tcgselall = () => { const b = document.querySelectorAll(".tbpage .tc3[data-iid]"); if (!sel) sel = new Set(); b.forEach(x => sel.add(x.dataset.iid)); changed("tcg"); };
ACT.tcgselfav = () => {
  if (!sel || !sel.size) return; const L = [...sel];
  commit(d => { const allFav = L.every(i => isFav(d, i)); L.forEach(i => { if (!d.cards[i]) return; const k = d.fav.indexOf(i); if (allFav && k >= 0) d.fav.splice(k, 1); else if (!allFav && k < 0) d.fav.push(i); }); });
  toast("⭐ Favorites mises à jour"); sel = sub === "virer" ? new Set() : null; changed("tcg");
};
ACT.tcgselfire = () => {
  if (!sel || !sel.size) return; const d = me(), L = [...sel].filter(i => d.cards[i] && !isFav(d, i)), nf = sel.size - L.length, gain = L.reduce((a, i) => a + (SELL[d.cards[i].r] || 0), 0);
  if (!L.length) return toast("Les favorites ne se virent pas");
  const top = L.filter(i => RAR.indexOf(d.cards[i].r) >= RAR.indexOf("SSR")).length;
  askConfirm("Virer " + L.length + " carte" + (L.length > 1 ? "s" : "") + " ?", "Tu gagnes <b>+" + gain + " 💵</b>. Les cartes virées disparaissent pour de bon (leur équipement revient dans ton sac)." + (nf ? "<br>⭐ " + nf + " favorite" + (nf > 1 ? "s" : "") + " gardée" + (nf > 1 ? "s" : "") + "." : "") + (top ? "<br>⚠️ Dont " + top + " SSR ou plus." : ""), "💸 Virer les " + L.length + " cartes",
    () => { commit(dd => { L.forEach(i => { const it = dd.cards[i]; if (!it || isFav(dd, i)) return; dd.res.money += SELL[it.r] || 0; drop(dd, i); }); }); toast("💸 " + L.length + " cartes virées : +" + gain + " 💵"); sel = sub === "virer" ? new Set() : null; changed("tcg"); });
};
if (typeof document !== "undefined") {
  const card = e => e.target.closest && e.target.closest(".trgrid.tlong .tc3[data-act=tcgcard]");
  document.addEventListener("pointerdown", e => { const c = card(e); clearTimeout(lpT); lpOn = false; if (!c) return; const x0 = e.clientX, y0 = e.clientY, iid = c.dataset.iid;
    lpT = setTimeout(() => { lpOn = true; lpIid = iid; if (!sel) sel = new Set(); sel.add(iid); try { navigator.vibrate && navigator.vibrate(25); } catch (er) {} changed("tcg"); }, 480);
    const mv = ev => { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 12) { clearTimeout(lpT); off(); } };
    const off = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); };
    const up = () => { clearTimeout(lpT); if (lpOn) lpUp = Date.now(); off(); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  });
  document.addEventListener("contextmenu", e => { if (card(e)) e.preventDefault(); });
}
// ---------- éveil : les cartes au niveau max qui ont tout ce qu'il faut ----------
export function awakeCost(inst) {
  const def = defOf(inst.c), r = inst.r, cost = AWAKE[r]; if (!cost || !def) return null;
  const next = RAR[RAR.indexOf(r) + 1]; if (!next || RAR.indexOf(next) > RAR.indexOf(def.max)) return null;
  const its = {}; Object.keys(cost.items).forEach(g => { const it = items().find(x => x.t === "eveil" && x.g === g); if (it) its[it.id] = cost.items[g]; });
  return { next: next, mpp: cost.mpp, items: its, medals: cost.medals ? { n: def.medalOf || baseName(inst.c), q: cost.medals } : null, lv: LVMAX[r] };
}
const missing = (d, inst, c) => {
  const m = []; if (inst.lv < c.lv) m.push("niveau " + inst.lv + " / " + c.lv);
  if (d.res.mom < c.mpp || d.res.pop < c.mpp || d.res.push < c.mpp) m.push("⚡⭐📣 " + c.mpp + " chacun");
  Object.keys(c.items).forEach(id => { if ((d.items[id] || 0) < c.items[id]) { const it = itemById(id); m.push((it ? it.ic + " " + it.n : id) + " " + (d.items[id] || 0) + " / " + c.items[id]); } });
  if (c.medals && (d.medals[c.medals.n] || 0) < c.medals.q) m.push("🏅 " + c.medals.n + " " + (d.medals[c.medals.n] || 0) + " / " + c.medals.q);
  return m;
};
const costTxt = c => "⚡⭐📣 " + c.mpp + " chacun" + Object.keys(c.items).map(id => { const it = itemById(id); return " · " + (it ? it.ic + " " + it.n : id) + " ×" + c.items[id]; }).join("") + (c.medals ? " · 🏅 " + c.medals.n + " ×" + c.medals.q : "");
function awakeView(d, L) {
  const R = L.map(x => ({ x: x, c: awakeCost(x) })).filter(o => o.c), ok = R.filter(o => !missing(d, o.x, o.c).length), almost = R.filter(o => missing(d, o.x, o.c).length).sort((a, b) => missing(d, a.x, a.c).length - missing(d, b.x, b.c).length).slice(0, 18);
  let h = '<p class="tnote">Une carte s’éveille quand elle est au niveau max et que tu as les objets d’éveil (et les médailles du catcheur pour les hautes raretés). Elle garde son niveau.</p>';
  h += "<h2>✨ Prêtes à s’éveiller <small class=\"tsmall\">" + ok.length + "</small></h2>" + (ok.length ? '<div class="tawl">' + ok.map(o => '<div class="tawc">' + cardHTML(o.x, { small: true, act: "tcgcard", iid: o.x.iid }) + '<small>' + o.x.r + " → <b>" + o.c.next + "</b></small><button class=\"btn small gold\" data-act=\"tcgawake\" data-iid=\"" + esc(o.x.iid) + "\">✨ Éveiller</button></div>").join("") + "</div>" : '<p class="tnote">Aucune pour l’instant.</p>');
  if (almost.length) h += "<h2>Presque prêtes</h2>" + '<div class="list">' + almost.map(o => { const f = defOf(o.x.c); return '<div class="item"><span class="lbl"><b>' + esc(f.name) + " · " + o.x.r + " → " + o.c.next + "</b><small>Il manque : " + esc(missing(d, o.x, o.c).join(" · ")) + "</small></span></div>"; }).join("") + "</div>";
  return h;
}
ACT.tcgawake = el => {
  const iid = el.dataset.iid, d = me(), inst = d.cards[iid]; if (!inst) return; const c = awakeCost(inst); if (!c) return;
  if (missing(d, inst, c).length) return toast("Il manque : " + missing(d, inst, c).join(" · "));
  askConfirm("Éveiller " + defOf(inst.c).name + " ?", inst.r + " → <b>" + c.next + "</b><br>Coût : " + esc(costTxt(c)), "✨ Éveiller", () => {
    let ok = false;
    commit(dd => { const it = dd.cards[iid]; if (!it) return; const cc = awakeCost(it); if (!cc || missing(dd, it, cc).length) return; dd.res.mom -= cc.mpp; dd.res.pop -= cc.mpp; dd.res.push -= cc.mpp; Object.keys(cc.items).forEach(id => { dd.items[id] -= cc.items[id]; }); if (cc.medals) { dd.medals[cc.medals.n] -= cc.medals.q; if (dd.medals[cc.medals.n] <= 0) delete dd.medals[cc.medals.n]; } it.r = cc.next; bump(dd, "awake"); ok = true; });
    if (ok) awakeFx(Object.assign({ iid: iid }, inst), c.next);
  });
};
// animation d'éveil : la carte brille, rayons, flash, elle passe à la nouvelle rareté
function awakeFx(before, next) {
  const ov = document.createElement("div"); ov.className = "tawfx";
  ov.innerHTML = '<div class="tawstage"><div class="tawcard">' + cardHTML(before, { nozoom: true }) + '</div><p class="tawt">ÉVEIL</p></div><p class="tphint">Touche pour continuer</p>';
  document.body.appendChild(ov); SFX.unlock(); SFX.bell(1);
  const cardEl = ov.querySelector(".tawcard"), rainbow = next === "UR" || next === "LR";
  let stopRays = null; rays(innerWidth / 2, innerHeight * 0.45, rainbow, 0).then(f => { stopRays = f; });
  setTimeout(() => { cardEl.classList.add("charge"); }, 300);
  setTimeout(() => { flash(rainbow ? 0xfff2c4 : 0xffffff, 500); const p = mid(cardEl); burst(p[0], p[1], 60); SFX.finisher();
    cardEl.innerHTML = cardHTML(Object.assign({}, before, { r: next }), { nozoom: true }); cardEl.classList.remove("charge"); cardEl.classList.add("done"); ov.querySelector(".tawt").textContent = before.r + " → " + next; ov.classList.add("ok"); }, 1600);
  ov.addEventListener("click", () => { if (!ov.classList.contains("ok")) return; if (stopRays) stopRays(); ov.remove(); changed("tcg"); });
}
// ---------- doublons : ils fusionnent dans la carte la plus forte ----------
const strength = x => RAR.indexOf(x.r) * 1000 + x.lv;
function dupsView(d, L) {
  const G = {}; L.forEach(x => { (G[baseOf(x.c)] = G[baseOf(x.c)] || []).push(x); });
  const K = Object.keys(G).filter(k => G[k].length > 1).sort((a, b) => G[b].length - G[a].length);
  let h = '<p class="tnote">Choisis un catcheur : ses doublons fusionnent dans sa carte la plus forte, qui gagne de l’XP (2 niveaux par doublon environ). Les favorites ne sont jamais fusionnées dans une autre.</p>';
  if (!K.length) return h + '<p class="tnote">Aucun doublon pour l’instant.</p>';
  return h + '<div class="list tdups">' + K.map(k => { const A = G[k].slice().sort((a, b) => strength(b) - strength(a)), best = A[0], eat = A.slice(1).filter(x => !isFav(d, x.iid));
    return '<div class="item">' + cardHTML(best, { small: true, act: "tcgcard", iid: best.iid }) + '<span class="lbl"><b>' + esc(defOf(best.c).name) + "</b><small>" + A.length + " exemplaires · garde : " + best.r + " Nv " + best.lv + "</small>" +
      (eat.length ? '<button class="btn small" data-act="tcgfuse" data-iid="' + esc(best.iid) + '">🔗 Fusionner ' + eat.length + " doublon" + (eat.length > 1 ? "s" : "") + "</button>" : '<small class="tnote">Doublons favoris : rien à fusionner</small>') + "</span></div>"; }).join("") + "</div>";
}
ACT.tcgfuse = el => {
  const iid = el.dataset.iid, d = me(), best = d.cards[iid]; if (!best) return;
  const eat = owned(d).filter(x => x.iid !== iid && baseOf(x.c) === baseOf(best.c) && !isFav(d, x.iid));
  if (!eat.length) return toast("Pas de doublon à fusionner");
  askConfirm("Fusionner " + eat.length + " doublon" + (eat.length > 1 ? "s" : "") + " ?", "Dans " + esc(defOf(best.c).name) + " (" + best.r + " Nv " + best.lv + "). Les doublons disparaissent (leur équipement revient dans ton sac).", "🔗 Fusionner", () => {
    let up = 0;
    commit(dd => { const b = dd.cards[iid]; if (!b) return; eat.forEach(x => { if (!dd.cards[x.iid] || isFav(dd, x.iid)) return; up += cardXp(b, CXP(b.lv) * 2 + (x.lv || 1) * 20); drop(dd, x.iid); }); bump(dd, "fuse", eat.length); });
    toast("🔗 Fusion : +" + up + " niveau" + (up > 1 ? "x" : ""));
    const el2 = document.querySelector('.tc3[data-iid="' + iid + '"]'); if (el2) { const p = mid(el2); burst(p[0], p[1], 30); }
  });
};
// ---------- évolution : les cartes qui ont un arbre ----------
function evoView(d, L) {
  const E = L.filter(x => evolutionsOf(x.c).length).sort((a, b) => strength(b) - strength(a));
  let h = '<p class="tnote">Chaque carte a son arbre d’évolution : ceintures tenues en vrai, anciennes gimmicks… Touche une carte pour voir son arbre et les conditions. La rareté ne change pas ; le niveau revient à 1, les bonus d’entraînement restent.</p>';
  if (!E.length) return h + '<p class="tnote">Aucune de tes cartes n’a d’évolution pour l’instant.</p>';
  return h + '<div class="trgrid">' + E.map(x => '<div class="tevtile" data-act="tcgevo" data-iid="' + esc(x.iid) + '">' + cardHTML(x, { small: true }) + "<small>🌳 " + evolutionsOf(x.c).length + " évolution" + (evolutionsOf(x.c).length > 1 ? "s" : "") + "</small></div>").join("") + "</div>";
}
// ---------- médailles ----------
function medalsView(d) {
  const M = Object.keys(d.medals || {}).filter(k => d.medals[k] > 0).sort();
  let h = '<p class="tnote">Une carte peut devenir une médaille de son catcheur. Les médailles servent aux éveils des hautes raretés, à certaines évolutions et à acheter les ceintures du Shop. Touche une médaille pour voir à quoi elle sert.</p>' +
    '<button class="btn wide gold" style="margin:4px 16px;width:calc(100% - 32px)" data-act="tcgmedpick">🏅 Transformer une carte en médaille</button>';
  h += M.length ? '<div class="tmeds">' + M.map(n => '<button class="tmed" data-act="tcgmedinfo" data-n="' + esc(n) + '"><span>🏅</span><b>' + esc(n) + "</b><small>×" + d.medals[n] + "</small></button>").join("") + "</div>" : '<p class="tnote">Pas encore de médaille.</p>';
  return h;
}
ACT.tcgmedinfo = el => {
  const n = el.dataset.n, d = me(), need = owned(d).filter(x => { const c = awakeCost(x); return c && c.medals && c.medals.n === n; });
  const evo = owned(d).filter(x => evolutionsOf(x.c).some(e => e.cond && e.cond.med && (e.cond.med.n === n || (!e.cond.med.n && baseName(x.c) === n))));
  modal((box, close) => {
    box.innerHTML = "<h3>🏅 Médaille de " + esc(n) + '</h3><p class="sub">Tu en as ' + (d.medals[n] || 0) + ".</p>" +
      "<h4>Éveils qui en ont besoin</h4>" + (need.length ? '<div class="trgrid">' + need.map(x => cardHTML(x, { small: true })).join("") + "</div>" : '<p class="tnote">Aucune de tes cartes pour l’instant.</p>') +
      "<h4>Évolutions qui en ont besoin</h4>" + (evo.length ? '<div class="trgrid">' + evo.map(x => cardHTML(x, { small: true })).join("") + "</div>" : '<p class="tnote">Aucune.</p>') +
      '<p class="tnote">Toutes les médailles servent aussi à acheter les ceintures du Shop.</p><button class="btn wide ghost" data-close>Fermer</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
  });
};
ACT.tcgmedpick = () => {
  let q = "";
  modal((box, close) => {
    box.classList.add("tbibox");
    const list = () => { const d = me(); return owned(d).filter(x => !isFav(d, x.iid) && (!q || defOf(x.c).name.toLowerCase().indexOf(q.toLowerCase()) >= 0)).sort((a, b) => strength(a) - strength(b)).slice(0, 60).map(x => cardHTML(x, { small: true, act: "tcgmed1", iid: x.iid })).join("") || '<p class="tnote">Aucune carte (les favorites ne se transforment pas).</p>'; };
    box.innerHTML = '<h3>🏅 Quelle carte ?</h3><div class="search"><input id="tmq" type="search" placeholder="Chercher un catcheur"></div><div class="trgrid" id="tmg">' + list() + '</div><button class="btn wide ghost" data-close>Fermer</button>';
    box.addEventListener("input", e => { if (e.target.id === "tmq") { q = e.target.value; box.querySelector("#tmg").innerHTML = list(); } });
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); if (e.target.closest("[data-act=tcgmed1]")) close(); });
  });
};
ACT.tcgmed1 = el => {
  const iid = el.dataset.iid, d = me(), inst = d.cards[iid]; if (!inst) return; if (isFav(d, iid)) return toast("Une favorite ne se transforme pas");
  const n = baseName(inst.c);
  askConfirm("Transformer en médaille ?", esc(defOf(inst.c).name) + " (" + inst.r + " Nv " + inst.lv + ") devient <b>1 médaille de " + esc(n) + "</b>. La carte disparaît.", "🏅 Transformer", () => {
    commit(dd => { if (!dd.cards[iid] || isFav(dd, iid)) return; drop(dd, iid); dd.medals[n] = (dd.medals[n] || 0) + 1; }); toast("🏅 Médaille de " + n);
  });
};
// ---------- objets : ceintures, équipement, objets d'éveil et de combat ----------
function objetsView(d) {
  const I = t => items().filter(x => x.t === t && (d.items[x.id] || 0) > 0);
  const used = {}; owned(d).forEach(x => { if (x.eq) (used[x.eq] = used[x.eq] || []).push(defOf(x.c).name); });
  const row = x => '<span class="titem" title="' + esc(x.d || "") + '">' + itemIc(x) + " <b>" + esc(x.n) + "</b> ×" + (d.items[x.id] || 0) + "<small>" + esc(x.d || "") + (used[x.id] ? " · porté par " + esc(used[x.id].slice(0, 3).join(", ")) : "") + "</small></span>";
  const eqAll = items().filter(x => x.t === "equip" && ((d.items[x.id] || 0) > 0 || used[x.id]));
  return beltsSection(d) +
    "<h2>🧤 Équipement</h2>" + (eqAll.length ? '<div class="titems">' + eqAll.map(row).join("") + "</div>" : '<p class="tnote">Achète de l’équipement au Shop, puis équipe-le depuis la fiche d’une carte.</p>') +
    "<h2>⚔️ Objets de combat</h2>" + (I("combat").length ? '<div class="titems">' + I("combat").map(row).join("") + "</div>" : '<p class="tnote">Shop › Combat.</p>') +
    "<h2>✨ Objets d’éveil</h2>" + (I("eveil").length ? '<div class="titems">' + I("eveil").map(row).join("") + "</div>" : '<p class="tnote">Gagne-les en combat ou achète-les au Shop.</p>');
}
// ---------- fiche d'une carte ----------
ACT.tcgcard = el => {
  const iid = el.dataset.iid;
  if (lpUp && iid === lpIid && Date.now() - lpUp < 450) { lpUp = 0; return; }
  if (sel) { if (sel.has(iid)) sel.delete(iid); else sel.add(iid); changed("tcg"); return; }
  let armed = "";
  modal((box, close) => {
    box.classList.add("tsheet");
    const draw = () => {
      const d = me(), inst = d.cards[iid]; if (!inst) { close(); return; }
      const def = defOf(inst.c), full = Object.assign({ iid: iid }, inst), st = statsOf(full), base = statsOf(Object.assign({}, full, { tr: null, eq: null })), tr = inst.tr || [], eq = inst.eq && itemById(inst.eq);
      const nEvo = evolutionsOf(inst.c).length, dups = owned(d).filter(x => x.iid !== iid && baseOf(x.c) === baseOf(inst.c)), c = awakeCost(inst), max = LVMAX[inst.r], fav = isFav(d, iid);
      const eqs = items().filter(x => x.t === "equip" && (d.items[x.id] || 0) > 0);
      box.innerHTML = '<div class="tczoom">' + cardHTML(full) + "</div>" +
        '<p class="sub">' + esc(RNAME[inst.r]) + " · Nv " + inst.lv + " / " + max + (inst.lv < max ? " · XP " + (inst.xp || 0) + " / " + CXP(inst.lv) : " · niveau max") + " · rareté max " + def.max + (fav ? " · ⭐ favorite" : "") + "</p>" +
        '<table class="tsttab"><tr><th></th><th>Base</th><th>Entr.</th><th>Équip.</th><th>Total</th></tr>' + STATS.map((s, i) => "<tr><td>" + s + "</td><td>" + base[i] + "</td><td>" + (tr[i] ? "+" + tr[i] : "") + "</td><td>" + (eq && eq.st && eq.st[i] ? "+" + eq.st[i] : "") + "</td><td><b>" + st[i] + "</b></td></tr>").join("") + '<tr class="ttot"><td>Vie si leader</td><td colspan="4"><b>' + st.reduce((a, b) => a + b, 0) + "</b></td></tr></table>" +
        '<p class="tnote" style="margin:4px 0"><b style="color:' + ARCH[def.arch].c + '">' + esc(def.arch) + "</b> bat " + esc(ARCH[def.arch].beats) + " · 🔥 " + esc(def.fin.n) + " · niveau de finisher <b>" + finLv(inst, def) + "</b> · entraînements " + (inst.trn || 0) + " / 5</p>" +
        '<div class="tsheq"><span>🧤 Équipement : ' + (eq ? itemIc(eq) + " <b>" + esc(eq.n) + "</b> <small>" + esc(eq.d || "") + "</small>" : "<i>aucun</i>") + "</span>" + (eq ? '<button class="btn small ghost" data-a="uneq">Retirer</button>' : "") + "</div>" +
        (eqs.length ? '<div class="tfilt">' + eqs.map(x => '<button class="chip" data-eq="' + esc(x.id) + '">' + itemIc(x) + " " + esc(x.n) + " ×" + d.items[x.id] + "</button>").join("") + "</div>" : "") +
        '<div class="tshbtns">' +
        (c ? '<a class="btn small" href="#/tccg/roster/eveil" data-close>✨ Éveil → ' + c.next + "</a>" : "") +
        '<a class="btn small" href="#/tccg/roster/entrainement/' + encodeURIComponent(iid) + '" data-close>🏋️ Entraîner</a>' +
        (nEvo ? '<button class="btn small gold" data-a="evo">🌳 Évolution (' + nEvo + ")</button>" : "") +
        (dups.length ? '<button class="btn small ghost" data-a="fuse">🔗 Doublons (' + dups.length + ")</button>" : "") +
        '<button class="btn small ghost" data-a="fav">' + (fav ? "★ Retirer des favorites" : "☆ Favorite") + "</button>" +
        (fav ? "" : '<button class="btn small ghost" data-a="medal1">' + (armed === "medal1" ? "Confirmer la médaille" : "🏅 Médaille") + "</button>") +
        (fav ? "" : '<button class="btn small ghost danger" data-a="sell">' + (armed === "sell" ? "Confirmer : virer" : "💸 Virer (+" + SELL[inst.r] + " 💵)") + "</button>") +
        "</div>" +
        '<a class="btn wide ghost" href="#/catcheur/' + encodeURIComponent(def.rn || def.name) + '" data-close>Sa fiche de catcheur</a><button class="btn wide ghost" data-close>Fermer</button>';
    };
    draw();
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) { close(); return; }
      const q = e.target.closest("[data-eq]"); if (q) { const id = q.dataset.eq; commit(d => { const it = d.cards[iid]; if (!it || !(d.items[id] > 0)) return; freeEq(d, it); d.items[id]--; it.eq = id; }); toast("🧤 Équipé ✓"); return draw(); }
      const a = (e.target.closest("[data-a]") || {}).dataset; if (!a || !a.a) return;
      if (a.a === "evo") { close(); return ACT.tcgevo({ dataset: { iid: iid } }); }
      if (a.a === "fuse") { close(); return ACT.tcgfuse({ dataset: { iid: owned(me()).filter(x => baseOf(x.c) === baseOf(me().cards[iid].c)).sort((x, y) => strength(y) - strength(x))[0].iid } }); }
      if ((a.a === "medal1" || a.a === "sell") && armed !== a.a) { armed = a.a; return draw(); }
      armed = "";
      let gone = false;
      commit(d => {
        const inst = d.cards[iid]; if (!inst) return;
        if (a.a === "uneq") freeEq(d, inst);
        if (a.a === "fav") { const i = d.fav.indexOf(iid); if (i >= 0) d.fav.splice(i, 1); else d.fav.push(iid); }
        if (a.a === "medal1" && !isFav(d, iid)) { const n = baseName(inst.c); drop(d, iid); d.medals[n] = (d.medals[n] || 0) + 1; toast("🏅 Médaille de " + n); gone = true; }
        if (a.a === "sell" && !isFav(d, iid)) { d.res.money += SELL[inst.r]; drop(d, iid); toast("💸 +" + SELL[inst.r] + " 💵"); gone = true; }
      });
      if (gone) close(); else draw();
    });
  });
};
