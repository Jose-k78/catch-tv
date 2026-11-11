// TCCCG — Call Up : un booster par show passé (les 7 derniers jours, PLE compris), boosters de départ par promotion (payés en
// Momentum / Pop / Push), booster gratuit du jour (N et R seulement), boosters du modo, booster « agents libres » (modo).
// 5 gimmicks = booster 5 cartes ; 50 gimmicks = Mega booster 15 cartes. Cartes « version show » 2 jours après les résultats.
// Animation (cahier) : 3… 2… 1…, le booster descend la rampe d'entrée, lueurs dans le public selon le tirage, déchirure, slide.
import { S, ACT, changed } from "../state.js";
import { esc, toast, fmt, modal } from "../util.js";
import { parisDay } from "../time.js";
import { realKey, RAR, LVMAX, rates, baseCards, showPeople, showKeyLabel, cfg, defOf, titleOf, champsNow, promoLogo, cardById } from "./data.js";
import { freeLeft, freeNextMs, useFree, me, commit, addCard } from "./store.js";
import { cardHTML } from "./card.js";
import { showLogo, eventLogo } from "../assets.js";
import { saveCfg } from "./modo.js";
import { norm } from "../wrestlers.js";

const DAY = 864e5;
const keyDate = key => key.split("|")[2] || "";
// shows passés des 7 derniers jours qui ont des résultats
export function recentShows(days) {
  const td = parisDay(), from = new Date(Date.parse(td) - (days || 7) * DAY).toISOString().slice(0, 10);
  return Object.keys(S.highlights || {}).filter(k => { const d = keyDate(k); return d && d <= td && d >= from && (S.highlights[k].res || []).length && S.P[k.split("|")[0]]; })
    .sort((a, b) => keyDate(b).localeCompare(keyDate(a)));
}
const showLogoOf = key => { const p = key.split("|"); if (p[1] === "PLE") { const e = ((S.P[p[0]] || {}).e || []).find(x => x.d === p[2]); return (e && eventLogo(Object.assign({ k: p[0] }, e))) || showLogo(p[0], ""); } return showLogo(p[0], p[1]) || showLogo(p[0], ""); };
const colorsOf = k => (S.P[k] && S.P[k].c) || ["#3b321f", "#0a0907"];
const inRoster = () => { const s = new Set(); Object.keys(S.rosters || {}).forEach(k => Object.keys(S.rosters[k] || {}).forEach(g => (S.rosters[k][g] || []).forEach(n => s.add(norm(n))))); return s; };

export function boosters() {
  const out = [], C = cfg(), td = parisDay();
  out.push({ id: "free", t: "Booster gratuit", sub: "N, R et SR · 3 toutes les 5 heures", n: 5, price: { free: 1 }, only: ["N", "R", "SR"], cat: "Cadeau" });
  out.push({ id: "mitb", t: "Booster Agent Libre", sub: "💼 Mallette Money In The Bank : la carte SSR de ton choix", n: 1, price: { mitb: 1 }, c: ["#0d4a2a", "#c9971f"], cat: "Cadeau" });
  recentShows(7).forEach(key => {
    const p = key.split("|"), ver = Date.parse(td) - Date.parse(keyDate(key)) >= 2 * DAY;
    out.push({ id: "s:" + key, key: key, t: showKeyLabel(key), sub: p[0] + " · " + fmt(p[2]) + (ver ? " · cartes du show !" : " · cartes du show dans " + Math.ceil((2 * DAY - (Date.parse(td) - Date.parse(keyDate(key)))) / DAY) + " j"), n: 3, price: { gim: 5 }, logo: showLogoOf(key), c: colorsOf(p[0]), cat: p[1] === "PLE" ? "PLE et PPV" : "Shows de la semaine", ver: ver });
  });
  ["WWE", "AEW", "NJPW"].concat(Object.keys(S.P || {}).filter(k => ["WWE", "AEW", "NJPW"].indexOf(k) < 0)).filter(k => S.P[k]).forEach(k => out.push({ id: "p:" + k, k: k, t: k + " Pack", sub: "Booster de départ · 5 cartes", n: 3, price: { mom: 60, pop: 60, push: 60 }, logo: showLogo(k, ""), c: colorsOf(k), cat: "Boosters de départ" }));
  (C.boosters || []).filter(b => b && b.id && !b.del && (b.on !== false || S.isAdmin)).forEach(b => out.push(Object.assign({ cat: "Boosters spéciaux", price: { gim: +b.gim || 5 }, n: +b.n || 3 }, b, { id: "c:" + b.id, t: b.t || b.n || "Booster" })));
  if (S.isAdmin) out.push({ id: "fa", t: "Hors rosters (modo)", sub: "Visible par le modo · catcheurs hors des rosters", n: 3, price: { gim: 0 }, cat: "Modo" });
  return out;
}
// catcheurs d'un booster (automatique), puis les changements du modo (cfg.bx[id] : add, del, feat, nofeat)
const bxOf = b => ((cfg().bx || {})[b.id]) || {};
const inPromo = k => { const ro = S.rosters && S.rosters[k], s = new Set(); if (ro) Object.keys(ro).forEach(g => (ro[g] || []).forEach(n => s.add(norm(n)))); return c => c.k === k || s.has(realKey(c)); };
function autoPool(b) {
  const P = baseCards();
  if (b.id === "free") return P;
  if (b.id === "mitb") return P.filter(c => c.r === "SSR" && !c.custom);
  // booster d'un show : les catcheurs de sa promotion, ceux du show en vedette
  if (b.key) { const pp = showPeople(b.key).map(x => x.c), ids = new Set(pp.map(c => c.id)), f = inPromo(b.key.split("|")[0]); return pp.concat(P.filter(c => !ids.has(c.id) && f(c))); }
  if (b.k && b.id.indexOf("p:") === 0) { const L = P.filter(inPromo(b.k)); return L.length >= 10 ? L : P; }
  if (b.id === "fa") { const r = inRoster(); return P.filter(c => !r.has(realKey(c)) && (!c.boosters || !c.boosters.length)); }
  if (b.id.indexOf("c:") === 0) {
    if (Array.isArray(b.cards) && b.cards.length) { const want = b.cards.map(norm); return P.filter(c => want.indexOf(realKey(c)) >= 0 || want.indexOf(norm(c.name)) >= 0 || want.indexOf(norm(c.id)) >= 0); }
    return P.filter(c => (!b.k || c.k === b.k) && (!c.boosters || !c.boosters.length || c.boosters.indexOf(b.id.slice(2)) >= 0));
  }
  return P;
}
export function poolOf(b) {
  const x = bxOf(b), del = new Set(x.del || []), seen = new Set();
  const L = autoPool(b).filter(c => !del.has(c.id) && (!c.boosters || !c.boosters.length || b.id === "free" || b.key || (b.id.indexOf("c:") === 0 && c.boosters.indexOf(b.id.slice(2)) >= 0)));
  (x.add || []).forEach(id => { const c = cardById(id); if (c && !del.has(id)) L.push(c); });
  return L.filter(c => !seen.has(c.id) && seen.add(c.id));
}
// cartes vedettes : catcheurs du show (booster d'un show), champions (booster d'une promotion), + choix du modo
export function featOf(b) {
  const x = bxOf(b), no = new Set(x.nofeat || []), out = new Set();
  if (b.key) showPeople(b.key).forEach(p => out.add(p.c.id));
  else if (b.k && b.id.indexOf("p:") === 0) { const ch = champsNow(); poolOf(b).forEach(c => { if (ch.has(realKey(c))) out.add(c.id); }); }
  (x.feat || []).forEach(id => out.add(id));
  no.forEach(id => out.delete(id));
  return out;
}
const featX = () => +((cfg().featx)) || 3;
function drawR(only, minR) {
  const R = rates(), keys = (only || RAR).filter(r => !minR || RAR.indexOf(r) >= RAR.indexOf(minR)), tot = keys.reduce((a, r) => a + (+R[r] || 0), 0);
  let x = Math.random() * tot; for (const r of keys) { x -= +R[r] || 0; if (x < 0) return r; } return keys[0];
}
const pickW = (L, F) => { const fx = featX(), w = L.map(c => (F.has(c.id) ? fx : 1)), t = w.reduce((a, b) => a + b, 0); let x = Math.random() * t; for (let i = 0; i < L.length; i++) { x -= w[i]; if (x < 0) return L[i]; } return L[L.length - 1]; };
export function pull(b, n) {
  const L = poolOf(b), F = featOf(b);
  const out = [], champ = champsNow();
  for (let i = 0; i < n; i++) {
    const want = drawR(b.only, i === n - 1 && !b.only ? "R" : "");
    let cand = L.filter(c => c.r === want), j = RAR.indexOf(want);
    while (!cand.length && j > 0) { j--; cand = L.filter(c => c.r === RAR[j]); }
    if (!cand.length) cand = L.length ? L : baseCards();
    const c = pickW(cand, F);
    let id = c.id;
    if (b.key && b.ver && F.has(c.id) && Math.random() < 0.4) id = c.id + "@" + b.key; // carte « version show »
    else if (champ.has(realKey(c)) && Math.random() < 0.04) id = c.id + "#champ"; // carte champion (boost permanent)
    out.push(id);
  }
  return out;
}
const priceTxt = p => p.mitb ? "💼 1 mallette" : p.free ? "🎁 Gratuit" : p.gim != null && !p.mom ? (p.gim ? "🎟️ " + p.gim + " gimmicks" : "Gratuit (modo)") : "⚡" + p.mom + " ⭐" + p.pop + " 📣" + p.push;
function canPay(d, p, mega) {
  if (p.free) return freeLeft(d) > 0;
  if (p.mitb) return (d.items.mitb || 0) > 0;
  if (mega) return d.res.gim >= 50;
  return ["gim", "mom", "pop", "push"].every(k => !p[k] || d.res[k] >= p[k]);
}
export function callUpView() {
  const d = me(), B = boosters(), cats = {};
  B.forEach(b => { (cats[b.cat] = cats[b.cat] || []).push(b); });
  let h = '<section class="tccghead"><h1>Call Up</h1></section><p class="tnote">5 gimmicks = booster de 5 cartes · 50 gimmicks = Mega booster de 15 cartes. Les cartes « version show » arrivent 2 jours après les résultats.</p>' +
    '<details class="trates"><summary>Taux d’apparition</summary><p>' + RAR.map(r => '<span class="tcr r-' + r + '">' + r + "</span> " + rates()[r] + " %").join(" · ") + "</p></details>";
  h += vitrine();
  ["Cadeau", "PLE et PPV", "Shows de la semaine", "Boosters de départ", "Boosters spéciaux", "Modo"].forEach(cat => {
    if (!cats[cat]) return;
    h += "<h2>" + cat + '</h2><div class="row tbrow">' + cats[cat].map(b => {
      const c = b.c || ["#3b321f", "#0a0907"], ok = canPay(d, b.price);
      return '<div class="tbwrap"><button class="tbooster' + (ok ? "" : " off") + '" data-act="tcgopen" data-id="' + esc(b.id) + '" style="background:' + (b.img ? "url('" + esc(b.img) + "') center/cover," : "") + "linear-gradient(160deg," + c[0] + "," + (c[1] || "#0a0907") + ')">' +
        (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : b.id === "free" ? '<span class="tbgift">🎁</span>' : "") + "<b>" + esc(b.t) + "</b><small>" + esc(b.sub || "") + '</small><span class="tbprice">' + (b.id === "free" ? (ok ? "🎁 Gratuit · reste " + freeLeft(d) : "Dans " + Math.ceil(freeNextMs() / 36e5 * 10) / 10 + " h") : b.id === "mitb" ? "💼 × " + (d.items.mitb || 0) : priceTxt(b.price)) + "</span></button>" +
        '<button class="tbinfo" data-act="tcgbinfo" data-id="' + esc(b.id) + '">👁️ Cartes' + (featOf(b).size ? " · ⭐ vedettes" : "") + "</button>" +
        (b.price.gim && b.key ? '<button class="tbmega" data-act="tcgopen" data-id="' + esc(b.id) + '" data-mega="1">Mega ×15 · 🎟️ 50</button>' : "") + "</div>";
    }).join("") + "</div>";
  });
  return h;
}
// Call Up : on confirme avant d'invoquer (coût, nombre de cartes)
ACT.tcgopen = el => {
  const b = boosters().find(x => x.id === el.dataset.id); if (!b) return;
  const mega = el.dataset.mega === "1", d0 = me();
  if (b.id === "mitb") return mitbPick();
  if (!canPay(d0, b.price, mega)) { toast(b.price.free ? "Tes 3 boosters gratuits reviennent dans " + Math.ceil(freeNextMs() / 6e4) + " min" : "Pas assez de ressources : gagne-en dans les combats"); return; }
  const c = b.c || ["#3b321f", "#0a0907"];
  modal((box, close) => {
    box.innerHTML = '<h3>Invoquer ' + (mega ? "un Mega booster" : "ce booster") + ' ?</h3><div class="tcfm"><div class="tbooster" style="background:linear-gradient(160deg,' + esc(c[0]) + "," + esc(c[1] || "#0a0907") + ')">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : "") + "<b>" + esc(b.t) + "</b></div>" +
      "<ul><li>" + (mega ? 15 : 5) + " cartes</li><li>Coût : " + esc(mega ? "🎟️ 50 gimmicks" : b.price.free ? "🎁 Gratuit (il t’en reste " + freeLeft(d0) + ")" : priceTxt(b.price)) + "</li>" + (featOf(b).size ? "<li>⭐ Cartes vedettes plus fréquentes</li>" : "") + "</ul></div>" +
      '<button class="btn wide" data-y>✨ Invoquer</button><button class="btn wide ghost" style="margin-top:6px" data-close>Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) return close(); if (e.target.closest("[data-y]")) { close(); openNow(b, mega); } });
  });
};
function openNow(b, mega) {
  if (!canPay(me(), b.price, mega)) { toast("Pas assez de ressources"); return; }
  const ids = pull(b, mega ? 15 : 5); // tous les boosters donnent 5 cartes, sans exception (demande de Jose)
  commit(d => {
    if (b.price.free) useFree(d, parisDay());
    else if (mega) d.res.gim -= 50;
    else ["gim", "mom", "pop", "push"].forEach(k => { if (b.price[k]) d.res[k] -= b.price[k]; });
    ids.forEach(id => addCard(d, id)); d.opened++;
  });
  summon(b, ids);
}
// Booster Agent Libre : la mallette Money In The Bank donne la carte SSR de son choix (une fois par mallette)
function mitbPick() {
  if (!(me().items.mitb > 0)) { toast("Il te faut une mallette Money In The Bank 💼"); return; }
  let q = "", pick = "";
  modal((box, close) => {
    box.classList.add("tbibox");
    const list = () => baseCards().filter(c => c.r === "SSR" && !c.custom && (!q || norm(c.name).indexOf(norm(q)) >= 0)).slice(0, 60).map(c => '<div class="tpk' + (pick === c.id ? " on" : "") + '" data-p="' + esc(c.id) + '">' + cardHTML(c, { small: true }) + "</div>").join("") || '<p class="tnote">Aucune carte SSR à ce nom.</p>';
    box.innerHTML = '<h3>💼 Booster Agent Libre</h3><p class="sub">Ta mallette Money In The Bank : choisis la carte SSR que tu veux. Ce choix est définitif.</p><div class="search"><input id="mq" type="search" placeholder="Chercher un catcheur"></div><div class="trgrid tpick" id="mgrid">' + list() + '</div><button class="btn wide" data-go disabled>Encaisser la mallette</button><button class="btn wide ghost" style="margin-top:6px" data-close>Plus tard</button>';
    box.addEventListener("input", e => { if (e.target.id === "mq") { q = e.target.value; box.querySelector("#mgrid").innerHTML = list(); } });
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const p = e.target.closest("[data-p]"); if (p) { pick = p.dataset.p; box.querySelectorAll(".tpk").forEach(x => x.classList.toggle("on", x.dataset.p === pick)); box.querySelector("[data-go]").disabled = false; return; }
      if (e.target.closest("[data-go]") && pick) { const id = pick, b = boosters().find(x => x.id === "mitb"); close();
        if (!(me().items.mitb > 0)) return;
        commit(d => { if (!(d.items.mitb > 0)) return; d.items.mitb--; addCard(d, id); d.opened++; });
        summon(b, [id]); }
    });
  });
}
// vitrine : des exemples de cartes au maximum (rareté max, niveau max) pour donner envie
function vitrine() {
  const P = baseCards().filter(c => c.pic && (c.max === "LR" || c.max === "UR")).sort((a, b) => RAR.indexOf(b.max) - RAR.indexOf(a.max) || b.score - a.score), day = Math.floor(Date.now() / 864e5);
  if (!P.length) return "";
  const pick = [0, 1, 2, 3].map(i => P[(day * 7 + i * 13) % Math.min(P.length, 40)]).filter((c, i, a) => a.indexOf(c) === i);
  return '<h2>✨ Vitrine <small class="tsmall">jusqu’où tes cartes peuvent aller</small></h2><div class="tfavs tvit">' + pick.map(c => cardHTML({ c: c.id, r: c.max, lv: LVMAX[c.max] }, { small: true })).join("") + "</div>";
}
// contenu d'un booster : vitrine, vedettes, toutes les cartes possibles ; le modo ajoute, retire, met en vedette, modifie, duplique
ACT.tcgbinfo = el => {
  const b = boosters().find(x => x.id === el.dataset.id); if (!b) return;
  let q = "";
  modal((box, close) => {
    box.classList.add("tbibox");
    const draw = () => {
      const L = poolOf(b), F = featOf(b), R = rates(), ed = S.isAdmin, keys = (b.only || RAR);
      const tile = c => '<div class="tbtile">' + cardHTML(c, { small: true }) + (ed ? '<div class="tbed"><button data-f="' + esc(c.id) + '" title="Vedette">' + (F.has(c.id) ? "⭐" : "☆") + '</button><button data-e="' + esc(c.id) + '" title="Modifier">✏️</button><button data-dup="' + esc(c.id) + '" title="Dupliquer">⧉</button><button data-x="' + esc(c.id) + '" title="Retirer du booster">✕</button></div>' : "") + "</div>";
      const best = L.slice().sort((a, b2) => RAR.indexOf(b2.max) - RAR.indexOf(a.max) || b2.score - a.score).slice(0, 3);
      let h = "<h3>" + esc(b.t) + '</h3><p class="sub">' + L.length + " cartes possibles · " + keys.map(r => r + " " + R[r] + " %").join(" · ") + (F.size ? " · vedettes ×" + featX() : "") + "</p>";
      if (best.length) h += '<h4>Vitrine</h4><div class="tfavs">' + best.map(c => cardHTML({ c: c.id, r: c.max, lv: LVMAX[c.max] }, { small: true })).join("") + "</div>";
      const FL = L.filter(c => F.has(c.id));
      if (FL.length) h += '<h4>⭐ Cartes vedettes <small>(plus de chances de tomber)</small></h4><div class="trgrid">' + FL.map(tile).join("") + "</div>";
      keys.slice().reverse().forEach(r => { const X = L.filter(c => c.r === r && !F.has(c.id)); if (X.length) h += '<h4><span class="tcr r-' + r + '">' + r + "</span> " + X.length + "</h4>" + '<div class="trgrid">' + X.slice(0, ed ? 400 : 120).map(tile).join("") + (X.length > 120 && !ed ? '<p class="tnote">… et ' + (X.length - 120) + " autres</p>" : "") + "</div>"; });
      if (ed) {
        const del = bxOf(b).del || [];
        h += '<h4>＋ Ajouter une carte</h4><div class="search"><input id="tbq" type="search" placeholder="Nom du catcheur" value="' + esc(q) + '"></div><div class="trgrid" id="tbadd">' + addList() + "</div>";
        if (del.length) h += "<h4>Retirées</h4><div class=\"tfilt\">" + del.map(id => { const c = cardById(id); return c ? '<button class="chip" data-un="' + esc(id) + '">↩ ' + esc(c.name) + "</button>" : ""; }).join("") + "</div>";
      }
      box.innerHTML = h + '<button class="btn wide ghost" style="margin-top:10px" data-close>Fermer</button>';
    };
    const addList = () => { if (!q) return ""; const have = new Set(poolOf(b).map(c => c.id)); return baseCards().filter(c => !have.has(c.id) && norm(c.name).indexOf(norm(q)) >= 0).slice(0, 12).map(c => '<div class="tbtile">' + cardHTML(c, { small: true }) + '<div class="tbed"><button data-add="' + esc(c.id) + '">＋ Ajouter</button></div></div>').join(""); };
    const mod = (fn, msg) => saveCfg(d => { d.bx = d.bx || {}; const x = d.bx[b.id] = d.bx[b.id] || {}; fn(x, d); }, msg).then(ok => { if (ok) { toast("Enregistré ✓"); draw(); } }).catch(e => toast("Pas enregistré : " + (e && e.message || ""), { ms: 4000 }));
    const tog = (arr, id, on) => { const s2 = new Set(arr || []); if (on) s2.add(id); else s2.delete(id); return Array.from(s2); };
    draw();
    box.addEventListener("input", e => { if (e.target.id === "tbq") { q = e.target.value; const g = box.querySelector("#tbadd"); if (g) g.innerHTML = addList(); } });
    box.addEventListener("click", e => {
      const t = e.target.closest("button,[data-close]"); if (!t) return;
      if (t.hasAttribute("data-close")) return close();
      const ds = t.dataset;
      if (ds.f) { const on = !featOf(b).has(ds.f); return mod(x => { x.feat = tog(x.feat, ds.f, on); x.nofeat = tog(x.nofeat, ds.f, !on); }, (on ? "vedette : " : "plus vedette : ") + ds.f); }
      if (ds.x) return mod(x => { x.del = tog(x.del, ds.x, true); x.add = tog(x.add, ds.x, false); }, "carte retirée du booster " + b.t);
      if (ds.un) return mod(x => { x.del = tog(x.del, ds.un, false); }, "carte remise dans le booster " + b.t);
      if (ds.add) return mod(x => { x.add = tog(x.add, ds.add, true); x.del = tog(x.del, ds.add, false); }, "carte ajoutée au booster " + b.t);
      if (ds.e) { close(); return ACT.tcgmedit({ dataset: { c: ds.e } }); }
      if (ds.dup) { const c = cardById(ds.dup); if (!c) return; const nid = "oc-" + c.id.slice(0, 30) + "-" + Date.now().toString(36).slice(-4);
        return mod((x, d) => { d.custom = d.custom || []; d.custom.push({ id: nid, name: c.name, img: c.pic || "", k: c.k, arch: c.arch, al: c.al, r: c.r, max: c.max, st: c.st.slice(), fin: Object.assign({}, c.fin), gimmick: (c.gimmick ? c.gimmick + " · " : "") + "copie" }); x.add = tog(x.add, nid, true); }, "carte dupliquée : " + c.name); }
    });
  });
};
// ---------- animation d'invocation ----------
// la scène : écran géant, entrée, rampe éclairée, ring de catch (dessinés par l'app)
const scene = (b, c) => '<svg class="tsscene" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>' +
  '<linearGradient id="tsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7e08a"/><stop offset="1" stop-color="#8a6412"/></linearGradient>' +
  '<linearGradient id="tsscr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + esc(c[0]) + '"/><stop offset="1" stop-color="' + esc(c[1] || "#0a0907") + '"/></linearGradient>' +
  '<linearGradient id="tsrp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f1a10"/><stop offset="1" stop-color="#0c0a07"/></linearGradient>' +
  '<linearGradient id="tsmat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2418"/><stop offset="1" stop-color="#171209"/></linearGradient>' +
  '<pattern id="tscw" width="14" height="12" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.2" fill="#fff" opacity=".07"/><circle cx="11" cy="9" r="2" fill="#fff" opacity=".05"/></pattern></defs>' +
  '<rect width="400" height="800" fill="#060504"/><rect class="tscw" width="400" height="330" fill="url(#tscw)"/><rect class="tscw" y="420" width="400" height="160" fill="url(#tscw)"/>' +
  '<rect x="30" y="16" width="340" height="7" fill="url(#tsg)" opacity=".6"/>' + [70, 130, 200, 270, 330].map(x => '<circle class="tslamp" cx="' + x + '" cy="27" r="5" fill="#fff8d8"/>').join("") +
  '<rect class="tsscreen" x="85" y="44" width="230" height="140" rx="6" fill="url(#tsscr)" stroke="url(#tsg)" stroke-width="3"/>' +
  '<text x="200" y="108" text-anchor="middle" font-size="22" font-weight="900" fill="#fff" letter-spacing="2">' + esc(String(b.t).slice(0, 18).toUpperCase()) + '</text><text x="200" y="140" text-anchor="middle" font-size="15" font-weight="900" fill="#f0cf62" letter-spacing="5">TCCCG</text>' +
  '<rect x="18" y="70" width="56" height="104" rx="4" fill="url(#tsscr)" opacity=".7" stroke="#8a6412"/><rect x="326" y="70" width="56" height="104" rx="4" fill="url(#tsscr)" opacity=".7" stroke="#8a6412"/>' +
  '<polygon points="100,218 300,218 312,240 88,240" fill="#16130d" stroke="url(#tsg)" stroke-width="2"/>' +
  '<polygon points="165,240 235,240 335,520 65,520" fill="url(#tsrp)"/>' +
  '<line class="tsled" x1="165" y1="240" x2="65" y2="520" stroke="url(#tsg)" stroke-width="4"/><line class="tsled" x1="235" y1="240" x2="335" y2="520" stroke="url(#tsg)" stroke-width="4"/>' +
  '<polygon points="12,560 388,560 400,800 0,800" fill="#0b0907"/><polygon points="34,570 366,570 392,780 8,780" fill="url(#tsmat)" stroke="#3b321f"/>' +
  '<text x="200" y="700" text-anchor="middle" font-size="44" font-weight="900" fill="#f0cf62" opacity=".16" letter-spacing="6">TCCCG</text>' +
  [[34, 528, 46], [366, 528, 46], [10, 700, 110], [390, 700, 110]].map(p => '<rect x="' + (p[0] - 4) + '" y="' + p[1] + '" width="8" height="' + p[2] + '" rx="2" fill="url(#tsg)"/>').join("") +
  [536, 548, 560].map((y, i) => '<line x1="34" y1="' + y + '" x2="366" y2="' + y + '" stroke="#e23b3b" stroke-width="2.5"/><line x1="34" y1="' + y + '" x2="10" y2="' + (708 + i * 26) + '" stroke="#e23b3b" stroke-width="3"/><line x1="366" y1="' + y + '" x2="390" y2="' + (708 + i * 26) + '" stroke="#e23b3b" stroke-width="3"/>').join("") +
  "</svg>";

function summon(b, ids) {
  const defs = ids.map(defOf), best = defs.reduce((m, x) => Math.max(m, RAR.indexOf(x.r)), 0), nSR = defs.filter(x => x.r === "SR").length, lrPot = defs.some(x => x.lrPot || x.max === "LR" && RAR.indexOf(x.r) >= 3);
  const glow = best >= 3 ? (lrPot ? "gold stars" : "gold") : nSR >= 2 ? "violet" : "white";
  const c = b.c || ["#3b321f", "#0a0907"];
  const ov = document.createElement("div"); ov.className = "tsum glow-" + glow.replace(" ", "-");
  ov.innerHTML = '<div class="tsstage">' + scene(b, c) + '<div class="tsbeam l"></div><div class="tsbeam r"></div><div class="tspyro l"></div><div class="tspyro r"></div><div class="tscount">3</div>' +
    '<div class="tspack" style="background:linear-gradient(160deg,' + c[0] + "," + (c[1] || "#0a0907") + ')">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : "") + "<b>" + esc(b.t) + '</b><span class="tstear"></span></div></div><button class="tsskip">Passer ›</button>';
  document.body.appendChild(ov);
  const cnt = ov.querySelector(".tscount"); let n = 3, stage = 0, idx = 0, x0 = null;
  const tick = setInterval(() => { n--; if (n > 0) { cnt.textContent = n; cnt.classList.remove("pop"); void cnt.offsetWidth; cnt.classList.add("pop"); } else { clearInterval(tick); cnt.remove(); ov.classList.add("walk"); setTimeout(() => { if (stage === 0) ov.classList.add("lights"); }, 900); setTimeout(() => { if (stage === 0) { ov.classList.add("center"); stage = 1; } }, 3000); } }, 650);
  const reveal = () => {
    stage = 2; ov._rv = Date.now();
    ov.innerHTML = '<div class="tsreveal"><div class="tsfx fx-' + defs[idx].r + '"></div><div class="tscard">' + cardHTML(defs[idx], { nozoom: true }) + '</div><p class="tphint">' + (idx + 1) + " / " + defs.length + ' · glisse ou touche ‹ ›</p><div class="tsnav"><button data-nav="-1">‹</button><button data-nav="1">›</button></div></div><button class="tsskip">Tout voir ›</button>';
    if (navigator.vibrate && RAR.indexOf(defs[idx].r) >= 3) try { navigator.vibrate([30, 40, 60]); } catch (e) {}
  };
  const recap = () => {
    stage = 3;
    ov.innerHTML = '<div class="trecap"><h2>' + esc(b.t) + '</h2><div class="trgrid">' + defs.map(x => cardHTML(x, { small: true })).join("") + '</div><div class="btns"><a class="btn" href="#/tccg/roster" data-close>Voir mon roster</a><button class="btn ghost" data-close>Continuer</button></div></div>';
  };
  const go = dir => { idx += dir; if (idx < 0) idx = 0; if (idx >= defs.length) return recap(); reveal(); };
  ov.addEventListener("click", e => {
    if (ov._sw && Date.now() - ov._sw < 450) return;
    if (stage === 3) { if (e.target.closest("[data-close]")) { ov.remove(); changed("tcg"); } return; }
    if (e.target.closest(".tsskip")) { clearInterval(tick); return stage === 2 ? recap() : (idx = 0, reveal()); }
    if (stage === 0 && n <= 0) { ov.classList.add("lights", "center"); stage = 1; return; } // un appui pendant la marche : le booster arrive tout de suite
    if (stage === 1 && ov.querySelector(".tspack")) { ov.querySelector(".tspack").classList.add("open"); stage = 1.5; setTimeout(reveal, 700); return; }
    if (stage === 2) { if (Date.now() - (ov._rv || 0) < 900) return; const nv = e.target.closest("[data-nav]"); go(nv ? +nv.dataset.nav : 1); } // on laisse le temps de voir la carte
  });
  ov.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  ov.addEventListener("touchend", e => { if (stage !== 2 || x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40 && Date.now() - (ov._rv || 0) > 700) { ov._sw = Date.now(); go(dx < 0 ? 1 : -1); } x0 = null; });
}
