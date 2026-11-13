// TCCCG — Accueil (carte leader, cadeaux, infos des boosters et des events, missions du jour, modo, guide) et Shop
// (équipement, objets d'éveil, objets de combat, gimmicks, ceintures du jour payées en médailles). Cahier de Jose du 12 nov.
import { S, ACT, changed } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { parisDay } from "../time.js";
import { items, itemById, defOf, showKeyLabel, prestige, EVO_NAME, QCH, QNAME, cfg, STATS } from "./data.js";
import { recentShows } from "./callup.js";
import { fightShows, resumeHome } from "./fight.js";
import { pendingCount, duelsForMe } from "./trade.js";
import { me, commit, owned, freeLeft } from "./store.js";
import { cardHTML, itemIc } from "./card.js";
import { dailyBelts, beltImgHTML, BELT } from "./evo.js";
import { saveCfg, pickFile } from "./modo.js";

const RES = { money: "💵", mom: "⚡", pop: "⭐", push: "📣", gim: "🎟️" };
const resTxt = r => Object.keys(r || {}).filter(k => RES[k] && r[k]).map(k => RES[k] + " " + r[k]).join(" ");
const cnt = (d, k) => (d.mis && d.mis.cnt && d.mis.cnt.d === parisDay() && d.mis.cnt[k]) || 0;
const seed = s => { let h = 7; for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0; return h; };

// ---------- missions du jour : 4 tirées chaque jour + celles du modo (cfg.missions) ----------
const MPOOL = [
  { id: "free", t: "Ouvrir un booster gratuit", k: "free", n: 1, r: { gim: 2 } },
  { id: "open3", t: "Ouvrir 3 boosters", k: "open", n: 3, r: { money: 800 } },
  { id: "win1", t: "Gagner un combat", k: "win", n: 1, r: { money: 800 } },
  { id: "win3", t: "Gagner 3 combats", k: "win", n: 3, r: { mom: 60, pop: 60, push: 60 } },
  { id: "event", t: "Gagner un combat d’event", k: "event", n: 1, r: { gim: 3 } },
  { id: "quick", t: "Jouer un Match rapide", k: "quick", n: 1, r: { gim: 1 } },
  { id: "train", t: "Réussir un entraînement", k: "train", n: 1, r: { money: 600 } },
  { id: "fuse", t: "Fusionner un doublon", k: "fuse", n: 1, r: { mom: 30, pop: 30, push: 30 } }
];
export function missions() {
  const day = parisDay(), h = seed(day), L = MPOOL.slice(), out = [];
  for (let i = 0; i < 4 && L.length; i++) out.push(L.splice((h >> (i * 3)) % L.length, 1)[0]);
  (cfg().missions || []).filter(m => m && m.id && m.t && !m.off).forEach(m => out.push(Object.assign({ n: 1, k: "win", r: {} }, m, { id: "m:" + m.id })));
  return out;
}
const misDone = (d, m) => cnt(d, m.k) >= (+m.n || 1);
const misGot = d => ((d.mis || {})[parisDay()]) || [];
ACT.tcgmisget = el => {
  const m = missions().find(x => x.id === el.dataset.id); if (!m) return; let ok = false;
  commit(d => { const day = parisDay(), got = misGot(d); if (got.indexOf(m.id) >= 0 || !misDone(d, m)) return; const cn = d.mis && d.mis.cnt; d.mis = { cnt: cn }; d.mis[day] = got.concat([m.id]); Object.keys(m.r || {}).forEach(k => { if (RES[k]) d.res[k] += +m.r[k] || 0; }); ok = true; });
  if (ok) toast("📋 Mission réussie : " + resTxt(m.r));
};
function missionsHTML(d) {
  const got = misGot(d);
  return "<h2>📋 Missions du jour <small class=\"tsmall\">nouvelles chaque jour</small></h2><div class=\"list tmis\">" + missions().map(m => {
    const c = Math.min(+m.n || 1, cnt(d, m.k)), ok = misDone(d, m), done = got.indexOf(m.id) >= 0;
    return '<div class="item' + (done ? " done" : "") + '"><span class="lbl"><b>' + esc(m.t) + "</b><small>" + resTxt(m.r) + " · " + c + " / " + (+m.n || 1) + '</small><i class="tmbar"><i style="width:' + Math.round(c / (+m.n || 1) * 100) + '%"></i></i></span>' +
      (done ? '<span class="tok">✓</span>' : ok ? '<button class="btn small" data-act="tcgmisget" data-id="' + esc(m.id) + '">Récupérer</button>' : "") + "</div>";
  }).join("") + "</div>";
}
// ---------- cadeaux : cadeau d'arrivée (nouveaux joueurs) + cadeaux du modo à tous (cfg.gifts) ----------
const isNew = d => !Object.keys(d.cards).length && !d.opened;
function gifts(d) {
  const L = [];
  if (!d.items.gift1 && isNew(d)) L.push({ id: "gift1", t: "Cadeau de bienvenue", msg: "Pour bien commencer : 250 gimmicks et une mallette Money In The Bank (la carte SSR de ton choix).", res: { gim: 250 }, items: { mitb: 1 } });
  const now = Date.now();
  (cfg().gifts || []).filter(g => g && g.id && !g.off && (!g.until || Date.parse(g.until) > now) && !d.items["gc:" + g.id]).forEach(g => L.push(Object.assign({}, g, { id: "gc:" + g.id })));
  return L;
}
ACT.tcggiftget = el => {
  const d0 = me(), g = gifts(d0).find(x => x.id === el.dataset.id); if (!g) return;
  commit(d => { if (d.items[g.id]) return; d.items[g.id] = 1; Object.keys(g.res || {}).forEach(k => { if (RES[k]) d.res[k] += +g.res[k] || 0; }); Object.keys(g.items || {}).forEach(k => { d.items[k] = (d.items[k] || 0) + (+g.items[k] || 0); }); });
  toast("🎁 Cadeau récupéré !");
};
function giftsHTML(d) {
  const L = gifts(d); if (!L.length) return "";
  return '<h2>🎁 Cadeaux</h2><div class="list tgifts">' + L.map(g => '<div class="item"><span class="tgic">🎁</span><span class="lbl"><b>' + esc(g.t || "Cadeau") + "</b><small>" + esc(g.msg || "") + (resTxt(g.res) ? " · " + resTxt(g.res) : "") + "</small></span>" +
    '<button class="btn small gold" data-act="tcggiftget" data-id="' + esc(g.id) + '">Récupérer</button></div>').join("") + "</div>";
}
// ---------- accueil ----------
export function tccgHome() {
  const d = me(), L = owned(d), free = freeLeft(d) > 0;
  if (!d.tuto) setTimeout(tuto, 300);
  const RA = ["N", "R", "SR", "SSR", "UR", "LR"];
  const lead = (d.fav[0] && d.cards[d.fav[0]] && Object.assign({ iid: d.fav[0] }, d.cards[d.fav[0]])) || L.sort((a, b) => RA.indexOf(b.r) - RA.indexOf(a.r) || b.lv - a.lv)[0];
  const ld = lead && defOf(lead.c), shows = recentShows(7), nf = fightShows().reduce((n, x) => n + x.matches.length, 0);
  const np = pendingCount(), duels = duelsForMe();
  const lines = [np ? np + " proposition" + (np > 1 ? "s" : "") + " d’échange t’attend" + (np > 1 ? "ent" : "") + " !" : "", free ? "Tu as " + freeLeft(d) + " booster" + (freeLeft(d) > 1 ? "s" : "") + " gratuit" + (freeLeft(d) > 1 ? "s" : "") + " dans Call Up !" : "", shows[0] ? "Le booster « " + showKeyLabel(shows[0]) + " » est sorti !" : "", nf ? nf + " combats t’attendent dans Event cette semaine." : "", ld ? "On va leur montrer qui est " + ld.name.split(" ")[0] + " !" : "Ouvre ton premier booster pour recruter ton catcheur."].filter(Boolean);
  const say = np ? lines[0] : lines[Math.floor(Date.now() / 6e4) % lines.length];
  // l'écran géant de l'entrée (version B « Dans l'arène »)
  let h = '<section class="tccghead home"><small>Ce soir sur le grand écran</small><h1>' + esc(shows[0] ? "Booster " + showKeyLabel(shows[0]) : free ? "Boosters gratuits" : "TCCCG") + "</h1></section>" + resumeHome();
  h += '<section class="thero"' + (ld ? ' style="--hp:url(\'' + esc(ld.pic) + '\')"' : "") + ">" + (ld ? '<div class="thcard">' + cardHTML(lead, { small: true, act: "tcgcard", iid: lead.iid }) + "</div>" : '<div class="thempty">🃏</div>') +
    '<div class="tbubble">' + esc(say) + "</div>" + (ld ? '<span class="thname">' + esc(ld.name) + "</span>" : "") + "</section>";
  h += giftsHTML(d);
  // infos : boosters, events, échanges, défis
  const ban = [];
  if (np) ban.push('<a class="tban gift" href="#/tccg/echange/props"><b>🤝 ' + np + " échange" + (np > 1 ? "s" : "") + "</b><small>Des membres te proposent un échange</small></a>");
  if (free) ban.push('<a class="tban gift" href="#/tccg/callup"><b>🎁 ' + freeLeft(d) + " booster" + (freeLeft(d) > 1 ? "s" : "") + " gratuit" + (freeLeft(d) > 1 ? "s" : "") + "</b><small>3 toutes les 5 heures</small></a>");
  shows.slice(0, 3).forEach(k => ban.push('<a class="tban" href="#/tccg/callup"><b>🎴 ' + esc(showKeyLabel(k)) + "</b><small>Booster · " + esc(k.split("|")[0]) + "</small></a>"));
  if (nf) ban.push('<a class="tban dark" href="#/tccg/event"><b>📅 ' + nf + " combats d’event</b><small>Les vrais matchs de la semaine</small></a>");
  ban.push('<a class="tban" href="#/tccg/match" style="background:linear-gradient(120deg,#3a0f0f,#d04f3f)"><b>⚡ Match rapide</b><small>Un combat tout de suite contre l’IA</small></a>');
  h += '<div class="tbans">' + ban.join("") + "</div>";
  if (duels.length) h += "<h2>Défis reçus</h2>" + '<div class="list">' + duels.map(x => '<div class="item"><span class="lbl"><b>⚔️ ' + esc(x.fromName || "Un membre") + (x.win ? " a battu ton équipe" : " a perdu contre ton équipe") + "</b><small>" + x.n + " contre " + x.n + " · " + esc(({ low: "Low", mid: "Mid", top: "Top" })[x.diff] || "") + "</small></span></div>").join("") + "</div>";
  const favs = d.fav.map(iid => d.cards[iid] && Object.assign({ iid: iid }, d.cards[iid])).filter(Boolean);
  if (favs.length) h += '<h2>⭐ Mes cartes favorites</h2><div class="tfavs">' + favs.map(x => cardHTML(x, { small: true, act: "tcgcard", iid: x.iid })).join("") + "</div>";
  h += missionsHTML(d);
  if (S.isAdmin) h += '<h2>⚙️ Modo</h2><div class="tbans"><a class="tban" href="#/tccg/modo"><b>⚙️ Réglages du TCCCG</b><small>Cartes, boosters, taux, objets…</small></a><button class="tban" data-act="tcgmgift"><b>🎁 Envoyer un cadeau</b><small>À tous les membres</small></button><button class="tban" data-act="tcgmmis"><b>📋 Missions du modo</b><small>Ajouter des missions</small></button></div>';
  h += '<a class="tguide" href="#/tccg/guide"><b>📖 Guide du jeu</b><small>Comment jouer : Call Up, roster, combats, entraînement, évolution…</small></a>';
  h += '<p class="tnote" style="text-align:center">' + d.wins + " victoire" + (d.wins > 1 ? "s" : "") + " · " + d.opened + " booster" + (d.opened > 1 ? "s" : "") + " ouvert" + (d.opened > 1 ? "s" : "") + " · " + L.length + " cartes</p>";
  return h;
}
// ---------- modo : cadeau à tous, missions ----------
ACT.tcgmgift = () => {
  if (!S.isAdmin) return;
  modal((box, close) => {
    const L = (cfg().gifts || []).filter(g => g && !g.off);
    box.innerHTML = "<h3>🎁 Cadeau pour tous les membres</h3><form data-gf>" +
      '<label class="fld">Titre<input name="t" maxlength="40" required placeholder="Ex. : Cadeau de Noël"></label><label class="fld">Message<input name="msg" maxlength="120"></label>' +
      '<div class="tmstats">' + Object.keys(RES).map(k => '<label>' + RES[k] + '<input name="' + k + '" type="number" min="0" max="100000"></label>').join("") + "</div>" +
      '<label class="fld">Jusqu’au (vide = sans fin)<input name="until" type="date"></label><button class="btn wide">Envoyer à tous</button></form>' +
      (L.length ? "<h4>Cadeaux en cours</h4><div class=\"list\">" + L.map(g => '<div class="item"><span class="lbl"><b>' + esc(g.t) + "</b><small>" + resTxt(g.res) + (g.until ? " · jusqu’au " + esc(g.until) : "") + '</small></span><button class="btn small ghost" data-off="' + esc(g.id) + '">Retirer</button></div>').join("") + "</div>" : "") +
      '<button class="btn wide ghost" style="margin-top:8px" data-close>Fermer</button>';
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const o = e.target.closest("[data-off]"); if (o) { close(); saveCfg(c => { (c.gifts || []).forEach(g => { if (g.id === o.dataset.off) g.off = true; }); }, "cadeau retiré").then(ok => ok && toast("Retiré ✓")); }
    });
    box.querySelector("[data-gf]").addEventListener("submit", e => {
      e.preventDefault(); const f = e.target, res = {}; Object.keys(RES).forEach(k => { if (+f[k].value > 0) res[k] = Math.round(+f[k].value); });
      const g = { id: Date.now().toString(36), t: f.t.value.trim(), msg: f.msg.value.trim(), res: res }; if (f.until.value) g.until = f.until.value;
      close(); saveCfg(c => { c.gifts = (c.gifts || []).concat([g]); }, "cadeau pour tous : " + g.t).then(ok => ok && toast("🎁 Cadeau envoyé ✓"));
    });
  });
};
ACT.tcgmmis = () => {
  if (!S.isAdmin) return;
  const KIND = { win: "Gagner des combats", event: "Gagner des combats d’event", quick: "Jouer des Matchs rapides", open: "Ouvrir des boosters", free: "Ouvrir des boosters gratuits", train: "Réussir des entraînements", fuse: "Fusionner des doublons", awake: "Éveiller des cartes", evo: "Faire évoluer des cartes" };
  modal((box, close) => {
    const L = (cfg().missions || []).filter(m => m && !m.off);
    box.innerHTML = "<h3>📋 Missions du modo</h3><p class=\"sub\">Elles s’ajoutent chaque jour aux 4 missions tirées au hasard.</p><form data-mf>" +
      '<label class="fld">Texte<input name="t" maxlength="60" required placeholder="Ex. : Gagner 5 combats"></label>' +
      '<label class="fld">Action<select name="k">' + Object.keys(KIND).map(k => '<option value="' + k + '">' + KIND[k] + "</option>").join("") + "</select></label>" +
      '<label class="fld">Combien de fois<input name="n" type="number" min="1" max="50" value="1"></label>' +
      '<div class="tmstats">' + Object.keys(RES).map(k => '<label>' + RES[k] + '<input name="' + k + '" type="number" min="0" max="100000"></label>').join("") + "</div>" +
      '<button class="btn wide">Ajouter</button></form>' +
      (L.length ? '<div class="list">' + L.map(m => '<div class="item"><span class="lbl"><b>' + esc(m.t) + "</b><small>" + resTxt(m.r) + '</small></span><button class="btn small ghost" data-off="' + esc(m.id) + '">Retirer</button></div>').join("") + "</div>" : "") +
      '<button class="btn wide ghost" style="margin-top:8px" data-close>Fermer</button>';
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const o = e.target.closest("[data-off]"); if (o) { close(); saveCfg(c => { (c.missions || []).forEach(m => { if (m.id === o.dataset.off) m.off = true; }); }, "mission retirée").then(ok => ok && toast("Retirée ✓")); }
    });
    box.querySelector("[data-mf]").addEventListener("submit", e => {
      e.preventDefault(); const f = e.target, r = {}; Object.keys(RES).forEach(k => { if (+f[k].value > 0) r[k] = Math.round(+f[k].value); });
      const m = { id: Date.now().toString(36), t: f.t.value.trim(), k: f.k.value, n: Math.max(1, +f.n.value || 1), r: r };
      close(); saveCfg(c => { c.missions = (c.missions || []).concat([m]); }, "mission du modo : " + m.t).then(ok => ok && toast("Mission ajoutée ✓"));
    });
  });
};
// ---------- tuto du premier lancement (renvoie au guide) ----------
ACT.tcgtuto = () => tuto(true);
const STEPS = [
  ["Bienvenue dans TCCCG !", "Le jeu de cartes de TCC TV. Toutes les 5 heures, 3 boosters gratuits t’attendent dans Call Up."],
  ["Call Up", "Tous les boosters côte à côte : glisse pour changer (PLE / PPV, shows de la semaine, boosters du modo). Simple : 5 gimmicks pour 5 cartes. Méga : 50 gimmicks pour 15 cartes, dont 1 SSR garantie."],
  ["Combats", "Event : les vrais matchs des shows de la semaine. Match : Match rapide, catcheurs au hasard et défis contre les membres. Tu choisis 1 à 3 cartes (leurs stats additionnées = ta barre de vie), un leader 👑 et un soutien."],
  ["Attaquer", "Choisis ta carte, la carte visée et la stat. Dégâts = 15 + 3 × l’écart entre vos deux stats, ×2 avec l’avantage de type. Si ta stat est plus faible, c’est toi qui prends le coup !"],
  ["Progresser", "Roster : entraîne tes cartes avec des mini-jeux, fusionne les doublons, éveille-les et fais-les évoluer. Tout est expliqué dans le Guide."]
];
function tuto(force) {
  if (document.querySelector(".ttuto") || (!force && me().tuto)) return;
  let i = 0;
  modal((box, close) => {
    box.classList.add("ttuto");
    const draw = () => { box.innerHTML = '<p class="sub">' + (i + 1) + " / " + STEPS.length + "</p><h3>" + esc(STEPS[i][0]) + "</h3><p>" + esc(STEPS[i][1]) + '</p><button class="btn wide" data-n>' + (i < STEPS.length - 1 ? "Suivant" : "C’est parti !") + '</button><a class="linkbtn" href="#/tccg/guide" data-g>📖 Lire le guide complet</a>'; };
    draw();
    const done = () => { close(); if (!me().tuto) commit(d => { d.tuto = true; }); };
    box.addEventListener("click", e => { if (e.target.closest("[data-g]")) return done(); if (!e.target.closest("[data-n]")) return; i++; if (i >= STEPS.length) done(); else draw(); });
  });
}
// ---------- guide du jeu ----------
export function guideView() {
  const S2 = [
    ["🎴 Call Up et raretés", "Raretés : N (bronze), R (argent), SR (doré), SSR (doré brillant), UR (arc-en-ciel), LR (diamant). Une carte tombe avec sa rareté de base (N à SSR) puis s’éveille jusqu’à sa rareté max. Les SSR qui peuvent devenir LR sont les plus rares (dos arc-en-ciel à l’invocation).<br>Taux : show de la semaine N 55 %, R 30 %, SR 11 %, SSR 3,5 %, SSR → LR 0,5 % · PLE / PPV N 42 %, R 32 %, SR 17 %, SSR 7,5 %, SSR → LR 1,5 % · booster gratuit N 65 %, R 27 %, SR 7 %, SSR 1 %. Le Méga monte les taux et garantit 1 SSR.<br>Le Call Up montre tous les boosters côte à côte : glisse pour changer, ou touche une catégorie en haut. Il se souvient du dernier booster regardé. « Ouverture rapide » : toutes les cartes d’un coup, sans l’entrée."],
    ["🃏 Roster", "En haut, ta carte vedette (ta 1re favorite ⭐, touche « Changer »). Dessous, une étagère par rareté ; « Tout voir » ouvre le classeur complet (tri par rareté, niveau, type, promotion, pages de 9). Dans le classeur, « Choisir plusieurs » pour mettre en favori ou virer plusieurs cartes. Une carte favorite ne peut pas être virée ni vendue."],
    ["🔍 Appui long", "Partout dans le jeu, maintiens ton doigt sur une carte : elle s’affiche en grand, en entier. Touche l’écran pour la fermer."],
    ["✨ Éveil", "Quand une carte est au niveau max et que tu as les objets d’éveil (et les médailles du catcheur pour l’UR → LR), elle passe à la rareté suivante. Elle garde son niveau."],
    ["🏋️ Entraînement", "Un mini-jeu par stat : Force (soulever au bon moment), Agilité (sauter les obstacles), Charisme (toucher les ronds), Endurance (taper le plus vite), Technique (sauter à la corde au bon moment), Niveau (combat rapide : touche et glisse) — en Low, Mid ou Top pour +1, +3 ou +5. 5 entraînements de stats par carte ; un mini-jeu raté se recommence. Coûte du Momentum, de la Pop et du Push."],
    ["🌳 Évolution", "Chaque carte a son arbre : ceintures qu’il a vraiment tenues, anciennes gimmicks… Réunis les conditions (ceinture, objet, médailles, niveau, victoires), confirme : la carte change de gimmick et de stats. La rareté ne change jamais ; le niveau revient à 1 mais les bonus d’entraînement restent. L’objet ou la ceinture utilisés disparaissent."],
    ["🔗 Doublons et 🏅 médailles", "Les doublons d’une carte fusionnent dans la plus forte, qui gagne de l’XP. Une carte peut aussi devenir une médaille du catcheur : il en faut pour certains éveils, évolutions et pour acheter des ceintures."],
    ["⚔️ Combats", "Choisis 1, 2 ou 3 cartes, ton leader 👑 (la barre de vie de ton équipe = les stats de toutes tes cartes additionnées), 1 soutien (+10 % aux cartes de son type) et jusqu’à 2 objets. Pierre-feuille-ciseaux pour savoir qui commence, puis chacun son tour : une carte attaque par tour. Touche ta carte puis la carte visée (ou fais-la glisser dessus), choisis la stat."],
    ["💥 Dégâts", "Dégâts = 15 + 3 × l’écart entre ta stat et la sienne (Force contre Force, Agilité contre Agilité…). Si sa stat est plus forte, c’est toi qui prends les dégâts. Avantage de type : ×2 ; désavantage : ×0,5. Une barre de timing (PARFAIT ×1,3, RATÉ ×0,8) et un petit hasard (±10 %) font le reste. Le message avant l’attaque te donne le calcul."],
    ["🎡 Types", "Dominator bat Aggressor, qui bat Technician, qui bat Opportunist, qui bat Showman, qui bat Dominator. Pendant un combat, touche le bouton rond « TYPES » en haut à droite pour revoir la roue."],
    ["🔥 Finisher", "Chaque coup remplit la barre de Finisher. Pleine : choisis la carte qui le lance ; il frappe toute l’équipe adverse. Dégâts = niveau de finisher (N 100, R 120, SR 130, SSR 150, UR 170, LR 200) + un effet au hasard : étourdir une carte, rejouer, soin, attaque adverse réduite ou boost ×1,5. Durée : 1 tour (N, R, SR), 2 tours (SSR), 3 tours (UR, LR)."],
    ["🤼 Le tombé", "Barre de vie adverse à 0 : touche « PIN » puis arrête la barre au bon moment. Si l’adversaire se dégage, sa barre remonte un peu (de plus en plus dur à chaque fois). Pareil pour toi : arrête la barre avant le 3 !"],
    ["🤖 Combat automatique", "Touche « ▶ AUTO » en haut du combat : l’app joue pour toi (la meilleure attaque, le finisher dès qu’il est plein, le tombé). Les objets ne sont pas utilisés en auto. Touche « ⏸ AUTO » pour reprendre la main. À la fin, « 🔁 Rejouer » relance le même combat (Match rapide : tout de suite, avec de nouveaux adversaires ; les autres : après l’attente)."],
    ["🏅 Médailles en Event", "Chaque combat gagné en Event donne des médailles des catcheurs que tu as affrontés : 1 en Low, 2 en Mid, 3 en Top."],
    ["🧰 Objets", "Équipement (Shop) : une pièce par carte, bonus de stats pour toujours, on peut la retirer. Objets de combat : 2 par combat, un seul usage. Ils marchent selon leur qualité (commun 50 %, rare 65 %, légendaire 80 %) ; sinon ils ratent ou se retournent contre toi !"],
    ["🛒 Shop et 🤝 Échange", "Shop : équipement, objets d’éveil et de combat contre des dollars, ceintures du jour contre des médailles. Échange : propose des cartes ou des ressources aux membres, ou mets tes cartes aux enchères (24 h)."]
  ];
  return '<section class="tccghead"><h1>Guide du jeu</h1><small>Tout comprendre, épisode par épisode</small></section><div class="tguidebox">' + S2.map(x => "<details><summary>" + x[0] + "</summary><p>" + x[1] + "</p></details>").join("") + '</div><p class="tnote" style="text-align:center"><button class="linkbtn" data-act="tcgtuto">Revoir le tuto</button></p>';
}
// ---------- Shop ----------
const PRICE = { C: 300, R: 900, E: 2500, L: 6000, M: 15000 };
export const priceOf = x => +x.price || (x.t === "combat" ? 500 : x.t === "equip" ? 4000 : PRICE[x.g] || 500);
export const BELT_MED = { world: 5, sec: 3, tag: 2 };
export const beltMedals = t => +((cfg().beltMed || {})[t.id]) || BELT_MED[prestige(t)];
const medTotal = d => Object.keys(d.medals || {}).reduce((a, k) => a + (+d.medals[k] || 0), 0);
let shopTab = "equip";
ACT.tcgshoptab = el => { shopTab = el.dataset.v; changed("tcg"); };
export function shopView() {
  const d = me(), T = { equip: "🧤 Équipement", eveil: "✨ Éveil", combat: "⚔️ Combat", belts: "🏆 Ceintures", gim: "🎟️ Gimmicks" };
  let h = '<section class="tccghead"><h1>Shop</h1><small>Le stand du merch</small></section><div class="ttabs">' + Object.keys(T).map(k => '<button class="ttab' + (shopTab === k ? " on" : "") + '" data-act="tcgshoptab" data-v="' + k + '">' + T[k] + "</button>").join("") + "</div>";
  const row = x => { const p = priceOf(x), own = d.items[x.id] || 0;
    return '<div class="item">' + itemIc(x, "tico big") + '<span class="lbl"><b>' + esc(x.n) + "</b><small>" + esc(x.d || "") + (x.t === "combat" && x.q ? " · " + QNAME[x.q] + " : marche " + Math.round(QCH[x.q] * 100) + " % du temps" : "") + " · tu en as " + own + "</small></span>" +
      '<span class="tbuy"><button class="btn small" data-act="tcgbuy" data-id="' + x.id + '"' + (d.res.money >= p ? "" : " disabled") + ">💵 " + p + "</button>" + (S.isAdmin ? '<button class="linkbtn" data-act="tcgitemimg" data-id="' + x.id + '">🖼️</button>' : "") + "</span></div>"; };
  if (shopTab === "equip") h += '<p class="tnote">Une pièce par carte, pour toujours (tu peux la retirer dans la fiche de la carte). Équipe-la depuis le Roster.</p><div class="list tshop">' + items().filter(x => x.t === "equip" && x.shop !== false).map(row).join("") + "</div>";
  if (shopTab === "eveil") h += '<p class="tnote">Pour faire passer une carte au niveau max à la rareté suivante.</p><div class="list tshop">' + items().filter(x => x.t === "eveil" && x.shop !== false).map(row).join("") + "</div>";
  if (shopTab === "combat") h += '<p class="tnote">2 objets par combat, un seul usage. Selon leur qualité, ils marchent… ou se retournent contre toi.</p><div class="list tshop">' + items().filter(x => x.t === "combat" && x.shop !== false).map(row).join("") + "</div>";
  if (shopTab === "gim") h += '<div class="list tshop"><div class="item"><span class="tico big e">🎟️</span><span class="lbl"><b>5 gimmicks</b><small>De quoi invoquer un booster simple</small></span><button class="btn small" data-act="tcgbuy" data-id="gim"' + (d.res.money >= 1000 ? "" : " disabled") + '>💵 1000</button></div><div class="item"><span class="tico big e">🎟️</span><span class="lbl"><b>50 gimmicks</b><small>De quoi invoquer un Multi</small></span><button class="btn small" data-act="tcgbuy" data-id="gim50"' + (d.res.money >= 9000 ? "" : " disabled") + ">💵 9000</button></div></div>";
  if (shopTab === "belts") {
    const L = dailyBelts();
    h += '<p class="tnote">4 ceintures chaque jour, payées en médailles de catcheurs (tu as ' + medTotal(d) + " médaille" + (medTotal(d) > 1 ? "s" : "") + "). Donne une ceinture à un catcheur qui l’a vraiment tenue pour le faire évoluer.</p>" +
      '<div class="list tshop tbshop">' + L.map(t => { const p = beltMedals(t);
        return '<div class="item">' + beltImgHTML(t.id) + '<span class="lbl"><b>' + esc(t.n) + "</b><small>" + esc(t.k) + " · " + EVO_NAME[prestige(t)] + " · tu en as " + (d.items[BELT + t.id] || 0) + '</small></span><button class="btn small" data-act="tcgbuybelt" data-id="' + esc(t.id) + '"' + (medTotal(d) >= p ? "" : " disabled") + ">🏅 " + p + "</button></div>"; }).join("") + "</div>";
  }
  return h;
}
// une ceinture se paie en médailles : on choisit lesquelles donner
ACT.tcgbuybelt = el => {
  const t = dailyBelts().find(x => x.id === el.dataset.id); if (!t) return toast("Cette ceinture n’est plus en boutique");
  const need = beltMedals(t), pick = {};
  modal((box, close) => {
    const draw = () => {
      const d = me(), n = Object.values(pick).reduce((a, b) => a + b, 0), M = Object.keys(d.medals || {}).filter(k => d.medals[k] > 0).sort();
      box.innerHTML = "<h3>" + beltImgHTML(t.id) + " " + esc(t.n) + '</h3><p class="sub">Choisis ' + need + " médaille" + (need > 1 ? "s" : "") + " à donner (" + n + " / " + need + ").</p>" +
        '<div class="list">' + M.map(k => '<div class="item"><span class="lbl"><b>🏅 ' + esc(k) + "</b><small>Tu en as " + d.medals[k] + '</small></span><span class="tstep"><button class="btn small ghost" data-m="' + esc(k) + '" data-v="-1">−</button><b>' + (pick[k] || 0) + '</b><button class="btn small ghost" data-m="' + esc(k) + '" data-v="1">＋</button></span></div>').join("") + "</div>" +
        '<button class="btn wide" data-y' + (n === need ? "" : " disabled") + ">🏆 Acheter la ceinture</button><button class=\"btn wide ghost\" style=\"margin-top:6px\" data-close>Annuler</button>";
    };
    draw();
    box.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return close();
      const b = e.target.closest("[data-m]"); if (b) { const d = me(), k = b.dataset.m, n = Object.values(pick).reduce((a, x) => a + x, 0), v = +b.dataset.v; const cur = pick[k] || 0, nx = cur + v; if (nx < 0 || nx > (d.medals[k] || 0) || (v > 0 && n >= need)) return; pick[k] = nx; return draw(); }
      if (e.target.closest("[data-y]")) { let ok = false;
        commit(d => { if (Object.keys(pick).some(k => (d.medals[k] || 0) < pick[k])) return; Object.keys(pick).forEach(k => { d.medals[k] -= pick[k]; if (d.medals[k] <= 0) delete d.medals[k]; }); d.items[BELT + t.id] = (d.items[BELT + t.id] || 0) + 1; ok = true; });
        close(); toast(ok ? "🏆 " + t.n + " achetée ✓" : "Il manque des médailles"); }
    });
  });
};
ACT.tcgbuy = el => {
  const id = el.dataset.id, it = itemById(id), p = id === "gim" ? 1000 : id === "gim50" ? 9000 : it ? priceOf(it) : 0; if (!p) return;
  let ok = false;
  commit(d => { if (d.res.money < p) return; d.res.money -= p; if (id === "gim") d.res.gim += 5; else if (id === "gim50") d.res.gim += 50; else d.items[id] = (d.items[id] || 0) + 1; ok = true; });
  toast(ok ? "Acheté ✓" : "Pas assez d’argent");
};
// modo : image d'un objet (sinon son émoji)
ACT.tcgitemimg = el => {
  if (!S.isAdmin) return; const id = el.dataset.id;
  pickFile("image/*", "img/tcg/objets/", path => saveCfg(c => { c.items = c.items || {}; c.items[id] = Object.assign({}, c.items[id] || {}, { img: path }); }, "image d’objet : " + id).then(ok => ok && toast("Image enregistrée ✓")));
};
