// Mode Univers : parties, menu général, courrier, actualité, buzz, monde (catcheurs, fédérations, récompenses, Hall of Fame, magazine,
// encyclopédie), fiche d'un catcheur (stats, gimmick, contrat, historique, relations, dialogue).
import { S, ACT, FORM } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { ST, STYLES, ROLES, FEDS0, dayLabel, shortDate, dateOf, fmtM, fmtK, stars, recTxt, salOf, clamp, rnd, pick, uid } from "./world.js";
import { newWorld } from "./world.js";
import { loadUData, GT, DEM, SROLE } from "./data.js";
import { meF, roster, avail, injured, risk, startGame, nextMyEvents, awardsOf, mail, news, teamName, wn } from "./sim.js";
import { e_, relAdd, champIds, isBig, isMine } from "./base.js";
import { upgrade, gimOf, fitOf } from "./v2.js";
import { setMentor, setTrain } from "./crea.js";
import { retireW } from "./life.js";
import { release, part, partAdd, hireLegend } from "./deal.js";
import { metaAll, loadSlot, delSlot } from "./save.js";
import { U, go, redraw, persist, shell, tabs, chips, face, crest, mailAv, wnH, teamH, sidesH, whoIn, imgFed, imgEv, imgT, imgW, imgBtn, unread, audTxt, autoPlay } from "./core.js";
import { searchBody, statTxt, signal, legendBox, relBody } from "./ui3.js";
import { hofBody, magBody, encBody, homeExtra, tutoCheck } from "./ui5.js";
import { gmFace, gmName } from "./setup.js";
import { known, bondWord, enWord, bondAdd } from "./vn.js";
import { DNA, dnaMain } from "./dna.js";

const pctBar = (v, c) => '<span class="uvbar"><i style="width:' + clamp(v) + "%" + (c ? ";background:" + c : "") + '"></i></span>';
const enC = v => v >= 60 ? "#63d69c" : v >= 35 ? "#ffd27a" : "#ff8a7e";
const alTxt = a => a === "heel" ? '<span class="uvheel">Heel</span>' : '<span class="uvface">Face</span>';
const fedN = (G, k) => k ? ((G.F[k] || {}).n || k) : "Libre";

// ---------- parties ----------
export function partiesView() {
  const M = metaAll();
  let h = '<div class="uvparties"><a class="uvback" href="#/jeux">‹ Jeux</a><h1>Mode Univers</h1><p class="uvmut">Tu as 3 parties. Choisis-en une ou commence une nouvelle carrière de GM.</p>';
  for (let s = 1; s <= 3; s++) {
    const m = M.find(x => x.slot === s);
    if (m) h += '<div class="uvslot"><span class="uvsn">Partie ' + s + '</span><div class="uvfedrow"><span class="uvcrest ini" style="background:' + esc(m.c || "#f5b13d") + '">' + esc(m.sh || "?") + "</span><div><b>" + esc(m.n) + "</b><small>" + (m.fed === "ME" ? "Ta fédération, créée par toi" : "Fédération existante") + "</small></div></div>" +
      "<p>" + esc(dayLabel(m.day || 0)) + " · Année " + dateOf(m.day || 0).y + (m.aud ? " · dernière audience " + fmtM(m.aud) : "") + "</p>" +
      '<div class="uvrow2"><button type="button" class="uvbtn pri" data-act="uvload" data-s="' + s + '">Continuer</button><button type="button" class="uvbtn del" data-act="uvdelslot" data-s="' + s + '">Supprimer</button></div></div>';
    else h += '<div class="uvslot empty"><span class="uvsn">Partie ' + s + ' · vide</span><a class="uvbtn pri" href="#/univers/nouveau/' + s + '">Nouvelle partie</a></div>';
  }
  return h + "</div>";
}
// la création d'une partie est dans setup.js (21 nov.)
// charger une partie (et la mettre à niveau si elle vient d'une ancienne version)
export async function openSlot(s) {
  const G = await loadSlot(s).catch(() => null); if (!G) return null;
  await loadUData(); try { upgrade(G); } catch (e) { console.error(e); }
  return G;
}
ACT.uvload = async el => { const s = +el.dataset.s; U.loading = true; redraw(); const G = await openSlot(s); U.loading = false; if (!G) { toast("Partie introuvable sur ce téléphone"); redraw(); return; } U.G = G; U.slot = s; try { localStorage.setItem("ctv.univ.slot", String(s)); } catch (e) {} go("#/univers/g"); redraw(); };
ACT.uvdelslot = el => {
  const s = +el.dataset.s;
  modal((box, close) => { box.classList.add("uvmodal"); box.innerHTML = "<h3>Supprimer la partie " + s + " ?</h3><p class=\"uvmut\">C’est définitif.</p><button type=\"button\" class=\"uvbtn del\" data-y=\"1\">Oui, supprimer</button><button type=\"button\" class=\"uvbtn ghost\" data-n=\"1\">Garder</button>";
    box.addEventListener("click", async e => { if (e.target.closest("[data-n]")) close(); if (e.target.closest("[data-y]")) { await delSlot(s); if (U.slot === s) { U.G = null; U.slot = 0; } close(); redraw(); } }); });
};

// ---------- menu général ----------
export function homeView() {
  const G = U.G, f = meF(G), R = roster(G), aud = f.aud.slice(-6), last = f.last;
  const mx = Math.max(0.01, ...aud), feds = Object.values(G.F).map(x => ({ k: x.id, a: x.aud.length ? x.aud.slice(-4).reduce((s, v) => s + v, 0) / x.aud.slice(-4).length : x.aud0 })).sort((a, b) => b.a - a.a);
  const rank = feds.findIndex(x => x.k === G.me) + 1, top3 = R.slice().sort((a, b) => b.pop - a.pop).slice(0, 3);
  const nx = nextMyEvents(G, 3), today = nx[0] && nx[0].day === G.day && !nx[0].done ? nx[0] : null;
  const mails = G.mail.slice().reverse().slice(0, 3), inj = R.filter(w => injured(G, w)).length, tired = R.filter(w => w.en < 50 && !injured(G, w)).length;
  const mor = R.length ? Math.round(R.reduce((s, w) => s + w.mor, 0) / R.length) : 0, prom = (G.prom || []).filter(p => p.st === "cours").length;
  const newsL = G.news.slice().reverse().slice(0, 3), cur = G.fin.cur, month = cur.tv + cur.tix + cur.merch + cur.pub - cur.sal - cur.prod;
  const body = (U.draftTile ? U.draftTile(G) : "") + (U.sceneTile ? U.sceneTile(G) : "") + (G.gm ? '<div class="uvgmh">' + gmFace(G, 36) + '<span class="uvgrow"><small>Ton GM</small><b>' + esc(gmName(G)) + '</b></span><a class="uvgmtag" href="#/univers/bureau/rep">' + (G.mark ? "Mark" : "Smart") + (G.dna ? " · " + esc(DNA[dnaMain(G)].n) : "") + "</a></div>" : "") + (today ? '<div class="uvalert"><b>Ce soir : ' + esc(today.n) + '</b><div class="uvrow2"><a class="uvbtn pri" href="#/univers/ev/' + encodeURIComponent(today.id) + '">Préparer la carte</a><button type="button" class="uvbtn" data-act="uvautolive" data-id="' + esc(today.id) + '">Vivre en direct</button><button type="button" class="uvbtn ghost" data-act="uvautoplay" data-id="' + esc(today.id) + '">Laisser l’IA faire</button></div></div>' : "") +
    '<div class="uvfedrow big">' + crest(G, G.me, 46) + "<div><b>" + esc(f.n) + "</b><small>" + (rank ? rank + "e sur " + feds.length + " à l’audience" : "") + " · " + fmtK(f.money) + " en banque · réputation " + Math.round(G.rep || 50) + "</small></div></div>" +
    (U.homeV3 ? U.homeV3(G) : "") + homeExtra(G) +
    '<a class="uvtile" href="#/univers/courrier"><div class="uvth">Courrier <i>' + unread(G) + " non lu" + (unread(G) > 1 ? "s" : "") + "</i></div>" + mails.map(m => '<div class="uvline">' + mailAv(G, m, 28) + "<span class=\"uvgrow\">" + esc(m.subj) + "</span>" + (m.read ? "" : '<span class="uvdot" aria-label="non lu"></span>') + "</div>").join("") + "</a>" +
    '<div class="uvtile"><div class="uvth">Audience <i>' + (last ? "dernier show" : "pas encore de show") + "</i></div>" + (last ? '<div class="uvaud"><div><div class="uvbig">' + fmtM(last.aud) + '</div><div class="uvmut">' + esc(last.n) + " · " + esc(dayLabel(last.d)) + " · " + stars(last.r) + '</div><div class="uvsm">Objectif du diffuseur : ' + fmtM(f.tv.min) + (last.aud >= f.tv.min ? ' <span class="uvok">✓ atteint</span>' : ' <span class="uvko">✗ raté</span>') + '</div></div><div class="uvbars" role="img" aria-label="Audience des derniers shows">' + aud.map((v, i) => '<span style="height:' + Math.max(6, Math.round(v / mx * 60)) + "px" + (i === aud.length - 1 ? ";background:#f5b13d" : "") + '"></span>').join("") + "</div></div>" : '<p class="uvmut">Ton premier show arrive bientôt.</p>') + '<a class="uvsm" href="#/univers/activite/aud">Audiences de la semaine ›</a></div>' +
    '<div class="uvtile"><div class="uvth">Popularité <i>' + Math.round(f.pop) + " / 100</i></div>" + pctBar(f.pop) + '<p class="uvmut">' + (f.pop < 45 ? "Locale" : f.pop < 65 ? "Nationale" : f.pop < 80 ? "Internationale" : "Mondiale") + " · plus elle monte, plus tu peux signer des stars</p>" +
    top3.map(w => '<a class="uvline" href="#/univers/c/' + esc(w.id) + '">' + face(G, w, 28) + '<span class="uvgrow">' + esc(w.n) + "</span><b>" + Math.round(w.pop) + "</b></a>").join("") + "</div>" +
    '<a class="uvtile" href="#/univers/bureau/agenda"><div class="uvth">Calendrier <i>agenda</i></div>' + (nx.length ? nx.map(e => '<div class="uvline"><span class="uvdate">' + esc(dayLabel(e.day)) + '</span><span class="uvgrow">' + esc(e.n) + '</span><span class="uvmut">' + (e.kind === "tv" ? "TV" : e.kind.toUpperCase()) + "</span></div>").join("") : '<p class="uvmut">Rien de prévu</p>') + "</a>" +
    '<a class="uvtile" href="#/univers/actu"><div class="uvth">Actualité <i>tout voir</i></div>' + (newsL.length ? newsL.map(n => '<div class="uvline">' + esc(n.t) + "</div>").join("") : '<p class="uvmut">Pas encore d’actualité</p>') + "</a>" +
    '<div class="uv2"><a class="uvtile" href="#/univers/activite/fin"><div class="uvth">Finances</div><div class="uvnum">' + fmtK(f.money) + '</div><div class="uvsm"><span class="' + (month >= 0 ? "uvok" : "uvko") + '">' + (month >= 0 ? "▲ " : "▼ ") + fmtK(month) + "</span> ce mois</div></a>" +
    '<a class="uvtile" href="#/univers/fede/m"><div class="uvth">Personnel</div><div class="uvsm">Moral : ' + (mor >= 65 ? "Bon" : mor >= 45 ? "Moyen" : "Mauvais") + "</div>" + pctBar(mor, mor >= 65 ? "#63d69c" : mor >= 45 ? "#ffd27a" : "#ff8a7e") + '<div class="uvmut">' + inj + " blessé" + (inj > 1 ? "s" : "") + " · " + tired + " fatigué" + (tired > 1 ? "s" : "") + " · " + prom + " promesse" + (prom > 1 ? "s" : "") + "</div></a></div>";
  setTimeout(tutoCheck, 400);
  return shell("g", "Menu général", "", body);
}
ACT.uvautoplay = el => { const ev = U.G.ev.find(e => e.id === el.dataset.id); if (ev) autoPlay(ev); };
ACT.uvautolive = el => { const ev = U.G.ev.find(e => e.id === el.dataset.id); if (ev && U.goLive) U.goLive(ev); };

// ---------- courrier ----------
const OK = [["OK", "ok"]];
const MACTS = {
  aud: m => [["Voir les finances", "go", "#/univers/activite/fin"], ["Audiences de la semaine", "go", "#/univers/activite/aud"], ["OK", "ok"]],
  inj: m => [["Envoyer chez un spécialiste (50 k$)", "heal"], ["Le laisser se reposer", "ok"]],
  agent: m => [["Ouvrir la négociation", "go", "#/univers/nego/" + m.w], ["Plus tard", "ok"]],
  demand: m => [["Promettre un match de titre (dans les 30 jours)", "promise"], ["Refuser poliment", "refuse"]],
  sponsor: m => [["Accepter", "spons"], ["Négocier (+20 %)", "sponsneg"], ["Refuser", "no"]],
  conflict: m => [["Les punir (amende)", "punish"], ["En faire une storyline !", "feud"], ["Ignorer", "ignore"]],
  young: m => [["Le faire monter dans l’effectif", "promote"], ["Plus tard", "ok"]],
  show: m => [["Préparer la carte", "go", "#/univers/ev/" + encodeURIComponent(m.ev)], ["Vivre en direct (carte de l’IA)", "autolive"], ["Laisser l’IA faire la carte et jouer", "autoplay"]],
  tv: m => [["Accepter", "tvok"], ["Négocier (+15 %)", "tvneg"]],
  tvoffers: m => [["Comparer les offres", "go", "#/univers/activite/ct"]],
  fa: m => [["Négocier avec lui", "go", "#/univers/nego/" + m.w], ["Voir sa fiche", "go", "#/univers/c/" + m.w]],
  scout: m => [["Chercher des catcheurs", "go", "#/univers/monde/w"], ["OK", "ok"]],
  req: m => [["D’accord", "rqyes"], ["Non", "rqno"]],
  playhurt: m => [["D’accord, il catche (risque de rechute)", "hurtyes"], ["Non, il se soigne", "hurtno"]],
  retire: m => [["Lancer une tournée d’adieu (2 mois)", "farewell"], ["Qu’il prenne sa retraite tout de suite", "retnow"], ["Le convaincre de continuer", "retno"]],
  askrel: m => [["Rupture à l’amiable", "relami"], ["Lui parler (il reste)", "relno"], ["Le contrat (toutes les options)", "go", "#/univers/c/" + m.w + "/c"]],
  crowd: m => [["On le suit : push !", "pushyes"], ["On l’ignore", "pushno"]],
  boo: m => [["On continue", "booon"], ["Il passe heel", "booheel"], ["Changer son personnage", "go", "#/univers/creatif/gim"]],
  team: m => [["Donner un nom à l’équipe", "teamname"], ["Garder ce nom", "ok"]],
  tourwin: m => [["Voir le tournoi", "go", "#/univers/creatif/to"], ["OK", "ok"]],
  hof: m => [["Choisir qui intronisé", "go", "#/univers/monde/hof"]],
  press: m => [["Ton agressif (plus de hype)", "pressagr"], ["Ton respectueux (réputation)", "pressres"], ["Annoncer une surprise", "presssur"]],
  scandal: m => [["Le suspendre une semaine", "scsusp"], ["Excuses publiques", "scsorry"], ["Ne rien faire", "scno"]],
  rumor: m => [["Le rassurer", "rumyes"], ["Ignorer", "ok"]],
  storm: m => [["Maintenir le show (moins de public)", "stormkeep"], ["Annuler l’épisode", "stormcancel"]],
  celeb: m => [["Accepter (80 k$)", "celebyes"], ["Refuser", "no"]],
  city: m => [["Accepter (+150 k$)", "cityyes"], ["Refuser", "no"]],
  partoffer: m => [["Accepter le partenariat", "partyes"], ["Refuser", "partno"]],
  job: m => [["Voir l’offre", "go", "#/univers/bureau/rep"]],
  fired: m => [["Voir les offres d’emploi", "go", "#/univers/bureau/rep"], ["Menu général", "go", "#/univers/g"]],
  bankrupt: m => [["Menu général", "go", "#/univers/g"]],
  retrole: m => [["Lui proposer un rôle", "go", "#/univers/c/" + m.w + "/c"], ["Le laisser partir", "ok"]],
  mag: m => [["Lire le " + "magazine", "go", "#/univers/monde/mag"]],
  war: m => [["Voir la rivale", "go", "#/univers/bureau/riv"], ["OK", "ok"]],
  taunt: m => [["Lui répondre au micro", "tauntyes"], ["Ne pas répondre", "tauntno"]],
  info: m => OK
};
const MCAT = { war: "audience", taunt: "offres", aud: "audience", tv: "offres", tvoffers: "offres", sponsor: "offres", celeb: "offres", city: "offres", partoffer: "offres", job: "offres", agent: "catcheurs", demand: "catcheurs", fa: "catcheurs", req: "catcheurs", playhurt: "catcheurs", retire: "catcheurs", askrel: "catcheurs", crowd: "catcheurs", boo: "catcheurs", team: "catcheurs", rumor: "catcheurs", scandal: "catcheurs", scout: "catcheurs", retrole: "catcheurs" };
export function courrierView(id) {
  const G = U.G, m = id && G.mail.find(x => x.id === id);
  if (m) {
    if (!m.read) { m.read = true; persist(); }
    const dk = U.deckCard ? U.deckCard(G, m) : "";
    if (dk) return shell("courrier", "Courrier", "", '<a class="uvback" href="#/univers/courrier">‹ Tous les messages</a>' + dk);
    const ev = m.k === "show" && G.ev.find(e => e.id === m.ev), acts = m.k === "show" && ev && ev.done ? [["Voir les résultats", "go", "#/univers/ev/" + encodeURIComponent(ev.id)]] : (MACTS[m.k] || MACTS.info)(m);
    const ids = m.ids || [], w = m.w && G.W[m.w];
    const body = '<a class="uvback" href="#/univers/courrier">‹ Tous les messages</a><div class="uvfrom">' + mailAv(G, m, 40) + "<div><b>" + esc(m.from) + '</b><small>' + esc(m.role || "") + " · " + esc(dayLabel(m.d)) + "</small></div></div>" +
      '<h2 class="uvh2">' + esc(m.subj) + '</h2><p class="uvbody">' + esc(m.body || "") + "</p>" +
      (w && m.k !== "scout" ? '<a class="uvw" href="#/univers/c/' + esc(w.id) + '">' + face(G, w, 32) + '<span class="uvgrow"><b>' + esc(w.n) + "</b><small>" + esc(fedN(G, w.fed)) + "</small></span></a>" : "") +
      ids.map(i => G.W[i] ? '<a class="uvw" href="#/univers/nego/' + esc(i) + '">' + face(G, G.W[i], 32) + '<span class="uvgrow"><b>' + esc(G.W[i].n) + "</b><small>" + esc(signal(G, G.W[i])[0] || "") + "</small></span></a>" : "").join("") +
      (m.done ? '<div class="uvdone" role="status">' + esc(m.done) + "</div>" : "") +
      '<div class="uvacts">' + acts.filter(a => a[1] === "go" || !m.done).map(a => a[1] === "go" ? '<a class="uvbtn pri" href="' + esc(a[2]) + '">' + esc(a[0]) + "</a>" : '<button type="button" class="uvbtn' + (a === acts[0] ? " pri" : "") + '" data-act="uvmail" data-id="' + esc(m.id) + '" data-a="' + a[1] + '">' + esc(a[0]) + "</button>").join("") + "</div>";
    return shell("courrier", "Courrier", "", body);
  }
  const cat = U.f.mail, L = G.mail.slice().reverse().filter(x => cat === "tout" || (MCAT[x.k] || "perso") === cat);
  const body = chips("mail", [["tout", "Tout"], ["perso", "Personnel"], ["catcheurs", "Catcheurs"], ["audience", "Audiences"], ["offres", "Offres"]], cat) +
    (L.length ? '<div class="uvlist">' + L.slice(0, 80).map(x => '<a class="uvmsg' + (x.read ? "" : " new") + '" href="#/univers/courrier/' + esc(x.id) + '">' + mailAv(G, x, 36) + '<span class="uvgrow"><b>' + esc(x.from) + (x.read ? "" : ' <span class="uvdot" aria-label="non lu"></span>') + "<i>" + esc(shortDate(x.d)) + "</i></b><span>" + esc(x.subj) + "</span>" + (x.done ? "<small>✓ " + esc(x.done) + "</small>" : "") + "</span></a>").join("") + "</div>" : '<p class="uvempty">Pas de message ici.</p>') +
    (G.mail.some(x => !x.read) ? '<button type="button" class="uvbtn ghost" data-act="uvreadall">Tout marquer comme lu</button>' : "");
  return shell("courrier", "Courrier", "", body);
}
// effet de chaque décision sur la confiance du propriétaire
const PATRON = { spons: 2, sponsneg: 1, tvok: 2, tvneg: 1, cityyes: 2, celebyes: 1, partyes: 1, punish: 1, ignore: -1, scsusp: 1, scno: -3, stormcancel: -2, pressres: 1, farewell: 1, heal: 1, tauntyes: 1 };
export { MACTS };
ACT.uvreadall = () => { U.G.mail.forEach(m => { m.read = true; }); persist(); redraw(); };
ACT.uvmail = el => {
  const G = U.G, m = G.mail.find(x => x.id === el.dataset.id), a = el.dataset.a; if (!m) return;
  const f = meF(G), w = m.w && G.W[m.w], ev = m.ev && G.ev.find(e => e.id === m.ev);
  const pay = k => { if (f.money < k) { toast("Pas assez d’argent (" + fmtK(f.money) + ")"); return false; } f.money -= k; G.fin.cur.prod += k; return true; };
  let out = "Réponse envoyée.";
  switch (a) {
    case "ok": out = "Vu."; break;
    case "heal": if (w && w.inj && !w.inj.spec) { if (!pay(50)) return; w.inj.until = Math.max(G.day + 3, G.day + Math.round((w.inj.until - G.day) * 0.6)); w.inj.spec = true; out = "Spécialiste payé : retour le " + dayLabel(w.inj.until) + "."; } break;
    case "promise": if (w) { G.prom.push({ id: uid("p"), w: w.id, t: "titre", until: G.day + 30, st: "cours", txt: "Match de titre avant le " + shortDate(G.day + 30) }); w.mor = clamp(w.mor + 10); out = "Promesse ajoutée (Ma fédé › Promesses). " + w.n + " est motivé" + e_(w) + "."; } break;
    case "refuse": if (w) { w.mor = clamp(w.mor - 15); out = w.n + " est déçu" + e_(w) + "."; } break;
    case "spons": G.spons.push({ n: m.from, pay: m.pay, min: m.min, until: G.day + 182 }); out = "Contrat signé : +" + m.pay + " k$ par show (Activité › Contrats TV et pub)."; break;
    case "sponsneg": if (rnd() < 0.5) { const p = Math.round(m.pay * 1.2); G.spons.push({ n: m.from, pay: p, min: m.min, until: G.day + 182 }); out = "Ils acceptent : " + p + " k$ par show."; } else out = "Ils refusent et retirent leur offre."; break;
    case "no": out = "Offre refusée."; break;
    case "punish": [m.a, m.b].forEach(i => { const x = G.W[i]; if (x) x.mor = clamp(x.mor - 5); }); G.tens = G.tens.filter(t => !(t.a === m.a && t.b === m.b)); out = "Amende donnée. Le calme revient."; break;
    case "feud": G.sl.push({ id: uid("s"), fed: G.me, n: wn(G, m.a) + " contre " + wn(G, m.b), a: [m.a], b: [m.b], len: 5, wk: 0, heat: 35, turn: null, done: false, from: G.day }); G.tens = G.tens.filter(t => !(t.a === m.a && t.b === m.b)); out = "Storyline créée (Créatif › Storylines). Le vrai conflit devient une feud !"; break;
    case "ignore": out = "Tu laisses faire. Le vestiaire n’aime pas trop."; roster(G).forEach(x => { x.mor = clamp(x.mor - 1); }); break;
    case "promote": { const y = (G.dev || []).find(x => x.id === m.y); if (!y) { out = "Déjà fait."; break; } promoteYoung(G, y); out = y.n + " rejoint l’effectif !"; } break;
    case "autoplay": { m.done = "Show joué par l’IA."; if (ev && !ev.done) { autoPlay(ev); return; } break; }
    case "autolive": { if (ev && !ev.done && U.goLive) { m.done = "Show vécu en direct."; m.read = true; U.goLive(ev); return; } break; }
    case "tvok": f.tv.pay = m.pay; f.tv.end = G.day + 365; out = "Contrat TV renouvelé : " + m.pay + " k$ par show."; break;
    case "tvneg": if (rnd() < 0.55) { f.tv.pay = Math.round(m.pay * 1.15); f.tv.end = G.day + 365; out = "Ils acceptent : " + f.tv.pay + " k$ par show."; } else { f.tv.pay = Math.round(m.pay * 0.95); f.tv.end = G.day + 365; out = "Ils refusent la hausse : tu signes à " + f.tv.pay + " k$ par show."; } break;
    // demandes des catcheurs
    case "rqyes": if (w) { w.mor = clamp(w.mor + 8); const o = m.o && G.W[m.o];
      if (m.rq === "vs" && o) { G.sl.push({ id: uid("s"), fed: G.me, n: w.n + " contre " + o.n, a: [w.id], b: [o.id], len: 4, wk: 0, heat: 25, turn: null, done: false, from: G.day }); out = "Storyline créée : " + w.n + " contre " + o.n + "."; }
      else if (m.rq === "turn") { w.al = w.al === "face" ? "heel" : "face"; w.hist.push({ d: G.day, t: (w.al === "heel" ? "Heel" : "Face") + " turn" }); out = w.n + " passe " + w.al + "."; }
      else if (m.rq === "partner" && o) { G.teams.push({ id: uid("t"), fed: G.me, n: w.n.split(" ")[0] + " & " + o.n.split(" ")[0], m: [w.id, o.id], chem: 65 }); relAdd(G, w.id, o.id, 10); out = "Nouvelle équipe : " + w.n + " et " + o.n + "."; }
      else if (m.rq === "rest") { G.rest = G.rest || {}; G.rest[w.id] = G.day + 7; out = "Une semaine de repos."; }
      else out = "Promis : tu le mets sur la carte."; } break;
    case "rqno": if (w) { w.mor = clamp(w.mor - 8); out = w.n + " est déçu" + e_(w) + "."; } break;
    case "hurtyes": if (w && w.inj) { w.inj.play = true; w.mor = clamp(w.mor + 10); out = w.n + " peut catcher, mais attention aux rechutes."; } break;
    case "hurtno": if (w) { w.mor = clamp(w.mor - 4); out = w.n + " se soigne."; } break;
    case "farewell": if (w) { w.farewell = { until: G.day + 60 }; news(G, { seg: "ecran", f: "nous", t: "La tournée d’adieu de " + w.n, txt: "Deux mois pour lui dire merci." }); out = "Tournée d’adieu jusqu’au " + shortDate(G.day + 60) + " : le public va l’acclamer. Ensuite, il pourra rejoindre ton staff."; } break;
    case "retnow": if (w) { retireW(G, w); out = w.n + " prend sa retraite : il t’a écrit pour la suite."; } break;
    case "retno": if (w) { w.mor = clamp(w.mor - 3); out = w.n + " continue… pour l’instant."; } break;
    case "relami": if (w) { out = release(G, w.id, "amiable") || "Rupture à l’amiable."; } break;
    case "relno": if (w) { w.mor = clamp(w.mor + 10); w.ask = false; out = "Tu lui parles : il reste, mais il attend du changement."; } break;
    case "pushyes": if (w) { w.push = 1; w.mor = clamp(w.mor + 8); out = "Push lancé : il gagnera plus souvent et montera plus vite (sa fiche › Stats)."; } break;
    case "pushno": if (w) { w.crowd = clamp((w.crowd || 50) - 5); out = "Tu l’ignores : le public finira par se lasser."; } break;
    case "booon": out = "Tu continues. Le public va-t-il changer d’avis ?"; break;
    case "booheel": if (w) { w.al = "heel"; w.hist.push({ d: G.day, t: "Heel turn" }); w.crowd = clamp((w.crowd || 40) + 15); out = w.n + " passe heel : le public adore le détester."; } break;
    case "teamname": { const t = (G.teams || []).find(x => x.id === m.tm); if (!t) { out = "Équipe introuvable."; break; } nameModal("Nom de l’équipe", t.n, n => { t.n = n; m.done = "Nom choisi : " + n; persist(); redraw(); }); return; }
    case "pressagr": if (ev) { G.hype[ev.id] = clamp((G.hype[ev.id] || 3) + 1.2, 0, 10); G.rep = clamp((G.rep || 50) - 0.5); } out = "Ambiance électrique : la hype monte."; break;
    case "pressres": G.rep = clamp((G.rep || 50) + 1); if (ev) G.hype[ev.id] = clamp((G.hype[ev.id] || 3) + 0.4, 0, 10); out = "Une conférence propre : ta réputation monte."; break;
    case "presssur": if (ev) { G.hype[ev.id] = clamp((G.hype[ev.id] || 3) + (rnd() < 0.6 ? 1.6 : -0.5), 0, 10); } out = "Tu annonces une surprise… il faudra la tenir !"; break;
    case "scsusp": if (w) { release(G, w.id, "susp", 1); out = w.n + " est suspendu" + e_(w) + " une semaine."; } break;
    case "scsorry": if (w) { w.pop = clamp(w.pop + 1, 1, 99); w.mor = clamp(w.mor - 3); out = "Excuses publiques : l’affaire se calme."; } break;
    case "scno": G.rep = clamp((G.rep || 50) - 1); out = "Tu ne fais rien : ta réputation en prend un coup."; break;
    case "rumyes": if (w) { w.mor = clamp(w.mor + 8); out = w.n + " est rassuré" + e_(w) + "."; } break;
    case "stormkeep": if (ev) ev.storm = "keep"; out = "Le show est maintenu."; break;
    case "stormcancel": if (ev && !ev.done) { G.ev = G.ev.filter(x => x !== ev); G.noTv = G.noTv || []; G.noTv.push(ev.id); } out = "Épisode annulé."; break;
    case "celebyes": if (ev && pay(80)) { ev.celeb = true; out = "La célébrité viendra à " + ev.n + "."; } else return; break;
    case "cityyes": if (ev) { ev.city = m.city; ev.bonus = 150; out = ev.n + " aura lieu là-bas (+150 k$ le soir du show)."; } break;
    case "partyes": { const o = G.F[m.fed]; if (!o) break; partAdd(G, o.id, 20); part(G, o.id).deal = { until: G.day + 365 }; out = "Partenariat signé avec " + o.n + " (Activité › Partenaires)."; } break;
    case "partno": if (m.fed) partAdd(G, m.fed, -5); out = "Offre refusée."; break;
    // la rivale se moque de toi
    case "tauntyes": { const nb = nextMyEvents(G, 20).find(e => e.kind !== "tv"); if (nb) G.hype[nb.id] = clamp((G.hype[nb.id] || 3) + 1, 0, 10); f.pop = clamp(f.pop + 0.3, 5, 99); if (rnd() < 0.25) { G.rep = clamp((G.rep || 50) - 1); out = "Ta réponse fait le buzz… mais certains la trouvent déplacée."; } else out = "Ta réponse fait le buzz : les fans adorent la guerre !"; } break;
    case "tauntno": G.rep = clamp((G.rep || 50) + 1); out = "Tu restes au-dessus de ça : ta réputation monte."; break;
    default: if (U.mact && U.mact[a]) { const r = U.mact[a](G, m); if (r === false) return; if (r) out = r; }   // réponses ajoutées par d'autres fichiers (brand.js…)
  }
  // le propriétaire suit tes décisions (mode carrière)
  const ps = PATRON[a]; if (ps && G.obj && G.mode !== "sandbox") G.obj.sec = clamp(G.obj.sec + ps, 0, 100);
  m.done = out; persist(); redraw();
};
function nameModal(title, cur, fn) {
  modal((box, close) => { box.classList.add("uvmodal"); box.innerHTML = "<h3>" + esc(title) + '</h3><input class="uvin" id="uvnm" maxlength="40" value="' + esc(cur || "") + '"><button type="button" class="uvbtn pri" data-y="1">Enregistrer</button><button type="button" class="uvbtn ghost" data-n="1">Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-n]")) close(); if (e.target.closest("[data-y]")) { const v = box.querySelector("#uvnm").value.trim(); if (v) { close(); fn(v); } } }); });
}
export function promoteYoung(G, y) {
  const i = G.dev.indexOf(y); if (i >= 0) G.dev.splice(i, 1);
  const b = 28 + y.pot * 6, id = uid("w");
  G.W[id] = { id: id, n: y.n, pic: "", fed: G.me, br: "", sx: y.sx, st: [clamp(b + rnd() * 20), clamp(b + rnd() * 15), clamp(b - 5 + rnd() * 15), clamp(b + rnd() * 12), clamp(b + 10 + rnd() * 20), clamp(b - 10 + rnd() * 10), clamp(55 + rnd() * 35)],
    sty: pick(["aer", "bag", "tec", "pur", "equ"]), al: rnd() < 0.6 ? "face" : "heel", pop: clamp(12 + y.pot * 4), en: 100, mor: 80, age: y.age, rec: [0, 0, 0], car: [0, 0, 0], pers: ["Bosseur"], inj: null, hist: [{ d: G.day, t: "Sort du centre de développement" }], ct: { sal: 40, end: G.day + 730, role: "low", exc: true, cl: {} }, p0: 15, last: -99, young: true, mom: 0, crowd: 30, push: 0, pot: y.pot };
  gimOf(G.W[id]);
  news(G, { seg: "coul", f: "nous", t: y.n + " monte dans l’effectif", txt: "Formé" + (y.sx === "f" ? "e" : "") + " au centre de développement, " + y.n + " fait ses débuts." });
}

// ---------- actualité et buzz ----------
export function actuView() {
  const G = U.G, seg = U.f.actu, fl = U.f.actuF;
  const cs = seg === "coul" ? [["tout", "Tout"], ["nous", "Ma fédé"], ["transferts", "Transferts"], ["blessures", "Blessures"], ["rumeurs", "Rumeurs"]] : [["tout", "Tout"], ["nous", "Ma fédé"], ["autres", "Autres fédérations"]];
  const L = G.news.slice().reverse().filter(n => n.seg === seg && (fl === "tout" || n.f === fl));
  const TAG = { nous: ["Ta fédé", "#f5b13d"], autres: ["Monde", "#eef1f6"], transferts: ["Transfert", "#6fb3ff"], blessures: ["Blessure", "#ff8a7e"], rumeurs: ["Rumeur", "#c9a7ff"] };
  const body = '<div class="uvseg" role="group"><button type="button" class="' + (seg === "coul" ? "on" : "") + '" aria-pressed="' + (seg === "coul") + '" data-act="uvseg" data-v="coul">En coulisses</button><button type="button" class="' + (seg === "ecran" ? "on" : "") + '" aria-pressed="' + (seg === "ecran") + '" data-act="uvseg" data-v="ecran">À l’écran (kayfabe)</button></div>' +
    chips("actuF", cs, fl) + (L.length ? L.slice(0, 60).map(n => { const t = TAG[n.f] || TAG.autres, pw = (n.w && G.W[n.w]) || whoIn(G, n.t) || whoIn(G, n.txt); return '<article class="uvart">' + (pw ? face(G, pw, 44, "uvartp") : "") + '<span class="uvtag" style="background:' + t[1] + '">' + t[0] + "</span><h2>" + esc(n.t) + "</h2><p>" + esc(n.txt || "") + "</p><small>" + esc(dayLabel(n.d)) + "</small></article>"; }).join("") : '<p class="uvempty">Rien pour l’instant. Avance les jours pour voir le monde bouger.</p>');
  return shell("actu", "Actualité", "", body);
}
ACT.uvseg = el => { U.f.actu = el.dataset.v; U.f.actuF = "tout"; redraw(); };
export function buzzView() {
  const G = U.G, fl = U.f.buzz, nb = G.ev.filter(e => e.fed === G.me && (e.kind === "ple" || e.kind === "ppv") && !e.done && e.day >= G.day).sort((a, b) => a.day - b.day)[0];
  const hype = nb ? Math.round(G.hype[nb.id] || 3) : 0, top = roster(G).sort((a, b) => b.pop - a.pop).slice(0, 3);
  const tags = [nb ? nb.n : "", meF(G).sh + "Show"].concat(top.map(w => w.n)).filter(Boolean).map(t => "#" + t.replace(/[^A-Za-z0-9À-ÿ]+/g, ""));
  const L = G.buzz.slice().reverse().filter(b => fl === "tout" || b.f === fl);
  const body = (nb ? '<div class="uvtile"><div class="uvth">Hype de ' + esc(nb.n) + "</div>" + '<div class="uvmeter" role="img" aria-label="Hype ' + hype + ' sur 10">' + Array.from({ length: 10 }, (x, i) => "<span" + (i < hype ? ' class="f"' : "") + "></span>").join("") + '</div><p class="uvmut">Plus la hype monte, plus il y a de monde et d’achats. Les storylines chaudes la font monter.</p></div>' : "") +
    '<div class="uvtile"><div class="uvth">Tendances</div><div class="uvtrend">' + tags.map(t => "<span>" + esc(t) + "</span>").join("") + "</div></div>" +
    chips("buzz", [["tout", "Tout"], ["nous", "Nos catcheurs"], ["fans", "Fans"]], fl) +
    (L.length ? L.slice(0, 50).map(b => { const bw = b.f !== "fans" && whoIn(G, b.who); return '<div class="uvpost">' + (bw ? face(G, bw, 36) : '<span class="uvav ini" style="width:36px;height:36px;background:' + esc(b.c || "#6fb3ff") + '">' + esc(b.ini || "") + "</span>") + '<div class="uvgrow"><b>' + esc(b.who) + " <small>" + esc(b.at || "") + " · " + esc(shortDate(b.d)) + "</small></b><p>" + esc(b.txt) + '</p><button type="button" class="uvlike' + (b.lk ? " on" : "") + '" aria-pressed="' + !!b.lk + '" data-act="uvlike" data-id="' + esc(b.id) + '">♥ ' + (b.n + (b.lk ? 1 : 0)) + "</button></div></div>"; }).join("") : '<p class="uvempty">Le buzz arrive après tes premiers shows.</p>');
  return shell("buzz", "Buzz", "", body);
}
ACT.uvlike = el => { const b = U.G.buzz.find(x => x.id === el.dataset.id); if (b) { b.lk = !b.lk; persist(); redraw(); } };

// ---------- monde ----------
export function mondeView(tab) {
  const G = U.G; tab = tab || "w";
  const T = tabs("#/univers/monde", [["w", "Catcheurs"], ["f", "Fédérations"], ["a", "Récompenses"], ["hof", "Hall of Fame"], ["mag", "Magazine"], ["enc", "Encyclopédie"]], tab);
  let body = "";
  if (tab === "w") body = searchBody(G);
  else if (tab === "f") {
    const L = Object.values(G.F).map(f => ({ f: f, a: f.aud.length ? f.aud.slice(-4).reduce((s, v) => s + v, 0) / f.aud.slice(-4).length : f.aud0 })).sort((a, b) => b.a - a.a);
    body = L.map((x, i) => { const f = x.f, champs = Object.values(G.T).filter(t => t.fed === f.id && t.div !== "tag").slice(0, 3); return '<div class="uvfed' + (f.id === G.me ? " me" : "") + '"><a class="uvfedrow" href="#/univers/fed/' + esc(f.id) + '">' + crest(G, f.id, 42) + '<div class="uvgrow"><b>' + esc(f.n) + "</b><small>" + (f.id === G.me ? "Toi" : "Gérée par l’IA") + '</small></div><span class="uvrank">#' + (i + 1) + "</span></a>" +
      '<div class="uvkv3"><div><b>' + fmtM(x.a) + "</b>audience</div><div><b>" + roster(G, f.id).length + "</b>catcheurs</div><div><b>" + Math.round(f.pop) + "</b>prestige</div></div>" +
      (champs.length ? '<div class="uvchamps">' + champs.map(t => '<span>' + (imgT(G, t) ? '<img src="' + esc(imgT(G, t)) + '" alt="">' : "") + "<i>" + esc(t.n) + " : <b>" + (champIds(t).length ? teamH(G, champIds(t)) : "vacant") + "</b></i></span>").join("") + "</div>" : "") + '<div class="uvrow2">' + imgBtn("f:" + f.id, "🖼️ Logo") + "</div></div>"; }).join("");
  } else if (tab === "a") {
    const y = dateOf(G.day).y, A = awardsOf(G, y);
    body = '<p class="uvmut">Awards de l’Année ' + y + " : remis le 31 décembre. En tête pour l’instant :</p>" + A.map(a => '<div class="uvaw"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8M10 17h4"></path></svg><div><small>' + esc(a.cat) + "</small><b>" + esc(a.who) + "</b></div></div>").join("") +
      Object.keys(G.awards || {}).sort((a, b) => b - a).map(yy => '<h3 class="uvh3">Année ' + yy + "</h3>" + G.awards[yy].map(a => '<div class="uvaw"><div><small>' + esc(a.cat) + "</small><b>" + esc(a.who) + "</b></div></div>").join("")).join("");
  } else if (tab === "hof") body = hofBody(G);
  else if (tab === "mag") body = magBody(G);
  else body = encBody(G);
  return shell("monde", "Monde", T, body);
}

// ---------- fiche d'un catcheur ----------
const SAY = [
  ["avenir", "Parler de son avenir", w => w.pop > 70 ? "Je veux être le visage de la fédération. Le main event, c’est pour moi." : "Je veux plus de temps à l’écran. Donne-moi une vraie storyline.", 0],
  ["bravo", "Le féliciter", w => "Merci boss ! Le public était en feu. Donne-moi encore des matchs comme ça.", 6],
  ["titre", "Lui promettre un match de titre", w => "Tu me le promets ? Alors je reste concentré" + e_(w) + ". Ne me déçois pas. (promesse ajoutée)", 10],
  ["main", "Lui promettre le main event du prochain grand show", w => "Le main event ? Là, tu me parles. (promesse ajoutée)", 12],
  ["recadrer", "Le recadrer", w => "OK… j’ai compris. Mais je n’aime pas qu’on me parle comme ça.", -10],
  ["repos", "Lui proposer du repos", w => w.en < 50 ? "Franchement, oui. Mon corps en a besoin." : "Du repos ? Je suis en pleine forme, fais-moi catcher !", 3]
];
const momTxt = v => v >= 40 ? ["En feu", "ok"] : v >= 10 ? ["En forme", "ok"] : v > -10 ? ["Normal", "mid"] : ["En perte de vitesse", "ko"];
export function ficheView(id, tab) {
  const G = U.G, w = G.W[id]; if (!w) return shell("monde", "Catcheur", "", '<p class="uvempty">Catcheur introuvable.</p>');
  const mine = isMine(G, w) && !w.ret; tab = tab || "s";
  if (U.f.styW !== id) { U.f.styW = id; U.f.sty = ""; }
  const R = risk(w), pic = imgW(G, w), g = gimOf(w), fin = (S.finishers || {})[w.n] || "";
  const head = '<a class="uvback" href="#/univers/' + (mine ? "fede/e" : "monde/w") + '">‹ ' + (mine ? "Mon effectif" : "Catcheurs du monde") + "</a>" +
    '<div class="uvfhead">' + (pic ? '<img class="uvfpic" src="' + esc(pic) + '" alt="">' : face(G, w, 76)) + '<div class="uvgrow"><h2>' + esc(w.n) + "</h2>" + (g.n ? '<small class="uvgimn">« ' + esc(g.n) + " »</small>" : "") +
    "<small>" + (w.ret ? "Légende retraitée" : esc(fedN(G, w.fed)) + (w.br && w.fed === "WWE" ? " · " + esc(w.br) : "") + (w.ct ? " · " + ROLES[w.ct.role] + (w.ct.exc === false ? " · non exclusif" : "") : "")) + " · " + w.age + " ans · " + alTxt(w.al) + "</small>" +
    "<small>Popularité <b>" + Math.round(w.pop) + "</b> · Moral <b>" + (w.mor >= 65 ? "Bon" : w.mor >= 45 ? "Moyen" : "Mauvais") + "</b>" + (w.push > 0 ? ' · <span class="uvok">Push</span>' : "") + "</small>" + imgBtn("w:" + w.id) + "</div></div>" + (U.ficheX ? U.ficheX(G, w) : "") +
    '<div class="uvpers"><span>' + esc(GT[g.t] ? GT[g.t][0] : "Personnage") + "</span>" + (fin ? "<span>Finisher : " + esc(fin) + "</span>" : "") + w.pers.map(p => "<span>" + esc(p) + "</span>").join("") + (injured(G, w) ? '<span class="uvko">Blessé' + e_(w) + " jusqu’au " + esc(shortDate(w.inj.until)) + "</span>" : "") + (w.susp > G.day ? '<span class="uvko">Suspendu' + e_(w) + "</span>" : "") + (w.bench ? '<span class="uvko">Au placard</span>' : "") + (w.farewell ? '<span class="uvok">Tournée d’adieu</span>' : "") + (w.secret ? '<span class="uvok">Signature secrète</span>' : "") + "</div>" +
    (w.ret ? "" : '<div class="uvenb"><div><span>' + enWord(w.en) + '</span><span class="uv' + R[1] + '">Risque de blessure : ' + R[0] + "</span></div>" + pctBar(w.en, enC(w.en)) + "</div>");
  const T = tabs("#/univers/c/" + encodeURIComponent(id), [["s", "Stats"], ["c", "Contrat"], ["h", "Historique"], ["r", "Relations"]].concat(mine ? [["d", "Dialogue"]] : []), tab);
  let body = head;
  if (w.ret && tab !== "h" && tab !== "r") body += legendBox(G, w);
  if (tab === "s") {
    const sv = U.f.sty || w.sty, mt = momTxt(w.mom || 0), fit = fitOf(w, g.t);
    body += '<div class="uvtile"><div class="uvth">Personnage <i>' + esc(GT[g.t] ? GT[g.t][0] : "") + "</i></div>" + (g.n ? "<p>« " + esc(g.n) + " »</p>" : '<p class="uvmut">Pas de surnom.</p>') +
      '<div class="uvst2"><span>Colle</span>' + pctBar(fit, fit >= 65 ? "#63d69c" : fit >= 45 ? "#ffd27a" : "#ff8a7e") + "<b>" + fit + '</b></div><div class="uvst2"><span>Fraîcheur</span>' + pctBar(g.fresh || 100, "#6fb3ff") + "<b>" + Math.round(g.fresh || 100) + "</b></div>" +
      (mine ? '<button type="button" class="uvbtn sm" data-act="uvgim" data-w="' + esc(w.id) + '">Proposer un autre personnage</button>' : "") + "</div>" +
      '<div class="uvtile"><div class="uvth">Élan et public</div><div class="uvst2"><span>Élan</span>' + pctBar(50 + (w.mom || 0) / 2, mt[1] === "ok" ? "#63d69c" : mt[1] === "mid" ? "#ffd27a" : "#ff8a7e") + '<b class="uv' + mt[1] + '">' + mt[0] + '</b></div><div class="uvst2"><span>Le public</span>' + pctBar(w.crowd || 40, "#f5b13d") + "<b>" + Math.round(w.crowd || 40) + "</b></div>" +
      (mine ? '<p class="uvsm">Un catcheur poussé gagne plus souvent et monte plus vite. Si le public ne suit pas, il peut le rejeter.</p><button type="button" class="uvbtn sm' + (w.push > 0 ? "" : " pri") + '" data-act="uvpush" data-w="' + esc(w.id) + '">' + (w.push > 0 ? "Arrêter le push" : "Le pousser (push)") + "</button>" : "") + "</div>" +
      (w.ret ? "" : '<h3 class="uvh3">Style de catch</h3><div class="uvchips wrap">' + Object.keys(STYLES).map(s => '<button type="button" class="uvchip' + (s === sv ? " on" : "") + (s === w.sty ? " his" : "") + '" aria-pressed="' + (s === sv) + '" data-act="uvsty" data-v="' + s + '">' + STYLES[s][0] + (s === w.sty ? " (son style)" : "") + "</button>").join("") + '</div><p class="uvsm">' + esc(STYLES[sv][1]) + "</p>" + (mine && sv !== w.sty ? '<button type="button" class="uvbtn sm" data-act="uvsetsty" data-w="' + esc(w.id) + '" data-v="' + sv + '">Lui donner ce style</button>' : "")) +
      '<h3 class="uvh3">Bilan de l’année</h3><div class="uvwld"><div><b>' + w.rec[0] + "</b>Victoires</div><div><b>" + w.rec[1] + "</b>Défaites</div><div><b>" + w.rec[2] + '</b>Draws</div></div><p class="uvmut">Carrière : ' + (w.car[0] + w.rec[0]) + " victoires, " + (w.car[1] + w.rec[1]) + " défaites, " + (w.car[2] + w.rec[2]) + " draws</p>" +
      '<h3 class="uvh3">Stats</h3>' + ST.map((n, i) => { const t = statTxt(G, w, i); return '<div class="uvst uvstw"><span>' + n + '</span><b class="uvgr g' + ["Faible", "Correct", "Bon", "Très bon", "Exceptionnel"].indexOf(t) + '">' + esc(t) + "</b></div>"; }).join("") +
      (known(G, w) ? (mine ? '<p class="uvsm">' + esc(w.n) + " " + esc(bondWord(w)) + ".</p>" : "") : '<p class="uvsm">Ton staff ne connaît pas encore bien ' + esc(w.n) + '.</p><button type="button" class="uvbtn sm" data-act="uvscoutw" data-w="' + esc(w.id) + '">Demander au recruteur</button>') +
      (mine ? '<div class="uvtile"><div class="uvth">Entraînement et mentor</div><form class="uvform" data-form="uvtrain" data-w="' + esc(w.id) + '"><label class="uvfld">Travailler en priorité<select name="i"><option value="">Rien de spécial</option>' + ST.map((n, i) => '<option value="' + i + '"' + (w.train === i ? " selected" : "") + ">" + esc(n) + "</option>").join("") + "</select></label>" +
        (w.age <= 30 ? '<label class="uvfld">Mentor<select name="m"><option value="">Pas de mentor</option>' + roster(G).filter(x => x.fed === G.me && x.id !== w.id && x.age >= 32 && x.sx === w.sx).sort((a, b) => b.pop - a.pop).map(x => '<option value="' + esc(x.id) + '"' + ((G.ment || {})[w.id] === x.id ? " selected" : "") + ">" + esc(x.n) + "</option>").join("") + "</select></label>" : "") + '<button class="uvbtn">Enregistrer</button></form>' +
        '<p class="uvsm">Chaque match fait baisser la barre d’endurance, le repos la fait remonter. Plus elle est basse, plus le risque de blessure monte.</p>' +
        ((G.rest || {})[w.id] > G.day ? '<p class="uvok">Au repos jusqu’au ' + esc(shortDate(G.rest[w.id])) + "</p>" : '<button type="button" class="uvbtn" data-act="uvrest" data-w="' + esc(w.id) + '">Le laisser se reposer une semaine</button>') + "</div>" : "");
  } else if (tab === "c") {
    if (w.ret) body += "";
    else if (mine && w.ct) {
      const cl = Object.keys(w.ct.cl || {}).filter(k => w.ct.cl[k] && DEM[k]);
      body += '<div class="uvtile"><div class="uvkv"><span>Salaire</span>' + fmtK(w.ct.sal) + ' par an</div><div class="uvkv"><span>Fin du contrat</span>' + esc(dayLabel(w.ct.end, true)) + '</div><div class="uvkv"><span>Rôle</span>' + ROLES[w.ct.role] + '</div><div class="uvkv"><span>Exclusif</span>' + (w.ct.exc === false ? "Non (il catche aussi dans des fédérations indépendantes)" : "Oui") + "</div>" +
        (cl.length ? '<p class="uvsm">Clauses : ' + cl.map(k => esc(DEM[k])).join(" · ") + "</p>" : "") + "</div>" +
        '<div class="uvrow2"><a class="uvbtn pri" href="#/univers/nego/' + esc(w.id) + '">Renégocier</a><button type="button" class="uvbtn" data-act="uvrel" data-w="' + esc(w.id) + '">Rompre, suspendre, placard…</button></div>' +
        (w.secret ? '<p class="uvok">Signature secrète : il fera ses débuts par surprise.</p>' : "");
    } else if (w.fed && w.fed !== G.me) body += '<div class="uvtile"><p>Sous contrat avec <b>' + esc(fedN(G, w.fed)) + "</b> jusqu’au " + esc(dayLabel(w.ct.end, true)) + '.</p><p class="uvmut">Impossible de le voler : quand son contrat finira, tu pourras lui faire une offre.</p>' +
      '<div class="uvrow2"><a class="uvbtn" href="#/univers/nego/' + esc(w.id) + '">Prendre contact</a>' + ((G.watch || []).indexOf(w.id) >= 0 ? '<span class="uvok">✓ Suivi par ton recruteur</span>' : '<button type="button" class="uvbtn ghost" data-act="uvwatch" data-w="' + esc(w.id) + '">Le suivre</button>') + "</div></div>";
    else { const sg = signal(G, w); body += '<div class="uvtile"><p class="uvok">Agent libre.</p><p class="uvsig ' + esc(sg[1]) + '">' + esc(sg[0]) + '</p><a class="uvbtn pri" href="#/univers/nego/' + esc(w.id) + '">Ouvrir la négociation</a></div>'; }
  } else if (tab === "h") {
    const titles = Object.values(G.T).filter(t => champIds(t).indexOf(w.id) >= 0);
    body += (titles.length ? '<div class="uvtile"><div class="uvth">Champion' + (w.sx === "f" ? "ne" : "") + " en titre</div>" + titles.map(t => '<div class="uvline">' + (imgT(G, t) ? '<img class="uvbelt" src="' + esc(imgT(G, t)) + '" alt="">' : "") + esc(t.n) + "</div>").join("") + "</div>" : "") +
      (w.hist.length ? w.hist.slice().reverse().map(x => '<div class="uvtl"><b>' + esc(shortDate(x.d)) + "</b>" + esc(x.t) + "</div>").join("") : '<p class="uvempty">Rien de marquant pour l’instant dans cette partie.</p>');
  } else if (tab === "r") body += relBody(G, w);
  else if (tab === "d" && mine) {
    const C = U.f.chat[w.id] || [["him", "Salut boss. Tu voulais me voir ?"]];
    body += (U.negoScene ? U.negoScene(G, w, { log: C }) : "") + '<div class="uvchat">' + C.map(m => '<div class="uvbub ' + m[0] + '">' + esc(m[1]) + "</div>").join("") + "</div>" +
      '<div class="uvacts">' + SAY.map(o => '<button type="button" class="uvbtn" data-act="uvsay" data-w="' + esc(w.id) + '" data-o="' + o[0] + '">' + esc(o[1]) + "</button>").join("") + "</div>";
  }
  return shell(mine ? "fede" : "monde", w.n, T, body);
}
ACT.uvsty = el => { U.f.sty = el.dataset.v; redraw(); };
ACT.uvsetsty = el => { const G = U.G, w = G.W[el.dataset.w]; if (!w || w.fed !== G.me) return; w.sty = el.dataset.v; w.hist.push({ d: G.day, t: "Nouveau style : " + STYLES[w.sty][0] }); U.f.sty = ""; persist(); redraw(); };
ACT.uvwatch = el => { const G = U.G; G.watch = G.watch || []; if (G.watch.indexOf(el.dataset.w) < 0) G.watch.push(el.dataset.w); persist(); redraw(); };
ACT.uvrest = el => { const G = U.G; G.rest = G.rest || {}; G.rest[el.dataset.w] = G.day + 7; persist(); toast("Repos jusqu’au " + shortDate(G.day + 7) + " : il ne sera pas mis sur les cartes de l’IA"); redraw(); };
ACT.uvpush = el => { const G = U.G, w = G.W[el.dataset.w]; if (!w || w.fed !== G.me) return; w.push = w.push > 0 ? 0 : 1; if (w.push) w.mor = clamp(w.mor + 5); toast(w.push ? w.n + " est poussé" + e_(w) + " !" : "Push arrêté"); persist(); redraw(); };
FORM.uvtrain = f => { const G = U.G, id = f.dataset.w; setTrain(G, id, f.i.value); if (f.m) setMentor(G, id, f.m.value); persist(); toast("Enregistré"); redraw(); };
// demander au recruteur (3 par jour) : les stats d'un catcheur en mots
ACT.uvscoutw = el => { const G = U.G; G.scoutD = G.scoutD && G.scoutD.d === G.day ? G.scoutD : { d: G.day, n: 0 }; if (G.scoutD.n >= 3) { toast("Ton recruteur a déjà fait 3 rapports aujourd’hui."); return; } G.scoutD.n++; G.known = G.known || {}; G.known[el.dataset.w] = G.day + 1; persist(); toast("Rapport reçu"); redraw(); };
ACT.uvsay = el => {
  const G = U.G, w = G.W[el.dataset.w], o = SAY.find(x => x[0] === el.dataset.o); if (!w || !o) return;
  const C = U.f.chat[w.id] || [["him", "Salut boss. Tu voulais me voir ?"]];
  C.push(["me", o[1]], ["him", o[2](w)]); U.f.chat[w.id] = C.slice(-8);
  w.mor = clamp(w.mor + o[3]); bondAdd(w, o[0] === "recadrer" ? { c: -3, r: 3 } : o[3] > 0 ? { a: 2, c: 1 } : {});
  if (o[0] === "titre") G.prom.push({ id: uid("p"), w: w.id, t: "titre", until: G.day + 30, st: "cours", txt: "Match de titre avant le " + shortDate(G.day + 30) });
  if (o[0] === "main") { const nb = G.ev.filter(e => e.fed === G.me && e.kind !== "tv" && !e.done && e.day >= G.day).sort((a, b) => a.day - b.day)[0]; G.prom.push({ id: uid("p"), w: w.id, t: "main", until: nb ? nb.day : G.day + 30, st: "cours", txt: "Main event de " + (nb ? nb.n : "du prochain grand show") }); }
  if (o[0] === "repos") { G.rest = G.rest || {}; G.rest[w.id] = G.day + 7; }
  persist(); redraw();
};
