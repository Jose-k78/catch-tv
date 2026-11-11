// TCCCG — combats : liés aux shows passés (7 jours, remplacés par le show suivant), Dark Match (OC / N au hasard), PLE plus durs.
// 2 contre 2 par élimination, 3 TAG pour chacun (l'IA aussi). Système de mémoire (cahier) : pierre-feuille-ciseaux pour le
// premier tour, 2 cases retournées par tour, paire = action ; PV = somme des 5 stats × 2 ; dégâts = stat × type ;
// points de Finisher = stat ÷ 2 ; cases spéciales Finisher, Soin, Boost, Signature (×0,5). Même combat refaisable 1 h plus tard.
import { S, B as DB, ACT, changed, prof } from "../state.js";
import { esc, toast, lsGet, modal } from "../util.js";
import { parisDay } from "../time.js";
import { RAR, STATS, ARCH, ARCHS, typeMult, defOf, statsOf, hpOf, baseCards, showMatches, showKeyLabel, cfg, items, itemById, linked, versionCard, cardById } from "./data.js";
import { me, commit, owned, addCard, addXp, cardXp } from "./store.js";
import { cardHTML, typeWheel } from "./card.js";
import { recentShows } from "./callup.js";
import { SFX } from "./sfx.js";
import { BELT_DROP, dropBelt, isBelt, beltTitle, beltImgHTML } from "./evo.js";

const H = 36e5;
const TIER = {
  low: { n: "Dark Match", money: [1200, 1800], mpp: [15, 25], gim: [2, 4], drop: 0.08, mem: 0.3, cxp: 60, pxp: 30, card: 0 },
  mid: { n: "Show de la semaine", money: [2000, 3000], mpp: [30, 45], gim: [4, 7], drop: 0.18, mem: 0.5, cxp: 100, pxp: 50, card: 0.03 },
  top: { n: "PLE / PPV", money: [3500, 5000], mpp: [55, 80], gim: [7, 12], drop: 0.30, mem: 0.78, cxp: 160, pxp: 80, card: 0.08 },
  duel: { n: "Défi entre membres", money: [1500, 1500], mpp: [15, 15], gim: [2, 2], drop: 0, mem: 0.5, cxp: 60, pxp: 40, card: 0 }
};
// 3 niveaux de difficulté pour tous les combats : Low = normal, Mid = adversaire un peu plus fort, Top = stats doublées
export const DIFF = { low: { n: "Low", d: "Normal", st: 1, mem: 0, rew: 1 }, mid: { n: "Mid", d: "Adversaire un peu plus fort", st: 1.3, mem: 0.12, rew: 1.6 }, top: { n: "Top", d: "Stats de l’adversaire doublées", st: 2, mem: 0.25, rew: 2.6 } };
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
const cooldown = () => (cfg().fight && +cfg().fight.cool) || 60; // minutes

// shows disponibles : le dernier de chaque show sur 7 jours ; PLE autorisés en plus par le modo ; PLE interdits retirés
export function fightShows() {
  const C = cfg().fight || {}, deny = C.deny || [], allow = C.allow || [];
  const seen = {}, out = [];
  recentShows(7).concat(allow.filter(k => (S.highlights || {})[k])).forEach(key => {
    const p = key.split("|"), sk = p[0] + "|" + p[1];
    if (deny.indexOf(key) >= 0 || (seen[sk] && allow.indexOf(key) < 0)) return; seen[sk] = 1;
    const M = showMatches(key); if (M.length) out.push({ key: key, ple: p[1] === "PLE", matches: M });
  });
  return out;
}
// tableau des types (toujours visible avant et pendant le combat) : chaque type bat le suivant
const typeChain = () => ARCHS.map(a => '<b style="color:' + ARCH[a].c + '">' + a + "</b>").join(" ▶ ") + ' ▶ <b style="color:' + ARCH[ARCHS[0]].c + '">' + ARCHS[0] + "</b>";
const typeChart = () => '<div class="ttchart">' + typeWheel(70) + "<div><b>Tableau des types</b><p>" + typeChain() + "</p><small>Chaque type bat le suivant : dégâts ×2 contre lui, ×0,5 contre celui qui le bat.</small></div></div>";
// avantage de type d'une de mes cartes contre les adversaires choisis : ▲ (bat) / ▼ (battu)
function advBadge(arch, foes) {
  const up = foes.filter(f => typeMult(arch, f) === 2).length, dn = foes.filter(f => typeMult(arch, f) === 0.5).length;
  if (!up && !dn) return "";
  return '<span class="tadv' + (up && dn ? " mix" : up ? " up" : " dn") + '" title="' + (up ? "Avantage de type contre " + up + " adversaire" + (up > 1 ? "s" : "") : "") + (up && dn ? " · " : "") + (dn ? "Désavantage contre " + dn : "") + '">' + (up ? "▲" + (foes.length > 1 ? up : "") : "") + (dn ? "▼" + (foes.length > 1 ? dn : "") : "") + "</span>";
}
const nf = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const pct = v => String(Math.round(v * 1000) / 10).replace(".", ",") + " %";
// ce qu'on peut gagner sur un combat (selon la difficulté et le nombre d'adversaires)
function gainsBox(F, diff, foes) {
  const T = TIER[F.tier], D = DIFF[diff] || DIFF.low, n = foes.length || 1, gm = D.rew * (0.5 + 0.25 * n), rg = a => nf(Math.round(a[0] * gm)) + (a[1] !== a[0] ? "–" + nf(Math.round(a[1] * gm)) : "");
  const L = ["💵 " + rg(T.money) + " d’argent", "⚡⭐📣 " + rg(T.mpp) + " de chaque", "🎟️ " + rg(T.gim) + " gimmicks", "✨ " + Math.round(T.pxp * gm) + " XP joueur, " + T.cxp + " XP par carte"];
  if (T.drop) L.push("🎁 Un objet : " + pct(T.drop));
  const bd = Math.min(0.6, (BELT_DROP[F.tier] || 0) * D.rew); if (bd) L.push("🏆 Une ceinture" + (F.key ? " (" + esc(F.key.split("|")[0]) + ")" : "") + " : " + pct(bd));
  const cards = F.key && T.card ? foes.filter(f => f.src) : [];
  cards.forEach(f => L.push("🃏 Carte « " + esc(f.src.name) + " » version du show : " + pct(T.card * D.rew)));
  if (!cards.length) L.push('<span class="tno">🃏 Pas de carte de catcheur à gagner sur ce combat' + (F.tier === "low" ? " (les cartes tombent sur les matchs des shows)" : "") + "</span>");
  return '<div class="tgains"><b>🎁 À gagner si tu gagnes</b><ul>' + L.map(x => "<li>" + x + "</li>").join("") + "</ul><small>Si tu perds : 💵 " + nf(Math.round(T.money[0] * (F.tier === "duel" ? 0.27 : 0.2))) + (F.tier === "duel" ? " et 5 ⚡⭐📣" : "") + " · gains ×" + String(Math.round(gm * 100) / 100).replace(".", ",") + " (difficulté " + D.n + ", " + n + " contre " + n + ")</small></div>";
}
// petite ligne des gains sur la liste des combats (niveau Low, 2 adversaires)
const gainLine = (tier, card) => { const T = TIER[tier]; return '<small class="tgline">💵 ' + nf(T.money[0]) + "–" + nf(T.money[1]) + (T.drop ? " · 🎁 " + pct(T.drop) : "") + (BELT_DROP[tier] ? " · 🏆 " + pct(BELT_DROP[tier]) : "") + (card && T.card ? " · 🃏 " + pct(T.card) : "") + " · plus en Mid / Top</small>"; };
const coolLeft = (d, k) => Math.max(0, (d.cool[k] || 0) + cooldown() * 6e4 - Date.now());
const leftTxt = ms => { const m = Math.ceil(ms / 6e4); return m >= 60 ? Math.floor(m / 60) + " h " + (m % 60) : m + " min"; };

export function fightsView() {
  const d = me(), F = fightShows(), dk = "dark";
  let h = '<section class="tccghead"><h1>Combats</h1></section>' + resumeBox() + '<p class="tnote">Choisis un match d’un show de la semaine, puis qui tu affrontes (1 contre 1, 2 contre 2, 3 contre 3…) et la difficulté : Low, Mid ou Top. 3 TAG chacun. Chaque combat se refait 1 h plus tard.</p>';
  h += '<div class="tfcard duel"><b>👥 Défier un membre</b><small>Contre l’équipe d’un autre joueur, menée par l’IA · des ressources pour le gagnant, un peu pour le perdant</small><button class="btn small" data-act="tcgduels">Choisir</button></div>';
  h += '<div class="tfcard dark"><b>🌑 Dark Match</b><small>Contre des catcheurs au hasard · beaucoup d’argent, peu de MPP</small>' + gainLine("low") + (coolLeft(d, dk) ? '<span class="tcool">⏳ ' + leftTxt(coolLeft(d, dk)) + "</span>" : '<button class="btn small" data-act="tcgprep" data-k="' + dk + '">Combattre</button>') + "</div>";
  if (!F.length) h += '<p class="tnote">Pas de show de la semaine avec des résultats pour l’instant.</p>';
  F.forEach(s => {
    h += '<h2>' + (s.ple ? "👑 " : "") + esc(showKeyLabel(s.key)) + ' <small class="tsmall">' + esc(s.key.split("|")[0]) + (s.ple ? " · PLE / PPV : IA plus forte, meilleurs gains" : "") + "</small></h2>";
    h += s.matches.map((m, i) => { const k = s.key + "#" + i, cl = coolLeft(d, k);
      return '<div class="tfcard' + (s.ple ? " ple" : "") + '"><div class="tfvs">' + m.cards.slice(0, 2).map(c => '<span class="tfface" style="background-image:url(\'' + esc(c.pic) + '\')"></span>').join('<i>VS</i>') + "</div><b>" + esc(m.cards.map(c => c.name).slice(0, 4).join(" · ")) + "</b>" + gainLine(s.ple ? "top" : "mid", true) +
        (cl ? '<span class="tcool">⏳ ' + leftTxt(cl) + "</span>" : '<button class="btn small" data-act="tcgprep" data-k="' + esc(k) + '">Combattre</button>') + "</div>"; }).join("");
  });
  return h;
}
// adversaires possibles d'un combat (on choisit ensuite qui on affronte) : { tier, label, pool: [{ def, lv, src, inst }], key }
function foesOf(k) {
  if (k === "dark") { const N0 = baseCards().filter(c => c.r === "N" || c.custom), N1 = N0.filter(c => c.pic), N = N1.length >= 6 ? N1 : N0, L = []; for (let i = 0; i < 6 && N.length; i++) { const c = N[Math.floor(Math.random() * N.length)]; if (L.indexOf(c) < 0) L.push(c); } return { tier: "low", label: "Dark Match", pool: L.map(c => ({ def: c, lv: 1 + Math.floor(Math.random() * 6) })) }; }
  if (k.indexOf("duel:") === 0) {
    const uid = k.slice(5), o = (S.tcgAll || []).find(x => x.uid === uid); if (!o) return null;
    const L = Object.keys(o.cards || {}).map(iid => Object.assign({ iid: iid }, o.cards[iid])).filter(x => defOf(x.c)).sort((a, b) => hpOf(statsOf(b)) - hpOf(statsOf(a))).slice(0, 8);
    return { tier: "duel", label: "Défi contre " + (o.name || "un membre"), pool: L.map(x => ({ def: defOf(x.c), lv: x.lv || 1, inst: x })), uid: uid, oname: o.name || "" };
  }
  const key = k.split("#")[0], i = +k.split("#")[1], s = fightShows().find(x => x.key === key); if (!s) return null;
  const m = s.matches[i]; if (!m) return null;
  // tous les catcheurs du match, rangés par nom (pas de spoiler)
  const L = m.sides[0].concat(m.sides[1]).filter((c, j, a) => a.indexOf(c) === j).sort((x, y) => x.name.localeCompare(y.name));
  const pool = L.map(c => ({ def: versionCard(c, key), lv: s.ple ? 12 + Math.floor(Math.random() * 10) : 3 + Math.floor(Math.random() * 8), src: c }));
  if (pool.length === 1) { const o = baseCards().filter(c => c.k === key.split("|")[0]); pool.push({ def: o[Math.floor(Math.random() * o.length)], lv: 10 }); }
  return { tier: s.ple ? "top" : "mid", label: showKeyLabel(key) + " · " + L.map(c => c.name).slice(0, 6).join(" · "), pool: pool, key: key };
}

// ---------- préparation : adversaires, difficulté, autant de cartes que d'adversaires, soutiens, objets ----------
let prep = null;
ACT.tcgprep = el => {
  const d = me(), L = owned(d);
  if (L.length < 1) { toast("Il te faut au moins 1 carte : ouvre ton booster gratuit du jour"); location.hash = "#/tccg/callup"; return; }
  const F = foesOf(el.dataset.k); if (!F) { toast("Combat introuvable"); return; }
  prep = { k: el.dataset.k, F: F, foes: F.pool.length >= 2 ? [0, 1] : [0], team: [], sup: [], items: [], diff: "low" };
  location.hash = "#/tccg/combat-prep";
};
export function prepView() {
  if (!prep) return fightsView();
  const d = me(), L = owned(d).sort((a, b) => hpOf(statsOf(b)) - hpOf(statsOf(a))), F = prep.F, n = prep.foes.length;
  const combatItems = items().filter(x => x.t === "combat" && (d.items[x.id] || 0) > 0);
  if (prep.team.length > n) prep.team = prep.team.slice(0, n);
  const fa = prep.foes.map(i => F.pool[i] && F.pool[i].def.arch).filter(Boolean), bdg = x => advBadge((defOf(x.c) || {}).arch, fa);
  let h = '<a class="back" href="#/tccg/combats">‹ Combats</a><h1 style="margin:4px 16px">' + esc(F.label) + "</h1>" +
    '<h2>1. Qui veux-tu affronter ? <small class="tsmall">' + n + " contre " + n + "</small></h2>" +
    '<div class="tfoes">' + F.pool.map((f, i) => '<button class="tfoe' + (prep.foes.indexOf(i) >= 0 ? " on" : "") + '" data-act="tcgfoe" data-i="' + i + '"><span class="tfface" style="background-image:url(\'' + esc(f.def.pic || "") + '\')"></span><b>' + esc(f.def.name) + "</b><small>Nv " + f.lv + ' · <i style="color:' + (ARCH[f.def.arch] || {}).c + '">' + esc(f.def.arch) + "</i></small></button>").join("") + "</div>" + typeChart() +
    '<h2>2. Difficulté</h2><div class="tdiff">' + Object.keys(DIFF).map(k => '<button class="tdf ' + k + (prep.diff === k ? " on" : "") + '" data-act="tcgdiff" data-v="' + k + '"><b>' + DIFF[k].n + "</b><small>" + esc(DIFF[k].d) + (DIFF[k].rew > 1 ? " · gains ×" + String(DIFF[k].rew).replace(".", ",") : "") + "</small></button>").join("") + "</div>" + gainsBox(F, prep.diff, prep.foes.map(i => F.pool[i]).filter(Boolean)) +
    "<h2>3. Ton équipe <small class=\"tsmall\">" + prep.team.length + " / " + n + "</small></h2>" +
    '<div class="tprepteam">' + Array.from({ length: n }, (_, i) => { const iid = prep.team[i], x = iid && d.cards[iid]; return '<div class="tslot2">' + (x ? cardHTML(Object.assign({ iid: iid }, x), { small: true, act: "tcgpick", iid: iid, badge: bdg(x) }) : '<span>Catcheur ' + (i + 1) + "</span>") + "</div>"; }).join("") +
    '<div class="tslot2 sup">' + [0, 1].map(i => { const iid = prep.sup[i], x = iid && d.cards[iid]; return x ? cardHTML(Object.assign({ iid: iid }, x), { small: true, act: "tcgpick", iid: iid }) : '<span>Soutien</span>'; }).join("") + "</div></div>" +
    '<p class="tnote">▲ = ta carte bat le type d’un adversaire choisi, ▼ = elle est battue. Touche une carte ci-dessous : d’abord tes ' + n + " catcheur" + (n > 1 ? "s" : "") + ", puis jusqu’à 2 soutiens (bonus +10 % si même équipe ou faction).</p>";
  if (L.length < n) h += '<p class="tnote">Il te faut ' + n + " cartes pour un " + n + " contre " + n + " : choisis moins d’adversaires.</p>";
  if (combatItems.length) h += '<div class="tfilt">' + combatItems.map(x => '<button class="chip' + (prep.items.indexOf(x.id) >= 0 ? " on" : "") + '" data-act="tcgitem" data-id="' + x.id + '">' + esc(x.ic + " " + x.n) + " ×" + d.items[x.id] + "</button>").join("") + "</div>";
  h += '<button class="btn wide" style="margin:8px 16px;width:calc(100% - 32px)" data-act="tcgfight"' + (prep.team.length === n && n ? "" : " disabled") + ">⚔️ Lancer le combat</button>";
  h += '<div class="trgrid">' + L.filter(x => prep.team.indexOf(x.iid) < 0 && prep.sup.indexOf(x.iid) < 0).map(x => cardHTML(x, { small: true, act: "tcgpick", iid: x.iid, badge: bdg(x) })).join("") + "</div>";
  return h;
}
ACT.tcgfoe = el => { if (!prep) return; const i = +el.dataset.i, j = prep.foes.indexOf(i); if (j >= 0) { if (prep.foes.length > 1) prep.foes.splice(j, 1); } else prep.foes.push(i); prep.foes.sort((a, b) => a - b); changed("tcg"); };
ACT.tcgdiff = el => { if (prep && DIFF[el.dataset.v]) { prep.diff = el.dataset.v; changed("tcg"); } };
ACT.tcgpick = el => {
  if (!prep) return; const iid = el.dataset.iid, n = prep.foes.length;
  if (prep.team.indexOf(iid) >= 0) prep.team = prep.team.filter(x => x !== iid);
  else if (prep.sup.indexOf(iid) >= 0) prep.sup = prep.sup.filter(x => x !== iid);
  else if (prep.team.length < n) prep.team.push(iid);
  else if (prep.sup.length < 2) prep.sup.push(iid);
  else toast("Équipe complète : touche une carte choisie pour la retirer");
  changed("tcg");
};
ACT.tcgitem = el => { if (!prep) return; const id = el.dataset.id, i = prep.items.indexOf(id); if (i >= 0) prep.items.splice(i, 1); else if (prep.items.length < 2) prep.items.push(id); else toast("2 objets au plus"); changed("tcg"); };
// ---------- défier un membre ----------
ACT.tcgduels = () => {
  modal((box, close) => {
    const draw = () => {
      const L = (S.tcgAll || []).filter(o => o.uid !== (S.user && S.user.uid) && Object.keys(o.cards || {}).length >= 1), d = me();
      box.innerHTML = "<h3>👥 Défier un membre</h3>" + (S.tcgAll ? (L.length ? '<div class="list">' + L.map(o => { const k = "duel:" + o.uid, cl = coolLeft(d, k), p = prof(o.uid);
        return '<div class="item"><span class="lbl"><b>' + esc(o.name || (p && p.pseudo) || "Joueur") + "</b><small>Niveau " + (o.lvl || 1) + " · " + Object.keys(o.cards || {}).length + " cartes · " + (o.wins || 0) + " victoires</small></span>" + (cl ? '<span class="tcool">⏳ ' + leftTxt(cl) + "</span>" : '<button class="btn small" data-k="' + esc(k) + '">Défier</button>') + "</div>"; }).join("") + "</div>" : '<p class="tnote">Personne d’autre n’a encore de cartes.</p>') : '<p class="tnote">Chargement…</p>') +
        '<button class="btn wide ghost" style="margin-top:10px" data-close>Fermer</button>';
    };
    draw(); loadAll().then(draw);
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) return close(); const b = e.target.closest("[data-k]"); if (b) { close(); ACT.tcgprep({ dataset: { k: b.dataset.k } }); } });
  });
};
export const loadAll = () => DB.listTcg ? DB.listTcg().then(L => { S.tcgAll = L || []; changed("tcg"); return S.tcgAll; }).catch(() => { S.tcgAll = S.tcgAll || []; return S.tcgAll; }) : Promise.resolve([]);
// ---------- combat en cours : gardé sur le téléphone, on peut quitter et reprendre ----------
const SKEY = () => "ctv.tcgfight." + ((S.user && S.user.uid) || "x");
function persist() { if (!B || B.over) return; try { localStorage.setItem(SKEY(), JSON.stringify(Object.assign({}, B, { fx: [], open: [], busy: false, saved: Date.now() }), (k, v) => (k === "def" && v && typeof v === "object" ? v.id : v))); } catch (e) {} }
function dropSave() { try { localStorage.removeItem(SKEY()); } catch (e) {} }
function savedFight() { try { const o = JSON.parse(lsGet(SKEY()) || "null"); if (!o || Date.now() - (o.saved || 0) > 3 * 864e5) return null; return o; } catch (e) { return null; } }
function restore() {
  const o = savedFight(); if (!o) return false;
  let ok = true; ["P", "E"].forEach(s => (o[s].team || []).forEach(f => { f.def = defOf(f.def); if (!f.def) ok = false; }));
  if (!ok) { dropSave(); return false; }
  o.fx = []; o.open = []; o.busy = false; B = o; return true;
}
function resumeBox() { const o = savedFight(); return o ? '<div class="tfcard resume"><b>⏸️ Combat en cours</b><small>' + esc((o.F && o.F.label) || "") + '</small><span class="repbtns"><button class="btn small" data-act="tcgresume">Reprendre</button><button class="btn small ghost" data-act="tcgdrop">Abandonner</button></span></div>' : ""; }
export const resumeHome = resumeBox;
ACT.tcgresume = () => { if (!B && !restore()) { toast("Plus de combat en cours"); changed("tcg"); return; } location.hash = "#/tccg/combat"; SFX.unlock(); SFX.crowd(true); SFX.music(true); setTimeout(() => { if (B && B.turn === "E" && !B.over) aiTurn(); }, 1200); };
ACT.tcgdrop = () => { if (!B) restore(); if (B && !B.over) end(false, true); else { dropSave(); changed("tcg"); } };

// ---------- le combat ----------
const PAIRS = ["fo", "ag", "ch", "en", "te", "fin", "soin", "boost", "sig", "x"];
const PICO = { fo: "💪", ag: "⚡", ch: "🎤", en: "🛡️", te: "🧠", fin: "🔥", soin: "💚", boost: "⏫", sig: "✴️" };
const PNAME = { fo: "Force", ag: "Agilité", ch: "Charisme", en: "Endurance", te: "Technique", fin: "Finisher", soin: "Soin", boost: "Boost", sig: "Signature" };
let B = null;
function fighter(def, lv, inst, supports) {
  const st0 = inst ? statsOf(inst, def) : def.st.map(v => Math.round(v + (lv - 1) * 1.2 / 5));
  const bonus = supports && supports.some(s => linked(def, s)) ? 1.1 : 1;
  const pw = (inst && inst.pw) || "", st = st0.map(v => Math.round(v * bonus * (pw === "aura" ? 1.08 : 1))), hp = hpOf(st);
  return { def: def, st: st, hp: hp, max: hp, lv: lv, linked: bonus > 1, iid: inst && inst.iid, pw: pw };
}
function newGrid() {
  const types = PAIRS.slice(0, 9).concat([["fo", "ag", "ch", "en", "te"][Math.floor(Math.random() * 5)]]), g = [];
  types.forEach(t => { g.push({ t: t }); g.push({ t: t }); });
  for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [g[i], g[j]] = [g[j], g[i]]; }
  return g;
}
ACT.tcgfight = () => {
  if (!prep || !prep.foes.length || prep.team.length !== prep.foes.length) return;
  const d = me(), F = prep.F, DF = DIFF[prep.diff] || DIFF.low, foes = prep.foes.map(i => F.pool[i]).filter(Boolean);
  const sups = prep.sup.map(iid => d.cards[iid] && defOf(d.cards[iid].c)).filter(Boolean);
  const mult = (cfg().fight && +cfg().fight.ai) || 1;
  B = { k: prep.k, F: { label: F.label, key: F.key || "", uid: F.uid || "", oname: F.oname || "", src: foes.map(f => f.src ? f.src.id : "") }, tier: F.tier, diff: prep.diff, n: foes.length, mem: Math.min(0.97, TIER[F.tier].mem * mult + DF.mem),
    P: { team: prep.team.map(iid => fighter(defOf(d.cards[iid].c), d.cards[iid].lv, Object.assign({ iid: iid }, d.cards[iid]), sups)), a: 0, tags: 3, fin: 0, boost: 1, stun: false },
    E: { team: foes.map(f => fighter(f.def, f.lv, f.inst || null, [])), a: 0, tags: 3, fin: 0, boost: 1, stun: false },
    items: prep.items.slice(), used: [], grid: newGrid(), open: [], known: {}, turn: "", first: true, log: "Pierre, feuille ou ciseaux ?", busy: false, over: false };
  ["P", "E"].forEach(s => { if (B[s].team.some(f => f.pw === "tag")) B[s].tags++; });
  const boostE = (B.tier === "top" ? 1.08 : 1) * DF.st;
  if (boostE !== 1) B.E.team.forEach(f => { f.st = f.st.map(v => Math.round(v * boostE)); f.hp = f.max = hpOf(f.st); });
  B.fx = []; SFX.unlock();
  location.hash = "#/tccg/combat";
  setTimeout(intro, 120);
};
// ---------- animations ----------
const $ = sel => document.querySelector(sel);
function layer(cls, html, ms) { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; document.body.appendChild(d); if (ms) setTimeout(() => d.remove(), ms); return d; }
// bandeau rapide au milieu de l'écran : « À TOI ! » / « TOUR DE L'IA »
function banner(txt, cls) { layer("tbanner " + (cls || ""), "<span>" + esc(txt) + "</span><span>" + esc(txt) + "</span><span>" + esc(txt) + "</span>", 1300); }
// entrée sur le ring : nos cartes avec leurs infos, puis l'adversaire, compte à rebours et 3 coups de cloche
function intro() {
  if (!B) return;
  const info = (f, side) => '<div class="tin ' + side + '"><span class="tinpic" style="background-image:url(\'' + esc(f.def.pic) + '\')"></span><div><b>' + esc(f.def.name) + "</b><small>" + esc(f.def.arch) + " · Nv " + f.lv + " · " + f.max + " PV</small><small>🔥 " + esc(f.def.fin.n) + "</small></div></div>";
  const ov = layer("tintro", '<div class="tinrow me">' + B.P.team.map(f => info(f, "me")).join("") + '</div><div class="tinvs">VS</div><div class="tinrow foe">' + B.E.team.map(f => info(f, "foe")).join("") + '</div><div class="tincount"></div><button class="tsskip">Passer ›</button>');
  B.busy = true; SFX.crowd(true); SFX.music(true);
  const cnt = ov.querySelector(".tincount"); let done = false;
  const finish = () => { if (done) return; done = true; ov.classList.add("out"); setTimeout(() => ov.remove(), 400); if (B) { B.busy = false; redraw(); } };
  ov.querySelector(".tsskip").addEventListener("click", finish);
  setTimeout(() => ov.classList.add("s1"), 50);
  setTimeout(() => ov.classList.add("s2"), 1300);
  [3, 2, 1].forEach((n, i) => setTimeout(() => { if (done) return; cnt.textContent = n; cnt.classList.remove("pop"); void cnt.offsetWidth; cnt.classList.add("pop"); }, 2600 + i * 700));
  setTimeout(() => { if (done) return; cnt.textContent = "🔔 🔔 🔔"; SFX.bell(3); }, 4700);
  setTimeout(() => { if (done) return; cnt.textContent = "FIGHT !"; cnt.classList.add("fight"); }, 6000);
  setTimeout(finish, 6900);
}
// effets après le redessin : dégâts qui s'envolent, secousse, soins
function runFx() {
  const L = (B && B.fx) || []; if (!L.length) return; B.fx = [];
  requestAnimationFrame(() => L.forEach(f => {
    const el = $(".tside." + (f.side === "E" ? "foe" : "me") + " .tfgt.on"); if (!el) return;
    const r = el.getBoundingClientRect();
    layer("tdmg " + (f.cls || ""), esc(f.txt), 1100).style.cssText = "left:" + (r.left + r.width / 2) + "px;top:" + (r.top + window.scrollY) + "px";
    if (f.shake) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }
  }));
}
// le finisher : la carte de l'attaquant s'abat sur celle de l'adversaire
function finisherFx(side, cb) {
  const a = act(side), t = act(side === "P" ? "E" : "P");
  B.busy = true; SFX.finisher();
  const ov = layer("tfinfx " + (side === "P" ? "me" : "foe"), '<div class="tfx-target">' + cardHTMLmini(t) + '</div><div class="tfx-att">' + cardHTMLmini(a) + '</div><div class="tfx-name">' + esc(a.def.fin.n) + "</div>");
  setTimeout(() => ov.classList.add("hit"), 650);
  setTimeout(() => { ov.remove(); B.busy = false; cb(); }, 1700);
}
const cardHTMLmini = f => '<div class="tfxcard" style="background-image:url(\'' + esc(f.def.pic) + '\')"><b>' + esc(f.def.name) + "</b></div>";
// carte éliminée : pop-up + cloche
function koFx(f) { SFX.bell(1); layer("tkopop", '<div class="tkocard" style="background-image:url(\'' + esc(f.def.pic) + '\')"></div><b>' + esc(f.def.name) + "</b><span>ÉLIMINÉ !</span>", 1800); }
function tagFx(f) { layer("ttagpop", "<span>TAG !</span><b>" + esc(f.def.name) + "</b>", 1100); }
const act = s => B[s].team[B[s].a];
const alive = s => B[s].team.filter(f => f.hp > 0);
function hpBar(f, on) { return '<div class="tfgt' + (on ? " on" : "") + (f.hp <= 0 ? " ko" : "") + '"><span class="tfmini" style="background-image:url(\'' + esc(f.def.pic) + '\')"></span><div><b>' + esc(f.def.name) + "</b>" + (f.linked ? ' <small class="tlink">lié +10 %</small>' : "") + '<i class="hp"><i style="width:' + Math.max(0, f.hp / f.max * 100) + '%"></i></i><small>' + Math.max(0, f.hp) + " / " + f.max + " PV · " + esc(f.def.arch) + "</small></div></div>"; }
export function combatView() {
  if (!B && !restore()) return fightsView();
  const P = B.P, E = B.E;
  const bg = (cfg().assets || {}).fightbg;
  let h = '<div class="tbattle"' + (bg ? ' style="background-image:linear-gradient(rgba(5,4,3,.55),rgba(5,4,3,.8)),url(\'' + esc(bg) + '\')"' : "") + ">" +
    '<div class="tside foe">' + E.team.map((f, i) => hpBar(f, i === E.a)).join("") + '<div class="tfin"><i style="width:' + Math.min(100, E.fin) + '%"></i></div><small>TAG ' + E.tags + "</small></div>" +
    typeStrip() + '<div class="tlog">' + esc(B.log) + (B.diff && B.diff !== "low" ? ' <span class="tdtag ' + B.diff + '">' + DIFF[B.diff].n + "</span>" : "") + "</div>";
  if (!B.turn) h += '<div class="trps">' + [["p", "✊"], ["f", "✋"], ["c", "✌️"]].map(x => '<button data-act="tcgrps" data-v="' + x[0] + '">' + x[1] + "</button>").join("") + "</div>";
  else h += '<div class="tgrid' + (B.turn === "P" ? " myturn" : "") + '">' + B.grid.map((c, i) => { const t = c.t === "x" ? "fo" : c.t;
    return '<button class="tcell' + (c.done ? " done" : B.open.indexOf(i) >= 0 || c.peek ? " open" : c.seen ? " seen" : " fresh") + '" data-act="tcgflip" data-i="' + i + '"' + (c.done ? " disabled" : "") + '><span class="tcf tback"><span class="tcb">TCCCG</span></span><span class="tcf tfront c-' + t + '"><span>' + PICO[t] + "</span><small>" + PNAME[t] + "</small></span></button>"; }).join("") + "</div>";
  h += '<div class="tside me"><div class="tfin"><i style="width:' + Math.min(100, P.fin) + '%"></i></div>' + P.team.map((f, i) => hpBar(f, i === P.a)).join("") + "</div>" +
    '<div class="tbtns"><button class="btn small" data-act="tcgtag"' + (P.tags && alive("P").length > 1 && B.turn === "P" && !B.busy ? "" : " disabled") + ">🔄 TAG (" + P.tags + ")</button>" +
    '<button class="btn small fin" data-act="tcgfin"' + (P.fin >= 100 && B.turn === "P" && !B.busy ? "" : " disabled") + ">🔥 " + esc(act("P").def.fin.n) + "</button>" +
    B.items.map(id => { const it = itemById(id); return it ? '<button class="btn small ghost" data-act="tcguse" data-id="' + id + '"' + (B.used.indexOf(id) >= 0 || B.turn !== "P" || B.busy ? " disabled" : "") + ">" + esc(it.ic) + "</button>" : ""; }).join("") +
    '<button class="btn small ghost" data-act="tcgquit">Abandonner</button></div></div>';
  return h;
}
// pendant le combat : mon catcheur actif contre le sien (avantage de type) + le cycle des types
function typeStrip() {
  const a = act("P"), b = act("E"); if (!a || !b) return "";
  const m = typeMult(a.def.arch, b.def.arch), r = typeMult(b.def.arch, a.def.arch);
  return '<div class="ttstrip">' + typeWheel(22) + '<span><b style="color:' + ARCH[a.def.arch].c + '">' + esc(a.def.arch) + "</b> " + (m === 2 ? '<em class="up">▲ ×2</em>' : m === 0.5 ? '<em class="dn">▼ ×0,5</em>' : "=") + ' <b style="color:' + ARCH[b.def.arch].c + '">' + esc(b.def.arch) + "</b>" + (r === 2 ? ' <small class="dn">(il te fait ×2)</small>' : r === 0.5 ? ' <small class="up">(il te fait ×0,5)</small>' : "") + '</span><details><summary>Types</summary><p>' + typeChain() + "</p></details></div>";
}
const redraw = () => { changed("tcg"); runFx(); persist(); };
function say(t) { B.log = t; }
ACT.tcgrps = el => {
  const me_ = el.dataset.v, ai = ["p", "f", "c"][Math.floor(Math.random() * 3)], ic = { p: "✊", f: "✋", c: "✌️" };
  if (me_ === ai) { say("Égalité (" + ic[me_] + " / " + ic[ai] + ") : on recommence !"); return redraw(); }
  const win = (me_ === "p" && ai === "c") || (me_ === "f" && ai === "p") || (me_ === "c" && ai === "f");
  B.turn = win ? "P" : "E"; say((win ? "Tu commences" : "L’adversaire commence") + " (" + ic[me_] + " contre " + ic[ai] + ")");
  redraw(); banner(win ? "À TOI !" : "TOUR DE L’IA", win ? "me" : "foe"); if (!win) setTimeout(aiTurn, 1300);
};
function dmg(side, stat, mult) {
  const o = side === "P" ? "E" : "P", a = act(side), t = act(o);
  // pouvoirs d'évolution : critique, entrée fracassante, tueur de géants (attaquant) ; garde haute (défenseur)
  let pm = a.pw === "crit" ? 1.15 : 1; if (a.pw === "entree" && !a.hit1) pm *= 1.5; if (a.pw === "geant" && t.max > a.max) pm *= 1.25; if (t.pw === "garde") pm *= 0.85; a.hit1 = true;
  const v = Math.round(stat * typeMult(a.def.arch, t.def.arch) * B[side].boost * (mult || 1) * pm);
  B[side].boost = 1; t.hp -= v;
  const m = typeMult(a.def.arch, t.def.arch);
  B.fx.push({ side: o, txt: "-" + v + (m > 1 ? " !" : ""), cls: m > 1 ? "crit" : m < 1 ? "weak" : "", shake: true }); SFX.hit(v > 60);
  return v;
}
function koCheck() {
  ["P", "E"].forEach(s => { const t = act(s); if (t.hp <= 0 && !t.koShown) { t.koShown = true; koFx(t); const nx = B[s].team.findIndex(f => f.hp > 0); if (nx >= 0) { B[s].a = nx; say(B.log + " · " + t.def.name + " est éliminé !"); setTimeout(() => B && tagFx(act(s)), 1500); } } });
  if (!alive("E").length) return end(true);
  if (!alive("P").length) return end(false);
  return false;
}
// une paire trouvée
function resolve(side, t) {
  const S_ = B[side], a = act(side), idx = { fo: 0, ag: 1, ch: 2, en: 3, te: 4, x: 0 }, who = side === "P" ? "Tu" : a.def.name;
  if (t === "ch") { banner(side === "P" ? "PROVOCATION !" : a.def.name + " PROVOQUE !", "taunt"); SFX.taunt(); }
  if (a.pw === "regen" && a.hp > 0) { const h = Math.max(1, Math.round(a.max * 0.06)); a.hp = Math.min(a.max, a.hp + h); B.fx.push({ side: side, txt: "+" + h, cls: "heal" }); }
  if (t in idx) { const st = a.st[idx[t]], v = dmg(side, st); if (!B.noFin) S_.fin = Math.min(100, S_.fin + Math.round(st / 2 * (a.pw === "foule" ? 1.3 : 1))); say(who + " · " + PNAME[t === "x" ? "fo" : t] + " : " + v + " dégâts" + (typeMult(a.def.arch, act(side === "P" ? "E" : "P").def.arch) > 1 ? " (super efficace !)" : "")); }
  else if (t === "fin") { S_.fin = 100; say(who + " · case Finisher : barre pleine !"); }
  else if (t === "soin") { const h = Math.round(a.max * 0.2); a.hp = Math.min(a.max, a.hp + h); say(who + " · Soin : +" + h + " PV"); B.fx.push({ side: side, txt: "+" + h, cls: "heal" }); }
  else if (t === "boost") { S_.boost = 1.5; say(who + " · Boost : prochaine attaque ×1,5"); }
  else if (t === "sig") { const v = dmg(side, Math.max.apply(null, a.st), 0.5); say(who + " · Signature : " + v + " dégâts"); }
}
function finisher(side) {
  const S_ = B[side], o = side === "P" ? "E" : "P", a = act(side), e = a.def.fin.e;
  const v = dmg(side, a.st.reduce((x, y) => x + y, 0) * 0.45); S_.fin = 0;
  let extra = "";
  if (e === "Stun") { B[o].stun = true; extra = " · l’adversaire est sonné"; }
  else if (e === "Soin") { const h = Math.round(a.max * 0.25); a.hp = Math.min(a.max, a.hp + h); extra = " · +" + h + " PV"; }
  else if (e === "Division") { B[o].fin = Math.floor(B[o].fin / 2); extra = " · barre adverse divisée"; }
  else if (e === "Boost") { S_.boost = 1.5; extra = " · prochaine attaque ×1,5"; }
  else if (e === "Révélation") { peek(1400); extra = " · cases révélées"; }
  else if (e === "Mélange") { reshuffle(); extra = " · cases mélangées"; }
  else if (e === "Vol de tour") { S_.again = true; extra = " · il rejoue"; }
  say((side === "P" ? "🔥 " : "🔥 " + a.def.name + " : ") + a.def.fin.n + " ! " + v + " dégâts" + extra);
}
function peek(ms) { B.grid.forEach(c => { if (!c.done) c.peek = true; }); redraw(); setTimeout(() => { if (!B) return; B.grid.forEach(c => { c.peek = false; }); redraw(); }, ms); }
function reshuffle() { const idx = B.grid.map((c, i) => c.done ? -1 : i).filter(i => i >= 0), vals = idx.map(i => B.grid[i]); for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [vals[i], vals[j]] = [vals[j], vals[i]]; } idx.forEach((gi, j) => { B.grid[gi] = vals[j]; vals[j].seen = false; }); B.known = {}; }
function afterPair() { if (B.grid.every(c => c.done)) { B.grid = newGrid(); B.known = {}; say(B.log + " · nouvelles cases !"); } }
function flip(i, side) {
  if (!B || B.over || B.busy) return;
  const c = B.grid[i]; if (!c || c.done || B.open.indexOf(i) >= 0) return;
  B.open.push(i); B.known[i] = c.t; c.seen = true;
  const cel = document.querySelector('.tcell[data-i="' + i + '"]'); if (cel) { cel.classList.remove("fresh", "seen"); cel.classList.add("open"); } else redraw();
  if (B.open.length < 2) return;
  const [x, y] = B.open; B.busy = true;
  setTimeout(() => {
    if (!B) return;
    const same = B.grid[x].t === B.grid[y].t;
    if (same) [x, y].forEach(j => { const el = document.querySelector('.tcell[data-i="' + j + '"]'); if (el) el.classList.add("match"); });
    else [x, y].forEach(j => { const el = document.querySelector('.tcell[data-i="' + j + '"]'); if (el) el.classList.add("miss"); });
  }, 600);
  setTimeout(() => {
    if (!B) return;
    const same = B.grid[x].t === B.grid[y].t;
    if (same) {
      B.grid[x].done = B.grid[y].done = true; delete B.known[x]; delete B.known[y];
      B.noFin = B.first && side === B.turn; // paire dès le premier essai : rejoue sans points de Finisher
      resolve(side, B.grid[x].t); B.noFin = false; B.first = false;
      B.open = []; B.busy = false; afterPair();
      if (koCheck()) return redraw();
      redraw(); if (side === "E") setTimeout(aiTurn, 900);
    } else {
      B.first = false; B.open = []; B.busy = false; nextTurn(side);
    }
  }, 1150);
}
function nextTurn(side) {
  const o = side === "P" ? "E" : "P";
  if (B[side].again) { B[side].again = false; redraw(); if (side === "E") setTimeout(aiTurn, 800); return; }
  if (B[o].stun) { B[o].stun = false; say(B.log + " · " + (o === "P" ? "tu es sonné, tu passes ton tour" : "l’adversaire passe son tour")); redraw(); if (side === "E") setTimeout(aiTurn, 900); return; }
  B.turn = o; redraw(); banner(o === "P" ? "À TOI !" : "TOUR DE L’IA", o === "P" ? "me" : "foe"); if (o === "E") setTimeout(aiTurn, 1300);
}
ACT.tcgflip = el => { if (!B || B.turn !== "P") return; flip(+el.dataset.i, "P"); };
ACT.tcgtag = () => { if (!B || B.turn !== "P" || !B.P.tags) return; const nx = B.P.team.findIndex((f, i) => i !== B.P.a && f.hp > 0); if (nx < 0) return; B.P.a = nx; B.P.tags--; say("🔄 TAG ! " + act("P").def.name + " entre sur le ring"); SFX.taunt(); tagFx(act("P")); redraw(); };
ACT.tcgfin = () => { if (!B || B.turn !== "P" || B.P.fin < 100 || B.busy) return; finisherFx("P", () => { finisher("P"); if (koCheck()) return redraw(); redraw(); }); };
ACT.tcguse = el => {
  if (!B || B.turn !== "P") return; const it = itemById(el.dataset.id); if (!it || B.used.indexOf(it.id) >= 0) return;
  B.used.push(it.id);
  if (it.fx === "dmg") { const t = act("E"); t.hp -= +it.v || 20; say(it.ic + " " + it.n + " : " + (+it.v || 20) + " dégâts !"); B.fx.push({ side: "E", txt: it.ic + " -" + (+it.v || 20), shake: true }); SFX.hit(true); }
  else if (it.fx === "heal") { const a = act("P"); a.hp = Math.min(a.max, a.hp + (+it.v || 20)); say(it.ic + " " + it.n + " : +" + (+it.v || 20) + " PV"); }
  else if (it.fx === "fin") { B.P.fin = Math.min(100, B.P.fin + (+it.v || 50)); say(it.ic + " " + it.n + " : barre de Finisher +" + (+it.v || 50)); }
  else if (it.fx === "boost") { B.P.boost = +it.v || 1.5; say(it.ic + " " + it.n + " : prochaine attaque ×" + (+it.v || 1.5)); }
  else if (it.fx === "reveal") { peek(1000); say(it.ic + " " + it.n + " : cases révélées"); }
  commit(d => { d.items[it.id] = Math.max(0, (d.items[it.id] || 0) - 1); });
  if (koCheck()) return redraw(); redraw();
};
ACT.tcgquit = () => { if (B && !B.over) end(false, true); };
// quitter la page du combat coupe le public et la musique
window.addEventListener("hashchange", () => { if (B && location.hash.indexOf("#/tccg/combat") !== 0) { SFX.crowd(false); SFX.music(false); } });
// IA : se souvient de certaines cases (selon la difficulté), TAG quand son catcheur faiblit, Finisher dès que possible
function aiTurn() {
  if (!B || B.over || B.turn !== "E" || B.busy) return;
  const E = B.E, a = act("E");
  if (E.tags && a.hp < a.max * 0.3) { const nx = E.team.findIndex((f, i) => i !== E.a && f.hp > a.hp); if (nx >= 0) { E.a = nx; E.tags--; say("🔄 L’adversaire fait le TAG : " + act("E").def.name); tagFx(act("E")); redraw(); return setTimeout(aiTurn, 1200); } }
  if (E.fin >= 100) { return finisherFx("E", () => { finisher("E"); if (koCheck()) return redraw(); redraw(); setTimeout(aiTurn, 1000); }); }
  const hidden = B.grid.map((c, i) => (!c.done ? i : -1)).filter(i => i >= 0), mem = {};
  Object.keys(B.known).forEach(i => { if (Math.random() < B.mem && !B.grid[i].done) (mem[B.known[i]] = mem[B.known[i]] || []).push(+i); });
  const pair = Object.keys(mem).find(t => mem[t].length >= 2);
  let first = pair ? mem[pair][0] : hidden[Math.floor(Math.random() * hidden.length)];
  flip(first, "E");
  setTimeout(() => {
    if (!B || B.over) return;
    const t = B.grid[first].t, known = Object.keys(B.known).map(Number).filter(i => i !== first && B.known[i] === t && !B.grid[i].done && Math.random() < B.mem + 0.15);
    const rest = hidden.filter(i => i !== first);
    const second = pair ? mem[pair][1] : known.length ? known[0] : rest[Math.floor(Math.random() * rest.length)];
    flip(second, "E");
  }, 700);
}
// fin du combat : animation, musique, récompenses
function end(win, quit) {
  if (B.over) return true; B.over = true;
  const T = TIER[B.tier], rew = { money: 0, mom: 0, pop: 0, push: 0, gim: 0, items: [], cards: [], xp: 0, up: 0 };
  const gm = (DIFF[B.diff] || DIFF.low).rew * (0.5 + 0.25 * (B.n || 2)); // gains : difficulté et nombre d'adversaires
  if (win) { rew.money = Math.round(rnd(T.money[0], T.money[1]) * gm); const m = Math.round(rnd(T.mpp[0], T.mpp[1]) * gm); rew.mom = rew.pop = rew.push = m; rew.gim = Math.round(rnd(T.gim[0], T.gim[1]) * gm); rew.xp = Math.round(T.pxp * gm);
    if (Math.random() < T.drop) { const I = items(), w = { C: 50, R: 28, E: 14, L: 6, M: 2 }; const pool = []; I.forEach(x => { const n = x.t === "combat" ? 10 : w[x.g] || 5; for (let i = 0; i < n; i++) pool.push(x.id); }); rew.items.push(pool[Math.floor(Math.random() * pool.length)]); }
    // ceinture (objet d'évolution) : plus de chances en Mid / Top et en difficulté élevée
    if (Math.random() < Math.min(0.6, (BELT_DROP[B.tier] || 0) * (DIFF[B.diff] || DIFF.low).rew)) { const bt = dropBelt(B.F.key ? B.F.key.split("|")[0] : ""); if (bt) rew.items.push(bt); }
    if (B.F.key && T.card) (B.F.src || []).filter(Boolean).forEach(id => { if (Math.random() < T.card * (DIFF[B.diff] || DIFF.low).rew) rew.cards.push(id + "@" + B.F.key); });
  } else if (!quit) { rew.money = Math.round(T.money[0] * (B.tier === "duel" ? 0.27 : 0.2)); if (B.tier === "duel") rew.mom = rew.pop = rew.push = 5; rew.xp = Math.round(T.pxp / 3); }
  dropSave();
  if (B.tier === "duel" && B.F.uid && !quit && DB.addTcgx && S.user) DB.addTcgx({ ty: "duel", from: S.user.uid, to: B.F.uid, fromName: String((S.profile && S.profile.pseudo) || "Joueur").slice(0, 30), toName: String(B.F.oname || "").slice(0, 30), win: !!win, diff: B.diff || "low", n: B.n || 2 }).catch(() => {});
  const k = B.k, team = B.P.team;
  commit(d => {
    ["money", "mom", "pop", "push", "gim"].forEach(r => { d.res[r] += rew[r]; });
    rew.items.forEach(id => { d.items[id] = (d.items[id] || 0) + 1; });
    rew.cards.forEach(id => addCard(d, id));
    rew.up = addXp(d, rew.xp);
    team.forEach(f => { const inst = f.iid && d.cards[f.iid]; if (inst) cardXp(inst, win ? T.cxp : Math.round(T.cxp / 3)); });
    d.cool[k] = Date.now(); if (win) { d.wins++; const day = parisDay(), md = {}; md[day] = ((d.mday || {})[day] || 0) + 1; d.mday = md; }
    Object.keys(d.cool).forEach(c => { if (Date.now() - d.cool[c] > 8 * 864e5) delete d.cool[c]; });
  });
  victory(win, rew, quit);
  return true;
}
function victory(win, rew, quit) {
  SFX.crowd(false); SFX.music(false); SFX.end(win);
  const ov = document.createElement("div"); ov.className = "tvict " + (win ? "win" : "lose");
  ov.innerHTML = '<div class="tvbox"><h1>' + (win ? "VICTOIRE !" : quit ? "Abandon" : "DÉFAITE") + "</h1>" +
    (rew.money || rew.xp ? '<div class="tvrew">' + (rew.money ? "<span>💵 +" + rew.money + "</span>" : "") + (rew.mom ? "<span>⚡ +" + rew.mom + "</span><span>⭐ +" + rew.pop + "</span><span>📣 +" + rew.push + "</span>" : "") + (rew.gim ? "<span>🎟️ +" + rew.gim + "</span>" : "") + (rew.xp ? "<span>XP +" + rew.xp + (rew.up ? " · niveau +" + rew.up + " !" : "") + "</span>" : "") + "</div>" : "") +
    rew.items.map(id => { if (isBelt(id)) { const t = beltTitle(id); return t ? '<p class="tvdrop belt">' + beltImgHTML(t.id, "tvbelt") + " Ceinture gagnée : <b>" + esc(t.n) + "</b></p>" : ""; } const it = itemById(id); return it ? '<p class="tvdrop">🎁 ' + esc(it.ic + " " + it.n) + "</p>" : ""; }).join("") +
    (rew.cards.length ? '<p class="tvdrop">✨ Carte gagnée !</p><div class="trgrid">' + rew.cards.map(id => cardHTML(defOf(id), { small: true })).join("") + "</div>" : "") +
    '<div class="btns"><a class="btn" href="#/tccg/combats" data-close>Combats</a><a class="btn ghost" href="#/tccg" data-close>Accueil</a></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener("click", e => { if (e.target.closest("[data-close]")) { ov.remove(); B = null; prep = null; SFX.crowd(false); SFX.music(false); } });
}
// (ancienne) petite fanfare de victoire (ou thème de défaite) jouée par l'app
function fanfare(win) {
  try {
    const C = new (window.AudioContext || window.webkitAudioContext)(), N = win ? [523, 659, 784, 1047, 784, 1047] : [392, 349, 311, 262], dur = win ? 0.16 : 0.32;
    N.forEach((f, i) => { const o = C.createOscillator(), g = C.createGain(); o.type = win ? "square" : "triangle"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, C.currentTime + i * dur); g.gain.exponentialRampToValueAtTime(0.18, C.currentTime + i * dur + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, C.currentTime + i * dur + dur * (i === N.length - 1 ? 3 : 0.95)); o.connect(g).connect(C.destination); o.start(C.currentTime + i * dur); o.stop(C.currentTime + i * dur + dur * 3.2); });
  } catch (e) {}
}
