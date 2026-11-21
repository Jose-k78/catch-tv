// Mode Univers (21 nov., heure du codage) : créer sa partie en 2 étapes.
// 1) #/univers/nouveau/<n> : toi (nom, photo), ta fédération (créer : nom, sigle, logo, 1 ou 2 shows ; reprendre : WWE entière ou un seul show),
//    budget (petit / normal / gros / montant libre), mode Smart ou Mark (le mode préféré du joueur est gardé), ADN, carrière / bac à sable, difficulté.
// 2) #/univers/setup : ton effectif de départ (garder ou laisser partir sans frais, recruter des agents libres), puis « Lancer l'Année 1 ».
import { S, ACT, FORM } from "../state.js";
import { esc, toast, lsGet, lsSet, fileToDataUrl } from "../util.js";
import { FEDS0, STYLES, fmtK, clamp, rnd, newWorld } from "./world.js";
import { loadUData } from "./data.js";
import { meF, roster, champIds } from "./base.js";
import { upgrade } from "./v2.js";
import { startGame } from "./sim.js";
import { demandOf } from "./deal.js";
import { DNA, DNA_OF, dnaInit, dnaMain } from "./dna.js";
import { applyBase } from "./extra.js";
import { U, go, redraw, persist, face, crest } from "./core.js";

const WD = [["1", "Lundi"], ["2", "Mardi"], ["3", "Mercredi"], ["4", "Jeudi"], ["5", "Vendredi"], ["6", "Samedi"], ["0", "Dimanche"]];
const days = (name, v, none) => '<select name="' + name + '">' + (none ? '<option value="">—</option>' : "") + WD.map(d => '<option value="' + d[0] + '"' + (d[0] === v ? " selected" : "") + ">" + d[1] + "</option>").join("") + "</select>";
const choice = (name, v, title, txt, on) => '<label class="uvchoice"><input type="radio" name="' + name + '" value="' + esc(v) + '"' + (on ? " checked" : "") + "><span><b>" + title + "</b>" + (txt ? "<small>" + txt + "</small>" : "") + "</span></label>";
export const gmName = G => (G && G.gm && G.gm.n) || "";
export const gmFace = (G, sz) => G && G.gm && G.gm.pic ? '<img class="uvav" src="' + esc(G.gm.pic) + '" alt="" style="width:' + sz + "px;height:" + sz + 'px">' : '<span class="uvav ini" style="width:' + sz + "px;height:" + sz + 'px;background:#f5b13d">' + esc((gmName(G) || "GM").slice(0, 2).toUpperCase()) + "</span>";

export function newView(slot) {
  const feds = Object.keys(FEDS0), um = lsGet("ctv.univ.um") === "mark" ? "mark" : "smart", gmn = lsGet("ctv.univ.gmn") || ((S.profile || {}).name || "");
  return '<div class="uvparties uvnew"><a class="uvback" href="#/univers">‹ Les parties</a><h1>Nouvelle partie</h1><p class="uvmut">Partie ' + esc(slot) + " · étape 1 sur 2</p>" +
    '<form class="uvform" data-form="uvcreate"><input type="hidden" name="slot" value="' + esc(slot) + '">' +
    '<fieldset class="uvfs"><legend>Toi, le GM</legend><label class="uvfld">Ton nom<input name="gmn" maxlength="30" value="' + esc(gmn) + '" placeholder="Ton nom de GM"></label>' +
    '<label class="uvfld">Ta photo (facultatif)<input type="file" name="gmpic" accept="image/*"></label></fieldset>' +
    '<fieldset class="uvfs"><legend>Comment veux-tu jouer ?</legend>' +
    choice("mode", "create", "Créer ma fédération", "Tu choisis le nom, le logo et tes shows. Tu commences petit ; plus ton show est célèbre, plus tu peux signer des stars.", true) +
    choice("mode", "take", "Prendre une fédération existante", "Avec ses catcheurs sous contrat. Les autres sont gérées par l’IA.") + "</fieldset>" +
    '<fieldset class="uvfs cr"><legend>Ta fédération</legend><label class="uvfld">Nom<input name="n" maxlength="40" value="TCC Pro Wrestling"></label>' +
    '<label class="uvfld">Sigle (2 à 5 lettres)<input name="sh" maxlength="5" value="TCC"></label><label class="uvfld">Couleur<input type="color" name="c" value="#f5b13d"></label>' +
    '<label class="uvfld">Logo (facultatif)<input type="file" name="logo" accept="image/*"></label>' +
    '<label class="uvfld">Nom du show TV<input name="show" maxlength="30" value="TCC Monday"></label><label class="uvfld">Jour du show' + days("wd", "1") + "</label>" +
    '<label class="uvfld">2e show (facultatif)<input name="show2" maxlength="30" value="" placeholder="Ex. TCC Friday"></label><label class="uvfld">Jour du 2e show' + days("wd2", "5") + "</label></fieldset>" +
    '<fieldset class="uvfs tk"><legend>La fédération</legend><label class="uvfld">Fédération<select name="take">' + feds.map(k => '<option value="' + k + '">' + esc(k) + "</option>").join("") + "</select></label>" +
    '<div class="uvww"><p class="uvsm">À la WWE, tu peux tout diriger ou prendre un seul show. Les autres shows ont alors leur propre GM (l’IA) : tu seras quand même là pour les drafts.</p>' +
    choice("solo", "", "Toute la WWE", "Raw, SmackDown, NXT et Evolve.", true) + FEDS0.WWE.shows.map(s => choice("solo", s[0], "Seulement " + s[0], "")).join("") + "</div></fieldset>" +
    '<fieldset class="uvfs"><legend>Ton budget de départ</legend>' +
    choice("money", "petit", "Petit budget", "La moitié de l’argent habituel : chaque dollar compte.") + choice("money", "normal", "Budget normal", "", true) +
    choice("money", "gros", "Gros budget", "2,5 fois plus d’argent pour signer qui tu veux.") +
    '<label class="uvchoice"><input type="radio" name="money" value="libre"><span><b>Montant libre</b><small>En k$ (1 000 k$ = 1 million de dollars).</small><input class="uvmfree" name="mfree" type="number" inputmode="numeric" min="100" max="2000000" step="1" value="5000" aria-label="Montant en k$"></span></label></fieldset>' +
    '<fieldset class="uvfs"><legend>Ton univers</legend>' +
    choice("um", "smart", "Smart", "Tu sais comment marche le catch : tu choisis les vainqueurs et tu écris les histoires.", um === "smart") +
    choice("um", "mark", "Mark", "Le catch est vrai. Tu programmes les matchs, mais le résultat se joue sur le ring, comme un sport. Tu ne choisis jamais qui gagne. Tout est raconté comme à la télé.", um === "mark") + "</fieldset>" +
    '<fieldset class="uvfs"><legend>L’ADN de ta fédération</legend><p class="uvsm">Ce que ton public aime et ce qui attire les catcheurs. Il bougera avec ce que tu programmes.</p>' +
    '<span class="tk">' + choice("dna", "", "Celui de la fédération choisie", "WWE = Spectacle, NJPW = Sport de combat, AEW = Liberté créative, AAA et CMLL = Lucha libre, Stardom et Marigold = Joshi, ROH = Lutte pure.", true) + "</span>" +
    Object.keys(DNA).map(k => choice("dna", k, DNA[k].n + " <i>(" + DNA[k].ex + ")</i>", DNA[k].d)).join("") + "</fieldset>" +
    '<fieldset class="uvfs"><legend>Mode de jeu</legend>' +
    choice("gm", "carriere", "Carrière", "Le propriétaire te fixe des objectifs chaque trimestre. Rate-les trop souvent et tu es viré ; la faillite = fin de partie.", true) +
    choice("gm", "sandbox", "Bac à sable", "Pas d’objectifs, pas de renvoi, pas de faillite : tu fais ce que tu veux.") +
    '<label class="uvfld">Difficulté<select name="diff"><option value="facile">Facile (plus d’argent, objectifs plus doux)</option><option value="normal" selected>Normal</option><option value="difficile">Difficile (moins d’argent, objectifs plus durs)</option></select></label></fieldset>' +
    '<button class="uvbtn pri">Suivant : ton effectif</button></form></div>';
}
const fileOf = (f, n) => { const x = f.elements.namedItem(n); return x && x.files && x.files[0]; };
FORM.uvcreate = async f => {
  const slot = +f.slot.value, mode = f.mode.value, gm = f.gm.value, diff = f.diff.value, um = f.um.value === "mark" ? "mark" : "smart";
  if (!Object.keys(S.rosters || {}).length) { toast("Les données de TCC TV ne sont pas encore chargées, réessaie dans un instant"); return; }
  const btn = f.querySelector("button.pri"); if (btn) { btn.disabled = true; btn.textContent = "Création du monde…"; }
  const gmn = (f.gmn.value || "").trim().slice(0, 30); lsSet("ctv.univ.gmn", gmn || null); lsSet("ctv.univ.um", um);
  let pic = "", logo = "";
  try { const a = fileOf(f, "gmpic"); if (a) pic = await fileToDataUrl(a, 240, 240, false, 40000); const b = mode === "create" && fileOf(f, "logo"); if (b) logo = await fileToDataUrl(b, 360, 360, false, 60000); } catch (e) { toast("Image illisible : la partie est créée sans elle"); }
  await loadUData();
  const money = f.money.value, free = +f.mfree.value, dna = f.dna.value, solo = mode === "take" && f.take.value === "WWE" ? f.solo.value : "";
  const show2 = mode === "create" ? (f.show2.value || "").trim().slice(0, 30) : "", wd2 = f.wd2.value;
  setTimeout(() => {
    try {
      const G0 = mode === "take" ? newWorld({ take: f.take.value }) : newWorld({ create: { n: f.n.value.trim(), sh: f.sh.value.trim() || "MOI", c: f.c.value, show: f.show.value.trim() || "Mon show", wd: f.wd.value } });
      if (show2 && G0.F.ME && String(wd2) !== String(f.wd.value)) G0.F.ME.shows.push({ n: show2, wd: +wd2 });
      const G = upgrade(G0, { fresh: true, mode: gm, diff: diff }), fd = meF(G); G.tuto = 0;
      applyBase(G);   // noms et images choisis par le modo pour toutes les nouvelles parties
      G.gm = { n: gmn || "Le GM", pic: pic };
      if (logo) { G.img = G.img || {}; G.img["f:" + G.me] = logo; }
      if (money === "petit") fd.money = Math.round(fd.money * 0.5); else if (money === "gros") fd.money = Math.round(fd.money * 2.5); else if (money === "libre" && free > 0) fd.money = clamp(free, 100, 2000000);
      G.mark = um === "mark";
      dnaInit(G, dna || (mode === "create" ? "wwe" : DNA_OF[G.me]));
      if (solo) { G.solo = solo; fd.split = true; }
      G.setup = { drop: [], add: [], tab: "r" };
      U.G = G; U.slot = slot; try { localStorage.setItem("ctv.univ.slot", String(slot)); } catch (e) {} persist(true); go("#/univers/setup");
    } catch (e) { console.error(e); toast("Création impossible : " + (e.message || e)); if (btn) { btn.disabled = false; btn.textContent = "Suivant : ton effectif"; } }
  }, 30);
};

// ---------- étape 2 : l'effectif de départ ----------
const mine = G => roster(G).filter(w => w.fed === G.me && (!G.solo || w.br === G.solo));
const freeAgents = G => Object.values(G.W).filter(w => !w.fed && !w.ret && !w.staff && !w.dead && !(w.inj && w.inj.until > 60)).sort((a, b) => b.pop - a.pop);
const tooBig = (G, w) => w.pop > meF(G).pop + 30;
function row(G, w, on, act, lab, sal, dis) {
  return '<div class="uvsur' + (on ? " on" : "") + '">' + face(G, w, 40) + '<span class="uvgrow"><b>' + esc(w.n) + "</b><small>Pop " + Math.round(w.pop) + " · " + esc((STYLES[w.sty] || [""])[0]) + " · " + w.age + " ans" + (sal ? " · " + fmtK(sal) + " / an" : "") + "</small></span>" +
    '<button type="button" class="uvbtn sm' + (on ? " pri" : "") + '" data-act="' + act + '" data-w="' + esc(w.id) + '"' + (dis ? " disabled" : "") + ' aria-pressed="' + (on ? "true" : "false") + '">' + lab + "</button></div>";
}
export function setupView() {
  const G = U.G, f = meF(G), su = G.setup || (G.setup = { drop: [], add: [], tab: "r" }), R = mine(G), keep = R.filter(w => su.drop.indexOf(w.id) < 0), add = su.add.map(id => G.W[id]).filter(Boolean);
  const total = keep.length + add.length, sal = keep.reduce((s, w) => s + ((w.ct || {}).sal || 0), 0) + add.reduce((s, w) => s + demandOf(G, w), 0);
  const sx = su.sx || "", byS = L => sx ? L.filter(w => w.sx === sx) : L;
  const grp = (L, fn) => [["h", "Hommes"], ["f", "Femmes"]].map(g => { const L2 = L.filter(w => w.sx === g[0]); return L2.length ? '<h3 class="uvh3">' + g[1] + " (" + L2.length + ")</h3>" + L2.map(fn).join("") : ""; }).join("");
  let body = "";
  if (su.tab === "r") body = '<p class="uvsm">Touche « Gardé » pour laisser partir un catcheur. Avant le début de la partie, ça ne coûte rien : il devient agent libre.</p>' +
    grp(R.slice().sort((a, b) => b.pop - a.pop), w => { const on = su.drop.indexOf(w.id) < 0; return row(G, w, on, "uvsukeep", on ? "Gardé ✓" : "Laissé partir", (w.ct || {}).sal); });
  else { const FA = byS(freeAgents(G)).slice(0, 60);
    body = '<p class="uvsm">Les agents libres signent pour un an au salaire qu’ils demandent. Les stars trop célèbres pour ta fédération ne viendront pas tout de suite.</p>' +
      '<div class="uvchips" role="group" aria-label="Filtrer">' + [["", "Tous"], ["h", "Hommes"], ["f", "Femmes"]].map(x => '<button type="button" class="uvchip' + (sx === x[0] ? " on" : "") + '" data-act="uvsusx" data-v="' + x[0] + '">' + x[1] + "</button>").join("") + "</div>" +
      (FA.length ? FA.map(w => { const on = su.add.indexOf(w.id) >= 0, big = tooBig(G, w); return row(G, w, on, "uvsuadd", on ? "Recruté ✓" : big ? "Trop célèbre" : "Recruter", demandOf(G, w), big && !on); }).join("") : '<p class="uvempty">Aucun agent libre.</p>'); }
  return '<div class="uvparties uvsetup"><a class="uvback" href="#/univers">‹ Les parties</a><h1>Ton effectif de départ</h1><p class="uvmut">Étape 2 sur 2</p>' +
    '<div class="uvsuhd">' + crest(G, G.me, 52) + '<span class="uvgrow"><b>' + esc(f.n) + (G.solo ? " · " + esc(G.solo) : "") + "</b><small>" + gmFace(G, 22) + " " + esc(gmName(G)) + " · " + (G.mark ? "Mode Mark" : "Mode Smart") + " · ADN : " + esc(DNA[dnaMain(G)].n) + "</small></span></div>" +
    '<div class="uvsunum"><span><b>' + total + "</b><small>catcheurs</small></span><span><b>" + fmtK(f.money) + "</b><small>en caisse</small></span><span><b>" + fmtK(sal) + "</b><small>de salaires par an</small></span></div>" +
    '<div class="uvtabs" role="tablist">' + [["r", "Ton effectif (" + keep.length + ")"], ["a", "Recruter" + (add.length ? " (" + add.length + ")" : "")]].map(t => '<button type="button" role="tab" class="uvtab' + (su.tab === t[0] ? " on" : "") + '" aria-selected="' + (su.tab === t[0]) + '" data-act="uvsutab" data-v="' + t[0] + '">' + t[1] + "</button>").join("") + "</div>" +
    '<div class="uvsul">' + body + "</div>" +
    '<div class="uvsugo">' + (total < 8 ? '<p class="uvko">Il te faut au moins 8 catcheurs pour lancer la partie.</p>' : sal > f.money ? '<p class="uvko">Attention : tes salaires d’un an dépassent ton argent.</p>' : "") +
    '<button type="button" class="uvbtn pri" data-act="uvsugo"' + (total < 8 ? " disabled" : "") + ">Lancer l’Année 1</button></div></div>";
}
const tog = (L, id) => { const i = L.indexOf(id); if (i >= 0) L.splice(i, 1); else L.push(id); };
ACT.uvsutab = el => { const G = U.G; if (!G || !G.setup) return; G.setup.tab = el.dataset.v; redraw(); };
ACT.uvsusx = el => { const G = U.G; if (!G || !G.setup) return; G.setup.sx = el.dataset.v; redraw(); };
ACT.uvsukeep = el => { const G = U.G; if (!G || !G.setup) return; tog(G.setup.drop, el.dataset.w); persist(); redraw(); };
ACT.uvsuadd = el => { const G = U.G; if (!G || !G.setup) return; const w = G.W[el.dataset.w]; if (!w) return; if (G.setup.add.indexOf(w.id) < 0 && tooBig(G, w)) return; tog(G.setup.add, w.id); persist(); redraw(); };
ACT.uvsugo = () => {
  const G = U.G; if (!G || !G.setup) return; const su = G.setup, f = meF(G);
  su.drop.forEach(id => { const w = G.W[id]; if (!w || w.fed !== G.me) return;
    Object.values(G.T).forEach(t => { if (champIds(t).indexOf(id) >= 0) t.champ = Array.isArray(t.champ) ? [] : ""; });
    w.fed = ""; w.ct = null; w.br = ""; });
  G.teams = (G.teams || []).filter(t => t.fed !== G.me || t.m.every(id => G.W[id] && G.W[id].fed === G.me));
  (G.clans || []).forEach(c => { if (c.fed === G.me) c.m = c.m.filter(id => G.W[id] && G.W[id].fed === G.me); }); G.clans = (G.clans || []).filter(c => c.fed !== G.me || c.m.length >= 3);
  su.add.forEach(id => { const w = G.W[id]; if (!w || w.fed) return; w.fed = G.me; w.br = G.solo || ""; w.ct = { sal: demandOf(G, w), end: G.day + 365 + Math.floor(rnd() * 365), role: "mid" }; });
  const R = roster(G).filter(w => w.fed === G.me).sort((a, b) => b.pop - a.pop), n = R.length;
  R.forEach((w, i) => { if (w.ct) w.ct.role = i < Math.max(1, n * 0.1) ? "me" : i < n * 0.35 ? "up" : i < n * 0.75 ? "mid" : "low"; });
  delete G.setup; startGame(G); persist(true); go("#/univers/g");
};
// changer sa photo de GM (Bureau › Réglages)
ACT.uvgmpic = () => {
  const G = U.G; if (!G) return;
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
  inp.addEventListener("change", async () => { const fl = inp.files && inp.files[0]; if (!fl) return; try { G.gm = G.gm || { n: "Le GM" }; G.gm.pic = await fileToDataUrl(fl, 240, 240, false, 40000); persist(); redraw(); toast("Photo changée"); } catch (e) { toast("Image illisible"); } });
  inp.click();
};
