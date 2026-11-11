// Tournois : outils du modo (11 nov., demande de Jose). Créer, modifier, supprimer, choisir gagnants / perdants,
// clôturer, rouvrir, mettre à la une, ajouter une image (les vidéos passent par les liens « tn:id » déjà en place).
// « 🔒 Verrouiller » : la mise à jour du soir ne touche plus à ce tournoi (consigne dans CLAUDE.md).
// Enregistré dans data/tournaments.json avec la clé GitHub du modo (comme les liens et le TCCCG).
import { S, ACT, changed } from "../state.js";
import { esc, toast, modal, fileToDataUrl, okDay } from "../util.js";
import { ghGetJson, ghPutJson, ghToken, ghPutBinary } from "../github.js";

const ST = ["à venir", "en cours", "terminé"];
export async function saveTn(fn, msg) {
  if (!ghToken()) { if (ACT.ghkey) ACT.ghkey(); return false; }
  const cur = await ghGetJson("data/tournaments.json"), d = cur.data || { items: [], series: {} };
  d.items = Array.isArray(d.items) ? d.items : [];
  if (fn(d) === false) return false;
  d.updated = new Date().toISOString();
  await ghPutJson("data/tournaments.json", d, "Tournois (modo) : " + msg);
  S.tournaments = d; changed("content");
  return true;
}
const run = (fn, msg) => saveTn(fn, msg).then(ok => { if (ok) toast("Enregistré ✓"); return ok; }).catch(e => { if (e && e.message !== "nokey") toast("Pas enregistré : " + e.message, { ms: 5000 }); return false; });
const byId = (d, id) => d.items.find(t => t && t.id === id);
const slug = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "tournoi";
const ytId = s => { const m = String(s || "").match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/) || String(s || "").trim().match(/^([\w-]{11})$/); return m ? m[1] : ""; };

// tableau en texte (facile à écrire sur téléphone) : « # Nom du tour » puis « A vs B > gagnant | résultat | vidéo YouTube »
export function roundsToText(R) {
  return (R || []).map((r, i) => "# " + (r.n || "Tour " + (i + 1)) + "\n" + (r.m || []).map(m => (m.a || "?") + " vs " + (m.b || "?") + (m.w ? " > " + m.w : "") + (m.res || m.v ? " | " + (m.res || "") + (m.v ? " | " + m.v : "") : "")).join("\n")).join("\n\n");
}
export function textToRounds(txt) {
  const R = []; let cur = null;
  String(txt || "").split("\n").map(l => l.trim()).filter(Boolean).forEach(l => {
    if (l[0] === "#") { cur = { n: l.replace(/^#+\s*/, "").slice(0, 60), m: [] }; R.push(cur); return; }
    if (!cur) { cur = { n: "Tour 1", m: [] }; R.push(cur); }
    const p = l.split("|").map(x => x.trim()), mw = p[0].split(">"), ab = mw[0].split(/\s+(?:vs\.?|contre|VS)\s+/i);
    const m = { a: (ab[0] || "").trim().slice(0, 80), b: (ab[1] || "").trim().slice(0, 80) }, w = (mw[1] || "").trim();
    if (w) m.w = w === "a" || w === "A" ? m.a : w === "b" || w === "B" ? m.b : w.slice(0, 80);
    if (p[1]) m.res = p[1].slice(0, 200);
    if (p[2] && ytId(p[2])) m.v = ytId(p[2]);
    if (m.a || m.b) cur.m.push(m);
  });
  return R.filter(r => r.m.length || r.n);
}
// blocs : « # Bloc A » puis « Nom = points »
export function blocsToText(Bl) { return (Bl || []).map(b => "# " + (b.n || "Bloc") + "\n" + (b.rows || []).map(r => r.w + (r.pts != null ? " = " + r.pts : "")).join("\n")).join("\n\n"); }
export function textToBlocs(txt) {
  const L = []; let cur = null;
  String(txt || "").split("\n").map(l => l.trim()).filter(Boolean).forEach(l => {
    if (l[0] === "#") { cur = { n: l.replace(/^#+\s*/, "").slice(0, 40), rows: [] }; L.push(cur); return; }
    if (!cur) { cur = { n: "Bloc A", rows: [] }; L.push(cur); }
    const p = l.split("="), r = { w: p[0].trim().slice(0, 80) }; if (p[1] != null && p[1].trim() !== "" && !isNaN(+p[1])) r.pts = +p[1]; if (r.w) cur.rows.push(r);
  });
  return L;
}
const srcToText = s => (Array.isArray(s) ? s : []).map(x => (x.n || "") + " | " + (x.u || "")).join("\n");
const textToSrc = t => String(t || "").split("\n").map(l => l.split("|").map(x => x.trim())).filter(p => /^https?:\/\//.test(p[1] || p[0] || "")).map(p => p[1] ? { n: p[0].slice(0, 60) || "Source", u: p[1] } : { n: "Source", u: p[0] });

// ---------- formulaire : créer / modifier ----------
function tnForm(t) {
  const isNew = !t; t = t || { st: "à venir", y: new Date().getFullYear(), lock: true };
  const P = Object.keys(S.P || {}), SER = (S.tournaments && S.tournaments.series) || {};
  modal((box, close) => {
    box.classList.add("tnform");
    box.innerHTML = "<h3>" + (isNew ? "Nouveau tournoi" : "Modifier le tournoi") + "</h3><form data-tnf>" +
      '<label class="fld">Nom<input name="n" required maxlength="80" value="' + esc(t.n || "") + '" placeholder="Ex. : King of the Ring 2026"></label>' +
      '<div class="tnf2"><label class="fld">Promotion<select name="k">' + P.map(k => "<option" + (k === t.k ? " selected" : "") + ">" + esc(k) + "</option>").join("") + "</select></label>" +
      '<label class="fld">Année<input name="y" type="number" min="1950" max="2100" value="' + esc(t.y || "") + '"></label></div>' +
      '<div class="tnf2"><label class="fld">État<select name="st">' + ST.map(s => "<option" + (s === (t.st || "à venir") ? " selected" : "") + ">" + s + "</option>").join("") + "</select></label>" +
      '<label class="fld">Type<select name="type">' + [["bracket", "Tableau (élimination)"], ["blocs", "Blocs (tous contre tous)"], ["mixte", "Blocs puis tableau"]].map(x => '<option value="' + x[0] + '"' + (x[0] === t.type ? " selected" : "") + ">" + x[1] + "</option>").join("") + "</select></label></div>" +
      '<div class="tnf2"><label class="fld">Début<input name="from" type="date" value="' + esc(okDay(t.from) ? t.from : "") + '"></label><label class="fld">Fin<input name="to" type="date" value="' + esc(okDay(t.to) ? t.to : "") + '"></label></div>' +
      '<label class="fld">Série (grand tournoi)<select name="serie"><option value="">–</option>' + Object.keys(SER).map(id => '<option value="' + esc(id) + '"' + (id === t.serie ? " selected" : "") + ">" + esc(SER[id].n || id) + "</option>").join("") + "</select></label>" +
      '<label class="fld">Présentation<textarea name="about" rows="3" maxlength="1200">' + esc(t.about || "") + "</textarea></label>" +
      '<label class="fld">Vainqueur (visible quand le tournoi est terminé)<input name="winner" maxlength="80" value="' + esc(t.winner || "") + '"></label>' +
      '<label class="fld">Tableau — « # Nom du tour » puis une ligne par match : <code>A vs B &gt; gagnant | résultat | lien YouTube</code><textarea name="rounds" rows="7" spellcheck="false">' + esc(roundsToText(t.rounds)) + "</textarea></label>" +
      '<label class="fld">Blocs — « # Bloc A » puis <code>Nom = points</code><textarea name="blocs" rows="5" spellcheck="false">' + esc(blocsToText(t.blocs)) + "</textarea></label>" +
      '<label class="fld">Sources — une par ligne : <code>Nom | https://…</code><textarea name="src" rows="2" spellcheck="false">' + esc(srcToText(t.src)) + "</textarea></label>" +
      '<label class="chk"><input type="checkbox" name="feat"' + (t.feat ? " checked" : "") + "> ⭐ À la une</label>" +
      '<label class="chk"><input type="checkbox" name="lock"' + (t.lock ? " checked" : "") + "> 🔒 Verrouiller : la mise à jour du soir n’y touche plus</label>" +
      '<button class="btn wide">' + (isNew ? "Créer" : "Enregistrer") + '</button></form><button class="btn wide ghost" style="margin-top:8px" data-close>Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
    box.querySelector("[data-tnf]").addEventListener("submit", ev => {
      ev.preventDefault(); const f = ev.target, n = f.n.value.trim(); if (!n) return;
      const v = {
        n: n, k: f.k.value, y: +f.y.value || "", st: f.st.value, type: f.type.value, from: f.from.value || "", to: f.to.value || "", serie: f.serie.value || "",
        about: f.about.value.trim(), winner: f.winner.value.trim(), rounds: textToRounds(f.rounds.value), blocs: textToBlocs(f.blocs.value), src: textToSrc(f.src.value), feat: f.feat.checked, lock: f.lock.checked
      };
      let nid = t.id;
      close();
      run(d => {
        let x = isNew ? null : byId(d, t.id);
        if (!x) { nid = slug(n + (v.y && String(n).indexOf(String(v.y)) < 0 ? " " + v.y : "")); let i = 2; const b0 = nid; while (byId(d, nid)) nid = b0 + "-" + i++; x = { id: nid }; d.items.unshift(x); }
        Object.keys(v).forEach(k => { const val = v[k]; if (val === "" || val === false || (Array.isArray(val) && !val.length)) delete x[k]; else x[k] = val; });
        x.modo = new Date().toISOString().slice(0, 10);
      }, (isNew ? "nouveau tournoi " : "tournoi modifié ") + n).then(ok => { if (ok && isNew) location.hash = "#/tournoi/" + encodeURIComponent(nid); });
    });
  });
}
ACT.tnnew = () => { if (S.isAdmin) tnForm(null); };
ACT.tnedit = el => { const t = ((S.tournaments || {}).items || []).find(x => x.id === el.dataset.id); if (S.isAdmin && t) tnForm(JSON.parse(JSON.stringify(t))); };
// actions rapides : clôturer / rouvrir, à la une, verrou, supprimer, image
ACT.tnst = el => run(d => { const t = byId(d, el.dataset.id); if (!t) return false; t.st = el.dataset.v; if (t.st === "terminé" && !t.to) t.to = new Date().toISOString().slice(0, 10); }, (el.dataset.v === "terminé" ? "tournoi clôturé " : "tournoi rouvert ") + el.dataset.id);
ACT.tnfeat = el => run(d => { const t = byId(d, el.dataset.id); if (!t) return false; if (t.feat) delete t.feat; else t.feat = true; }, "à la une : " + el.dataset.id);
ACT.tnlock = el => run(d => { const t = byId(d, el.dataset.id); if (!t) return false; if (t.lock) delete t.lock; else t.lock = true; }, (el.dataset.v ? "verrouillé " : "déverrouillé ") + el.dataset.id);
ACT.tndel = el => {
  const id = el.dataset.id, t = ((S.tournaments || {}).items || []).find(x => x.id === id); if (!t) return;
  modal((box, close) => {
    box.innerHTML = "<h3>Supprimer ce tournoi ?</h3><p class=\"sub\">« " + esc(t.n) + " » disparaît de l’app (les liens vidéo restent enregistrés).</p><button class=\"btn wide danger\" data-y>🗑 Supprimer</button><button class=\"btn wide ghost\" style=\"margin-top:6px\" data-close>Annuler</button>";
    box.addEventListener("click", e => { if (e.target.closest("[data-close]")) return close(); if (e.target.closest("[data-y]")) { close(); run(d => { const n0 = d.items.length; d.items = d.items.filter(x => x.id !== id); if (d.items.length === n0) return false; }, "tournoi supprimé " + id).then(ok => { if (ok) location.hash = "#/tournois"; }); } });
  });
};
ACT.tnimg = el => {
  const id = el.dataset.id;
  if (el.dataset.v === "-") return run(d => { const t = byId(d, id); if (!t) return false; delete t.img; }, "image retirée " + id);
  if (!ghToken()) { if (ACT.ghkey) ACT.ghkey(); return; }
  const i = document.createElement("input"); i.type = "file"; i.accept = "image/*";
  i.onchange = async () => {
    const f = i.files[0]; if (!f) return; toast("Envoi…");
    try {
      const url = await fileToDataUrl(f, 1600, 1600, false, 900000), path = "img/tournois/" + slug(id) + "-" + Date.now().toString(36) + ".jpg";
      await ghPutBinary(path, url.split(",")[1], "Tournois (modo) : image " + id);
      run(d => { const t = byId(d, id); if (!t) return false; t.img = path; }, "image " + id);
    } catch (e) { toast("Envoi impossible : " + ((e && e.message) || "erreur")); }
  };
  i.click();
};
// choisir le gagnant d'un match (l'autre est éliminé) ; « – » efface
ACT.tnwin = el => {
  const ds = el.dataset, ri = +ds.ri, mi = +ds.mi;
  run(d => { const t = byId(d, ds.id), m = t && t.rounds && t.rounds[ri] && t.rounds[ri].m && t.rounds[ri].m[mi]; if (!m) return false; if (ds.w) m.w = ds.w; else delete m.w; t.modo = new Date().toISOString().slice(0, 10); }, "gagnant " + ds.id);
};
// barre du modo en haut d'un tournoi
export function tnModoBar(t) {
  if (!S.isAdmin || !t) return "";
  const b = (act, label, v, cls) => '<button class="btn small ' + (cls || "ghost") + '" data-act="' + act + '" data-id="' + esc(t.id) + '"' + (v != null ? ' data-v="' + esc(v) + '"' : "") + ">" + label + "</button>";
  return '<div class="tnmodo"><b>Modo</b>' + b("tnedit", "✏️ Modifier", null, "") + (t.st === "terminé" ? b("tnst", "↩ Rouvrir", "en cours") : b("tnst", "🏁 Clôturer", "terminé")) +
    b("tnfeat", t.feat ? "⭐ Retirer de la une" : "☆ À la une") + b("tnlock", t.lock ? "🔒 Verrouillé" : "🔓 Pas verrouillé", t.lock ? "" : "1", t.lock ? "gold" : "ghost") +
    b("tnimg", t.img ? "🖼️ Changer l’image" : "🖼️ Image") + (t.img ? b("tnimg", "Retirer l’image", "-") : "") + b("tndel", "🗑 Supprimer", null, "ghost danger") +
    '<small>' + (t.lock ? "La mise à jour du soir ne touche plus à ce tournoi." : "La mise à jour du soir peut compléter ce tournoi.") + " Vidéos : bouton « ＋ » sous les matchs et en bas de page.</small></div>";
}
// boutons gagnant sous un match (modo)
export function tnWinBtns(t, ri, mi, m) {
  if (!S.isAdmin) return "";
  const b = (w, label) => '<button class="chip' + ((m.w || "") === w ? " on" : "") + '" data-act="tnwin" data-id="' + esc(t.id) + '" data-ri="' + ri + '" data-mi="' + mi + '" data-w="' + esc(w) + '">' + label + "</button>";
  return '<div class="tnwin"><small>Gagnant :</small>' + b(m.a, esc(m.a)) + b(m.b, esc(m.b)) + b("", "–") + "</div>";
}
