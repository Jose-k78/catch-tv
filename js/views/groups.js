// Fiche d'un tag team / d'une faction (#/groupe/id) : logo (dossier de l'admin, sinon ajouté par un membre, sinon le nom écrit),
// membres actuels, anciens membres, années, matchs de référence. Données : data/groups.json (tenu à jour chaque soir).
// Sur la fiche d'un catcheur : le logo de ses groupes actuels dans un coin de sa photo, et la liste de ses groupes.
import { linksOf } from "../links.js";
import { S, ACT, changed } from "../state.js";
import { ghGetJson, ghPutJson, ghToken } from "../github.js";
import { esc, ICON, modal, toast } from "../util.js";
import { linkNames } from "../wrestlers.js";
import { okVid } from "./highlights.js";
import { photoOf, face } from "../photos.js";
import { groupById, groupId, groupLogo, groupsOf, groupChip, groupHref, artVersions } from "../assets.js";
import { wImageBox, gslug } from "./wimage.js";

// bouton d'un match de référence : vidéo officielle connue -> on la regarde dans l'app ;
// sinon simple recherche YouTube du combat complet (« noms + événement + full match »), et c'est le membre qui choisit
// NJPW, Stardom, Marigold : le membre choisit où chercher (YouTube, Dailymotion ou la plateforme officielle).
// Jamais de sites de copies non officielles (VK Video, archive.org…).
const OFFICIAL = { NJPW: ["NJPW World", "https://njpwworld.com/"], Stardom: ["Stardom World", "https://www.stardom-world.com/"], Marigold: ["Wrestle Universe", "https://www.wrestle-universe.com/"] };
export function refButton(m, k) {
  // lien du modo (TCC Play) : lu en priorité dans le lecteur de l'app ; en mode modification, bouton pour en ajouter
  const rk = "ref:" + String(m.t || "").slice(0, 100) + "|" + String(m.ev || "").slice(0, 40), L = linksOf(rk);
  const add = S.isAdmin ? '<button class="iconbtn" data-act="mladd" data-k="' + esc(rk) + '" data-t="' + esc(m.t) + '" title="Ajouter un lien (modo)">🔗</button>' : "";
  if (L.length) { const x = L.find(y => y.def) || L[0]; return '<span class="refbtns"><button class="btn small" data-act="mlplay" data-u="' + esc(x.u) + '" data-t="' + esc(m.t) + '">▶ Voir</button>' + add + "</span>"; }
  return '<span class="refbtns">' + refButton0(m, k) + add + "</span>";
}
function refButton0(m, k) {
  const q = String(m.t || "").replace(/^[^:]{1,80} : (?=.* (?:contre|vs) )/, "").replace(/ — .*$/, "").replace(/ contre /g, " vs ").replace(/ et /g, " & ") + (m.ev ? " " + m.ev : "") + " full match";
  if (okVid(m.v)) return '<button class="btn small" data-act="play" data-id="' + esc(m.v) + '" data-t="' + esc(m.t) + '">▶ Voir</button>';
  const ks = String(k || "").split(/\s*·\s*/), off = ks.map(x => OFFICIAL[x]).find(Boolean);
  if (off) return '<button class="btn small ghost" data-act="refsearch" data-q="' + esc(q) + '" data-on="' + esc(off[0]) + '" data-ou="' + esc(off[1]) + '">🔎 Chercher le match</button>';
  return '<a class="btn small ghost" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '" target="_blank" rel="noopener">🔎 Chercher le match</a>';
}
ACT.refsearch = el => {
  const q = el.dataset.q, on = el.dataset.on, ou = el.dataset.ou;
  modal((box, close) => {
    box.innerHTML = "<h3>Où chercher le match ?</h3><p class=\"sub\">" + esc(q.replace(/ full match$/, "")) + "</p>" +
      '<a class="btn wide" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '">YouTube</a>' +
      '<a class="btn wide ghost" style="margin-top:8px" target="_blank" rel="noopener" href="https://www.dailymotion.com/search/' + encodeURIComponent(q) + '/videos">Dailymotion</a>' +
      '<a class="btn wide ghost" style="margin-top:8px" target="_blank" rel="noopener" href="' + esc(ou) + '">' + esc(on) + " (plateforme officielle)</a>" +
      '<p class="note small" style="margin-top:10px">C’est toi qui choisis la vidéo. Seulement les sites officiels ou grand public.</p><button class="btn wide ghost" style="margin-top:6px" data-no>Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-no]") || e.target.closest("a")) close(); });
  });
};
const wl = n => "#/catcheur/" + encodeURIComponent(n);
function people(list) {
  return '<div class="list">' + list.map(n => '<a class="item" href="' + wl(n) + '">' + (photoOf(n) ? '<img class="wface0" src="' + esc(photoOf(n)) + '" alt="" loading="lazy" style="width:40px;height:40px" onerror="this.remove()">' : '<span class="wnone">?</span>') +
    '<span class="lbl"><b>' + esc(n) + '</b></span><span class="chev">›</span></a>').join("") + "</div>";
}

export function groupView(raw) {
  const id = groupById(raw) ? raw : groupId(decodeURIComponent(String(raw)).replace(/-/g, " "));
  const g = groupById(id);
  if (!g) return '<a class="back" href="#/recherche">' + ICON.back + ' Recherche</a><p class="empty">Groupe introuvable.</p>';
  const logo = groupLogo(id);
  let h = '<a class="back" href="#/recherche/' + encodeURIComponent(g.n) + '">' + ICON.back + " Recherche</a>";
  h += '<section class="wcard gcard">' + (logo ? '<button class="glogo" data-act="zoom" data-src="' + esc(logo) + '" data-alt="' + esc(g.n) + '" aria-label="Agrandir le logo"><img src="' + esc(logo) + '" alt="' + esc(g.n) + '"></button>' : "") +
    '<div class="wtt"><span class="eyebrow">' + (g.m && g.m.length === 2 ? "TAG TEAM" : "FACTION / TAG TEAM") + "</span><h1>" + esc(g.n) + "</h1></div>" +
    (logo ? "" : wImageBox(g.n, { slug: gslug(id), label: "logo" })) +
    '<div class="wfacts"><div><small>Promotion</small><b>' + esc(g.k || "–") + "</b></div><div><small>" + (g.on ? "En activité" : "Années") + "</small><b>" + esc(g.y || "–") + "</b></div></div>";
  // les deux visages face à face pour un duo, sinon la rangée des membres
  const faces = (g.m || []).map(n => face(n, 56)).filter(Boolean);
  if (faces.length) h += '<div class="wfaces gfaces">' + faces.slice(0, 8).join("") + "</div>";
  h += "</section>";
  h += "<h2>" + (g.on ? "Membres actuels" : "Membres") + "</h2>" + ((g.m || []).length ? people(g.m) : '<p class="note">Les membres seront ajoutés lors d’une prochaine mise à jour.</p>');
  if ((g.ex || []).length) h += "<h2>Anciens membres</h2>" + people(g.ex);
  const ref = (Array.isArray(g.ref) ? g.ref : []).slice(0, 5);
  h += "<h2>Matchs de référence</h2>" + (ref.length ? '<div class="list">' + ref.map(m => '<div class="item"><span class="lbl"><b>' + linkNames(m.t) + "</b><small>" + esc(m.ev || "") + "</small></span>" + refButton(m, g.k) + "</div>").join("") + "</div>"
    : '<p class="note">Ses matchs de référence seront ajoutés lors d’une prochaine mise à jour.</p>');
  const old = artVersions("groups", g.lg);
  if (old.length) h += '<h2>Anciens logos</h2><div class="glogos">' + old.map(s => '<button data-act="zoom" data-src="' + esc(s) + '" data-alt="' + esc(g.n) + '"><img src="' + esc(s) + '" alt="" loading="lazy"></button>').join("") + "</div>";
  h += '<p class="note small" style="margin-top:12px">' + "Membres et matchs de référence tenus à jour chaque soir." + "</p>";
  if (S.isAdmin) h += '<div class="btns" style="margin:10px 16px"><button class="btn small" data-act="gedit" data-id="' + esc(id) + '">✏️ Modifier ce groupe</button><button class="btn small ghost" data-act="gnew">＋ Nouveau clan / équipe</button><button class="btn small ghost danger" data-act="gdel" data-id="' + esc(id) + '">🗑 Supprimer</button></div>';
  return h;
}

// ---------- modo : ajouter, modifier, supprimer un clan / une équipe (data/groups.json, clé GitHub du modo) ----------
const lines = v => String(v || "").split(/\n|,/).map(x => x.trim()).filter(Boolean);
async function saveGroups(fn, msg) {
  if (!ghToken()) { if (ACT.ghkey) ACT.ghkey(); return false; }
  const cur = await ghGetJson("data/groups.json"), d = cur.data || { items: {} };
  d.items = d.items || {}; fn(d.items); d.updated = new Date().toISOString().slice(0, 10);
  await ghPutJson("data/groups.json", d, msg);
  S.groups = d.items; changed("content");
  return true;
}
function groupForm(id) {
  const g = id ? groupById(id) || {} : { on: 1 };
  modal((box, close) => {
    box.innerHTML = "<h3>" + (id ? "Modifier « " + esc(g.n) + " »" : "Nouveau clan / équipe") + '</h3><form data-gf>' +
      '<label class="fld">Nom<input name="n" required maxlength="60" value="' + esc(g.n || "") + '"></label>' +
      '<label class="fld">Promotion<select name="k">' + Object.keys(S.P).map(k => "<option" + (k === g.k ? " selected" : "") + ">" + esc(k) + "</option>").join("") + "</select></label>" +
      '<label class="fld">Années<input name="y" maxlength="40" placeholder="depuis 2026" value="' + esc(g.y || "") + '"></label>' +
      '<label class="chk"><input type="checkbox" name="on"' + (g.on ? " checked" : "") + "> En activité</label>" +
      '<label class="fld">Membres actuels (un par ligne)<textarea name="m" rows="4">' + esc((g.m || []).join("\n")) + "</textarea></label>" +
      '<label class="fld">Anciens membres (un par ligne)<textarea name="ex" rows="3">' + esc((g.ex || []).join("\n")) + "</textarea></label>" +
      '<label class="fld">Autres noms (un par ligne)<textarea name="a" rows="2">' + esc((g.a || []).join("\n")) + "</textarea></label>" +
      '<label class="fld">Nom du fichier logo (facultatif)<input name="lg" maxlength="60" value="' + esc(g.lg || "") + '"></label>' +
      '<button class="btn wide">Enregistrer</button></form><button class="btn wide ghost" style="margin-top:10px" data-close>Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
    box.querySelector("[data-gf]").addEventListener("submit", async e => {
      e.preventDefault();
      const f = e.target, n = f.n.value.trim(); if (!n) return;
      const rec = Object.assign({}, g, { n: n, k: f.k.value, y: f.y.value.trim(), on: f.on.checked ? 1 : 0, m: lines(f.m.value), lg: f.lg.value.trim() || g.lg || n });
      const ex = lines(f.ex.value), a = lines(f.a.value); if (ex.length) rec.ex = ex; else delete rec.ex; if (a.length) rec.a = a; else delete rec.a;
      const key = id || groupId(n) || n.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      close();
      try { if (await saveGroups(items => { items[key] = rec; }, (id ? "Groupe modifié : " : "Nouveau groupe : ") + n)) { toast("Enregistré ✓"); location.hash = groupHref(key); } }
      catch (err) { if (err && err.message !== "nokey") toast("Pas enregistré : " + err.message, { ms: 5000 }); }
    });
  });
}
ACT.gedit = el => { if (S.isAdmin) groupForm(el.dataset.id); };
ACT.gnew = () => { if (S.isAdmin) groupForm(""); };
ACT.gdel = el => {
  if (!S.isAdmin) return;
  const id = el.dataset.id, g = groupById(id) || {};
  modal((box, close) => {
    box.innerHTML = "<h3>Supprimer « " + esc(g.n || id) + " » ?</h3><button class=\"btn wide danger\" data-ok>Supprimer</button><button class=\"btn wide ghost\" style=\"margin-top:10px\" data-close>Annuler</button>";
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-close]")) return close();
      if (!e.target.closest("[data-ok]")) return;
      close();
      try { if (await saveGroups(items => { delete items[id]; }, "Groupe supprimé : " + (g.n || id))) { toast("Groupe supprimé"); location.hash = "#/recherche"; } }
      catch (err) { if (err && err.message !== "nokey") toast("Pas enregistré : " + err.message, { ms: 5000 }); }
    });
  });
};

// Fiche catcheur : logos des groupes actuels (dans un coin de la photo) et liste de ses groupes
export function wGroups(name) {
  const gs = groupsOf(name);
  const corner = gs.cur.slice(0, 2).map(id => groupChip(id, 30)).join("");
  const all = gs.cur.concat(gs.past);
  const list = all.length ? '<div class="wgroups"><small>' + (gs.cur.length ? "Ses groupes" : "Ses anciens groupes") + '</small><div class="chips wrap">' +
    all.map(id => { const g = groupById(id), src = groupLogo(id); return '<a class="chip gpill' + (gs.cur.indexOf(id) >= 0 ? " cur" : "") + '" href="' + groupHref(id) + '">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : "") + esc(g.n) + (gs.cur.indexOf(id) < 0 ? ' <span class="muted">(ancien)</span>' : "") + "</a>"; }).join("") +
    "</div></div>" : "";
  return { corner: corner, list: list };
}
