// Pages réservées à l'admin : « Sources des données » (sites utilisés par les mises à jour quotidiennes)
// et « État des mises à jour » (date de chaque donnée + derniers envois sur GitHub).
import { S, B, ACT, changed } from "../state.js";
import { esc, fmt, okHttp, modal, toast } from "../util.js";
import { PARIS, parisDay, parisMin, parisWeekday, prevDay, fmtAt } from "../time.js";
import { ghToken, setGhToken, ghCheck, ghGetJson, ghPutJson, ghCommits } from "../github.js";
import { PREVIEW } from "../content.js";

export const USES = [["actu", "Actu"], ["resultats", "Résultats et highlights"], ["titres", "Titres"], ["calendrier", "Calendrier et horaires"], ["rosters", "Rosters"],
  ["fiches", "Fiches catcheurs"], ["storylines", "Storylines"], ["archives", "Archives"], ["videos", "Vidéos"], ["autre", "Autre"]];
const useLabel = u => (USES.find(x => x[0] === u) || [u, u])[1];
const host = u => String(u || "").replace(/^https?:\/\/(www\.)?/, "").split("/")[0];

// ---------- Sources ----------
export function sourcesView() {
  const list = S.sources || [], key = !!ghToken();
  let h = '<h1>Sources des données</h1><p class="note" style="margin-bottom:12px">Les sites que les mises à jour automatiques utilisent en priorité, chacun pour ce que tu coches. L’app ne lit pas ces sites elle-même : ce sont les mises à jour quotidiennes qui s’en servent. Une source désactivée n’est plus utilisée.</p>';
  if (!key) h += '<div class="lockbox" style="margin:0 16px 14px;text-align:left;align-items:flex-start"><b>🔑 Clé GitHub nécessaire pour enregistrer</b><p>La liste est rangée avec les données de l’app sur GitHub. Pour la modifier depuis ce téléphone, ajoute une fois ta clé GitHub personnelle.</p><button class="btn" data-act="ghkey">Ajouter ma clé GitHub</button></div>';
  h += '<div class="btns" style="justify-content:flex-start;margin:0 16px 10px"><button class="btn" data-act="srcedit" data-i="-1">＋ Ajouter une source</button></div>';
  h += list.length ? '<div class="list srclist">' + list.map((s, i) => '<div class="item src' + (s.on === false ? " off" : "") + '"><span class="lbl"><b>' + (okHttp(s.u) ? '<a href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.n || host(s.u)) + "</a>" : esc(s.n || s.u)) + "</b>" +
    "<small>" + esc(host(s.u)) + (s.on === false ? " · désactivée" : "") + "</small>" + ((s.use || []).length ? '<span class="chips srcuses">' + s.use.map(u => '<span class="chip">' + esc(useLabel(u)) + "</span>").join("") + "</span>" : "") +
    (s.note ? '<small class="srcnote">' + esc(s.note) + "</small>" : "") + '</span><span class="srcbtns"><button class="tglbtn" data-act="srctoggle" data-i="' + i + '" aria-label="' + (s.on === false ? "Activer" : "Désactiver") + '"><span class="tgl' + (s.on === false ? "" : " on") + '"></span></button>' +
    '<button class="btn small ghost" data-act="srcedit" data-i="' + i + '">Modifier</button></span></div>').join("") + "</div>" : '<p class="note">Aucune source pour l’instant.</p>';
  h += '<h2>Clé GitHub</h2><div class="list"><div class="item"><span class="lbl"><b>' + (key ? "✓ Enregistrée sur ce téléphone" : "Pas de clé sur ce téléphone") + "</b><small>Elle sert seulement à enregistrer les sources (et à transmettre les favoris des membres aux mises à jour). Elle n’est jamais partagée.</small></span>" +
    '<span class="srcbtns"><button class="btn small" data-act="ghkey">' + (key ? "Changer" : "Ajouter") + "</button>" + (key ? '<button class="btn small ghost" data-act="ghkeydel">Retirer</button>' : "") + "</span></div></div>";
  return h;
}
async function saveSources(items, msg) {
  if (!ghToken()) { ghKeyModal(); throw new Error("nokey"); }
  await ghPutJson("data/sources.json", { updated: parisDay(), items: items }, msg);
  S.sources = items; changed("route");
  toast("Enregistré ✓ Les prochaines mises à jour s’en serviront");
}
ACT.srctoggle = async el => {
  const i = +el.dataset.i, items = (S.sources || []).map(x => Object.assign({}, x)); if (!items[i]) return;
  items[i].on = items[i].on === false;
  try { await saveSources(items, "Sources TCC TV : " + (items[i].on ? "réactivation" : "désactivation") + " de " + (items[i].n || host(items[i].u))); } catch (e) { if (e.message !== "nokey") toast(e.message); }
};
ACT.srcedit = el => {
  const i = +el.dataset.i, s = i >= 0 ? (S.sources || [])[i] : null, cur = (s && s.use) || [];
  modal((box, close) => {
    box.innerHTML = "<h3>" + (s ? "Modifier la source" : "Ajouter une source") + "</h3>" +
      '<label class="fld">Adresse du site<input id="src_u" type="url" inputmode="url" placeholder="https://…" value="' + esc(s ? s.u : "") + '"></label>' +
      '<label class="fld">Nom (facultatif)<input id="src_n" maxlength="60" placeholder="Ex. : Cagematch" value="' + esc(s ? s.n || "" : "") + '"></label>' +
      '<p class="sub" style="margin:8px 0 6px;text-align:left">À utiliser pour :</p><div class="usegrid">' + USES.map(u => '<label class="chk"><input type="checkbox" value="' + u[0] + '"' + (cur.indexOf(u[0]) >= 0 ? " checked" : "") + "> " + u[1] + "</label>").join("") + "</div>" +
      '<label class="fld">Précisions pour la mise à jour (facultatif)<textarea id="src_note" maxlength="300" rows="2" placeholder="Ex. : la page des résultats de la semaine">' + esc(s ? s.note || "" : "") + "</textarea></label>" +
      '<p class="err" id="srcerr"></p><button class="btn wide" data-ok>Enregistrer</button>' + (s ? '<button class="btn wide ghost danger" style="margin-top:10px" data-del>Supprimer cette source</button>' : "") +
      '<button class="btn wide ghost" style="margin-top:10px" data-no>Annuler</button>';
    const err = t => { box.querySelector("#srcerr").textContent = t; };
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-no]")) return close();
      const items = (S.sources || []).map(x => Object.assign({}, x));
      try {
        if (e.target.closest("[data-del]")) { const n = items[i].n || host(items[i].u); items.splice(i, 1); await saveSources(items, "Sources TCC TV : suppression de " + n); close(); return; }
        if (!e.target.closest("[data-ok]")) return;
        let u = box.querySelector("#src_u").value.trim(); if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
        if (!/^https?:\/\/[^\s"<>]+\.[^\s"<>]+$/i.test(u)) { err("Colle l’adresse complète du site (https://…)"); return; }
        const use = Array.from(box.querySelectorAll(".usegrid input:checked")).map(x => x.value);
        if (!use.length) { err("Coche au moins une utilisation"); return; }
        const it = { n: box.querySelector("#src_n").value.trim().slice(0, 60) || host(u), u: u.slice(0, 400), use: use, on: s ? s.on !== false : true, note: box.querySelector("#src_note").value.trim().slice(0, 300) };
        if (s) items[i] = it; else items.push(it);
        await saveSources(items, "Sources TCC TV : " + (s ? "modification" : "ajout") + " de " + it.n); close();
      } catch (x) { if (x.message === "nokey") close(); else err(x.message); }
    });
  });
};
function ghKeyModal() {
  modal((box, close) => {
    box.innerHTML = '<h3>Ta clé GitHub</h3><p class="sub" style="text-align:left">À faire une seule fois, connecté à ton compte GitHub :</p><ol class="steps">' +
      '<li>Ouvre <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com › Nouvelle clé</a></li>' +
      "<li><b>Token name</b> : TCC TV · <b>Expiration</b> : 1 an</li><li><b>Repository access</b> : « Only select repositories » › <b>catch-tv</b></li>" +
      "<li><b>Permissions</b> › Repository permissions › <b>Contents</b> : « Read and write »</li><li><b>Generate token</b>, copie la clé (elle commence par github_pat_) et colle-la ci-dessous</li></ol>" +
      '<label class="fld">Clé<input id="ghk" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label><p class="err" id="ghkerr"></p>' +
      '<button class="btn wide" data-ok>Vérifier et enregistrer</button><button class="btn wide ghost" style="margin-top:10px" data-no>Annuler</button>';
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-no]")) return close();
      if (!e.target.closest("[data-ok]")) return;
      const t = box.querySelector("#ghk").value.trim();
      if (!/^(github_pat_|ghp_)[\w]{20,}$/.test(t)) { box.querySelector("#ghkerr").textContent = "Ça ne ressemble pas à une clé GitHub (github_pat_…)"; return; }
      try { await ghCheck(t); setGhToken(t); close(); toast("Clé GitHub enregistrée sur ce téléphone ✓"); changed("route"); syncFollowed(true); }
      catch (x) { box.querySelector("#ghkerr").textContent = x.message; }
    });
  });
}
ACT.ghkey = () => ghKeyModal();
ACT.ghkeydel = () => { setGhToken(""); toast("Clé retirée de ce téléphone"); changed("route"); };

// Favoris des membres -> data/followed.json, pour que la mise à jour quotidienne suive ces catcheurs en priorité
// (les mises à jour ne peuvent pas lire Firebase directement). Une fois par jour, depuis l'appareil de l'admin.
export async function syncFollowed(force) {
  if (PREVIEW || !S.isAdmin || !ghToken() || !B || !B.getFollowed) return;
  let last = ""; try { last = localStorage.getItem("ctv.fsync") || ""; } catch (e) {}
  if (!force && last === parisDay()) return;
  try {
    const names = Array.from(new Set((await B.getFollowed()).map(x => String(x).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "fr"));
    const cur = await ghGetJson("data/followed.json");
    if (!cur.data || JSON.stringify(cur.data.names || []) !== JSON.stringify(names)) await ghPutJson("data/followed.json", { updated: parisDay(), names: names }, "Favoris des membres pour la mise à jour (" + names.length + ")");
    try { localStorage.setItem("ctv.fsync", parisDay()); } catch (e) {}
  } catch (e) { /* réessai à la prochaine ouverture */ }
}

// ---------- État des mises à jour ----------
// [clé dans S.updated, nom, heure prévue (minutes, heure de Paris), hebdomadaire]
const SETS = [["news", "Actu en français", 464], ["storylines", "Storyline du jour", 464], ["highlights", "Résultats et highlights", 501], ["titles", "Titres et champions", 501],
  ["recaps", "Résumés sans spoiler", 501], ["calendar", "Calendrier, horaires, pages Netflix", 1163], ["rosters", "Rosters", 1163], ["wrestlers", "Fiches catcheurs", 1163], ["matches", "Matchs à revoir", 1163, true]];
const MARGIN = 45;
function expected(at, weekly) {
  const today = parisDay(), now = parisMin();
  if (!weekly) return now >= at + MARGIN ? today : prevDay(today);
  // le lundi : dernier lundi dont l'heure est passée
  let d = today, wd = parisWeekday();
  if (wd === 1 && now < at + MARGIN) { d = prevDay(d); wd = 0; }
  while (wd !== 1) { d = prevDay(d); wd = (wd + 6) % 7; }
  return d;
}
let commits = null, commitsAt = 0, commitsErr = "";
export function statusView() {
  const U = S.updated || {};
  let h = '<h1>État des mises à jour</h1><p class="note" style="margin-bottom:12px">Chaque donnée de l’app et la date de sa dernière mise à jour automatique. ⚠ = elle aurait dû être mise à jour et ne l’a pas été.</p><div class="list">';
  h += SETS.map(s => {
    const d = U[s[0]] || "", exp = expected(s[2], s[3]);
    let ok = !!d && d >= exp;
    if (s[0] === "storylines" && ok) { const top = (S.storylines || [])[0]; ok = !!top && (top.d || "") >= exp; }
    const when = d ? (d === parisDay() ? "aujourd’hui" : d === prevDay(parisDay()) ? "hier" : fmt(d)) : "jamais";
    return '<div class="item stat' + (ok ? " ok" : " late") + '"><span class="lbl"><b>' + esc(s[1]) + "</b><small>Dernière mise à jour : " + esc(when) + " · prévue " + (s[3] ? "le lundi vers " : "chaque jour vers ") +
      Math.floor(s[2] / 60) + " h " + String(s[2] % 60).padStart(2, "0") + '</small></span><span class="rt">' + (ok ? "✓" : "⚠") + "</span></div>";
  }).join("") + "</div>";
  h += '<p class="note small" style="margin-top:8px">Les dates sont celles chargées à l’ouverture de l’app. <button class="linkbtn" data-act="reloadapp">Recharger</button></p>';
  h += '<h2>Derniers envois sur GitHub</h2><div id="ghcommits">' + commitsHTML() + "</div>";
  setTimeout(loadCommits, 0);
  return h;
}
function commitsHTML() {
  if (commitsErr) return '<p class="note">' + esc(commitsErr) + "</p>";
  if (!commits) return '<p class="note">Chargement…</p>';
  if (!commits.length) return '<p class="note">Aucun envoi.</p>';
  return '<div class="list">' + commits.map(c => '<div class="item"><span class="lbl"><b>' + esc(c.msg.replace(/^Mise à jour TCC TV : /, "🤖 ")) + "</b><small>" + esc(c.at ? fmtAt(c.at, PARIS) : "") + "</small></span></div>").join("") + "</div>";
}
async function loadCommits() {
  if (PREVIEW) { commitsErr = "Visible une fois l’app en ligne."; }
  else if (!commits || Date.now() - commitsAt > 60000) {
    try { commits = await ghCommits(12); commitsAt = Date.now(); commitsErr = ""; } catch (e) { commitsErr = "GitHub ne répond pas pour le moment (" + e.message + ")."; }
  }
  const box = document.getElementById("ghcommits"); if (box) box.innerHTML = commitsHTML();
}
ACT.reloadapp = () => location.reload();
