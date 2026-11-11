// TCCCG — Roster : sous-onglets Voir les cartes, Éveil, Entraînement, Virer, Médailles et objets.
// Fusion : un doublon (même catcheur) donne beaucoup d'XP à la carte. Médaille : un doublon devient 1 « Médaille de X ».
// Éveil (passage de rareté) : Momentum / Pop / Push + objets d'éveil (+ médailles d'un partenaire pour UR → LR), jusqu'à la rareté max.
import { S, ACT, changed } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { RAR, LVMAX, AWAKE, items, itemById, defOf, statsOf, hpOf, RNAME, ARCH, STATS, MEDAL, cardById, evolutionsOf } from "./data.js";
import { me, commit, owned, cardXp, CXP } from "./store.js";
import { cardHTML } from "./card.js";
import { beltsSection, BELT } from "./evo.js";

const SELL = { N: 50, R: 120, SR: 300, SSR: 800, UR: 2000, LR: 5000 };
const TRAIN = 150; // argent par entraînement (+1 niveau environ)
let sub = "", rf = "", rs = "rar";
const baseOf = id => (id || "").split(/[@#~]/)[0];
const baseName = c => { const b = cardById(baseOf(c)); return b ? b.name : (defOf(c) || {}).name || ""; };
// sélection multiple (appui long sur une carte) pour virer plusieurs cartes d'un coup
let sel = null, lpT = 0, lpUp = 0, lpOn = false, lpIid = "";
export const selecting = () => !!sel;
// petite fenêtre de confirmation
export function askConfirm(title, text, yes, fn) {
  modal((box, close) => {
    box.innerHTML = "<h3>" + esc(title) + '</h3><p class="sub">' + text + '</p><button class="btn wide" data-y>' + esc(yes) + '</button><button class="btn wide ghost" style="margin-top:6px" data-close>Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) return close(); if (e.target.closest("[data-y]")) { close(); fn(); } });
  });
}
export const resBar = d => '<div class="tres"><span title="Argent">💵 ' + d.res.money + '</span><span title="Momentum">⚡ ' + d.res.mom + '</span><span title="Pop">⭐ ' + d.res.pop + '</span><span title="Push">📣 ' + d.res.push + '</span><span title="Gimmicks">🎟️ ' + d.res.gim + "</span></div>";

export function rosterView(tab) {
  const nsub = tab || ""; if (nsub !== sub) sel = null; sub = nsub;
  const d = me(), L = owned(d);
  if (sel) [...sel].forEach(i => { if (!d.cards[i]) sel.delete(i); });
  let h = '<section class="tccghead"><h1>Roster</h1></section>' + resBar(d) +
    '<nav class="tsub">' + [["", "Voir les cartes"], ["eveil", "Éveil"], ["entrainement", "Entraînement"], ["virer", "Virer"], ["objets", "Médailles et objets"]].map(x => '<a class="' + (sub === x[0] ? "on" : "") + '" href="#/tccg/roster' + (x[0] ? "/" + x[0] : "") + '">' + x[1] + "</a>").join("") + "</nav>";
  if (sub === "objets") return h + objetsView(d);
  if (!L.length) return h + '<p class="tnote">Pas encore de carte. Ouvre ton booster gratuit du jour dans Call Up !</p><a class="btn" style="margin:8px 16px" href="#/tccg/callup">Aller au Call Up</a>';
  let V = L.filter(x => !rf || x.r === rf);
  V.sort((a, b) => rs === "lv" ? b.lv - a.lv : rs === "nom" ? defOf(a.c).name.localeCompare(defOf(b.c).name) : rs === "pv" ? hpOf(statsOf(b)) - hpOf(statsOf(a)) : RAR.indexOf(b.r) - RAR.indexOf(a.r) || b.lv - a.lv);
  const dupC = {}; L.forEach(x => { dupC[baseOf(x.c)] = (dupC[baseOf(x.c)] || 0) + 1; });
  h += '<p class="tnote">' + L.length + " carte" + (L.length > 1 ? "s" : "") + " · " + Object.keys(dupC).length + " catcheurs différents" + (sub === "eveil" ? " · touche une carte pour l’éveiller" : sub === "entrainement" ? " · " + TRAIN + " 💵 par entraînement" : sub === "virer" ? " · touche une carte pour la virer (contre de l’argent)" : "") + "</p>" +
    '<div class="tfilt">' + ['<button class="chip' + (!rf ? " on" : "") + '" data-act="tcgrf" data-r="">Toutes</button>'].concat(RAR.map(r => '<button class="chip tcr r-' + r + (rf === r ? " on" : "") + '" data-act="tcgrf" data-r="' + r + '">' + r + " " + L.filter(x => x.r === r).length + "</button>")).join("") + "</div>" +
    '<div class="tfilt">' + [["rar", "Rareté"], ["lv", "Niveau"], ["pv", "PV"], ["nom", "Nom"]].map(x => '<button class="chip' + (rs === x[0] ? " on" : "") + '" data-act="tcgrs" data-s="' + x[0] + '">' + x[1] + "</button>").join("") + "</div>";
  if (sel) { const gain = [...sel].reduce((a, i) => a + (SELL[(d.cards[i] || {}).r] || 0), 0);
    h += '<div class="tselbar"><b>' + sel.size + " carte" + (sel.size > 1 ? "s" : "") + '</b><button class="btn small ghost" data-act="tcgselall">Tout</button><button class="btn small danger" data-act="tcgselfire"' + (sel.size ? "" : " disabled") + ">💸 Virer · +" + gain + ' 💵</button><button class="btn small ghost" data-act="tcgselx">✕</button></div>'; }
  else h += '<p class="tnote thint">Astuce : appui long sur une carte pour en sélectionner plusieurs (et les virer d’un coup).</p>';
  h += '<div class="trgrid tlong' + (sel ? " tselmode" : "") + '">' + V.map(x => cardHTML(x, { small: true, act: "tcgcard", iid: x.iid, count: 0, cls: sel && sel.has(x.iid) ? "pick" : "" })).join("") + "</div>";
  return h;
}
ACT.tcgselx = () => { sel = null; changed("tcg"); };
ACT.tcgselall = () => { const d = me(); const V = owned(d).filter(x => !rf || x.r === rf); if (sel && sel.size === V.length) sel.clear(); else sel = new Set(V.map(x => x.iid)); changed("tcg"); };
ACT.tcgselfire = () => {
  if (!sel || !sel.size) return; const d = me(), L = [...sel].filter(i => d.cards[i]), gain = L.reduce((a, i) => a + (SELL[d.cards[i].r] || 0), 0), fav = L.filter(i => d.fav.indexOf(i) >= 0).length;
  const top = L.filter(i => RAR.indexOf(d.cards[i].r) >= RAR.indexOf("SSR")).length;
  askConfirm("Virer " + L.length + " carte" + (L.length > 1 ? "s" : "") + " ?", "Tu gagnes <b>+" + gain + " 💵</b>. Les cartes virées disparaissent pour de bon." + (fav ? "<br>⚠️ Dont " + fav + " favorite" + (fav > 1 ? "s" : "") + "." : "") + (top ? "<br>⚠️ Dont " + top + " SSR ou plus." : ""), "💸 Virer les " + L.length + " cartes",
    () => { commit(dd => { L.forEach(i => { const it = dd.cards[i]; if (!it) return; dd.res.money += SELL[it.r] || 0; delete dd.cards[i]; }); dd.fav = dd.fav.filter(x => L.indexOf(x) < 0); }); toast("💸 " + L.length + " cartes virées : +" + gain + " 💵"); sel = null; changed("tcg"); });
};
// appui long (≈ 0,5 s) sur une carte du roster : passe en sélection multiple
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
ACT.tcgrf = el => { rf = el.dataset.r || ""; changed("tcg"); };
ACT.tcgrs = el => { rs = el.dataset.s || "rar"; changed("tcg"); };

function objetsView(d) {
  return beltsSection(d) + objetsRest(d);
}
function objetsRest(d) {
  const M = Object.keys(d.medals).filter(k => d.medals[k] > 0), I = items().filter(x => (d.items[x.id] || 0) > 0);
  return "<h2>Médailles</h2>" + (M.length ? '<div class="titems">' + M.map(n => '<span class="titem">🏅 <b>Médaille de ' + esc(n) + "</b> ×" + d.medals[n] + "</span>").join("") + "</div>" : '<p class="tnote">Transforme tes doublons en médailles depuis la fiche d’une carte.</p>') +
    "<h2>Objets</h2>" + (I.length ? '<div class="titems">' + I.map(x => '<span class="titem" title="' + esc(x.d || "") + '">' + esc(x.ic || "🎁") + " <b>" + esc(x.n) + "</b> ×" + d.items[x.id] + "<small>" + (x.t === "combat" ? "combat" : "éveil " + x.g) + "</small></span>").join("") + "</div>" : '<p class="tnote">Gagne des objets en combat ou achète-les au Shop.</p>');
}
// coût d'éveil d'une carte
export function awakeCost(inst) {
  const def = defOf(inst.c), r = inst.r, cost = AWAKE[r]; if (!cost) return null;
  const next = RAR[RAR.indexOf(r) + 1]; if (!next || RAR.indexOf(next) > RAR.indexOf(def.max)) return null;
  const its = {}; Object.keys(cost.items).forEach(g => { const it = items().find(x => x.t === "eveil" && x.g === g); if (it) its[it.id] = cost.items[g]; });
  return { next: next, mpp: cost.mpp, items: its, medals: cost.medals ? { n: def.medalOf, q: cost.medals } : null };
}
const costTxt = (d, c) => "⚡⭐📣 " + c.mpp + " chacun" + Object.keys(c.items).map(id => { const it = itemById(id); return " · " + (it ? it.ic + " " + it.n : id) + " ×" + c.items[id] + " (" + (d.items[id] || 0) + ")"; }).join("") + (c.medals ? " · 🏅 Médaille de " + c.medals.n + " ×" + c.medals.q + " (" + (d.medals[c.medals.n] || 0) + ")" : "");
const canAwake = (d, c) => c && d.res.mom >= c.mpp && d.res.pop >= c.mpp && d.res.push >= c.mpp && Object.keys(c.items).every(id => (d.items[id] || 0) >= c.items[id]) && (!c.medals || (d.medals[c.medals.n] || 0) >= c.medals.q);

ACT.tcgcard = el => {
  const iid = el.dataset.iid;
  if (lpUp && iid === lpIid && Date.now() - lpUp < 450) { lpUp = 0; return; }
  if (sel) { if (sel.has(iid)) sel.delete(iid); else sel.add(iid); changed("tcg"); return; }
  let armed = "";
  modal((box, close) => {
    const draw = () => {
      const d = me(), inst = d.cards[iid]; if (!inst) { close(); return; }
      const def = defOf(inst.c), full = Object.assign({ iid: iid }, inst), st = statsOf(full), nEvo = evolutionsOf(inst.c).length, mName = baseName(inst.c), dups = owned(d).filter(x => x.iid !== iid && baseOf(x.c) === baseOf(inst.c)), c = awakeCost(inst), max = LVMAX[inst.r];
      box.innerHTML = '<div class="tczoom">' + cardHTML(full) + "</div>" +
        '<p class="sub">' + esc(RNAME[inst.r]) + " · Nv " + inst.lv + " / " + max + (inst.lv < max ? " · XP " + (inst.xp || 0) + " / " + CXP(inst.lv) : " · niveau max") + " · rareté max " + def.max + "</p>" +
        '<p class="tnote" style="margin:0 0 8px">' + esc(def.arch) + " bat " + esc(ARCH[def.arch].beats) + " · Finisher : " + esc(def.fin.n) + " (" + esc(def.fin.e) + ")" + (def.medalOf && def.medalOf !== def.name ? " · éveil LR : médailles de " + esc(def.medalOf) : "") + "</p>" +
        (c ? '<button class="btn wide" data-a="awake"' + (canAwake(d, c) ? "" : " disabled") + ">✨ Éveil → " + c.next + "</button><small class=\"tcost\">" + esc(costTxt(d, c)) + "</small>" : '<p class="tnote">Rareté maximale atteinte.</p>') +
        (inst.lv < max ? '<button class="btn wide ghost" data-a="train"' + (d.res.money >= TRAIN ? "" : " disabled") + ">🏋️ Entraînement (" + TRAIN + " 💵)</button>" : "") +
        (nEvo ? '<button class="btn wide gold" data-a="evo">🏆 Évolution par ceinture (' + nEvo + ")</button>" : "") +
        (dups.length ? '<button class="btn wide ghost" data-a="fuse">🔗 Fusionner un doublon (+' + (CXP(inst.lv) * 2) + ' XP)</button><button class="btn wide ghost" data-a="medal">🏅 Transformer un doublon en médaille</button>' :
          '<button class="btn wide ghost" data-a="medal1">' + (armed === "medal1" ? "Confirmer : cette carte devient 1 Médaille de " + esc(mName) : "🏅 Transformer cette carte en médaille") + "</button>") +
        '<button class="btn wide ghost" data-a="fav">' + (d.fav.indexOf(iid) >= 0 ? "★ Retirer des favorites" : "☆ Carte favorite (accueil)") + "</button>" +
        '<button class="btn wide ghost danger" data-a="sell">💸 Virer (+' + SELL[inst.r] + " 💵)</button>" +
        '<a class="btn wide ghost" href="#/catcheur/' + encodeURIComponent(def.name) + '" data-close>Sa fiche</a><button class="btn wide ghost" data-close>Fermer</button>';
    };
    draw();
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) { close(); return; }
      const a = (e.target.closest("[data-a]") || {}).dataset; if (!a || !a.a) return;
      if (a.a === "evo") { close(); return ACT.tcgevo({ dataset: { iid: iid } }); }
      if (a.a === "medal1" && armed !== "medal1") { armed = "medal1"; return draw(); }
      armed = "";
      commit(d => {
        const inst = d.cards[iid]; if (!inst) return;
        const dups = owned(d).filter(x => x.iid !== iid && baseOf(x.c) === baseOf(inst.c)).sort((x, y) => x.lv - y.lv);
        if (a.a === "awake") { const c = awakeCost(inst); if (!canAwake(d, c)) return; d.res.mom -= c.mpp; d.res.pop -= c.mpp; d.res.push -= c.mpp; Object.keys(c.items).forEach(id => { d.items[id] -= c.items[id]; }); if (c.medals) d.medals[c.medals.n] -= c.medals.q; inst.r = c.next; toast("✨ Éveil réussi : " + c.next + " !"); }
        if (a.a === "train" && d.res.money >= TRAIN) { d.res.money -= TRAIN; const up = cardXp(inst, CXP(inst.lv)); toast("🏋️ +" + up + " niveau"); }
        if (a.a === "fuse" && dups[0]) { delete d.cards[dups[0].iid]; d.fav = d.fav.filter(x => x !== dups[0].iid); const up = cardXp(inst, CXP(inst.lv) * 2); toast("🔗 Fusion : +" + up + " niveau" + (up > 1 ? "x" : "")); }
        if (a.a === "medal" && dups[0]) { const n = baseName(inst.c); delete d.cards[dups[0].iid]; d.fav = d.fav.filter(x => x !== dups[0].iid); d.medals[n] = (d.medals[n] || 0) + 1; toast("🏅 Médaille de " + n); }
        if (a.a === "medal1") { const n = baseName(inst.c); delete d.cards[iid]; d.fav = d.fav.filter(x => x !== iid); d.medals[n] = (d.medals[n] || 0) + 1; toast("🏅 Médaille de " + n); }
        if (a.a === "fav") { const i = d.fav.indexOf(iid); if (i >= 0) d.fav.splice(i, 1); else d.fav.push(iid); }
        if (a.a === "sell") { d.res.money += SELL[inst.r]; delete d.cards[iid]; d.fav = d.fav.filter(x => x !== iid); toast("💸 +" + SELL[inst.r] + " 💵"); }
      });
      if (a.a === "sell" || a.a === "medal1") close(); else draw();
    });
  });
};
