// TCCCG — combats (cahier de Jose du 12 nov., le memory est retiré) :
// Event = les vrais matchs des shows des 7 derniers jours, rangés par show ; Match = Match rapide, catcheurs au hasard, défis
// contre les membres. Préparation : 1, 2 ou 3 cartes, un leader (la somme de ses stats = la vie de toute l'équipe), 1 soutien
// (+10 % aux cartes de son type), 2 objets de combat. Plateau : pierre-feuille-ciseaux puis chacun son tour, une carte attaque
// par tour (toucher puis viser, ou glisser la carte sur l'adversaire), on choisit la stat : dégâts = 15 + 3 × l'écart, ×2 avec
// l'avantage de type, ×0,5 sinon ; si sa stat est plus forte, c'est l'attaquant qui prend le coup. Barre de timing, ±10 %.
// Finisher (niveau selon la rareté) sur toute l'équipe + effet au hasard. PIN à 0 PV : barre à arrêter, dégagement possible.
import { S, B as DB, ACT, changed, prof } from "../state.js";
import { esc, toast, lsGet, modal, backLayer } from "../util.js";
import { parisDay } from "../time.js";
import { RAR, STATS, ARCH, ARCHS, typeMult, defOf, statsOf, baseCards, showMatches, showKeyLabel, cfg, items, itemById, versionCard, cardById, finLv, QCH, QNAME, titleOf, realKey, champsNow } from "./data.js";
import { me, commit, owned, addCard, addXp, cardXp, bump } from "./store.js";
import { cardHTML, typeWheel, itemIc } from "./card.js";
import { recentShows } from "./callup.js";
import { SFX } from "./sfx.js";
import { BELT, BELT_DROP, isBelt, beltTitle, beltImgHTML } from "./evo.js";
import { burst, pop, flash, wave, fireworks, confetti, mid, shake } from "./phaser.js";

const TIER = {
  low: { n: "Catcheurs au hasard", money: [1200, 1800], mpp: [15, 25], gim: [2, 4], drop: 0.08, cxp: 60, pxp: 30, card: 0.02, ko: 0.25 },
  quick: { n: "Match rapide", money: [500, 800], mpp: [6, 10], gim: [1, 2], drop: 0.06, cxp: 40, pxp: 20, card: 0.015, ko: 0.2 },
  mid: { n: "Show de la semaine", money: [2000, 3000], mpp: [30, 45], gim: [4, 7], drop: 0.18, cxp: 100, pxp: 50, card: 0.03, ko: 0.35 },
  top: { n: "PLE / PPV", money: [3500, 5000], mpp: [55, 80], gim: [7, 12], drop: 0.30, cxp: 160, pxp: 80, card: 0.08, ko: 0.45 },
  duel: { n: "Défi entre membres", money: [1500, 2200], mpp: [15, 25], gim: [2, 3], drop: 0, cxp: 60, pxp: 40, card: 0, ko: 0.4 }
};
// difficulté de l'IA : Low = normal, Mid = un peu plus fort, Top = stats doublées
export const DIFF = { low: { n: "Low", d: "Normal", st: 1, rew: 1, ai: 0.35, ko: 0.8 }, mid: { n: "Mid", d: "Adversaire un peu plus fort", st: 1.3, rew: 1.6, ai: 0.7, ko: 1 }, top: { n: "Top", d: "Stats de l’adversaire doublées", st: 2, rew: 2.6, ai: 0.95, ko: 1.25 } };
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
const nf = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const pct = v => String(Math.round(v * 1000) / 10).replace(".", ",") + " %";
const cooldown = () => (cfg().fight && +cfg().fight.cool) || 60; // minutes
const coolLeft = (d, k) => Math.max(0, (d.cool[k] || 0) + cooldown() * 6e4 - Date.now());
const leftTxt = ms => { const m = Math.ceil(ms / 6e4); return m >= 60 ? Math.floor(m / 60) + " h " + (m % 60) : m + " min"; };
const sum = a => a.reduce((x, y) => x + y, 0);
const DUR = r => RAR.indexOf(r) >= 4 ? 3 : r === "SSR" ? 2 : 1; // durée des effets selon la rareté
const typeChain = () => ARCHS.map(a => '<b style="color:' + ARCH[a].c + '">' + a + "</b>").join(" ▶ ") + ' ▶ <b style="color:' + ARCH[ARCHS[0]].c + '">' + ARCHS[0] + "</b>";

// ---------- les shows de la semaine (Event) ----------
export function fightShows() {
  const C = cfg().fight || {}, deny = C.deny || [], allow = C.allow || [], seen = {}, out = [];
  recentShows(7).concat(allow.filter(k => (S.highlights || {})[k])).forEach(key => {
    const p = key.split("|"), sk = p[0] + "|" + p[1];
    if (deny.indexOf(key) >= 0 || (seen[sk] && allow.indexOf(key) < 0)) return; seen[sk] = 1;
    const M = showMatches(key); if (M.length) out.push({ key: key, ple: p[1] === "PLE", matches: M });
  });
  return out;
}
const gainLine = (tier, card) => { const T = TIER[tier]; return '<small class="tgline">💵 ' + nf(T.money[0]) + "–" + nf(T.money[1]) + (T.drop ? " · 🎁 " + pct(T.drop) : "") + (card && T.card ? " · 🃏 " + pct(T.card) : "") + " · plus en Mid / Top</small>"; };
let evShow = "";
ACT.tcgevshow = el => { evShow = el.dataset.k || ""; changed("tcg"); };
export function eventView() {
  const d = me(), F = fightShows();
  let h = '<section class="tccghead"><h1>Event</h1></section>' + resumeBox() + '<p class="tnote">Chaque show de la vraie vie est un event : choisis un vrai match, la difficulté, puis ton équipe. Un show reste 7 jours puis disparaît. Chaque match se refait 1 h plus tard.</p>';
  if (!F.length) return h + '<p class="tnote">Pas de show de la semaine avec des résultats pour l’instant.</p>';
  if (!F.find(s => s.key === evShow)) evShow = F[0].key;
  h += '<div class="tevchips">' + F.map(s => { const p = s.key.split("|"); return '<button class="tevchip' + (s.key === evShow ? " on" : "") + (s.ple ? " ple" : "") + '" data-act="tcgevshow" data-k="' + esc(s.key) + '"><b>' + esc(s.ple ? showKeyLabel(s.key) : p[1]) + "</b><small>" + esc(p[0]) + " · " + esc(p[2].slice(8) + "/" + p[2].slice(5, 7)) + "</small></button>"; }).join("") + "</div>";
  const s = F.find(x => x.key === evShow), left = Math.max(1, 7 - Math.floor((Date.parse(parisDay()) - Date.parse(s.key.split("|")[2])) / 864e5));
  h += "<h2>" + (s.ple ? "👑 " : "") + esc(showKeyLabel(s.key)) + ' <small class="tsmall">' + esc(s.key.split("|")[0]) + " · disparaît dans " + left + " j" + (s.ple ? " · IA plus forte, meilleurs gains" : "") + "</small></h2>";
  h += s.matches.map((m, i) => { const k = s.key + "#" + i, cl = coolLeft(d, k);
    return '<div class="tfcard' + (s.ple ? " ple" : "") + '"><div class="tfvs">' + m.cards.slice(0, 2).map(c => '<span class="tfface" style="background-image:url(\'' + esc(c.pic) + '\')"></span>').join("<i>VS</i>") + "</div><b>" + esc(m.cards.map(c => c.name).slice(0, 4).join(" · ")) + "</b>" + gainLine(s.ple ? "top" : "mid", true) +
      (cl ? '<span class="tcool">⏳ ' + leftTxt(cl) + "</span>" : '<button class="btn small" data-act="tcgprep" data-k="' + esc(k) + '">Combattre</button>') + "</div>"; }).join("");
  return h;
}
// ---------- Match : Match rapide, catcheurs au hasard, membres ----------
const seedOf = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function randomList() {
  const P = baseCards().filter(c => c.pic && !c.custom); if (!P.length) return [];
  const day = parisDay(), out = []; let h = seedOf(day);
  for (let i = 0; i < 40 && out.length < 8; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; const c = P[h % P.length]; if (out.indexOf(c) < 0) out.push(c); }
  return out;
}
export function matchView(sub) {
  const d = me(), tab = sub === "membres" ? "membres" : "";
  let h = '<section class="tccghead"><h1>Match</h1></section>' + resumeBox() +
    '<button class="tquick" data-act="tcgprep" data-k="quick"><b>⚡ MATCH RAPIDE</b><small>Un adversaire au hasard, une IA moins forte · petits gains : argent, objets, équipement, parfois une carte</small></button>' +
    '<nav class="tsub"><a class="' + (tab ? "" : "on") + '" href="#/tccg/match">🎲 Catcheurs au hasard</a><a class="' + (tab ? "on" : "") + '" href="#/tccg/match/membres">👥 Contre les membres</a></nav>';
  if (tab === "membres") {
    const L = (S.tcgAll || []).filter(o => o.uid !== (S.user && S.user.uid) && Object.keys(o.cards || {}).length >= 1);
    if (!S.tcgAll) { loadAll(); return h + '<p class="tnote">Chargement des membres…</p>'; }
    h += '<p class="tnote">Affronte l’équipe d’un autre membre, menée par l’IA. Sans limite : de l’argent et des ressources à chaque combat.</p>';
    return h + (L.length ? '<div class="list">' + L.map(o => { const p = prof(o.uid);
      return '<div class="item"><span class="lbl"><b>' + esc(o.name || (p && p.pseudo) || "Joueur") + "</b><small>Niveau " + (o.lvl || 1) + " · " + Object.keys(o.cards || {}).length + " cartes · " + (o.wins || 0) + ' victoires</small></span><button class="btn small" data-act="tcgprep" data-k="duel:' + esc(o.uid) + '">Défier</button></div>'; }).join("") + "</div>" : '<p class="tnote">Personne à défier pour l’instant.</p>');
  }
  h += '<p class="tnote">8 catcheurs tirés au hasard chaque jour. Chacun se refait 1 h plus tard.</p><div class="trgrid trnd">' + randomList().map(c => { const k = "rnd:" + c.id, cl = coolLeft(d, k);
    return '<div class="trndc">' + cardHTML(c, { small: true }) + (cl ? '<span class="tcool">⏳ ' + leftTxt(cl) + "</span>" : '<button class="btn small" data-act="tcgprep" data-k="' + esc(k) + '">Affronter</button>') + "</div>"; }).join("") + "</div>";
  return h;
}
export const loadAll = () => DB.listTcg ? DB.listTcg().then(L => { S.tcgAll = L || []; changed("tcg"); return S.tcgAll; }).catch(() => { S.tcgAll = S.tcgAll || []; return S.tcgAll; }) : Promise.resolve([]);

// ---------- adversaires d'un combat ----------
const pickN = (L, n, not) => { const out = [], A = L.filter(c => !not || not.indexOf(c) < 0); while (out.length < n && A.length) out.push(A.splice(Math.floor(Math.random() * A.length), 1)[0]); return out; };
function foesOf(k) {
  if (k === "quick") { const P = baseCards().filter(c => c.pic && (c.r === "N" || c.r === "R")), L = pickN(P.length >= 3 ? P : baseCards(), 4); return { tier: "quick", label: "Match rapide", pool: L.map(c => ({ def: c, lv: 1 + Math.floor(Math.random() * 6) })), quick: true }; }
  if (k.indexOf("rnd:") === 0) {
    const c = cardById(k.slice(4)); if (!c) return null;
    const al = pickN(baseCards().filter(x => x.pic && x.k === c.k && x.id !== c.id), 3);
    return { tier: "low", label: c.name + " et ses alliés", pool: [{ def: c, lv: 4 + Math.floor(Math.random() * 8), src: c }].concat(al.map(x => ({ def: x, lv: 3 + Math.floor(Math.random() * 6) }))) };
  }
  if (k.indexOf("duel:") === 0) {
    const uid = k.slice(5), o = (S.tcgAll || []).find(x => x.uid === uid); if (!o) return null;
    const L = Object.keys(o.cards || {}).map(iid => Object.assign({ iid: iid }, o.cards[iid])).filter(x => defOf(x.c)).sort((a, b) => sum(statsOf(b)) - sum(statsOf(a))).slice(0, 6);
    return { tier: "duel", label: "Défi contre " + (o.name || "un membre"), pool: L.map(x => ({ def: defOf(x.c), lv: x.lv || 1, inst: x })), uid: uid, oname: o.name || "" };
  }
  const key = k.split("#")[0], i = +k.split("#")[1], s = fightShows().find(x => x.key === key); if (!s) return null;
  const m = s.matches[i]; if (!m) return null;
  const L = m.sides[0].concat(m.sides[1]).filter((c, j, a) => a.indexOf(c) === j).sort((x, y) => x.name.localeCompare(y.name));
  const lv = () => s.ple ? 12 + Math.floor(Math.random() * 10) : 3 + Math.floor(Math.random() * 8);
  const pool = L.map(c => ({ def: versionCard(c, key), lv: lv(), src: c }));
  // pour un 3 contre 3, des alliés de la même promotion complètent l'équipe adverse
  if (pool.length < 3) pickN(baseCards().filter(c => c.pic && c.k === key.split("|")[0] && L.indexOf(c) < 0), 3 - pool.length).forEach(c => pool.push({ def: c, lv: lv(), ally: true }));
  return { tier: s.ple ? "top" : "mid", label: showKeyLabel(key) + " · " + L.map(c => c.name).slice(0, 6).join(" · "), pool: pool, key: key };
}
// ---------- préparation ----------
let prep = null;
ACT.tcgprep = el => {
  const d = me(), L = owned(d);
  if (L.length < 1) { toast("Il te faut au moins 1 carte : ouvre tes boosters gratuits"); location.hash = "#/tccg/callup"; return; }
  if (el.dataset.k.indexOf("duel:") === 0 && !S.tcgAll) { loadAll().then(() => ACT.tcgprep(el)); return; }
  const F = foesOf(el.dataset.k); if (!F) { toast("Combat introuvable"); return; }
  const n = Math.min(3, F.pool.length, Math.max(1, L.length));
  prep = { k: el.dataset.k, F: F, n: Math.min(2, n) || 1, foes: [], team: [], lead: "", sup: "", items: [], diff: "low" };
  prep.foes = F.pool.map((f, i) => i).slice(0, prep.n);
  location.hash = "#/tccg/combat-prep";
};
const teamBonus = (d, iid, supIid) => { const s = supIid && d.cards[supIid], a = d.cards[iid]; return s && a && (defOf(s.c) || {}).arch === (defOf(a.c) || {}).arch ? 1.1 : 1; };
function gainsBox(F, diff, n) {
  const T = TIER[F.tier], D = DIFF[diff] || DIFF.low, gm = (F.quick ? 1 : D.rew) * (0.6 + 0.2 * n), rg = a => nf(Math.round(a[0] * gm)) + "–" + nf(Math.round(a[1] * gm));
  const L = ["💵 " + rg(T.money), "⚡⭐📣 " + rg(T.mpp) + " de chaque", "🎟️ " + rg(T.gim) + " gimmicks", "✨ XP joueur et cartes"];
  if (T.drop) L.push("🎁 Un objet ou un équipement : " + pct(T.drop));
  const src = F.pool.filter(f => f.src);
  if (T.card) src.forEach(f => L.push("🃏 Carte « " + esc(f.src.name) + " »" + (F.key ? " version du show" : "") + " : " + pct(T.card * (F.quick ? 1 : D.rew))));
  else L.push('<span class="tno">🃏 Pas de carte à gagner sur ce combat</span>');
  const ch = champsNow(), belts = F.pool.filter(f => ch.has(realKey(f.src || f.def)));
  if (belts.length && BELT_DROP[F.tier]) L.push("🏆 Ceinture de " + esc((belts[0].src || belts[0].def).name) + " (champion en vrai) : " + pct(Math.min(0.6, BELT_DROP[F.tier] * D.rew)));
  return '<div class="tgains"><b>🎁 À gagner si tu gagnes</b><ul>' + L.map(x => "<li>" + x + "</li>").join("") + "</ul></div>";
}
export function prepView() {
  if (!prep) return eventView();
  const d = me(), F = prep.F, n = prep.n, L = owned(d).sort((a, b) => sum(statsOf(b)) - sum(statsOf(a)));
  prep.team = prep.team.filter(i => d.cards[i]).slice(0, n); if (prep.lead && prep.team.indexOf(prep.lead) < 0) prep.lead = ""; if (!prep.lead) prep.lead = prep.team[0] || "";
  if (prep.sup && (!d.cards[prep.sup] || prep.team.indexOf(prep.sup) >= 0)) prep.sup = "";
  while (prep.foes.length > n) prep.foes.pop();
  const foes = prep.foes.map(i => F.pool[i]).filter(Boolean), fa = foes.map(f => f.def.arch);
  const adv = x => { const a = (defOf(x.c) || {}).arch, up = fa.filter(f => typeMult(a, f) === 2).length, dn = fa.filter(f => typeMult(a, f) === 0.5).length; return up || dn ? '<span class="tadv' + (up && dn ? " mix" : up ? " up" : " dn") + '">' + (up ? "▲" : "") + (dn ? "▼" : "") + "</span>" : ""; };
  const life = prep.lead && d.cards[prep.lead] ? sum(statsOf(Object.assign({ iid: prep.lead }, d.cards[prep.lead]))) : 0;
  const combatItems = items().filter(x => x.t === "combat" && (d.items[x.id] || 0) > 0);
  let h = '<a class="back" href="' + (prep.k.indexOf("#") > 0 ? "#/tccg/event" : "#/tccg/match") + '">‹ Retour</a><h1 style="margin:4px 16px">' + esc(F.label) + "</h1>";
  h += '<h2>1. Format</h2><div class="tdiff">' + [1, 2, 3].map(k => '<button class="tdf' + (n === k ? " on" : "") + '" data-act="tcgfmt" data-v="' + k + '"' + (k > F.pool.length ? " disabled" : "") + "><b>" + k + " contre " + k + "</b></button>").join("") + "</div>";
  h += '<h2>2. Tes adversaires <small class="tsmall">' + foes.length + " / " + n + '</small></h2><div class="tfoes">' + F.pool.map((f, i) => '<button class="tfoe' + (prep.foes.indexOf(i) >= 0 ? " on" : "") + '" data-act="tcgfoe" data-i="' + i + '"><span class="tfface" style="background-image:url(\'' + esc(f.def.pic || "") + '\')"></span><b>' + esc(f.def.name) + "</b><small>Nv " + f.lv + ' · <i style="color:' + (ARCH[f.def.arch] || {}).c + '">' + esc(f.def.arch) + "</i>" + (f.ally ? " · allié" : "") + "</small></button>").join("") + "</div>";
  h += '<div class="ttchart">' + typeWheel(64) + "<div><b>Tableau des types</b><p>" + typeChain() + "</p><small>Avantage : dégâts ×2 · désavantage : ×0,5. ▲ = ta carte bat un adversaire choisi, ▼ = elle est battue.</small></div></div>";
  if (!F.quick && F.tier !== "duel") h += '<h2>3. Difficulté de l’IA</h2><div class="tdiff">' + Object.keys(DIFF).map(k => '<button class="tdf ' + k + (prep.diff === k ? " on" : "") + '" data-act="tcgdiff" data-v="' + k + '"><b>' + DIFF[k].n + "</b><small>" + esc(DIFF[k].d) + (DIFF[k].rew > 1 ? " · gains ×" + String(DIFF[k].rew).replace(".", ",") : "") + "</small></button>").join("") + "</div>";
  h += gainsBox(F, prep.diff, n);
  h += '<h2>4. Ton équipe <small class="tsmall">' + prep.team.length + " / " + n + "</small></h2>" +
    '<div class="tprepteam">' + Array.from({ length: n }, (_, i) => { const iid = prep.team[i], x = iid && d.cards[iid]; return '<div class="tslot2' + (iid && iid === prep.lead ? " lead" : "") + '">' + (x ? cardHTML(Object.assign({ iid: iid }, x), { small: true, act: "tcgpick", iid: iid, badge: adv(x) }) + '<button class="tleadb" data-act="tcglead" data-iid="' + esc(iid) + '">' + (iid === prep.lead ? "👑 Leader" : "Leader ?") + "</button>" : "<span>Carte " + (i + 1) + "</span>") + "</div>"; }).join("") +
    '<div class="tslot2 sup">' + (prep.sup && d.cards[prep.sup] ? cardHTML(Object.assign({ iid: prep.sup }, d.cards[prep.sup]), { small: true, act: "tcgpick", iid: prep.sup }) : "<span>Soutien<br><small>+10 % à son type</small></span>") + "</div></div>" +
    '<p class="tnote">' + (life ? "❤️ Vie de ton équipe = stats du leader = <b>" + life + "</b>. " : "") + "Touche des cartes ci-dessous : d’abord " + n + " carte" + (n > 1 ? "s" : "") + ", puis 1 soutien (bonus +10 % aux cartes de son type). « Leader ? » pour choisir le leader.</p>";
  if (combatItems.length) h += '<h2>5. Objets <small class="tsmall">2 au plus, un seul usage</small></h2><div class="tfilt">' + combatItems.map(x => '<button class="chip' + (prep.items.indexOf(x.id) >= 0 ? " on" : "") + '" data-act="tcgitem" data-id="' + x.id + '">' + itemIc(x) + " " + esc(x.n) + " ×" + d.items[x.id] + " · " + Math.round(QCH[x.q || "commun"] * 100) + " %</button>").join("") + "</div>";
  h += '<button class="btn wide gold" style="margin:8px 16px;width:calc(100% - 32px)" data-act="tcgfight"' + (prep.team.length === n && foes.length === n ? "" : " disabled") + ">⚔️ Lancer le combat</button>";
  h += '<div class="trgrid">' + L.filter(x => prep.team.indexOf(x.iid) < 0 && prep.sup !== x.iid).map(x => cardHTML(x, { small: true, act: "tcgpick", iid: x.iid, badge: adv(x) })).join("") + "</div>";
  return h;
}
ACT.tcgfmt = el => { if (!prep) return; const v = +el.dataset.v; prep.n = v; const F = prep.F; prep.foes = prep.foes.slice(0, v); for (let i = 0; prep.foes.length < v && i < F.pool.length; i++) if (prep.foes.indexOf(i) < 0) prep.foes.push(i); changed("tcg"); };
ACT.tcgfoe = el => { if (!prep) return; const i = +el.dataset.i, j = prep.foes.indexOf(i); if (j >= 0) prep.foes.splice(j, 1); else { if (prep.foes.length >= prep.n) prep.foes.shift(); prep.foes.push(i); } changed("tcg"); };
ACT.tcgdiff = el => { if (prep && DIFF[el.dataset.v]) { prep.diff = el.dataset.v; changed("tcg"); } };
ACT.tcglead = el => { if (prep) { prep.lead = el.dataset.iid; changed("tcg"); } };
ACT.tcgpick = el => {
  if (!prep) return; const iid = el.dataset.iid;
  if (prep.team.indexOf(iid) >= 0) prep.team = prep.team.filter(x => x !== iid);
  else if (prep.sup === iid) prep.sup = "";
  else if (prep.team.length < prep.n) prep.team.push(iid);
  else if (!prep.sup) prep.sup = iid;
  else toast("Équipe complète : touche une carte choisie pour la retirer");
  changed("tcg");
};
ACT.tcgitem = el => { if (!prep) return; const id = el.dataset.id, i = prep.items.indexOf(id); if (i >= 0) prep.items.splice(i, 1); else if (prep.items.length < 2) prep.items.push(id); else toast("2 objets au plus"); changed("tcg"); };

// ---------- le combat ----------
let B = null;
const SKEY = () => "ctv.tcgfight." + ((S.user && S.user.uid) || "x");
function persist() { if (!B || B.over) return; try { localStorage.setItem(SKEY(), JSON.stringify(Object.assign({}, B, { busy: false, saved: Date.now() }))); } catch (e) {} }
function dropSave() { try { localStorage.removeItem(SKEY()); } catch (e) {} }
function savedFight() { try { const o = JSON.parse(lsGet(SKEY()) || "null"); if (!o || o.v !== 2 || Date.now() - (o.saved || 0) > 3 * 864e5) return null; return o; } catch (e) { return null; } }
function restore() { const o = savedFight(); if (!o) return false; if (!o.P.cards.every(c => defOf(c.id)) || !o.E.cards.every(c => defOf(c.id))) { dropSave(); return false; } o.busy = false; B = o; return true; }
function resumeBox() { const o = savedFight(); return o ? '<div class="tfcard resume"><b>⏸️ Combat en cours</b><small>' + esc((o.F && o.F.label) || "") + '</small><span class="repbtns"><button class="btn small" data-act="tcgresume">Reprendre</button><button class="btn small ghost" data-act="tcgdrop">Abandonner</button></span></div>' : ""; }
export const resumeHome = resumeBox;
ACT.tcgresume = () => { if (!B && !restore()) { toast("Plus de combat en cours"); changed("tcg"); return; } location.hash = "#/tccg/combat"; SFX.unlock(); SFX.crowd(true); SFX.music(true); setTimeout(() => { if (B && B.turn === "E" && !B.over) aiTurn(); else if (B && B.pin) pinStep(); }, 1200); };
ACT.tcgdrop = () => { if (!B) restore(); if (B && !B.over) end(false, true); else { dropSave(); changed("tcg"); } };

// une carte sur le plateau : { iid, id, r, lv, st (stats), arch, name, stun (tour jusqu'auquel elle est étourdie) }
function fighter(def, lv, inst, r, mult) {
  const st = inst ? statsOf(inst, def) : def.st.map(v => Math.round(v + (lv - 1) * 1.2 / 5));
  const pw = (inst && inst.pw) || "";
  return { iid: inst && inst.iid || "", id: def.id, r: r || (inst && inst.r) || def.r, lv: lv || 1, st: st.map(v => Math.round(v * (mult || 1) * (pw === "aura" ? 1.08 : 1))), arch: def.arch, name: def.name, stun: -1, pw: pw, inst: inst ? { c: inst.c, r: inst.r, lv: inst.lv, tr: inst.tr, eq: inst.eq, pw: inst.pw } : null };
}
// pouvoir « Partenaire fidèle » : +5 % de stats aux autres cartes de l'équipe
const partner = L => { L.forEach((c, i) => { if (c.pw === "tag") L.forEach((o, j) => { if (j !== i) o.st = o.st.map(v => Math.round(v * 1.05)); }); }); return L; };
const side = (cards, lead) => { const hp = Math.max(30, sum(cards[lead].st)); return { cards: cards, lead: lead, hp: hp, max: hp, fin: 0, items: [], used: [], boostU: -1, divU: -1, next: 1, kick: 0 }; };
ACT.tcgfight = () => {
  if (!prep) return; const d = me(), n = prep.n;
  if (prep.team.length !== n) return toast("Choisis " + n + " carte" + (n > 1 ? "s" : ""));
  const F = prep.F, D = DIFF[prep.diff] || DIFF.low, mult = F.quick ? 0.85 : F.tier === "duel" ? 1 : D.st;
  const mine = prep.team.map(iid => { const x = Object.assign({ iid: iid }, d.cards[iid]), f = fighter(defOf(x.c), x.lv, x); const bo = teamBonus(d, iid, prep.sup); f.st = f.st.map(v => Math.round(v * bo)); f.sup = bo > 1; return f; });
  const foes = prep.foes.map(i => F.pool[i]).filter(Boolean).map(f => fighter(f.def, f.lv, f.inst || null, f.inst && f.inst.r, mult));
  partner(mine); partner(foes);
  const lead = Math.max(0, prep.team.indexOf(prep.lead)), elead = foes.reduce((bi, f, i) => sum(f.st) > sum(foes[bi].st) ? i : bi, 0);
  B = { v: 2, k: prep.k, F: { label: F.label, tier: F.tier, key: F.key || "", uid: F.uid || "", oname: F.oname || "", quick: !!F.quick, src: prep.foes.map(i => F.pool[i] && F.pool[i].src ? F.pool[i].src.id : "").filter(Boolean), champ: prep.foes.map(i => F.pool[i]).filter(Boolean).map(f => (f.src || f.def).rn || (f.src || f.def).name) },
    tier: F.tier, diff: prep.diff, n: n, P: side(mine, lead), E: side(foes, elead), T: 0, turn: "", over: false, pin: "", log: "Pierre, feuille, ciseaux : qui commence ?", sel: -1 };
  B.P.items = prep.items.slice(0, 2);
  persist(); location.hash = "#/tccg/combat"; SFX.unlock(); SFX.bell(3); SFX.crowd(true); SFX.music(true);
};
const other = s => s === "P" ? "E" : "P";
const stunned = (sd, i) => B[sd].cards[i].stun >= B.T;
const mods = sd => (B[sd].boostU >= B.T ? 1.5 : 1) * (B[sd].divU >= B.T ? 0.5 : 1);
// calcul d'une attaque (sans timing ni hasard) : qui prend combien
function calc(sd, ai, ti, si, noNext) {
  const A = B[sd], Dd = B[other(sd)], a = A.cards[ai], t = Dd.cards[ti], diff = a.st[si] - t.st[si];
  // pouvoirs : Coup critique ×1,15, Entrée fracassante ×1,5 (1re attaque), Tueur de géants ×1,25, Garde haute −15 %
  if (diff >= 0) { const m = typeMult(a.arch, t.arch), pw = (a.pw === "crit" ? 1.15 : 1) * (a.pw === "entree" && !a.hit1 ? 1.5 : 1) * (a.pw === "geant" && sum(t.st) > sum(a.st) ? 1.25 : 1) * (t.pw === "garde" ? 0.85 : 1);
    return { to: other(sd), dmg: Math.round((15 + 3 * diff) * m * mods(sd) * (noNext ? 1 : A.next) * pw), m: m, diff: diff }; }
  const m = typeMult(t.arch, a.arch); return { to: sd, dmg: Math.round((15 + 3 * -diff) * m * mods(other(sd)) * (a.pw === "garde" ? 0.85 : 1) * (t.pw === "crit" ? 1.15 : 1)), m: m, diff: diff };
}
const mTxt = m => m === 2 ? " · avantage de type ×2" : m === 0.5 ? " · désavantage ×0,5" : "";
function hpBar(sd) { const X = B[sd], p = Math.max(0, Math.round(X.hp / X.max * 100)); return '<div class="tbhp ' + sd + '"><span class="tbhpt">❤️ ' + Math.max(0, X.hp) + " / " + X.max + '</span><i style="width:' + p + '%" class="' + (p > 50 ? "g" : p > 25 ? "y" : "r") + '"></i></div><div class="tbfin ' + (X.fin >= 100 ? "full" : "") + '"><span>🔥 FINISHER ' + Math.min(100, Math.round(X.fin)) + ' %</span><i style="width:' + Math.min(100, X.fin) + '%"></i></div>'; }
function cardsRow(sd) {
  const X = B[sd];
  return '<div class="tbrow ' + sd + '">' + X.cards.map((c, i) => '<div class="tbc' + (i === X.lead ? " lead" : "") + (sd === "P" && B.sel === i ? " sel" : "") + (stunned(sd, i) ? " stun" : "") + '" data-side="' + sd + '" data-i="' + i + '">' +
    cardHTML(c.inst || { c: c.id, r: c.r, lv: c.lv }, { small: true, nozoom: true }) + '<span class="tbtype" style="background:' + (ARCH[c.arch] || {}).c + '">' + esc(c.arch) + "</span>" + (i === X.lead ? '<span class="tblead">👑</span>' : "") + (stunned(sd, i) ? '<span class="tbstun">💫</span>' : "") + (c.sup ? '<span class="tbsup">+10 %</span>' : "") + "</div>").join("") + "</div>";
}
export function combatView() {
  if (!B && !restore()) return eventView();
  const P = B.P, E = B.E, bg = (cfg().assets || {}).fightbg, my = B.turn === "P" && !B.busy && !B.over && !B.pin;
  let h = '<div class="tbat"' + (bg ? ' style="background-image:linear-gradient(rgba(5,4,3,.6),rgba(5,4,3,.85)),url(\'' + esc(bg) + '\')"' : "") + ">" +
    '<div class="tbtop"><button class="tbquit" data-act="tcgquit" aria-label="Abandonner">✕</button><span class="tblabel">' + esc(B.F.label) + (B.diff && B.diff !== "low" && !B.F.quick ? ' · <b class="tdtag ' + B.diff + '">' + DIFF[B.diff].n + "</b>" : "") + '</span><button class="tbwheel" data-act="tcgtypes" aria-label="Tableau des types">' + typeWheel(30) + "</button></div>" +
    '<div class="tbsideE">' + hpBar("E") + cardsRow("E") + "</div>" +
    '<div class="tbmid"><div class="tbturn ' + (B.turn === "P" ? "me" : B.turn === "E" ? "foe" : "") + '">' + (B.pin ? "🤼 TOMBÉ !" : !B.turn ? "✊ ✋ ✌️" : B.turn === "P" ? "▶ À TOI DE JOUER" : "⏳ TOUR DE L’ADVERSAIRE") + '</div><p class="tblog">' + esc(B.log) + "</p></div>" +
    '<div class="tbsideP">' + cardsRow("P") + hpBar("P") + "</div>";
  if (!B.turn) h += '<div class="trps">' + [["p", "✊", "Pierre"], ["f", "✋", "Feuille"], ["c", "✌️", "Ciseaux"]].map(x => '<button data-act="tcgrps" data-v="' + x[0] + '"><span>' + x[1] + "</span><small>" + x[2] + "</small></button>").join("") + "</div>";
  else if (B.pin === "P" && !B.over) h += '<button class="tbpin" data-act="tcgpin">🤼 PIN !</button>';
  else h += '<div class="tbbtns">' + (P.fin >= 100 ? '<button class="btn gold tbfinb" data-act="tcgfinpick"' + (my ? "" : " disabled") + ">🔥 FINISHER</button>" : "") +
    P.items.map(id => { const it = itemById(id); return it ? '<button class="btn small ghost" data-act="tcguse" data-id="' + id + '"' + (P.used.indexOf(id) >= 0 || !my ? " disabled" : "") + ">" + itemIc(it) + " " + esc(it.n) + "</button>" : ""; }).join("") +
    '<small class="tbhelp">' + (my ? (B.sel >= 0 ? "Touche la carte adverse à attaquer (ou glisse ta carte dessus)" : "Touche une de tes cartes pour attaquer · touche une carte adverse pour voir ses stats") : "") + "</small></div>";
  return h + "</div>";
}
const redraw = () => { changed("tcg"); persist(); };
const say = t => { B.log = t; };
const el = (sd, i) => document.querySelector('.tbc[data-side="' + sd + '"][data-i="' + i + '"]');
const wait = ms => new Promise(r => setTimeout(r, ms));
// pierre-feuille-ciseaux du tout premier tour
ACT.tcgrps = btn => {
  if (!B || B.turn) return; const me_ = btn.dataset.v, ai = ["p", "f", "c"][Math.floor(Math.random() * 3)], ic = { p: "✊", f: "✋", c: "✌️" }, beats = { p: "c", f: "p", c: "f" };
  if (me_ === ai) { say("Égalité " + ic[me_] + " contre " + ic[ai] + " : on recommence !"); return redraw(); }
  B.turn = beats[me_] === ai ? "P" : "E"; B.first = B.turn;
  say(ic[me_] + " contre " + ic[ai] + " : " + (B.turn === "P" ? "tu commences !" : "l’adversaire commence."));
  redraw(); if (B.turn === "E") setTimeout(aiTurn, 1400);
};
// toucher une carte : choisir l'attaquant, puis la cible ; sinon voir les stats adverses
document.addEventListener("click", e => {
  const c = e.target.closest && e.target.closest(".tbat .tbc"); if (!c || !B) return;
  if (Date.now() - dragEnd < 300) return;
  const sd = c.dataset.side, i = +c.dataset.i, my = B.turn === "P" && !B.busy && !B.over && !B.pin;
  if (B.finPick && sd === "P") { B.finPick = false; return finConfirm(i); }
  if (sd === "P") { if (!my) return; if (stunned("P", i)) { toast("💫 Cette carte est étourdie"); return; } B.sel = B.sel === i ? -1 : i; return redraw(); }
  if (sd === "E") { if (my && B.sel >= 0) return statPick(B.sel, i); return statsOfFoe(i); }
});
// glisser sa carte sur une carte adverse
let dragEnd = 0;
document.addEventListener("dragstart", e => { if (e.target && e.target.closest && e.target.closest(".tbat, .tsum2, .ttrain, .tbinder")) e.preventDefault(); });
document.addEventListener("pointerdown", e => {
  const c = e.target.closest && e.target.closest('.tbat .tbc[data-side="P"]'); if (!c || !B || B.turn !== "P" || B.busy || B.pin || B.over) return;
  const i = +c.dataset.i; if (stunned("P", i)) return;
  const x0 = e.clientX, y0 = e.clientY; let ghost = null;
  const mv = ev => { const dx = ev.clientX - x0, dy = ev.clientY - y0; if (!ghost && Math.abs(dx) + Math.abs(dy) > 14) { ghost = c.cloneNode(true); ghost.className += " tbghost"; document.body.appendChild(ghost); } if (ghost) { ghost.style.left = ev.clientX + "px"; ghost.style.top = ev.clientY + "px"; const t = document.elementFromPoint(ev.clientX, ev.clientY), tc = t && t.closest && t.closest('.tbc[data-side="E"]'); document.querySelectorAll(".tbc.tgt").forEach(x => x.classList.remove("tgt")); if (tc) tc.classList.add("tgt"); } };
  const up = ev => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
    if (!ghost) return; ghost.remove(); dragEnd = Date.now(); document.querySelectorAll(".tbc.tgt").forEach(x => x.classList.remove("tgt"));
    const t = document.elementFromPoint(ev.clientX, ev.clientY), tc = t && t.closest && t.closest('.tbc[data-side="E"]'); if (tc) { B.sel = i; statPick(i, +tc.dataset.i); } };
  document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
});
function statsOfFoe(i) {
  const c = B.E.cards[i]; if (!c) return;
  modal((box, close) => {
    box.innerHTML = '<div class="tczoom">' + cardHTML(c.inst || { c: c.id, r: c.r, lv: c.lv }, { nozoom: true }) + "</div><h3>" + esc(c.name) + '</h3><p class="sub"><b style="color:' + ARCH[c.arch].c + '">' + esc(c.arch) + "</b> bat " + esc(ARCH[c.arch].beats) + "</p>" +
      '<table class="tsttab">' + STATS.map((s, k) => "<tr><td>" + s + "</td><td><b>" + c.st[k] + "</b></td></tr>").join("") + "</table>" + (stunned("E", i) ? '<p class="tnote">💫 Étourdie</p>' : "") + '<button class="btn wide ghost" data-close>Fermer</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
  });
}
ACT.tcgtypes = () => modal((box, close) => {
  box.innerHTML = '<h3>Tableau des types</h3><div style="text-align:center">' + typeWheel(150) + "</div><p>" + typeChain() + '</p><div class="list">' + ARCHS.map(a => '<div class="item"><span class="lbl"><b style="color:' + ARCH[a].c + '">' + a + "</b><small>bat " + ARCH[a].beats + " (×2) · battu par " + ARCHS.find(x => ARCH[x].beats === a) + " (×0,5)</small></span></div>").join("") + '</div><button class="btn wide ghost" data-close>Fermer</button>';
  box.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
});
// choisir la stat, voir les dégâts prévus, confirmer
function statPick(ai, ti) {
  if (!B || B.turn !== "P") return; const a = B.P.cards[ai], t = B.E.cards[ti];
  modal((box, close) => {
    box.classList.add("tstatbox");
    box.innerHTML = "<h3>" + esc(a.name) + " ➜ " + esc(t.name) + '</h3><p class="sub">Choisis la stat de l’attaque. Dégâts = 15 + 3 × l’écart' + mTxt(typeMult(a.arch, t.arch)) + "</p>" +
      '<div class="list">' + STATS.map((s, k) => { const c = calc("P", ai, ti, k); return '<button class="item tstat' + (c.to === "E" ? " good" : " bad") + '" data-k="' + k + '"><span class="lbl"><b>' + s + " : " + a.st[k] + " contre " + t.st[k] + "</b><small>" + (c.to === "E" ? "Tu fais ~" + c.dmg + " dégâts" : "⚠️ Sa stat est plus forte : tu prends ~" + c.dmg) + mTxt(c.m) + "</small></span></button>"; }).join("") + "</div>" +
      '<button class="btn wide ghost" data-close>Annuler</button>';
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) { close(); return; }
      const b = e.target.closest("[data-k]"); if (!b) return; const k = +b.dataset.k, c = calc("P", ai, ti, k);
      box.innerHTML = "<h3>Attaquer ?</h3><p>" + (c.to === "E" ? "Tu vas faire environ <b>" + c.dmg + " dégâts</b> à l’équipe adverse." : "⚠️ Attention : sa " + STATS[k] + " est plus forte, <b>c’est toi qui prends environ " + c.dmg + " dégâts</b>.") + '</p><p class="sub">' + STATS[k] + " " + a.st[k] + " contre " + t.st[k] + " → 15 + 3 × " + Math.abs(c.diff) + mTxt(c.m) + ". La barre de timing peut changer le résultat.</p>" +
        '<button class="btn wide gold" data-go>⚔️ Oui, attaquer</button><button class="btn wide ghost" style="margin-top:6px" data-close>Non</button>';
      box.querySelector("[data-go]").addEventListener("click", ev => { ev.stopPropagation(); close(); attack("P", ai, ti, k); });
    });
  });
}
// barre de timing : PARFAIT / BIEN / RATÉ (zone plus petite pour un dégagement de plus en plus dur)
function timing(label, hard) {
  return new Promise(res => {
    const ov = document.createElement("div"); ov.className = "ttiming"; const zg = Math.max(18, 30 * Math.pow(0.75, hard || 0)), zp = Math.max(6, 10 * Math.pow(0.75, hard || 0));
    ov.innerHTML = '<p>' + esc(label || "TAPE AU BON MOMENT !") + '</p><div class="tttrack"><i class="ttgood" style="width:' + zg + '%"></i><i class="ttperf" style="width:' + zp + '%"></i><i class="ttcur"></i></div><small>Zone dorée = PARFAIT</small>';
    document.body.appendChild(ov);
    const cur = ov.querySelector(".ttcur"), t0 = performance.now(), sp = 1500 / (1 + 0.25 * (hard || 0)); let done = false, raf = 0, pos = 0;
    const loop = t => { pos = ((t - t0) % sp) / sp; const x = pos < 0.5 ? pos * 2 : 2 - pos * 2; cur.style.left = (x * 100) + "%"; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const fin = () => { if (done) return; done = true; cancelAnimationFrame(raf); const x = parseFloat(cur.style.left) || 0, dd = Math.abs(x - 50), r = dd <= zp / 2 ? "perfect" : dd <= zg / 2 ? "good" : "miss";
      ov.classList.add("r-" + r); ov.querySelector("p").textContent = { perfect: "PARFAIT !", good: "BIEN", miss: "RATÉ" }[r];
      if (r === "perfect") { const p = mid(ov.querySelector(".ttperf")); burst(p[0], p[1], 18); }
      setTimeout(() => { ov.remove(); res(r); }, 450); };
    setTimeout(() => ov.addEventListener("pointerdown", fin), 150);
    setTimeout(fin, 3200);
  });
}
// une attaque, avec animation : la carte fonce sur sa cible, éclats, dégâts
async function attack(sd, ai, ti, si) {
  if (!B || B.busy || B.over) return; B.busy = true; B.sel = -1; redraw();
  const A = B[sd], c = calc(sd, ai, ti, si);
  let tq = "good";
  if (sd === "P") tq = await timing(c.to === "E" ? "FRAPPE AU BON MOMENT !" : "PROTÈGE-TOI : TAPE AU BON MOMENT !");
  else { const q = (DIFF[B.diff] || DIFF.low).ai; const r = Math.random(); tq = r < q * 0.4 ? "perfect" : r < 0.4 + q * 0.4 ? "good" : "miss"; }
  let dmg = c.dmg * (0.9 + Math.random() * 0.2);
  if (c.to !== sd) dmg *= { perfect: 1.3, good: 1, miss: 0.8 }[tq]; else dmg *= { perfect: 0.5, good: 1, miss: 1.2 }[tq];
  dmg = Math.max(1, Math.round(dmg)); A.next = 1;
  const a = A.cards[ai], t = B[other(sd)].cards[ti];
  // animation
  const ae = el(sd, ai), te = el(other(sd), ti);
  if (ae && te) { const ra = ae.getBoundingClientRect(), rt = te.getBoundingClientRect(); ae.style.transition = "transform .18s ease-in"; ae.style.transform = "translate(" + (rt.left - ra.left) * 0.8 + "px," + (rt.top - ra.top) * 0.8 + "px) scale(1.08)"; ae.style.zIndex = 5; }
  await wait(190);
  const hitEl = c.to === sd ? ae : te, p = hitEl ? mid(hitEl) : [innerWidth / 2, innerHeight / 2];
  burst(p[0], p[1], c.m === 2 ? 40 : 24); pop(p[0], p[1] - 30, "-" + dmg, c.to === "P" ? "#ff6b5a" : "#f0cf62", c.m === 2 ? 36 : 28); SFX.hit(c.m === 2 || tq === "perfect");
  if (tq === "perfect" && c.to !== sd) pop(p[0], p[1] - 70, "PARFAIT !", "#f0cf62", 20);
  shake(document.querySelector(".tbat"), 300);
  if (ae) { setTimeout(() => { ae.style.transform = ""; }, 60); }
  B[c.to].hp = Math.max(0, B[c.to].hp - dmg);
  const dealer = c.to === sd ? other(sd) : sd, hitter = c.to === sd ? t : a;
  B[dealer].fin = Math.min(100, B[dealer].fin + dmg * 0.5 * (hitter.pw === "foule" ? 1.3 : 1)); B[c.to].fin = Math.min(100, B[c.to].fin + dmg * 0.25);
  if (c.to !== sd) { a.hit1 = true; if (a.pw === "regen") A.hp = Math.min(A.max, A.hp + Math.round(A.max * 0.04)); }
  say(c.to !== sd ? a.name + " (" + STATS[si] + " " + a.st[si] + " contre " + t.st[si] + ") : " + dmg + " dégâts" + mTxt(c.m) : "Contré ! " + t.name + " est plus fort en " + STATS[si] + " : " + a.name + " prend " + dmg + " dégâts");
  await wait(420);
  B.busy = false;
  afterAction(sd);
}
// après une action : tombé possible, sinon tour suivant
function afterAction(sd, again) {
  if (B.over) return;
  if (B.E.hp <= 0 && !B.pin) { B.pin = "P"; say("L’équipe adverse est à terre : touche PIN pour le tombé !"); redraw(); return; }
  if (B.P.hp <= 0 && !B.pin) { B.pin = "E"; say("Ton équipe est à terre… l’adversaire tente le tombé !"); redraw(); setTimeout(pinStep, 900); return; }
  if (again) { say(B.log + " · 🔁 Tu rejoues !"); redraw(); return; }
  nextTurn(sd);
}
function nextTurn(sd) {
  B.T++; B.turn = other(sd); B.sel = -1;
  const X = B[B.turn];
  // toutes les cartes étourdies : tour sauté
  if (X.cards.every((c, i) => stunned(B.turn, i))) { say((B.turn === "P" ? "Tes cartes sont" : "Les cartes adverses sont") + " toutes étourdies : tour passé"); redraw(); return setTimeout(() => nextTurn(B.turn), 1300); }
  redraw();
  if (B.turn === "E") setTimeout(aiTurn, 1100);
}
// ---------- IA ----------
function aiTurn() {
  if (!B || B.over || B.turn !== "E" || B.busy || B.pin) return;
  const E = B.E, q = (DIFF[B.diff] || DIFF.low).ai * (B.F.quick ? 0.6 : 1);
  if (E.fin >= 100) { const L = E.cards.map((c, k) => k).filter(k => !stunned("E", k)).sort((a, b) => RAR.indexOf(E.cards[b].r) - RAR.indexOf(E.cards[a].r)); if (L.length) return finisher("E", L[0]); }
  const opts = [];
  E.cards.forEach((a, ai) => { if (stunned("E", ai)) return; B.P.cards.forEach((t, ti) => { for (let si = 0; si < 5; si++) { const c = calc("E", ai, ti, si, true); opts.push({ ai: ai, ti: ti, si: si, v: c.to === "P" ? c.dmg : -c.dmg }); } }); });
  if (!opts.length) return nextTurn("E");
  opts.sort((x, y) => y.v - x.v);
  const o = Math.random() < q ? opts[0] : opts[Math.floor(Math.random() * Math.min(opts.length, Math.random() < 0.5 ? 6 : opts.length))];
  say(E.cards[o.ai].name + " attaque " + B.P.cards[o.ti].name + " en " + STATS[o.si] + "…"); redraw();
  setTimeout(() => attack("E", o.ai, o.ti, o.si), 700);
}
// ---------- finisher : on choisit la carte qui le lance ----------
ACT.tcgfinpick = () => { if (!B || B.turn !== "P" || B.P.fin < 100 || B.busy || B.pin) return; B.finPick = true; say("🔥 Touche la carte qui lance le finisher"); redraw(); };
function finConfirm(i) {
  const c = B.P.cards[i]; if (stunned("P", i)) { toast("💫 Cette carte est étourdie"); B.finPick = true; return; }
  const def = defOf(c.id), lv = finLv(c.inst || { c: c.id, r: c.r }, def);
  modal((box, close) => {
    box.innerHTML = "<h3>🔥 " + esc(def.fin.n) + '</h3><p class="sub">' + esc(c.name) + " · niveau de finisher <b>" + lv + "</b> : " + lv + " dégâts à toute l’équipe adverse + un effet au hasard (" + DUR(c.r) + " tour" + (DUR(c.r) > 1 ? "s" : "") + ").</p>" +
      '<button class="btn wide gold" data-go>🔥 Lancer le finisher</button><button class="btn wide ghost" style="margin-top:6px" data-close>Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) { close(); B.finPick = false; return redraw(); } if (e.target.closest("[data-go]")) { close(); finisher("P", i); } });
  });
}
const FXN = ["stun", "vol", "soin", "div", "boost"], FXT = { stun: "💫 Étourdissement", vol: "🔁 Vol de tour", soin: "💚 Soin", div: "📉 Attaque adverse réduite", boost: "⏫ Boost ×1,5" };
async function finisher(sd, i) {
  if (!B || B.busy) return; B.busy = true; B.finPick = false;
  const X = B[sd], O = B[other(sd)], c = X.cards[i], def = defOf(c.id), lv = finLv(c.inst || { c: c.id, r: c.r }, def), dur = DUR(c.r), fx = FXN[Math.floor(Math.random() * FXN.length)];
  X.fin = 0;
  // animation : bandeau, flash, éclats sur toutes les cartes adverses
  const ov = document.createElement("div"); ov.className = "tfinfx " + sd; ov.innerHTML = '<div class="tfincard">' + cardHTML(c.inst || { c: c.id, r: c.r, lv: c.lv }, { nozoom: true }) + '</div><div class="tfint">🔥 ' + esc(def.fin.n) + "</div>";
  document.body.appendChild(ov); SFX.finisher(); flash(0xfff2c4, 500);
  await wait(1100); ov.classList.add("hit");
  O.cards.forEach((x, k) => { const e = el(other(sd), k); if (e) { const p = mid(e); burst(p[0], p[1], 40); wave(p[0], p[1], 0xf0cf62, 140); } });
  shake(document.querySelector(".tbat"), 500); fireworks(2);
  await wait(500); ov.remove();
  const dmg = Math.round(lv * mods(sd)); O.hp = Math.max(0, O.hp - dmg);
  const e0 = el(other(sd), 0); if (e0) { const p = mid(e0); pop(p[0], p[1] - 40, "-" + dmg, "#ff5a5a", 40); }
  let txt = c.name + " : 🔥 " + def.fin.n + " ! " + dmg + " dégâts · " + FXT[fx], again = false;
  if (fx === "stun") { const L = O.cards.map((x, k) => k).filter(k => !stunned(other(sd), k)); if (L.length) { const k = L[Math.floor(Math.random() * L.length)]; O.cards[k].stun = B.T + 2 * dur; txt += " : " + O.cards[k].name + " (" + dur + " tour" + (dur > 1 ? "s" : "") + ")"; } }
  if (fx === "vol") { again = true; B.T += 2; }
  if (fx === "soin") { const h0 = X.hp; X.hp = Math.min(X.max, X.hp + lv); txt += " +" + (X.hp - h0) + " PV"; }
  if (fx === "div") { O.divU = B.T + 2 * dur; txt += " (" + dur + " tour" + (dur > 1 ? "s" : "") + ")"; }
  if (fx === "boost") { X.boostU = B.T + 2 * dur + 1; txt += " (" + dur + " tour" + (dur > 1 ? "s" : "") + ")"; }
  say(txt); B.busy = false;
  if (again && B.E.hp > 0 && B.P.hp > 0) { if (sd === "P") return afterAction("P", true); say(txt + " · l’adversaire rejoue !"); redraw(); setTimeout(aiTurn, 1300); return; }
  afterAction(sd);
}
// ---------- objets : la roulette décide (réussi / raté / retourné contre toi) ----------
ACT.tcguse = btn => {
  if (!B || B.turn !== "P" || B.busy || B.pin) return; const it = itemById(btn.dataset.id); if (!it || B.P.used.indexOf(it.id) >= 0) return;
  const ch = QCH[it.q || "commun"] || 0.5, r = Math.random(), out = r < ch ? "ok" : r < ch + (1 - ch) / 2 ? "rate" : "back";
  B.P.used.push(it.id); B.busy = true; redraw();
  commit(d => { d.items[it.id] = Math.max(0, (d.items[it.id] || 0) - 1); });
  const ov = document.createElement("div"); ov.className = "troul";
  ov.innerHTML = '<div class="trbox"><div class="tric">' + itemIc(it, "tico big") + "</div><b>" + esc(it.n) + '</b><small>' + QNAME[it.q || "commun"] + " · marche " + Math.round(ch * 100) + ' % du temps</small><div class="trwheel"><span>✅ Réussi</span><span>❌ Raté</span><span>🔄 Retourné</span><span>✅ Réussi</span><span>❌ Raté</span><span>🔄 Retourné</span><span class="trfinal ' + out + '">' + { ok: "✅ Réussi !", rate: "❌ Raté…", back: "🔄 Retourné contre toi !" }[out] + "</span></div></div>";
  document.body.appendChild(ov);
  setTimeout(() => {
    ov.classList.add("done");
    const P = B.P, E = B.E, me_ = out === "ok", tgt = me_ ? E : P, ally = me_ ? P : E, v = +it.v || 0;
    let t = it.ic + " " + it.n + " : " + { ok: "réussi !", rate: "raté…", back: "retourné contre toi !" }[out];
    if (out !== "rate") {
      if (it.fx === "dmg") { tgt.hp = Math.max(0, tgt.hp - v); t += " " + v + " dégâts" + (me_ ? "" : " pour toi"); }
      if (it.fx === "heal") { ally.hp = Math.min(ally.max, ally.hp + v); t += " +" + v + " PV" + (me_ ? "" : " pour l’adversaire"); }
      if (it.fx === "fin") { ally.fin = Math.min(100, ally.fin + v); t += " barre de finisher +" + v + (me_ ? "" : " pour l’adversaire"); }
      if (it.fx === "boost") { ally.next = v || 1.5; t += me_ ? " ta prochaine attaque ×" + String(v).replace(".", ",") : " la prochaine attaque adverse ×" + String(v).replace(".", ","); }
      if (it.fx === "stun") { const k = Math.floor(Math.random() * tgt.cards.length); tgt.cards[k].stun = B.T + (me_ ? 2 : 1) * (v || 1); t += " " + tgt.cards[k].name + " étourdi" + (me_ ? "" : " (ta carte)"); }
      if (it.fx === "div") { (me_ ? E : P).divU = B.T + (me_ ? 1 : 2); t += me_ ? " attaques adverses ×0,5" : " tes attaques ×0,5"; }
    }
    say(t);
    setTimeout(() => { ov.remove(); B.busy = false; if (B.E.hp <= 0 || B.P.hp <= 0) return afterAction("P"); redraw(); }, 1200);
  }, 1700);
};
// ---------- le tombé ----------
ACT.tcgpin = () => { if (B && B.pin === "P" && !B.busy) pinStep(); };
async function pinStep() {
  if (!B || !B.pin || B.over || B.busy) return; B.busy = true;
  const pinner = B.pin, victim = other(pinner), V = B[victim], T = TIER[B.tier] || TIER.low;
  const cnt = document.createElement("div"); cnt.className = "tpincnt"; document.body.appendChild(cnt);
  const count = async n => { cnt.textContent = n; cnt.classList.remove("pop"); void cnt.offsetWidth; cnt.classList.add("pop"); SFX.hit(false); await wait(650); };
  let out = false;
  if (pinner === "P") {
    const q = await timing("TOMBÉ : TAPE AU BON MOMENT !");
    const kc = T.ko * (B.F.quick ? 0.8 : (DIFF[B.diff] || DIFF.low).ko) * { perfect: 0.3, good: 0.7, miss: 1.3 }[q] * Math.pow(0.6, V.kick);
    await count("1"); await count("2");
    out = Math.random() < kc;
  } else {
    await count("1");
    const q = await timing("DÉGAGE-TOI AVANT 3 !", B.P.kick);
    await count("2");
    out = q !== "miss";
  }
  if (out) {
    cnt.textContent = "DÉGAGEMENT !"; cnt.classList.add("kick"); SFX.crowd(true);
    V.kick++; V.hp = Math.max(1, Math.round(V.max * 0.15)); B.pin = ""; B.busy = false;
    say((victim === "P" ? "Tu te dégages à 2 ! " : "L’adversaire se dégage à 2 ! ") + "+" + V.hp + " PV");
    await wait(900); cnt.remove();
    nextTurn(pinner);
    return;
  }
  await count("3"); cnt.textContent = "1… 2… 3 !"; await wait(600); cnt.remove(); B.busy = false;
  end(pinner === "P");
}
ACT.tcgquit = () => { if (!B || B.over) return; modal((box, close) => { box.innerHTML = '<h3>Abandonner le combat ?</h3><p class="sub">Tu n’auras pas de récompense. Tu peux aussi quitter la page : le combat t’attendra (« Reprendre »).</p><button class="btn wide danger" data-y>Abandonner</button><button class="btn wide ghost" style="margin-top:6px" data-close>Continuer le combat</button>'; box.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); if (e.target.closest("[data-y]")) { close(); end(false, true); } }); }); };
window.addEventListener("hashchange", () => { if (B && location.hash.indexOf("#/tccg/combat") !== 0) { SFX.crowd(false); SFX.music(false); } });
// ---------- fin : récompenses ----------
function itemDrop(T, quick) {
  const I = items(), w = { C: 50, R: 28, E: 14, L: 6, M: 2 }, pool = [];
  I.forEach(x => { const n = x.t === "combat" ? 10 : x.t === "equip" ? (quick ? 8 : 4) : w[x.g] || 5; for (let i = 0; i < n; i++) pool.push(x.id); });
  return pool[Math.floor(Math.random() * pool.length)];
}
function end(win, quit) {
  if (B.over) return true; B.over = true;
  const T = TIER[B.tier] || TIER.low, D = DIFF[B.diff] || DIFF.low, rew = { money: 0, mom: 0, pop: 0, push: 0, gim: 0, items: [], cards: [], xp: 0, up: 0 };
  const gm = (B.F.quick ? 1 : D.rew) * (0.6 + 0.2 * (B.n || 1));
  if (win) {
    rew.money = Math.round(rnd(T.money[0], T.money[1]) * gm); rew.mom = Math.round(rnd(T.mpp[0], T.mpp[1]) * gm); rew.pop = Math.round(rnd(T.mpp[0], T.mpp[1]) * gm); rew.push = Math.round(rnd(T.mpp[0], T.mpp[1]) * gm);
    rew.gim = Math.round(rnd(T.gim[0], T.gim[1]) * gm); rew.xp = Math.round(T.pxp * gm);
    if (Math.random() < T.drop) rew.items.push(itemDrop(T, B.F.quick));
    // la ceinture, seulement si un catcheur affronté est champion en vrai
    const ch = champsNow(); (B.F.champ || []).forEach(nm => { if (rew.items.some(isBelt)) return; const t = ch.has(realKey({ name: nm })) && titleOf(nm); if (t && Math.random() < Math.min(0.6, (BELT_DROP[B.tier] || 0) * D.rew)) rew.items.push(BELT + t.id); });
    if (T.card) (B.F.src || []).forEach(id => { if (Math.random() < T.card * (B.F.quick ? 1 : D.rew)) rew.cards.push(B.F.key ? id + "@" + B.F.key : id); });
  } else if (!quit) { rew.money = Math.round(T.money[0] * (B.tier === "duel" ? 0.3 : 0.2)); if (B.tier === "duel") rew.mom = rew.pop = rew.push = 8; rew.xp = Math.round(T.pxp / 3); }
  dropSave();
  if (B.tier === "duel" && B.F.uid && !quit && DB.addTcgx && S.user) DB.addTcgx({ ty: "duel", from: S.user.uid, to: B.F.uid, fromName: String((S.profile && S.profile.pseudo) || "Joueur").slice(0, 30), toName: String(B.F.oname || "").slice(0, 30), win: !!win, diff: B.diff || "low", n: B.n || 1 }).catch(() => {});
  const k = B.k, team = B.P.cards, tier = B.tier, quick = B.F.quick;
  commit(d => {
    ["money", "mom", "pop", "push", "gim"].forEach(r => { d.res[r] += rew[r]; });
    rew.items.forEach(id => { d.items[id] = (d.items[id] || 0) + 1; });
    rew.cards.forEach(id => addCard(d, id));
    rew.up = addXp(d, rew.xp);
    team.forEach(f => { const inst = f.iid && d.cards[f.iid]; if (inst && !quit) cardXp(inst, win ? T.cxp : Math.round(T.cxp / 3)); });
    if (!quit && k !== "quick" && k.indexOf("duel:") !== 0) d.cool[k] = Date.now();
    if (!quit && quick) bump(d, "quick");
    if (win) { d.wins++; bump(d, "win"); if (tier === "mid" || tier === "top") bump(d, "event"); const day = parisDay(), md = {}; md[day] = ((d.mday || {})[day] || 0) + 1; d.mday = md; }
    Object.keys(d.cool).forEach(c => { if (Date.now() - d.cool[c] > 8 * 864e5) delete d.cool[c]; });
  });
  victory(win, rew, quit);
  return true;
}
function victory(win, rew, quit) {
  SFX.crowd(false); SFX.music(false); SFX.end(win);
  if (win) { fireworks(5); confetti(); }
  const ov = document.createElement("div"); ov.className = "tvict " + (win ? "win" : "lose");
  const back = B && B.k && B.k.indexOf("#") > 0 ? "#/tccg/event" : "#/tccg/match";
  ov.innerHTML = '<div class="tvbox"><h1>' + (win ? "VICTOIRE !" : quit ? "Abandon" : "DÉFAITE") + "</h1>" +
    (rew.money || rew.xp ? '<div class="tvrew">' + (rew.money ? "<span>💵 +" + rew.money + "</span>" : "") + (rew.mom ? "<span>⚡ +" + rew.mom + "</span><span>⭐ +" + rew.pop + "</span><span>📣 +" + rew.push + "</span>" : "") + (rew.gim ? "<span>🎟️ +" + rew.gim + "</span>" : "") + (rew.xp ? "<span>XP +" + rew.xp + (rew.up ? " · niveau +" + rew.up + " !" : "") + "</span>" : "") + "</div>" : "") +
    rew.items.map(id => { if (isBelt(id)) { const t = beltTitle(id); return t ? '<p class="tvdrop belt">' + beltImgHTML(t.id, "tvbelt") + " Ceinture gagnée : <b>" + esc(t.n) + "</b></p>" : ""; } const it = itemById(id); return it ? '<p class="tvdrop">🎁 ' + itemIc(it) + " " + esc(it.n) + "</p>" : ""; }).join("") +
    (rew.cards.length ? '<p class="tvdrop">✨ Carte gagnée !</p><div class="trgrid">' + rew.cards.map(id => cardHTML(defOf(id), { small: true })).join("") + "</div>" : "") +
    '<div class="btns"><a class="btn" href="' + back + '" data-close>Continuer</a><a class="btn ghost" href="#/tccg" data-close>Accueil</a></div></div>';
  document.body.appendChild(ov);
  const rel = backLayer(() => { ov.remove(); B = null; prep = null; });
  ov.addEventListener("click", e => { if (e.target.closest("[data-close]")) { rel(); ov.remove(); B = null; prep = null; SFX.crowd(false); SFX.music(false); } });
}
