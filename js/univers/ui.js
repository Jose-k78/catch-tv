// Mode Univers : parties, menu général, courrier, actualité, buzz, monde (catcheurs, fiche + contrat, fédérations, récompenses).
import { S, ACT, FORM } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { ST, STYLES, ROLES, FEDS0, dayLabel, shortDate, dateOf, fmtM, fmtK, stars, recTxt, salOf, clamp, rnd, pick, uid } from "./world.js";
import { newWorld } from "./world.js";
import { meF, roster, avail, injured, risk, startGame, nextMyEvents, awardsOf, mail, news, teamName, wn } from "./sim.js";
import { metaAll, loadSlot, delSlot } from "./save.js";
import { U, go, redraw, persist, shell, tabs, chips, face, crest, imgFed, imgEv, imgT, imgW, imgBtn, unread, audTxt, autoPlay } from "./core.js";

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
export function newView(slot) {
  const feds = Object.keys(FEDS0);
  return '<div class="uvparties"><a class="uvback" href="#/univers">‹ Les parties</a><h1>Nouvelle partie</h1><p class="uvmut">Partie ' + esc(slot) + "</p>" +
    '<form class="uvform" data-form="uvcreate"><input type="hidden" name="slot" value="' + esc(slot) + '">' +
    '<fieldset class="uvfs"><legend>Comment veux-tu jouer ?</legend>' +
    '<label class="uvchoice"><input type="radio" name="mode" value="create" checked><span><b>Créer ma fédération</b><small>Tu choisis le nom, le logo, les ceintures et les PPV. Tu commences petit avec des agents libres ; plus ton show est célèbre, plus tu peux signer des stars.</small></span></label>' +
    '<label class="uvchoice"><input type="radio" name="mode" value="take"><span><b>Prendre une fédération existante</b><small>Avec ses catcheurs sous contrat. Les autres sont gérées par l’IA.</small></span></label></fieldset>' +
    '<fieldset class="uvfs cr"><legend>Ta fédération</legend><label class="uvfld">Nom<input name="n" maxlength="40" value="TCC Pro Wrestling"></label>' +
    '<label class="uvfld">Sigle (2 à 5 lettres)<input name="sh" maxlength="5" value="TCC"></label><label class="uvfld">Couleur<input type="color" name="c" value="#f5b13d"></label>' +
    '<label class="uvfld">Nom du show TV<input name="show" maxlength="30" value="TCC Monday"></label>' +
    '<label class="uvfld">Jour du show<select name="wd"><option value="1">Lundi</option><option value="2">Mardi</option><option value="3">Mercredi</option><option value="4">Jeudi</option><option value="5">Vendredi</option><option value="6">Samedi</option><option value="0">Dimanche</option></select></label></fieldset>' +
    '<fieldset class="uvfs tk"><legend>La fédération</legend><label class="uvfld">Fédération<select name="take">' + feds.map(k => '<option value="' + k + '">' + esc(k) + "</option>").join("") + "</select></label></fieldset>" +
    '<button class="uvbtn pri">Commencer l’Année 1</button></form></div>';
}
FORM.uvcreate = async f => {
  const slot = +f.slot.value, mode = f.mode.value;
  if (!Object.keys(S.rosters || {}).length) { toast("Les données de TCC TV ne sont pas encore chargées, réessaie dans un instant"); return; }
  const btn = f.querySelector("button"); if (btn) { btn.disabled = true; btn.textContent = "Création du monde…"; }
  setTimeout(() => {
    try {
      const G = mode === "take" ? newWorld({ take: f.take.value }) : newWorld({ create: { n: f.n.value.trim(), sh: f.sh.value.trim() || "MOI", c: f.c.value, show: f.show.value.trim() || "Mon show", wd: f.wd.value } });
      startGame(G); U.G = G; U.slot = slot; try { localStorage.setItem("ctv.univ.slot", String(slot)); } catch (e) {} persist(true); go("#/univers/g");
    } catch (e) { console.error(e); toast("Création impossible : " + (e.message || e)); if (btn) { btn.disabled = false; btn.textContent = "Commencer l’Année 1"; } }
  }, 30);
};
ACT.uvload = async el => { const s = +el.dataset.s; U.loading = true; redraw(); const G = await loadSlot(s).catch(() => null); U.loading = false; if (!G) { toast("Partie introuvable sur ce téléphone"); redraw(); return; } U.G = G; U.slot = s; try { localStorage.setItem("ctv.univ.slot", String(s)); } catch (e) {} go("#/univers/g"); redraw(); };
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
  const nx = nextMyEvents(G, 3), today = nx[0] && nx[0].day === G.day ? nx[0] : null;
  const mails = G.mail.slice().reverse().slice(0, 3), inj = R.filter(w => injured(G, w)).length, tired = R.filter(w => w.en < 50 && !injured(G, w)).length;
  const mor = R.length ? Math.round(R.reduce((s, w) => s + w.mor, 0) / R.length) : 0, prom = (G.prom || []).filter(p => p.st === "cours").length;
  const newsL = G.news.slice().reverse().slice(0, 3), cur = G.fin.cur, month = cur.tv + cur.tix + cur.merch + cur.pub - cur.sal - cur.prod;
  const body = (today ? '<div class="uvalert"><b>Ce soir : ' + esc(today.n) + '</b><div class="uvrow2"><a class="uvbtn pri" href="#/univers/ev/' + encodeURIComponent(today.id) + '">Préparer la carte</a><button type="button" class="uvbtn" data-act="uvautoplay" data-id="' + esc(today.id) + '">Laisser l’IA faire</button></div></div>' : "") +
    '<div class="uvfedrow big">' + crest(G, G.me, 46) + "<div><b>" + esc(f.n) + "</b><small>" + (rank ? rank + "e sur " + feds.length + " à l’audience" : "") + " · " + fmtK(f.money) + " en banque</small></div></div>" +
    '<a class="uvtile" href="#/univers/courrier"><div class="uvth">Courrier <i>' + unread(G) + " non lu" + (unread(G) > 1 ? "s" : "") + "</i></div>" + mails.map(m => '<div class="uvline"><span class="uvav ini" style="width:28px;height:28px;background:' + esc(m.c || "#a3abbd") + '">' + esc(m.ini || "") + "</span><span class=\"uvgrow\">" + esc(m.subj) + "</span>" + (m.read ? "" : '<span class="uvdot" aria-label="non lu"></span>') + "</div>").join("") + "</a>" +
    '<div class="uvtile"><div class="uvth">Audience <i>' + (last ? "dernier show" : "pas encore de show") + "</i></div>" + (last ? '<div class="uvaud"><div><div class="uvbig">' + fmtM(last.aud) + '</div><div class="uvmut">' + esc(last.n) + " · " + esc(dayLabel(last.d)) + " · " + stars(last.r) + '</div><div class="uvsm">Objectif du diffuseur : ' + fmtM(f.tv.min) + (last.aud >= f.tv.min ? ' <span class="uvok">✓ atteint</span>' : ' <span class="uvko">✗ raté</span>') + '</div></div><div class="uvbars" role="img" aria-label="Audience des derniers shows">' + aud.map((v, i) => '<span style="height:' + Math.max(6, Math.round(v / mx * 60)) + "px" + (i === aud.length - 1 ? ";background:#f5b13d" : "") + '"></span>').join("") + "</div></div>" : '<p class="uvmut">Ton premier show arrive bientôt.</p>') + "</div>" +
    '<div class="uvtile"><div class="uvth">Popularité <i>' + Math.round(f.pop) + " / 100</i></div>" + pctBar(f.pop) + '<p class="uvmut">' + (f.pop < 45 ? "Locale" : f.pop < 65 ? "Nationale" : f.pop < 80 ? "Internationale" : "Mondiale") + " · plus elle monte, plus tu peux signer des stars</p>" +
    top3.map(w => '<a class="uvline" href="#/univers/c/' + esc(w.id) + '">' + face(G, w, 28) + '<span class="uvgrow">' + esc(w.n) + "</span><b>" + Math.round(w.pop) + "</b></a>").join("") + "</div>" +
    '<a class="uvtile" href="#/univers/activite/ev"><div class="uvth">Calendrier</div>' + (nx.length ? nx.map(e => '<div class="uvline"><span class="uvdate">' + esc(dayLabel(e.day)) + '</span><span class="uvgrow">' + esc(e.n) + '</span><span class="uvmut">' + (e.kind === "tv" ? "TV" : e.kind.toUpperCase()) + "</span></div>").join("") : '<p class="uvmut">Rien de prévu</p>') + "</a>" +
    '<a class="uvtile" href="#/univers/actu"><div class="uvth">Actualité <i>tout voir</i></div>' + (newsL.length ? newsL.map(n => '<div class="uvline">' + esc(n.t) + "</div>").join("") : '<p class="uvmut">Pas encore d’actualité</p>') + "</a>" +
    '<div class="uv2"><a class="uvtile" href="#/univers/activite/fin"><div class="uvth">Finances</div><div class="uvnum">' + fmtK(f.money) + '</div><div class="uvsm"><span class="' + (month >= 0 ? "uvok" : "uvko") + '">' + (month >= 0 ? "▲ " : "▼ ") + fmtK(month) + "</span> ce mois</div></a>" +
    '<a class="uvtile" href="#/univers/fede/m"><div class="uvth">Personnel</div><div class="uvsm">Moral : ' + (mor >= 65 ? "Bon" : mor >= 45 ? "Moyen" : "Mauvais") + "</div>" + pctBar(mor, mor >= 65 ? "#63d69c" : mor >= 45 ? "#ffd27a" : "#ff8a7e") + '<div class="uvmut">' + inj + " blessé" + (inj > 1 ? "s" : "") + " · " + tired + " fatigué" + (tired > 1 ? "s" : "") + " · " + prom + " promesse" + (prom > 1 ? "s" : "") + "</div></a></div>";
  return shell("g", "Menu général", "", body);
}
ACT.uvautoplay = el => { const ev = U.G.ev.find(e => e.id === el.dataset.id); if (ev) autoPlay(ev); };

// ---------- courrier ----------
const MACTS = {
  aud: m => [["Voir les finances", "go", "#/univers/activite/fin"], ["OK", "ok"]],
  inj: m => [["Envoyer chez un spécialiste (50 k$)", "heal"], ["Le laisser se reposer", "ok"]],
  agent: m => [["Ouvrir la négociation", "go", "#/univers/c/" + m.w + "/c"], ["Plus tard", "ok"]],
  demand: m => [["Promettre un match de titre (dans les 30 jours)", "promise"], ["Refuser poliment", "refuse"]],
  sponsor: m => [["Accepter", "spons"], ["Négocier (+20 %)", "sponsneg"], ["Refuser", "no"]],
  conflict: m => [["Les punir (amende)", "punish"], ["En faire une storyline !", "feud"], ["Ignorer", "ignore"]],
  young: m => [["Le faire monter dans l’effectif", "promote"], ["Plus tard", "ok"]],
  show: m => [["Préparer la carte", "go", "#/univers/ev/" + encodeURIComponent(m.ev)], ["Laisser l’IA faire la carte et jouer", "autoplay"]],
  tv: m => [["Accepter", "tvok"], ["Négocier (+15 %)", "tvneg"]],
  fa: m => [["Voir sa fiche", "go", "#/univers/c/" + m.w + "/c"]],
  info: m => [["OK", "ok"]]
};
const MCAT = { aud: "audience", tv: "offres", sponsor: "offres", agent: "catcheurs", demand: "catcheurs", fa: "catcheurs", conflict: "perso", inj: "perso", young: "perso", show: "perso", info: "perso" };
export function courrierView(id) {
  const G = U.G, m = id && G.mail.find(x => x.id === id);
  if (m) {
    if (!m.read) { m.read = true; persist(); }
    const ev = m.k === "show" && G.ev.find(e => e.id === m.ev), acts = m.k === "show" && ev && ev.done ? [["Voir les résultats", "go", "#/univers/ev/" + encodeURIComponent(ev.id)]] : (MACTS[m.k] || MACTS.info)(m);
    const body = '<a class="uvback" href="#/univers/courrier">‹ Tous les messages</a><div class="uvfrom"><span class="uvav ini" style="width:40px;height:40px;background:' + esc(m.c || "#a3abbd") + '">' + esc(m.ini || "") + "</span><div><b>" + esc(m.from) + '</b><small>' + esc(m.role || "") + " · " + esc(dayLabel(m.d)) + "</small></div></div>" +
      '<h2 class="uvh2">' + esc(m.subj) + '</h2><p class="uvbody">' + esc(m.body || "") + "</p>" + (m.done ? '<div class="uvdone" role="status">' + esc(m.done) + "</div>" : "") +
      '<div class="uvacts">' + acts.filter(a => a[1] === "go" || !m.done).map(a => a[1] === "go" ? '<a class="uvbtn pri" href="' + esc(a[2]) + '">' + esc(a[0]) + "</a>" : '<button type="button" class="uvbtn' + (a === acts[0] ? " pri" : "") + '" data-act="uvmail" data-id="' + esc(m.id) + '" data-a="' + a[1] + '">' + esc(a[0]) + "</button>").join("") + "</div>";
    return shell("courrier", "Courrier", "", body);
  }
  const cat = U.f.mail, L = G.mail.slice().reverse().filter(x => cat === "tout" || MCAT[x.k] === cat);
  const body = chips("mail", [["tout", "Tout"], ["perso", "Personnel"], ["catcheurs", "Catcheurs"], ["audience", "Audiences"], ["offres", "Offres"]], cat) +
    (L.length ? '<div class="uvlist">' + L.slice(0, 80).map(x => '<a class="uvmsg' + (x.read ? "" : " new") + '" href="#/univers/courrier/' + esc(x.id) + '"><span class="uvav ini" style="width:36px;height:36px;background:' + esc(x.c || "#a3abbd") + '">' + esc(x.ini || "") + '</span><span class="uvgrow"><b>' + esc(x.from) + (x.read ? "" : ' <span class="uvdot" aria-label="non lu"></span>') + "<i>" + esc(shortDate(x.d)) + "</i></b><span>" + esc(x.subj) + "</span>" + (x.done ? "<small>✓ " + esc(x.done) + "</small>" : "") + "</span></a>").join("") + "</div>" : '<p class="uvempty">Pas de message ici.</p>') +
    (G.mail.some(x => !x.read) ? '<button type="button" class="uvbtn ghost" data-act="uvreadall">Tout marquer comme lu</button>' : "");
  return shell("courrier", "Courrier", "", body);
}
ACT.uvreadall = () => { U.G.mail.forEach(m => { m.read = true; }); persist(); redraw(); };
ACT.uvmail = el => {
  const G = U.G, m = G.mail.find(x => x.id === el.dataset.id), a = el.dataset.a; if (!m) return;
  const f = meF(G), w = m.w && G.W[m.w];
  let out = "Réponse envoyée.";
  switch (a) {
    case "ok": out = "Vu."; break;
    case "heal": if (w && w.inj && !w.inj.spec) { if (f.money < 50) { toast("Pas assez d’argent"); return; } f.money -= 50; G.fin.cur.prod += 50; w.inj.until = Math.max(G.day + 3, G.day + Math.round((w.inj.until - G.day) * 0.6)); w.inj.spec = true; out = "Spécialiste payé : retour le " + dayLabel(w.inj.until) + "."; } break;
    case "promise": if (w) { G.prom.push({ id: uid("p"), w: w.id, t: "titre", until: G.day + 30, st: "cours", txt: "Match de titre avant le " + shortDate(G.day + 30) }); w.mor = clamp(w.mor + 10); out = "Promesse ajoutée (Ma fédé › Promesses). " + w.n + " est motivé" + (w.sx === "f" ? "e" : "") + "."; } break;
    case "refuse": if (w) { w.mor = clamp(w.mor - 15); out = w.n + " est déçu" + (w.sx === "f" ? "e" : "") + "."; } break;
    case "spons": G.spons.push({ n: m.from, pay: m.pay, min: m.min, until: G.day + 182 }); out = "Contrat signé : +" + m.pay + " k$ par show (Activité › Contrats TV et pub)."; break;
    case "sponsneg": if (rnd() < 0.5) { const p = Math.round(m.pay * 1.2); G.spons.push({ n: m.from, pay: p, min: m.min, until: G.day + 182 }); out = "Ils acceptent : " + p + " k$ par show."; } else out = "Ils refusent et retirent leur offre."; break;
    case "no": out = "Offre refusée."; break;
    case "punish": [m.a, m.b].forEach(i => { const x = G.W[i]; if (x) x.mor = clamp(x.mor - 5); }); G.tens = G.tens.filter(t => !(t.a === m.a && t.b === m.b)); out = "Amende donnée. Le calme revient."; break;
    case "feud": G.sl.push({ id: uid("s"), fed: G.me, n: wn(G, m.a) + " contre " + wn(G, m.b), a: [m.a], b: [m.b], len: 5, wk: 0, heat: 35, turn: null, done: false, from: G.day }); G.tens = G.tens.filter(t => !(t.a === m.a && t.b === m.b)); out = "Storyline créée (Créatif › Storylines). Le vrai conflit devient une feud !"; break;
    case "ignore": out = "Tu laisses faire. Le vestiaire n’aime pas trop."; roster(G).forEach(x => { x.mor = clamp(x.mor - 1); }); break;
    case "promote": { const y = (G.dev || []).find(x => x.id === m.y); if (!y) { out = "Déjà fait."; break; } promoteYoung(G, y); out = y.n + " rejoint l’effectif !"; } break;
    case "autoplay": { const ev = G.ev.find(e => e.id === m.ev); m.done = "Show joué par l’IA."; if (ev && !ev.done) { autoPlay(ev); return; } break; }
    case "tvok": f.tv.pay = m.pay; f.tv.end = G.day + 365; out = "Contrat TV renouvelé : " + m.pay + " k$ par show."; break;
    case "tvneg": if (rnd() < 0.55) { f.tv.pay = Math.round(m.pay * 1.15); f.tv.end = G.day + 365; out = "Ils acceptent : " + f.tv.pay + " k$ par show."; } else { f.tv.pay = Math.round(m.pay * 0.95); f.tv.end = G.day + 365; out = "Ils refusent la hausse : tu signes à " + f.tv.pay + " k$ par show."; } break;
  }
  m.done = out; persist(); redraw();
};
export function promoteYoung(G, y) {
  const i = G.dev.indexOf(y); if (i >= 0) G.dev.splice(i, 1);
  const b = 28 + y.pot * 6, id = uid("w");
  G.W[id] = { id: id, n: y.n, pic: "", fed: G.me, br: "", sx: y.sx, st: [clamp(b + rnd() * 20), clamp(b + rnd() * 15), clamp(b - 5 + rnd() * 15), clamp(b + rnd() * 12), clamp(b + 10 + rnd() * 20), clamp(b - 10 + rnd() * 10), clamp(55 + rnd() * 35)],
    sty: pick(["aer", "bag", "tec", "pur", "equ"]), al: rnd() < 0.6 ? "face" : "heel", pop: clamp(12 + y.pot * 4), en: 100, mor: 80, age: y.age, rec: [0, 0, 0], car: [0, 0, 0], pers: ["Bosseur"], inj: null, hist: [{ d: G.day, t: "Sort du centre de développement" }], ct: { sal: 40, end: G.day + 730, role: "low" }, p0: 15, last: -99, young: true };
  news(G, { seg: "coul", f: "nous", t: y.n + " monte dans l’effectif", txt: "Formé" + (y.sx === "f" ? "e" : "") + " au centre de développement, " + y.n + " fait ses débuts." });
}

// ---------- actualité et buzz ----------
export function actuView() {
  const G = U.G, seg = U.f.actu, fl = U.f.actuF;
  const cs = seg === "coul" ? [["tout", "Tout"], ["nous", "Ma fédé"], ["transferts", "Transferts"], ["blessures", "Blessures"], ["rumeurs", "Rumeurs"]] : [["tout", "Tout"], ["nous", "Ma fédé"], ["autres", "Autres fédérations"]];
  const L = G.news.slice().reverse().filter(n => n.seg === seg && (fl === "tout" || n.f === fl));
  const TAG = { nous: ["Ta fédé", "#f5b13d"], autres: ["Monde", "#eef1f6"], transferts: ["Transfert", "#6fb3ff"], blessures: ["Blessure", "#ff8a7e"], rumeurs: ["Rumeur", "#c9a7ff"] };
  const body = '<div class="uvseg" role="group"><button type="button" class="' + (seg === "coul" ? "on" : "") + '" aria-pressed="' + (seg === "coul") + '" data-act="uvseg" data-v="coul">En coulisses</button><button type="button" class="' + (seg === "ecran" ? "on" : "") + '" aria-pressed="' + (seg === "ecran") + '" data-act="uvseg" data-v="ecran">À l’écran (kayfabe)</button></div>' +
    chips("actuF", cs, fl) + (L.length ? L.slice(0, 60).map(n => { const t = TAG[n.f] || TAG.autres; return '<article class="uvart"><span class="uvtag" style="background:' + t[1] + '">' + t[0] + "</span><h2>" + esc(n.t) + "</h2><p>" + esc(n.txt || "") + "</p><small>" + esc(dayLabel(n.d)) + "</small></article>"; }).join("") : '<p class="uvempty">Rien pour l’instant. Avance les jours pour voir le monde bouger.</p>');
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
    (L.length ? L.slice(0, 50).map(b => '<div class="uvpost"><span class="uvav ini" style="width:36px;height:36px;background:' + esc(b.c || "#6fb3ff") + '">' + esc(b.ini || "") + '</span><div class="uvgrow"><b>' + esc(b.who) + " <small>" + esc(b.at || "") + " · " + esc(shortDate(b.d)) + "</small></b><p>" + esc(b.txt) + '</p><button type="button" class="uvlike' + (b.lk ? " on" : "") + '" aria-pressed="' + !!b.lk + '" data-act="uvlike" data-id="' + esc(b.id) + '">♥ ' + (b.n + (b.lk ? 1 : 0)) + "</button></div></div>").join("") : '<p class="uvempty">Le buzz arrive après tes premiers shows.</p>');
  return shell("buzz", "Buzz", "", body);
}
ACT.uvlike = el => { const b = U.G.buzz.find(x => x.id === el.dataset.id); if (b) { b.lk = !b.lk; persist(); redraw(); } };

// ---------- monde ----------
export function mondeView(tab) {
  const G = U.G; tab = tab || "w";
  const T = tabs("#/univers/monde", [["w", "Catcheurs du monde"], ["f", "Fédérations"], ["a", "Récompenses"]], tab);
  let body = "";
  if (tab === "w") {
    const F = U.f, q = (F.mq || "").toLowerCase();
    let L = Object.values(G.W).filter(w => !w.ret);
    if (F.mw === "libres") L = L.filter(w => !w.fed); if (F.mw === "contrat") L = L.filter(w => w.fed); if (F.mw === "femmes") L = L.filter(w => w.sx === "f"); if (F.mw === "hommes") L = L.filter(w => w.sx === "h");
    if (F.mfed) L = L.filter(w => (F.mfed === "-" ? !w.fed : w.fed === F.mfed)); if (F.msty) L = L.filter(w => w.sty === F.msty); if (q) L = L.filter(w => w.n.toLowerCase().indexOf(q) >= 0);
    L.sort((a, b) => b.pop - a.pop);
    body = '<form class="uvsearch" data-form="uvmq"><input type="search" name="q" value="' + esc(F.mq || "") + '" placeholder="Chercher un catcheur" aria-label="Chercher un catcheur">' +
      '<select name="fed" aria-label="Fédération"><option value="">Toutes</option><option value="-"' + (F.mfed === "-" ? " selected" : "") + ">Libres</option>" + Object.values(G.F).map(f => '<option value="' + esc(f.id) + '"' + (F.mfed === f.id ? " selected" : "") + ">" + esc(f.n) + "</option>").join("") + "</select>" +
      '<select name="sty" aria-label="Style"><option value="">Tous les styles</option>' + Object.keys(STYLES).map(s => '<option value="' + s + '"' + (F.msty === s ? " selected" : "") + ">" + STYLES[s][0] + "</option>").join("") + '</select><button class="uvbtn">Chercher</button></form>' +
      chips("mw", [["tous", "Tous"], ["libres", "Libres"], ["contrat", "Sous contrat"], ["femmes", "Femmes"], ["hommes", "Hommes"]], F.mw) +
      '<p class="uvmut">' + L.length + " catcheurs · touche un nom pour sa fiche</p>" +
      L.slice(0, F.mn).map(w => '<a class="uvw" href="#/univers/c/' + esc(w.id) + '">' + face(G, w, 40) + '<span class="uvgrow"><b>' + esc(w.n) + "</b><small" + (w.fed ? "" : ' class="uvok"') + ">" + esc(fedN(G, w.fed)) + (w.fed && w.ct ? " · fin de contrat " + esc(shortDate(w.ct.end)) : " · demande " + fmtK(salOf(w)) + " par an") + "</small><small>" + STYLES[w.sty][0] + " · " + (w.al === "heel" ? "Heel" : "Face") + " · " + recTxt(w.rec) + (injured(G, w) ? " · blessé" + (w.sx === "f" ? "e" : "") : "") + '</small></span><span class="uvnote">' + Math.round(w.pop) + "<small>POP</small></span></a>").join("") +
      (L.length > F.mn ? '<button type="button" class="uvbtn ghost" data-act="uvmore">Voir plus</button>' : "");
  } else if (tab === "f") {
    const L = Object.values(G.F).map(f => ({ f: f, a: f.aud.length ? f.aud.slice(-4).reduce((s, v) => s + v, 0) / f.aud.slice(-4).length : f.aud0 })).sort((a, b) => b.a - a.a);
    body = L.map((x, i) => { const f = x.f, champs = Object.values(G.T).filter(t => t.fed === f.id && t.div !== "tag").slice(0, 3); return '<div class="uvfed' + (f.id === G.me ? " me" : "") + '"><div class="uvfedrow">' + crest(G, f.id, 42) + '<div class="uvgrow"><b>' + esc(f.n) + "</b><small>" + (f.id === G.me ? "Toi" : "Gérée par l’IA") + '</small></div><span class="uvrank">#' + (i + 1) + "</span>" + imgBtn("f:" + f.id, "🖼️") + "</div>" +
      '<div class="uvkv3"><div><b>' + fmtM(x.a) + "</b>audience</div><div><b>" + roster(G, f.id).length + "</b>catcheurs</div><div><b>" + Math.round(f.pop) + "</b>prestige</div></div>" +
      (champs.length ? '<div class="uvchamps">' + champs.map(t => '<span>' + (imgT(G, t) ? '<img src="' + esc(imgT(G, t)) + '" alt="">' : "") + "<i>" + esc(t.n) + " : <b>" + esc(t.champ ? wn(G, t.champ) : "vacant") + "</b></i></span>").join("") + "</div>" : "") + "</div>"; }).join("");
  } else {
    const y = dateOf(G.day).y, A = awardsOf(G, y);
    body = '<p class="uvmut">Awards de l’Année ' + y + " : remis le 31 décembre. En tête pour l’instant :</p>" + A.map(a => '<div class="uvaw"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8 20h8M10 17h4"></path></svg><div><small>' + esc(a.cat) + "</small><b>" + esc(a.who) + "</b></div></div>").join("") +
      Object.keys(G.awards || {}).sort((a, b) => b - a).map(yy => '<h3 class="uvh3">Année ' + yy + "</h3>" + G.awards[yy].map(a => '<div class="uvaw"><div><small>' + esc(a.cat) + "</small><b>" + esc(a.who) + "</b></div></div>").join("")).join("");
  }
  return shell("monde", "Monde", T, body);
}
FORM.uvmq = f => { U.f.mq = f.q.value.trim(); U.f.mfed = f.fed.value; U.f.msty = f.sty.value; U.f.mn = 40; redraw(); };
ACT.uvmore = () => { U.f.mn += 60; redraw(); };

// ---------- fiche d'un catcheur ----------
export function demandOf(G, w) { const f = meF(G); return Math.round(salOf(w) * (1 + Math.max(0, w.pop - f.pop) / 60) / 10) * 10; }
export function moodOf(G, w, sal, dur, role) {
  const dem = demandOf(G, w), f = meF(G);
  if (w.pop > f.pop + 30) return [-9, "Pas intéressé" + (w.sx === "f" ? "e" : "") + " : ta fédération n’est pas assez connue pour " + (w.sx === "f" ? "elle" : "lui"), "ko"];
  const sc = (sal / dem - 1) * 6 + (role === "me" ? 1.5 : role === "up" ? 0.5 : role === "low" ? -1.5 : 0) - (dur >= 4 ? 0.5 : 0) + (w.fed === G.me ? (w.mor - 60) / 30 : 0);
  return sc >= 0.8 ? [sc, "Content" + (w.sx === "f" ? "e" : "") + " : signerait tout de suite", "ok"] : sc >= -0.6 ? [sc, "Hésite : veut un peu plus", "mid"] : [sc, "Pas d’accord : écoutera d’autres offres", "ko"];
}
const SAY = [
  ["avenir", "Parler de son avenir", w => w.pop > 70 ? "Je veux être le visage de la fédération. Le main event, c’est pour moi." : "Je veux plus de temps à l’écran. Donne-moi une vraie storyline.", 0],
  ["bravo", "Le féliciter", w => "Merci boss ! Le public était en feu. Donne-moi encore des matchs comme ça.", 6],
  ["titre", "Lui promettre un match de titre", w => "Tu me le promets ? Alors je reste concentré" + (w.sx === "f" ? "e" : "") + ". Ne me déçois pas. (promesse ajoutée)", 10],
  ["main", "Lui promettre le main event du prochain grand show", w => "Le main event ? Là, tu me parles. (promesse ajoutée)", 12],
  ["recadrer", "Le recadrer", w => "OK… j’ai compris. Mais je n’aime pas qu’on me parle comme ça.", -10],
  ["repos", "Lui proposer du repos", w => w.en < 50 ? "Franchement, oui. Mon corps en a besoin." : "Du repos ? Je suis en pleine forme, fais-moi catcher !", 3]
];
export function ficheView(id, tab) {
  const G = U.G, w = G.W[id]; if (!w) return shell("monde", "Catcheur", "", '<p class="uvempty">Catcheur introuvable.</p>');
  const mine = w.fed === G.me; tab = tab || "s";
  if (U.f.styW !== id) { U.f.styW = id; U.f.sty = ""; }
  const R = risk(w), pic = imgW(G, w);
  const head = '<a class="uvback" href="#/univers/' + (mine ? "fede/e" : "monde/w") + '">‹ ' + (mine ? "Mon effectif" : "Catcheurs du monde") + "</a>" +
    '<div class="uvfhead">' + (pic ? '<img class="uvfpic" src="' + esc(pic) + '" alt="">' : face(G, w, 76)) + '<div class="uvgrow"><h2>' + esc(w.n) + "</h2><small>" + esc(fedN(G, w.fed)) + (w.ct ? " · " + ROLES[w.ct.role] : "") + " · " + w.age + " ans · " + alTxt(w.al) + "</small>" +
    "<small>Popularité <b>" + Math.round(w.pop) + "</b> · Moral <b>" + (w.mor >= 65 ? "Bon" : w.mor >= 45 ? "Moyen" : "Mauvais") + "</b></small>" + imgBtn("w:" + w.id) + "</div></div>" +
    '<div class="uvpers">' + w.pers.map(p => "<span>" + esc(p) + "</span>").join("") + (injured(G, w) ? '<span class="uvko">Blessé' + (w.sx === "f" ? "e" : "") + " jusqu’au " + esc(shortDate(w.inj.until)) + "</span>" : "") + "</div>" +
    '<div class="uvenb"><div><span>Endurance ' + Math.round(w.en) + ' %</span><span class="uv' + R[1] + '">Risque de blessure : ' + R[0] + "</span></div>" + pctBar(w.en, enC(w.en)) + "</div>";
  const T = tabs("#/univers/c/" + encodeURIComponent(id), [["s", "Stats"], ["c", "Contrat"], ["h", "Historique"]].concat(mine ? [["d", "Dialogue"]] : []), tab);
  let body = head;
  if (tab === "s") {
    const sv = U.f.sty || w.sty;
    body += '<h3 class="uvh3">Style de catch</h3><div class="uvchips">' + Object.keys(STYLES).map(s => '<button type="button" class="uvchip' + (s === sv ? " on" : "") + (s === w.sty ? " his" : "") + '" aria-pressed="' + (s === sv) + '" data-act="uvsty" data-v="' + s + '">' + STYLES[s][0] + (s === w.sty ? " (son style)" : "") + "</button>").join("") + '</div><p class="uvsm">' + esc(STYLES[sv][1]) + "</p>" + (mine && sv !== w.sty ? '<button type="button" class="uvbtn sm" data-act="uvsetsty" data-w="' + esc(w.id) + '" data-v="' + sv + '">Lui donner ce style</button>' : "") +
      '<h3 class="uvh3">Bilan de l’année</h3><div class="uvwld"><div><b>' + w.rec[0] + "</b>Victoires</div><div><b>" + w.rec[1] + "</b>Défaites</div><div><b>" + w.rec[2] + '</b>Draws</div></div><p class="uvmut">Carrière : ' + (w.car[0] + w.rec[0]) + " victoires, " + (w.car[1] + w.rec[1]) + " défaites, " + (w.car[2] + w.rec[2]) + " draws</p>" +
      '<h3 class="uvh3">Stats</h3>' + ST.map((n, i) => '<div class="uvst"><span>' + n + "</span>" + pctBar(w.st[i]) + "<b>" + w.st[i] + "</b></div>").join("") +
      (mine ? '<div class="uvtile"><p class="uvsm">Chaque match fait baisser la barre d’endurance, le repos la fait remonter. Plus elle est basse, plus le risque de blessure monte. Sa stat Endurance compte : plus elle est haute, moins la barre baisse vite. Le style aussi.</p>' +
        ((G.rest || {})[w.id] > G.day ? '<p class="uvok">Au repos jusqu’au ' + esc(shortDate(G.rest[w.id])) + "</p>" : '<button type="button" class="uvbtn" data-act="uvrest" data-w="' + esc(w.id) + '">Le laisser se reposer une semaine</button>') + "</div>" : "");
  } else if (tab === "c") {
    if (w.fed && !mine) body += '<div class="uvtile"><p>Sous contrat avec <b>' + esc(fedN(G, w.fed)) + "</b> jusqu’au " + esc(dayLabel(w.ct.end, true)) + '.</p><p class="uvmut">Tu pourras lui faire une offre quand son contrat sera fini.</p>' +
      ((G.watch || []).indexOf(w.id) >= 0 ? '<p class="uvok">✓ Tu le suis : ton recruteur te préviendra.</p>' : '<button type="button" class="uvbtn" data-act="uvwatch" data-w="' + esc(w.id) + '">Le suivre</button>') + "</div>";
    else {
      const N = U.f.nego[w.id] || { sal: mine && w.ct ? w.ct.sal : demandOf(G, w), dur: 2, role: (w.ct && w.ct.role) || (w.pop > 75 ? "me" : w.pop > 55 ? "up" : "mid"), res: "" };
      U.f.nego[w.id] = N; const md = moodOf(G, w, N.sal, N.dur, N.role), dem = demandOf(G, w);
      body += (mine && w.ct ? '<div class="uvtile"><div class="uvkv"><span>Salaire</span>' + fmtK(w.ct.sal) + ' par an</div><div class="uvkv"><span>Fin du contrat</span>' + esc(dayLabel(w.ct.end, true)) + '</div><div class="uvkv"><span>Rôle</span>' + ROLES[w.ct.role] + "</div></div>" : '<p class="uvok">Agent libre : il demande environ ' + fmtK(dem) + " par an.</p>") +
        '<form class="uvform" id="uvnego" data-form="uvnego" data-w="' + esc(w.id) + '"><h3 class="uvh3">' + (mine ? "Renégocier" : "Lui faire une offre") + "</h3>" +
        '<label class="uvfld">Salaire par an : <output id="uvsalo">' + fmtK(N.sal) + '</output><input type="range" name="sal" min="' + Math.max(20, Math.round(dem * 0.4 / 10) * 10) + '" max="' + Math.round(dem * 2.2 / 10) * 10 + '" step="10" value="' + N.sal + '"></label>' +
        '<label class="uvfld">Durée : <output id="uvduro">' + N.dur + " an" + (N.dur > 1 ? "s" : "") + '</output><input type="range" name="dur" min="1" max="5" step="1" value="' + N.dur + '"></label>' +
        '<label class="uvfld">Rôle promis<select name="role">' + Object.keys(ROLES).map(r => '<option value="' + r + '"' + (r === N.role ? " selected" : "") + ">" + ROLES[r] + "</option>").join("") + "</select></label>" +
        '<div class="uvmood ' + md[2] + '" id="uvmood" role="status">' + esc(md[1]) + '</div><button class="uvbtn pri">Faire l’offre</button>' + (N.res ? '<div class="uvdone" role="status">' + esc(N.res) + "</div>" : "") + "</form>";
    }
  } else if (tab === "h") {
    const titles = Object.values(G.T).filter(t => (Array.isArray(t.champ) ? t.champ.indexOf(w.id) >= 0 : t.champ === w.id));
    body += (titles.length ? '<div class="uvtile"><div class="uvth">Champion' + (w.sx === "f" ? "ne" : "") + " en titre</div>" + titles.map(t => '<div class="uvline">' + (imgT(G, t) ? '<img class="uvbelt" src="' + esc(imgT(G, t)) + '" alt="">' : "") + esc(t.n) + "</div>").join("") + "</div>" : "") +
      (w.hist.length ? w.hist.slice().reverse().map(x => '<div class="uvtl"><b>' + esc(shortDate(x.d)) + "</b>" + esc(x.t) + "</div>").join("") : '<p class="uvempty">Rien de marquant pour l’instant dans cette partie.</p>');
  } else if (tab === "d" && mine) {
    const C = U.f.chat[w.id] || [["him", "Salut boss. Tu voulais me voir ?"]];
    body += '<div class="uvchat">' + C.map(m => '<div class="uvbub ' + m[0] + '">' + esc(m[1]) + "</div>").join("") + "</div>" +
      '<div class="uvacts">' + SAY.map(o => '<button type="button" class="uvbtn" data-act="uvsay" data-w="' + esc(w.id) + '" data-o="' + o[0] + '">' + esc(o[1]) + "</button>").join("") + "</div>";
  }
  return shell(mine ? "fede" : "monde", w.n, T, body);
}
ACT.uvsty = el => { U.f.sty = el.dataset.v; redraw(); };
ACT.uvsetsty = el => { const G = U.G, w = G.W[el.dataset.w]; if (!w || w.fed !== G.me) return; w.sty = el.dataset.v; w.hist.push({ d: G.day, t: "Nouveau style : " + STYLES[w.sty][0] }); U.f.sty = ""; persist(); redraw(); };
ACT.uvwatch = el => { const G = U.G; G.watch = G.watch || []; if (G.watch.indexOf(el.dataset.w) < 0) G.watch.push(el.dataset.w); persist(); redraw(); };
ACT.uvrest = el => { const G = U.G; G.rest = G.rest || {}; G.rest[el.dataset.w] = G.day + 7; persist(); toast("Repos jusqu’au " + shortDate(G.day + 7) + " : il ne sera pas mis sur les cartes de l’IA"); redraw(); };
ACT.uvsay = el => {
  const G = U.G, w = G.W[el.dataset.w], o = SAY.find(x => x[0] === el.dataset.o); if (!w || !o) return;
  const C = U.f.chat[w.id] || [["him", "Salut boss. Tu voulais me voir ?"]];
  C.push(["me", o[1]], ["him", o[2](w)]); U.f.chat[w.id] = C.slice(-8);
  w.mor = clamp(w.mor + o[3]);
  if (o[0] === "titre") G.prom.push({ id: uid("p"), w: w.id, t: "titre", until: G.day + 30, st: "cours", txt: "Match de titre avant le " + shortDate(G.day + 30) });
  if (o[0] === "main") { const nb = G.ev.filter(e => e.fed === G.me && e.kind !== "tv" && !e.done && e.day >= G.day).sort((a, b) => a.day - b.day)[0]; G.prom.push({ id: uid("p"), w: w.id, t: "main", until: nb ? nb.day : G.day + 30, st: "cours", txt: "Main event de " + (nb ? nb.n : "du prochain grand show") }); }
  if (o[0] === "repos") { G.rest = G.rest || {}; G.rest[w.id] = G.day + 7; }
  persist(); redraw();
};
// l'humeur change en direct quand on bouge les curseurs
if (typeof document !== "undefined") document.addEventListener("input", e => {
  const f = e.target.closest && e.target.closest("#uvnego"); if (!f || !U.G) return;
  const w = U.G.W[f.dataset.w]; if (!w) return;
  const N = U.f.nego[w.id]; N.sal = +f.sal.value; N.dur = +f.dur.value; N.role = f.role.value;
  const md = moodOf(U.G, w, N.sal, N.dur, N.role), mo = document.getElementById("uvmood");
  document.getElementById("uvsalo").textContent = fmtK(N.sal); document.getElementById("uvduro").textContent = N.dur + " an" + (N.dur > 1 ? "s" : "");
  if (mo) { mo.textContent = md[1]; mo.className = "uvmood " + md[2]; }
});
if (typeof document !== "undefined") document.addEventListener("change", e => { const f = e.target.closest && e.target.closest("#uvnego"); if (f && e.target.name === "role") f.dispatchEvent(new Event("input", { bubbles: true })); });
FORM.uvnego = f => {
  const G = U.G, w = G.W[f.dataset.w]; if (!w) return;
  const N = U.f.nego[w.id]; N.sal = +f.sal.value; N.dur = +f.dur.value; N.role = f.role.value;
  const md = moodOf(G, w, N.sal, N.dur, N.role), mf = meF(G);
  if (md[0] >= 0.8 || (md[0] >= -0.6 && rnd() < 0.35)) {
    const was = w.fed; w.fed = G.me; w.ct = { sal: N.sal, end: G.day + N.dur * 365, role: N.role }; w.mor = clamp(w.mor + 8);
    if (mf.id === "WWE") w.br = w.br || mf.shows[0].n;
    w.hist.push({ d: G.day, t: (was === G.me ? "Prolonge" : "Signe") + " chez " + mf.n + " (" + N.dur + " an" + (N.dur > 1 ? "s" : "") + ")" });
    N.res = (was === G.me ? "Contrat prolongé" : "Signé !") + " " + w.n + " : " + fmtK(N.sal) + " par an pendant " + N.dur + " an" + (N.dur > 1 ? "s" : "") + ".";
    if (was !== G.me) news(G, { seg: "coul", f: "transferts", t: mf.n + " signe " + w.n, txt: w.n + " rejoint " + mf.n + "." });
  } else if (md[0] >= -0.6) { const c = Math.round(Math.max(N.sal * 1.15, demandOf(G, w)) / 10) * 10; N.res = "Contre-offre de son agent : " + fmtK(c) + " par an" + (N.role !== "me" && w.pop > 70 ? " et le main event" : "") + "."; }
  else N.res = "Offre refusée. Il laisse son agent écouter les autres fédérations.";
  persist(); redraw();
};
