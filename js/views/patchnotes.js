// Patch notes : les nouveautés de l'app (Paramètres › Patch notes, pour tout le monde) et ce que peut faire le modérateur
// (Modération › Patch notes, réservé à l'admin). Fichier data/patchnotes.json = { items: [{ id, d, t, txt: [lignes], mod }] },
// écrit par l'admin depuis l'app (sa clé GitHub reste sur son téléphone). Point rouge tant qu'une note n'a pas été lue.
import { S, ACT, FORM, changed } from "../state.js";
import { esc, fmt, toast, lsGet, lsSet, modal } from "../util.js";
import { ghToken, ghGetJson, ghPutJson } from "../github.js";
import { parisDay } from "../time.js";

const SEEN = "ctv.pnseen";
const list = mod => (S.patch || []).filter(x => x && x.t && !!x.mod === !!mod).sort((a, b) => String(b.d || "").localeCompare(String(a.d || "")));
const lastId = () => { const l = list(false); return l.length ? l[0].id : ""; };
export function pnNew() { const id = lastId(); return !!id && lsGet(SEEN) !== id; }
export function pnSeen() { const id = lastId(); if (id) lsSet(SEEN, id); }

function noteHTML(x, admin) {
  return '<article class="pnote"><div class="pnhead"><b>' + esc(x.t) + "</b><small>" + (x.d ? fmt(x.d) : "") + (x.mod ? " · modérateur" : "") + "</small></div>" +
    '<ul>' + (Array.isArray(x.txt) ? x.txt : [String(x.txt || "")]).filter(Boolean).map(l => "<li>" + esc(l) + "</li>").join("") + "</ul>" +
    (admin ? '<button class="linkbtn danger" data-act="pndel" data-id="' + esc(x.id) + '">Supprimer cette note</button>' : "") + "</article>";
}
// Paramètres › Patch notes (tout le monde)
export function patchView() {
  const l = list(false);
  pnSeen();
  return "<h1>📝 Patch notes</h1><p class=\"note\" style=\"margin-bottom:12px\">Les nouveautés de TCC TV, de la plus récente à la plus ancienne.</p>" +
    (l.length ? '<div class="pnotes">' + l.map(x => noteHTML(x, false)).join("") + "</div>" : '<p class="note">Pas encore de patch note.</p>');
}
// Modération › Patch notes (admin) : ce que peut faire le modérateur + écrire une note
export function patchModView() {
  const key = !!ghToken();
  let h = "<h1>📝 Patch notes · modération</h1>";
  h += '<h2>Écrire une patch note</h2><form class="pnform" data-form="pnadd">' +
    '<label class="fld">Titre<input id="pn_t" maxlength="80" placeholder="Mise à jour du ' + esc(fmt(parisDay())) + '" required></label>' +
    '<label class="fld">Les nouveautés (une par ligne)<textarea id="pn_x" rows="6" maxlength="3000" placeholder="📸 Nouvelle fonction…&#10;🔧 Correction…" required></textarea></label>' +
    '<label class="chk"><input type="checkbox" id="pn_m"> Réservée au modérateur (pas visible par les membres)</label>' +
    '<button class="btn wide">Publier la note</button>' +
    (key ? "" : '<p class="note small">Il faut ta clé GitHub sur ce téléphone (Modération › Sources des données) : la note est rangée avec les données de l’app.</p>') + "</form>";
  const m = list(true);
  h += "<h2>Ce que peut faire le modérateur</h2>" + (m.length ? '<div class="pnotes">' + m.map(x => noteHTML(x, true)).join("") + "</div>" : '<p class="note">Aucune note réservée au modérateur.</p>');
  const l = list(false);
  if (l.length) h += "<h2>Notes visibles par tout le monde</h2><div class=\"pnotes\">" + l.map(x => noteHTML(x, true)).join("") + "</div>";
  return h;
}
async function saveAll(items, msg) {
  if (!ghToken()) { ACT.ghkey && ACT.ghkey(); throw new Error("nokey"); }
  const cur = await ghGetJson("data/patchnotes.json");
  const next = items((cur && cur.data && Array.isArray(cur.data.items)) ? cur.data.items : (S.patch || []));
  await ghPutJson("data/patchnotes.json", { updated: parisDay(), items: next }, msg);
  S.patch = next; changed("route");
}
FORM.pnadd = async () => {
  const t = document.getElementById("pn_t").value.trim(), x = document.getElementById("pn_x").value.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 30);
  const mod = document.getElementById("pn_m").checked;
  if (!t || !x.length) { toast("Mets un titre et au moins une ligne"); return; }
  const note = { id: parisDay() + "-" + Date.now().toString(36), d: parisDay(), t: t.slice(0, 80), txt: x.map(s => s.slice(0, 300)), mod: mod || undefined };
  try { await saveAll(items => [note].concat(items), "Patch note : " + note.t); toast("Patch note publiée ✓ (visible chez tout le monde d’ici 1 à 2 minutes)", { ms: 5000 }); }
  catch (e) { if (e.message !== "nokey") toast("Pas enregistrée : " + e.message); }
};
ACT.pndel = el => {
  const id = el.dataset.id; if (!id) return;
  modal((box, close) => {
    box.innerHTML = '<h3>Supprimer cette patch note ?</h3><div class="btns"><button class="btn danger" data-y>Supprimer</button><button class="btn ghost" data-n>Annuler</button></div>';
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-n]")) return close();
      if (!e.target.closest("[data-y]")) return;
      close();
      try { await saveAll(items => items.filter(x => x.id !== id), "Patch note supprimée"); toast("Note supprimée"); }
      catch (x) { if (x.message !== "nokey") toast("Pas supprimée : " + x.message); }
    });
  });
};
