// TCCCG — Accueil (en-tête joueur, cartes favorites, gros bouton Combats, Missions, Cadeau, Paramètres, Info), tuto du début, Shop.
import { S, ACT, changed } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { parisDay } from "../time.js";
import { items, itemById, defOf, showKeyLabel } from "./data.js";
import { recentShows } from "./callup.js";
import { fightShows, resumeHome } from "./fight.js";
import { pendingCount, duelsForMe } from "./trade.js";
import { me, commit, owned, XP_LV } from "./store.js";
import { cardHTML } from "./card.js";
import { resBar } from "./roster.js";

export function headerHTML(d) {
  const p = S.profile || {};
  return '<div class="tphead"><div><b>' + esc(p.pseudo || "Joueur") + '</b><small>Niveau ' + d.lvl + (d.lvl < 50 ? " · " + d.xp + " / " + XP_LV(d.lvl) + " XP" : " (max)") + '</small><i class="txpbar"><i style="width:' + (d.lvl < 50 ? Math.round(d.xp / XP_LV(d.lvl) * 100) : 100) + '%"></i></i></div></div>' + resBar(d);
}
// missions du jour (simples) : récompenses en ressources
const MISSIONS = [
  { id: "free", t: "Ouvrir le booster gratuit du jour", ok: d => d.free === parisDay(), r: { gim: 2 } },
  { id: "win", t: "Gagner un combat", ok: d => (d.mday || {})[parisDay()] >= 1, r: { money: 800 } },
  { id: "cards10", t: "Avoir 10 cartes", ok: d => Object.keys(d.cards).length >= 10, r: { mom: 40, pop: 40, push: 40 } }
];
// accueil façon Dokkan Battle : la carte « leader » en grand qui parle, bannières, gros bouton Combats
export function tccgHome() {
  const d = me(), L = owned(d), free = d.free !== parisDay();
  if (!d.tuto) setTimeout(tuto, 300);
  const lead = (d.fav[0] && d.cards[d.fav[0]] && Object.assign({ iid: d.fav[0] }, d.cards[d.fav[0]])) || L.sort((a, b) => ["N", "R", "SR", "SSR", "UR", "LR"].indexOf(b.r) - ["N", "R", "SR", "SSR", "UR", "LR"].indexOf(a.r) || b.lv - a.lv)[0];
  const ld = lead && defOf(lead.c), shows = recentShows(7), nf = fightShows().reduce((n, x) => n + x.matches.length, 0);
  const np = pendingCount(), duels = duelsForMe();
  const lines = [np ? np + " proposition" + (np > 1 ? "s" : "") + " d’échange t’attend" + (np > 1 ? "ent" : "") + " !" : "", free ? "Ton booster gratuit t’attend dans Call Up !" : "", shows[0] ? "Le booster « " + showKeyLabel(shows[0]) + " » est sorti !" : "", nf ? nf + " combats t’attendent cette semaine." : "", ld ? "On va leur montrer qui est " + (ld.name.split(" ")[0]) + " !" : "Ouvre ton premier booster pour recruter ton catcheur."].filter(Boolean);
  const say = np ? lines[0] : lines[Math.floor(Date.now() / 6e4) % lines.length];
  let h = headerHTML(d) + resumeHome();
  h += '<section class="thero"' + (ld ? ' style="--hp:url(\'' + esc(ld.pic) + '\')"' : "") + ">" + (ld ? '<div class="thcard">' + cardHTML(lead, { small: true, act: "tcgcard", iid: lead.iid }) + "</div>" : '<div class="thempty">🃏</div>') +
    '<div class="tbubble">' + esc(say) + "</div>" + (ld ? '<span class="thname">' + esc(ld.name) + "</span>" : "") + "</section>";
  // bannières
  const ban = [];
  if (free) ban.push('<a class="tban gift" href="#/tccg/callup"><b>🎁 Booster gratuit</b><small>N et R · chaque jour</small></a>');
  shows.slice(0, 3).forEach(k => ban.push('<a class="tban" href="#/tccg/callup"><b>🎴 ' + esc(showKeyLabel(k)) + "</b><small>Nouveau booster · " + esc(k.split("|")[0]) + "</small></a>"));
  if (np) ban.unshift('<a class="tban gift" href="#/tccg/echange/props"><b>🤝 ' + np + " échange" + (np > 1 ? "s" : "") + "</b><small>Des membres te proposent un échange</small></a>");
  ban.push('<a class="tban" href="#/tccg/echange/encheres" style="background:linear-gradient(120deg,#2a0f3a,#8a3fd0)"><b>🔨 Enchères</b><small>Achète et vends des cartes</small></a>');
  ban.push('<a class="tban dark" href="#/tccg/combats"><b>🌑 Dark Match · 👥 Défis</b><small>Gagne de l’argent, défie les autres membres</small></a>');
  h += '<div class="tbans">' + ban.join("") + "</div>";
  h += '<div class="tcenter"><a class="tround" href="#/tccg/callup">🎴<small>Call Up</small></a><button class="tround" data-act="tcgmis">📋<small>Missions</small></button>' +
    '<a class="tbig" href="#/tccg/combats">⚔️<b>COMBATS</b></a>' +
    '<a class="tround" href="#/tccg/roster">🃏<small>Roster</small></a>' + (S.isAdmin ? '<a class="tround" href="#/tccg/modo">⚙️<small>Modo</small></a>' : '<button class="tround" data-act="tcgtuto">ℹ️<small>Info</small></button>') + "</div>";
  if (duels.length) h += "<h2>Défis reçus</h2>" + '<div class="list">' + duels.map(x => '<div class="item"><span class="lbl"><b>⚔️ ' + esc(x.fromName || "Un membre") + (x.win ? " a battu ton équipe" : " a perdu contre ton équipe") + "</b><small>" + x.n + " contre " + x.n + " · " + esc(({ low: "Low", mid: "Mid", top: "Top" })[x.diff] || "") + "</small></span></div>").join("") + "</div>";
  const favs = d.fav.slice(1).map(iid => d.cards[iid] && Object.assign({ iid: iid }, d.cards[iid])).filter(Boolean);
  if (favs.length) h += "<h2>Mes cartes favorites</h2>" + '<div class="tfavs">' + favs.map(x => cardHTML(x, { small: true, act: "tcgcard", iid: x.iid })).join("") + "</div>";
  h += '<p class="tnote" style="text-align:center">' + d.wins + " victoire" + (d.wins > 1 ? "s" : "") + " · " + d.opened + " booster" + (d.opened > 1 ? "s" : "") + " ouvert" + (d.opened > 1 ? "s" : "") + " · " + L.length + " cartes" + ' · <button class="linkbtn" data-act="tcgtuto">Revoir le tuto</button></p>';
  return h;
}
ACT.tcgmis = () => {
  modal((box, close) => {
    const draw = () => { const d = me(), got = (d.mis || {})[parisDay()] || [];
      box.innerHTML = "<h3>Missions du jour</h3><div class=\"list\">" + MISSIONS.map(m => { const ok = m.ok(d), done = got.indexOf(m.id) >= 0;
        return '<div class="item"><span class="lbl"><b>' + esc(m.t) + "</b><small>" + Object.keys(m.r).map(k => ({ money: "💵", mom: "⚡", pop: "⭐", push: "📣", gim: "🎟️" })[k] + " " + m.r[k]).join(" ") + "</small></span>" + (done ? "✓" : ok ? '<button class="btn small" data-m="' + m.id + '">Récupérer</button>' : "…") + "</div>"; }).join("") + '</div><button class="btn wide ghost" style="margin-top:10px" data-close>Fermer</button>'; };
    draw();
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const b = e.target.closest("[data-m]"); if (!b) return; const m = MISSIONS.find(x => x.id === b.dataset.m);
      commit(d => { const day = parisDay(), got = (d.mis && d.mis[day]) || []; if (got.indexOf(m.id) >= 0 || !m.ok(d)) return; d.mis = {}; d.mis[day] = got.concat([m.id]); Object.keys(m.r).forEach(k => { d.res[k] += m.r[k]; }); });
      toast("Mission réussie !"); draw();
    });
  });
};
ACT.tcggift = () => { location.hash = "#/tccg/callup"; };
ACT.tcgtuto = () => tuto(true);
const STEPS = [
  ["Bienvenue dans TCCCG !", "Le jeu de cartes de TCC TV. Tu commences à zéro : pas de carte, pas de ressource. Chaque jour, un booster gratuit (N et R) t’attend dans Call Up."],
  ["Call Up", "Chaque show de la semaine a son booster (5 gimmicks pour 3 cartes, 50 pour un Mega de 15). 2 jours après les résultats, les cartes « version show » apparaissent, plus fortes si le catcheur a gagné."],
  ["Les cartes", "5 stats (Force, Agilité, Charisme, Endurance, Technique), un archétype et un Finisher. Dominator bat Aggressor, qui bat Technician, qui bat Opportunist, qui bat Showman, qui bat Dominator : dégâts ×2 ou ×0,5."],
  ["Combats", "Choisis un match d’un show de la semaine et affronte ses catcheurs en 2 contre 2. C’est un memory : retourne 2 cases, une paire déclenche l’action. 3 TAG pour changer de catcheur, des objets et des cartes de soutien (bonus si même équipe)."],
  ["Progresser", "Les combats donnent de l’argent, du Momentum, de la Pop, du Push, des gimmicks, des objets et parfois les cartes du show. Dans Roster : entraîne, fusionne les doublons ou fais-en des médailles, puis éveille tes cartes jusqu’à leur rareté max."]
];
function tuto(force) {
  if (document.querySelector(".ttuto") || (!force && me().tuto)) return;
  let i = 0;
  modal((box, close) => {
    box.classList.add("ttuto");
    const draw = () => { box.innerHTML = '<p class="sub">' + (i + 1) + " / " + STEPS.length + "</p><h3>" + esc(STEPS[i][0]) + "</h3><p>" + esc(STEPS[i][1]) + '</p><button class="btn wide" data-n>' + (i < STEPS.length - 1 ? "Suivant" : "C’est parti !") + "</button>"; };
    draw();
    box.addEventListener("click", e => { if (!e.target.closest("[data-n]")) return; i++; if (i >= STEPS.length) { close(); if (!me().tuto) commit(d => { d.tuto = true; }); } else draw(); });
  });
}
// ---------- Shop ----------
const PRICE = { C: 300, R: 900, E: 2500, L: 6000, M: 15000 };
export function shopView() {
  const d = me(), I = items().filter(x => x.shop !== false && (x.t === "combat" || x.g));
  return '<section class="tccghead"><h1>Shop</h1></section>' + resBar(d) + '<p class="tnote">Objets d’éveil et de combat contre de l’argent gagné en combat. Gimmicks : 1 000 💵 les 5.</p>' +
    '<div class="list tshop">' + I.map(x => { const p = +x.price || (x.t === "combat" ? 500 : PRICE[x.g] || 500);
      return '<div class="item"><span class="lbl"><b>' + esc(x.ic + " " + x.n) + "</b><small>" + esc(x.d || "") + " · tu en as " + (d.items[x.id] || 0) + '</small></span><button class="btn small" data-act="tcgbuy" data-id="' + x.id + '" data-p="' + p + '"' + (d.res.money >= p ? "" : " disabled") + ">💵 " + p + "</button></div>"; }).join("") +
    '<div class="item"><span class="lbl"><b>🎟️ 5 gimmicks</b><small>De quoi ouvrir un booster de show</small></span><button class="btn small" data-act="tcgbuy" data-id="gim" data-p="1000"' + (d.res.money >= 1000 ? "" : " disabled") + ">💵 1000</button></div></div>";
}
ACT.tcgbuy = el => {
  const p = +el.dataset.p, id = el.dataset.id;
  commit(d => { if (d.res.money < p) return; d.res.money -= p; if (id === "gim") d.res.gim += 5; else d.items[id] = (d.items[id] || 0) + 1; });
  toast("Acheté ✓");
};
