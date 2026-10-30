// Modération › Images de l'app : l'admin choisit la version affichée (photos des catcheurs, ceintures, logos des shows,
// des événements et des groupes), ajoute ses propres images (mises au bon format en WebP dans le navigateur, puis envoyées
// sur GitHub avec sa clé) et supprime les versions dont il ne veut plus. Fichiers : data/photos.json et data/logos.json.
import { S, ACT, changed } from "../state.js";
import { esc, toast, modal } from "../util.js";
import { ghToken, ghGetJson, ghPutJson, ghPutBinary, ghDelete } from "../github.js";
import { beltLabel } from "../assets.js";

const SEC = {
  catcheurs: { t: "Catcheurs", file: "data/photos.json", dir: "img/catcheurs/", w: 300, h: 300, fit: "cover", tip: "Carrée, 500 × 500 px conseillé (300 × 300 minimum), visage dans le haut, fond transparent ou uni." },
  titres: { t: "Ceintures", key: "titles", file: "data/logos.json", dir: "img/titres/", w: 320, h: 320, fit: "contain", tip: "Carrée, 400 × 400 px, fond transparent (PNG)." },
  shows: { t: "Logos des shows", key: "shows", file: "data/logos.json", dir: "img/shows/", w: 400, h: 400, fit: "cover", tip: "Carré, 400 × 400 px minimum, fond libre." },
  evenements: { t: "Événements", key: "events", file: "data/logos.json", dir: "img/events/", w: 400, h: 160, fit: "contain", tip: "En longueur (5 sur 2), 500 × 200 px, fond transparent (PNG)." },
  groupes: { t: "Groupes", key: "groups", file: "data/logos.json", dir: "img/groupes/", w: 300, h: 300, fit: "contain", tip: "Carré, 500 × 500 px, fond transparent, logo clair de préférence (affiché sur fond sombre)." }
};
let filter = "", filterSec = "";
const slugOf = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "image";
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// entrées d'une rubrique : [{ key, label, f, v }]
function entries(sec) {
  if (sec === "catcheurs") return Object.keys(S.photos || {}).map(k => ({ key: k, label: (S.photos[k].n || [k])[0], f: S.photos[k].f, v: S.photos[k].v || [] }));
  const M = (S.art || {})[SEC[sec].key] || {};
  return Object.keys(M).map(k => ({ key: k, label: sec === "titres" ? beltLabel(k) : k, f: M[k].f, v: M[k].v || [] }));
}
const src = (sec, f) => /^data:/.test(f) ? f : SEC[sec].dir + encodeURIComponent(f);

export function imagesView(sec) {
  sec = SEC[sec] ? sec : "catcheurs";
  if (sec !== filterSec) { filter = ""; filterSec = sec; } // nouvelle rubrique : recherche vidée
  const C = SEC[sec], key = !!ghToken();
  let h = "<h1>🖼️ Images de l’app</h1>";
  h += '<div class="imgtabs">' + Object.keys(SEC).map(k => '<a class="imgtab' + (k === sec ? " on" : "") + '" href="#/parametres/images/' + k + '">' + SEC[k].t + "</a>").join("") + "</div>";
  h += '<p class="note imgtip">📐 ' + esc(C.tip) + " PNG ou JPG de moins de 2 Mo : l’app réduit et allège l’image toute seule.</p>";
  if (!key) h += '<div class="lockbox" style="margin:0 16px 12px;text-align:left;align-items:flex-start"><b>🔑 Clé GitHub nécessaire</b><p>Les images sont rangées avec les fichiers de l’app sur GitHub. Ajoute une fois ta clé GitHub pour les modifier depuis ce téléphone.</p><button class="btn" data-act="ghkey">Ajouter ma clé GitHub</button></div>';
  h += '<div class="imgbar"><input id="imgq" type="search" placeholder="Chercher (ex. Becky, Raw, Royal Rumble…)" value="' + esc(filter) + '" aria-label="Chercher">' +
    (sec === "catcheurs" ? '<button class="btn small" data-act="imgnew" data-sec="catcheurs">＋ Nouveau catcheur</button>' : "") + "</div>";
  h += '<div id="imglist">' + listHTML(sec) + "</div>";
  h += '<p class="note small" style="margin:12px 16px">Appuie sur une version pour la mettre en avant chez tout le monde (visible d’ici 1 à 2 minutes). La version en avant ne peut pas être supprimée : mets-en une autre en avant d’abord.</p>';
  return h;
}
function listHTML(sec) {
  const q = norm(filter).trim();
  let list = entries(sec).sort((a, b) => a.label.localeCompare(b.label, "fr"));
  if (q) list = list.filter(e => norm(e.label + " " + e.key).indexOf(q) >= 0);
  const more = list.length > 40;
  list = list.slice(0, 40);
  return (list.length ? list.map(e => '<article class="imgrow"><div class="imghead"><b>' + esc(e.label) + "</b><small>" + (1 + e.v.length) + " version" + (e.v.length ? "s" : "") + "</small></div>" +
    '<div class="imgvers ' + sec + '">' + [e.f].concat(e.v).map((f, i) => '<div class="imgv' + (i ? "" : " cur") + '">' +
      '<button class="imgpick" data-act="' + (i ? "imgfront" : "zoom") + '" data-sec="' + sec + '" data-key="' + esc(e.key) + '" data-f="' + esc(f) + '" data-src="' + esc(src(sec, f)) + '" data-alt="' + esc(e.label) + '" aria-label="' + (i ? "Mettre en avant" : "Agrandir") + '"><img src="' + esc(src(sec, f)) + '" alt="" loading="lazy"></button>' +
      (i ? '<button class="imgdel" data-act="imgdel" data-sec="' + sec + '" data-key="' + esc(e.key) + '" data-f="' + esc(f) + '" aria-label="Supprimer cette version">🗑</button>' : '<span class="imgcur">En avant</span>') + "</div>").join("") +
    '<button class="imgadd" data-act="imgadd" data-sec="' + sec + '" data-key="' + esc(e.key) + '" aria-label="Ajouter une image">＋<small>Ajouter</small></button></div></article>').join("")
    : '<p class="note">Rien trouvé.</p>') + (more ? '<p class="note small" style="margin:8px 16px">40 premiers résultats : précise ta recherche.</p>' : "");
}
document.addEventListener("input", e => {
  if (e.target.id !== "imgq") return;
  filter = e.target.value;
  const box = document.getElementById("imglist"), sec = (location.hash.split("/")[3] || "catcheurs");
  if (box) box.innerHTML = listHTML(SEC[sec] ? sec : "catcheurs");
});

// ---------- enregistrement sur GitHub ----------
async function edit(sec, fn, msg) {
  if (!ghToken()) { ACT.ghkey && ACT.ghkey(); throw new Error("nokey"); }
  const C = SEC[sec], cur = await ghGetJson(C.file), J = cur.data || {};
  if (sec === "catcheurs") { J.items = J.items || {}; fn(J.items); S.photos = J.items; }
  else { J[C.key] = J[C.key] || {}; fn(J[C.key]); S.art = Object.assign({}, S.art, { [C.key]: J[C.key] }); }
  J.updated = new Date().toISOString().slice(0, 10);
  await ghPutJson(C.file, J, msg);
  changed("route");
}
const busy = t => toast(t, { ms: 2500 });
const fail = e => { if (e && e.message !== "nokey") toast("Pas enregistré : " + e.message, { ms: 5000 }); };
ACT.imgfront = async el => {
  const { sec, key, f } = el.dataset;
  busy("Mise en avant…");
  try {
    await edit(sec, M => { const it = M[key]; if (!it) throw new Error("introuvable"); const v = [it.f].concat((it.v || []).filter(x => x !== f)); it.f = f; it.v = v; }, "Images TCC TV : nouvelle version en avant (" + key + ")");
    toast("✓ En avant chez tout le monde d’ici 1 à 2 minutes", { ms: 4000 });
  } catch (e) { fail(e); }
};
ACT.imgdel = el => {
  const { sec, key, f } = el.dataset;
  modal((box, close) => {
    box.innerHTML = '<h3>Supprimer cette version ?</h3><img class="imgconfirm" src="' + esc(src(sec, f)) + '" alt=""><p class="sub">Elle sera retirée de l’app et de ton dossier sur GitHub.</p>' +
      '<div class="btns"><button class="btn danger" data-y>Supprimer</button><button class="btn ghost" data-n>Annuler</button></div>';
    box.addEventListener("click", async e => {
      if (e.target.closest("[data-n]")) return close();
      if (!e.target.closest("[data-y]")) return;
      close(); busy("Suppression…");
      try {
        await edit(sec, M => { const it = M[key]; if (!it) return; it.v = (it.v || []).filter(x => x !== f); if (!it.v.length) delete it.v; }, "Images TCC TV : version supprimée (" + key + ")");
        await ghDelete(SEC[sec].dir + f, "Images TCC TV : fichier supprimé (" + f + ")").catch(() => {});
        toast("Version supprimée");
      } catch (x) { fail(x); }
    });
  });
};
// image choisie sur le téléphone -> WebP au bon format (carré recadré, ou contenu entier sur fond transparent)
function toWebp(file, w, h, fit) {
  return new Promise((ok, ko) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(u);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d"), r = fit === "cover" ? Math.max(w / img.naturalWidth, h / img.naturalHeight) : Math.min(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * r, dh = img.naturalHeight * r;
      g.imageSmoothingQuality = "high";
      g.drawImage(img, (w - dw) / 2, fit === "cover" ? Math.min(0, (h - dh) * 0.2) : (h - dh) / 2, dw, dh);
      const d = c.toDataURL("image/webp", 0.84);
      ok(/^data:image\/webp/.test(d) ? d : c.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(u); ko(new Error("image illisible")); };
    img.src = u;
  });
}
function pickFile(cb) {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
  inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) cb(f); };
  inp.click();
}
async function upload(sec, key, file, name) {
  const C = SEC[sec];
  if (file.size > 8 * 1024 * 1024) { toast("Image trop lourde (8 Mo maximum)"); return; }
  busy("Préparation de l’image…");
  const data = await toWebp(file, C.w, C.h, C.fit), ext = /^data:image\/webp/.test(data) ? ".webp" : ".png";
  const fname = slugOf(sec === "catcheurs" ? key : key) + "-" + Date.now().toString(36) + ext;
  busy("Envoi sur GitHub…");
  await ghPutBinary(C.dir + fname, data.split(",")[1], "Images TCC TV : nouvelle image (" + (name || key) + ")");
  await edit(sec, M => {
    const it = M[key];
    if (it) { it.v = [it.f].concat(it.v || []); it.f = fname; }
    else M[key] = sec === "catcheurs" ? { f: fname, n: [name || key] } : { f: fname };
  }, "Images TCC TV : image ajoutée en avant (" + (name || key) + ")");
  toast("✓ Image ajoutée et mise en avant (visible d’ici 1 à 2 minutes)", { ms: 4500 });
}
ACT.imgadd = el => {
  const { sec, key } = el.dataset;
  if (!ghToken()) { ACT.ghkey && ACT.ghkey(); return; }
  pickFile(f => upload(sec, key, f).catch(fail));
};
ACT.imgnew = () => {
  if (!ghToken()) { ACT.ghkey && ACT.ghkey(); return; }
  modal((box, close) => {
    box.innerHTML = '<h3>Photo d’un nouveau catcheur</h3><label class="fld">Nom du catcheur (comme dans l’app)<input id="imgnm" maxlength="60" placeholder="ex. Je’Von Evans"></label>' +
      '<p class="note small">📐 ' + esc(SEC.catcheurs.tip) + '</p><button class="btn wide" data-go>Choisir la photo</button><button class="btn wide ghost" style="margin-top:8px" data-n>Annuler</button>';
    box.addEventListener("click", e => {
      if (e.target.closest("[data-n]")) return close();
      if (!e.target.closest("[data-go]")) return;
      const nm = box.querySelector("#imgnm").value.trim();
      if (nm.length < 2) { toast("Écris le nom du catcheur"); return; }
      close();
      const slug = slugOf(nm), exists = S.photos && S.photos[slug];
      pickFile(f => upload("catcheurs", slug, f, nm).catch(fail));
      if (exists) toast("Ce catcheur a déjà une photo : la nouvelle passera en avant");
    });
  });
};
