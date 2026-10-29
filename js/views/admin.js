// Pages réservées à l'admin : « Sources des données » (sites utilisés par les mises à jour quotidiennes)
// et « État des mises à jour » (date de chaque donnée + derniers envois sur GitHub).
import { S, B, ACT, changed } from "../state.js";
import { esc, fmt, okHttp, modal, toast } from "../util.js";
import { PARIS, parisDay, parisMin, parisWeekday, prevDay, fmtAt } from "../time.js";
import { ghToken, setGhToken, ghCheck, ghGetJson, ghPutJson, ghCommits, ghPutBinary, ghDelete, bufToB64 } from "../github.js";
import { bgKey } from "../media.js";
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
const SETS = [["news", "Actu en français", 464], ["storylines", "Storyline du jour", 464], ["polls", "Sondages du jour", 464], ["highlights", "Résultats et highlights", 501], ["titles", "Titres et champions", 501],
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

// ---------- Fonds animés des onglets et musique de fond ----------
// Fichiers rangés dans media/ sur GitHub (avec la clé GitHub), liste dans data/media.json
const MB = 1024 * 1024;
const kb = n => n >= MB ? (n / MB).toFixed(1).replace(".", ",") + " Mo" : Math.round(n / 1024) + " Ko";
const slug = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "home";
export function mediaView() {
  const M = S.media || { bg: {}, music: null }, bg = M.bg || {}, mu = M.music, key = !!ghToken();
  let h = '<h1>Fonds animés et musique</h1>';
  if (!key) h += '<div class="lockbox" style="margin:0 16px 14px;text-align:left;align-items:flex-start"><b>🔑 Clé GitHub nécessaire</b><p>Les vidéos et la musique sont rangées avec les fichiers de l’app sur GitHub. Ajoute une fois ta clé GitHub pour les envoyer depuis ce téléphone.</p><button class="btn" data-act="ghkey">Ajouter ma clé GitHub</button></div>';
  h += '<h2 style="margin-top:4px">Musique de fond</h2><p class="note small">MP3 de 1 à 2 minutes qui tourne en boucle, 3 Mo maximum conseillé (5 Mo au plus). Elle démarre au premier appui sur l’écran ; chaque membre peut la couper avec 🔊 en haut.</p>' +
    '<div class="list"><div class="item mediarow"><span class="lbl"><b>' + (mu ? "🎵 " + esc(mu.n || "Musique") : "Pas de musique") + "</b><small>" + (mu ? esc(kb(mu.size || 0)) + (mu.at ? " · envoyée le " + esc(fmt(mu.at)) : "") : "Silence par défaut") + "</small>" +
    (mu ? '<audio controls preload="none" src="' + esc(mu.u) + '"></audio>' : "") + "</span>" +
    '<span class="repbtns"><button class="btn small" data-act="mediapick" data-kind="music">' + (mu ? "Changer" : "Choisir un MP3") + "</button>" + (mu ? '<button class="btn small ghost" data-act="mediadel" data-kind="music">Retirer</button>' : "") + "</span></div>" +
    (mu ? '<div class="item"><span class="lbl"><b>Volume par défaut</b><small id="volv">' + Math.round((mu.vol == null ? 0.4 : mu.vol) * 100) + ' %</small><input type="range" id="mvol" min="5" max="100" step="5" value="' + Math.round((mu.vol == null ? 0.4 : mu.vol) * 100) + '" aria-label="Volume"></span><span class="repbtns"><button class="btn small" data-act="mediavol">Enregistrer</button></span></div>' : "") + "</div>";
  const rows = [["", ""]];
  Object.keys(S.P).forEach(k => { rows.push([k, ""]); Object.keys(S.P[k].s || {}).forEach(n => rows.push([k, n])); });
  h += '<h2>Fonds animés des onglets</h2><p class="note small">Une petite vidéo qui tourne en boucle derrière les onglets, sans le son. Idéal : MP4 de 3 à 8 secondes, 720 pixels de large, 2 Mo maximum conseillé (4 Mo au plus). Un show sans vidéo reprend celle de sa promotion.</p>' +
    '<div class="list">' + rows.map(r => {
      const k = bgKey(r[0], r[1]), b = bg[k];
      return '<div class="item mediarow"><span class="lbl"><b>' + esc(!r[0] ? "Accueil" : r[1] ? r[0] + " · " + r[1] : r[0]) + "</b><small>" + (b ? esc(kb(b.size || 0)) + (b.at ? " · " + esc(fmt(b.at)) : "") : r[1] && bg[r[0]] ? "Reprend la vidéo de " + esc(r[0]) : "Pas de vidéo") + "</small></span>" +
        (b ? '<span class="vidprev"><video muted loop playsinline autoplay preload="metadata" src="' + esc(b.u) + '"></video></span>' : "") +
        '<span class="repbtns"><button class="btn small" data-act="mediapick" data-kind="bg" data-key="' + esc(k) + '">' + (b ? "Changer" : "Choisir") + "</button>" +
        (b ? '<button class="btn small ghost" data-act="mediadel" data-kind="bg" data-key="' + esc(k) + '">Retirer</button>' : "") + "</span></div>";
    }).join("") + "</div>" +
    '<p class="note small" style="margin-top:8px">Après un envoi, la vidéo ou la musique apparaît chez tout le monde d’ici 1 à 2 minutes (le temps que GitHub publie le fichier).</p>';
  return h;
}
document.addEventListener("input", e => { if (e.target.id === "mvol") { const o = document.getElementById("volv"); if (o) o.textContent = e.target.value + " %"; } });
// Durée et largeur d'une vidéo ou durée d'un son, lues sur le téléphone avant l'envoi
function probe(file, kind) {
  return new Promise(res => {
    const el = document.createElement(kind === "bg" ? "video" : "audio"), u = URL.createObjectURL(file);
    const done = x => { URL.revokeObjectURL(u); res(x); };
    el.preload = "metadata"; el.muted = true;
    el.onloadedmetadata = () => done({ dur: el.duration || 0, w: el.videoWidth || 0 });
    el.onerror = () => done(null);
    setTimeout(() => done(null), 6000);
    el.src = u;
  });
}
async function saveMedia(next, msg) {
  await ghPutJson("data/media.json", Object.assign({ updated: parisDay() }, next), msg);
  S.media = next; changed("media");
}
ACT.mediapick = el => {
  if (!ghToken()) { ghKeyModal(); return; }
  const kind = el.dataset.kind, k = el.dataset.key || "";
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = kind === "bg" ? "video/mp4,video/quicktime,.mp4,.mov" : "audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,.mp3,.m4a";
  inp.addEventListener("change", async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const max = kind === "bg" ? 4 * MB : 5 * MB, ideal = kind === "bg" ? 2 * MB : 3 * MB;
    const ext = (f.name.match(/\.(mp4|mov|mp3|m4a)$/i) || [])[1] || (/quicktime/.test(f.type) ? "mov" : kind === "bg" ? "mp4" : /mp4|m4a/.test(f.type) ? "m4a" : "mp3");
    if (kind === "bg" ? !/^(mp4|mov)$/i.test(ext) : !/^(mp3|m4a)$/i.test(ext)) { toast(kind === "bg" ? "Choisis une vidéo MP4" : "Choisis un fichier MP3"); return; }
    if (f.size > max) { toast("Fichier trop lourd (" + kb(f.size) + ") : " + (kind === "bg" ? "4 Mo" : "5 Mo") + " au plus. Raccourcis-le ou compresse-le.", { ms: 6000 }); return; }
    const info = await probe(f, kind), warn = [];
    if (f.size > ideal) warn.push("un peu lourd (" + kb(f.size) + ", idéal " + kb(ideal) + ") : plus long à charger");
    if (info && kind === "bg" && info.dur > 10) warn.push("dure " + Math.round(info.dur) + " s (idéal 3 à 8 s)");
    if (info && kind === "bg" && info.w > 1280) warn.push("très large (" + info.w + " px, idéal 720 px)");
    if (info && kind === "music" && info.dur > 150) warn.push("dure " + Math.round(info.dur / 60) + " min (idéal 1 à 2 min)");
    if (kind === "bg" && /^mov$/i.test(ext)) warn.push("format .MOV : il peut ne pas s’afficher sur Android, un MP4 est plus sûr");
    if (kind === "bg" && !info) warn.push("ce téléphone n’arrive pas à lire cette vidéo : vérifie qu’elle s’affiche après l’envoi");
    modal((box, close) => {
      box.innerHTML = "<h3>" + (kind === "bg" ? "Envoyer ce fond animé ?" : "Envoyer cette musique ?") + '</h3><p class="sub">' + esc(f.name) + " · " + esc(kb(f.size)) + (info && info.dur ? " · " + Math.round(info.dur) + " s" : "") + "</p>" +
        (warn.length ? '<ul class="dellist">' + warn.map(w => "<li>⚠ " + esc(w) + "</li>").join("") + "</ul>" : '<p class="note small">✓ Taille et durée idéales</p>') +
        '<p class="err" id="mderr"></p><button class="btn wide" data-ok>Envoyer</button><button class="btn wide ghost" style="margin-top:10px" data-no>Annuler</button>';
      box.addEventListener("click", async e => {
        if (e.target.closest("[data-no]")) return close();
        const ok = e.target.closest("[data-ok]"); if (!ok || ok.disabled) return;
        ok.disabled = true; ok.textContent = "Envoi en cours…";
        try {
          const b64 = bufToB64(await f.arrayBuffer()), ts = Date.now().toString(36);
          const path = kind === "bg" ? "media/bg/" + slug(k) + "-" + ts + "." + ext.toLowerCase() : "media/music-" + ts + "." + ext.toLowerCase();
          await ghPutBinary(path, b64, kind === "bg" ? "Fond animé TCC TV : " + (k === "home" ? "accueil" : k) : "Musique de fond TCC TV");
          const cur = S.media || { bg: {}, music: null }, next = { bg: Object.assign({}, cur.bg || {}), music: cur.music || null };
          const old = kind === "bg" ? next.bg[k] : next.music;
          if (kind === "bg") next.bg[k] = { u: path, size: f.size, at: parisDay() };
          else next.music = { u: path, n: f.name.replace(/\.[^.]+$/, "").slice(0, 60), size: f.size, vol: cur.music && cur.music.vol != null ? cur.music.vol : 0.4, at: parisDay() };
          await saveMedia(next, kind === "bg" ? "Fonds animés TCC TV : " + (k === "home" ? "accueil" : k) : "Musique de fond TCC TV");
          if (old && old.u && old.u !== path && /^media\//.test(old.u)) ghDelete(old.u, "Ancien fichier remplacé").catch(() => {});
          close(); toast("Envoyé ✓ Visible chez tout le monde d’ici 1 à 2 minutes", { ms: 5000 });
        } catch (x) { ok.disabled = false; ok.textContent = "Envoyer"; box.querySelector("#mderr").textContent = x.message === "nokey" ? "Ajoute d’abord ta clé GitHub" : x.message; }
      });
    });
  });
  inp.click();
};
ACT.mediadel = async el => {
  if (!ghToken()) { ghKeyModal(); return; }
  const kind = el.dataset.kind, k = el.dataset.key || "";
  const cur = S.media || { bg: {}, music: null }, next = { bg: Object.assign({}, cur.bg || {}), music: cur.music || null };
  const old = kind === "bg" ? next.bg[k] : next.music;
  if (kind === "bg") delete next.bg[k]; else next.music = null;
  try {
    await saveMedia(next, kind === "bg" ? "Fonds animés TCC TV : retrait (" + k + ")" : "Musique de fond TCC TV : retrait");
    if (old && old.u && /^media\//.test(old.u)) ghDelete(old.u, "Fichier retiré").catch(() => {});
    toast("Retiré ✓");
  } catch (x) { toast(x.message === "nokey" ? "Ajoute d’abord ta clé GitHub" : x.message); }
};
ACT.mediavol = async () => {
  const v = document.getElementById("mvol"), cur = S.media || {}; if (!v || !cur.music) return;
  try { await saveMedia({ bg: cur.bg || {}, music: Object.assign({}, cur.music, { vol: Math.round(+v.value) / 100 }) }, "Musique de fond TCC TV : volume " + v.value + " %"); toast("Volume enregistré ✓"); }
  catch (x) { toast(x.message === "nokey" ? "Ajoute d’abord ta clé GitHub" : x.message); }
};
