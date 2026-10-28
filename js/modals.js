// Pop-ups : note « déjà vu » et changement d'image (admin)
import { S, B, ACT } from "./state.js";
import { esc, modal, toast, fmt, ICON, okHttp, okImg, fileToDataUrl, docId } from "./util.js";
import { seenId } from "./views/catalog.js";
import { chainOf } from "./images.js";
import { PREVIEW } from "./content.js";
import { errText } from "./views/account.js";

function itemFrom(el) { return { k: el.dataset.k, show: el.dataset.show || "", d: el.dataset.d || "", t: el.dataset.t }; }

ACT.seen = el => {
  if (!S.user) { toast("Connecte-toi pour garder ton historique"); location.hash = "#/connexion"; return; }
  const it = itemFrom(el), id = seenId(it), had = S.history[id];
  let rating = had ? had.rating || 0 : 0, comment = had ? had.comment || "" : "";
  modal((box, close) => {
    const label = (it.show ? it.show + " · " : "") + fmt(it.d);
    const draw = () => {
      const ta = box.querySelector("#seencom"); if (ta) comment = ta.value;
      box.innerHTML = "<h3>" + (had ? "Déjà vu" : "Tu l’as vu ?") + "</h3>" +
        '<p class="sub">' + esc(it.t) + "<br>" + esc(it.k) + " · " + esc(label) + "</p>" +
        '<p class="sub" style="margin-bottom:4px">Ta note</p><div class="rate">' +
        [1, 2, 3, 4, 5].map(i => '<button type="button" class="' + (i <= rating ? "on" : "") + '" data-r="' + i + '" aria-label="' + i + ' étoile' + (i > 1 ? "s" : "") + '">' + ICON.star + "</button>").join("") + "</div>" +
        '<label class="fld">Ton commentaire (facultatif)<textarea id="seencom" maxlength="280" rows="3" placeholder="Ce que tu as pensé du show, ton match préféré…">' + esc(comment) + "</textarea></label>" +
        '<button class="btn wide" data-ok>' + (had ? "Enregistrer" : "Valider") + "</button>" +
        (had ? '<button class="btn wide ghost" style="margin-top:10px" data-del>Retirer de l’historique</button>'
             : '<button class="btn wide ghost" style="margin-top:10px" data-skip>Marquer vu sans note</button>');
    };
    draw();
    box.addEventListener("click", async e => {
      const r = e.target.closest("[data-r]");
      if (r) { rating = +r.dataset.r === rating ? 0 : +r.dataset.r; box.querySelectorAll(".rate button").forEach(b => b.classList.toggle("on", +b.dataset.r <= rating)); return; }
      try {
        if (e.target.closest("[data-ok]") || e.target.closest("[data-skip]")) {
          if (e.target.closest("[data-skip]")) rating = 0;
          comment = (box.querySelector("#seencom") || { value: comment }).value.trim().slice(0, 280);
          await B.setSeen(S.user.uid, id, { title: it.t, k: it.k, show: it.show, d: it.d, rating: rating, comment: comment });
          close(); toast(had ? "Note enregistrée" : "Ajouté à ton historique");
        } else if (e.target.closest("[data-del]")) {
          await B.unsetSeen(S.user.uid, id); close(); toast("Retiré de l’historique");
        }
      } catch (err) { toast(errText(err)); }
    });
  });
};

// Lien collé : extrait l'adresse de la vraie image quand c'est un lien Google Images
export function cleanImageUrl(raw) {
  let u = String(raw || "").trim();
  try {
    const x = new URL(u);
    if (/(^|\.)google\.[a-z.]+$/.test(x.hostname) && x.searchParams.get("imgurl")) u = x.searchParams.get("imgurl");
    else if (/(^|\.)bing\.com$/.test(x.hostname) && x.searchParams.get("mediaurl")) u = x.searchParams.get("mediaurl");
  } catch (e) {}
  return u;
}
const looksLikeImage = u => /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(u) || /(pinimg\.com|googleusercontent\.com|gstatic\.com\/images|upload\.wikimedia\.org|imgur\.com\/\w+\.)/i.test(u);

// Message clair si Firebase refuse l'enregistrement de l'image
function imgErr(err) {
  if (err && err.code === "permission-denied") return "Refusé par Firebase : publie les dernières règles (fichier firestore.rules) avec ton identifiant admin, puis réessaie.";
  if (err && err.code === "demo/quota") return errText(err);
  return "Image non enregistrée : " + errText(err);
}
ACT.img = el => {
  if (!S.isAdmin) return;
  const d = el.dataset, label = d.label;
  const chain = chainOf({ kind: d.kind, k: d.k, show: d.show, br: d.br, t: d.t, d: d.d });
  let level = chain.length > 1 && (d.kind === "ep") ? 1 : 0; // pour un épisode : par défaut, tout le show
  modal((box, close) => {
    const cur = () => S.images[docId(chain[level].key)] || "";
    const draw = (msg) => {
      const c = cur();
      box.innerHTML = "<h3>Image de la vignette</h3><p class=\"sub\">" + esc(label) + "</p>" +
        (chain.length > 1 ? '<div class="levels" role="radiogroup" aria-label="Appliquer à">' + chain.map((l, i) =>
          '<button type="button" class="lvl' + (i === level ? " on" : "") + '" data-lvl="' + i + '" role="radio" aria-checked="' + (i === level) + '">' + esc(l.label) +
          (S.images[docId(l.key)] ? " ✓" : "") + "</button>").join("") + "</div>" : "") +
        '<div class="imgprev" style="' + (okImg(c) ? "background-image:url(&quot;" + esc(c) + "&quot;)" : "") + '">' + (okImg(c) ? "" : "Pas d’image à ce niveau") + "</div>" +
        '<button class="btn wide" data-gal>Choisir dans ma galerie</button>' +
        '<div class="sep">ou</div><label class="fld">Lien de l’image<input id="imgurl" type="url" inputmode="url" placeholder="https://…" value="' + (okHttp(c) ? esc(c) : "") + '"></label>' +
        '<p class="err" id="imgerr">' + (msg || "") + "</p>" +
        '<p class="note small" style="margin:-4px 16px 10px">Astuce : appui long sur l’image › « Copier l’adresse de l’image ». Les liens Google Images sont acceptés.</p>' +
        '<button class="btn wide ghost" data-url>Utiliser ce lien</button>' +
        (c ? '<button class="btn wide ghost" style="margin-top:10px" data-rm>Retirer l’image de ce niveau</button>' : "") +
        '<input type="file" accept="image/*" hidden id="imgfile">';
    };
    draw();
    const save = async src => {
      try { await B.setImage(docId(chain[level].key), src, S.user.uid); close(); toast("Image mise à jour" + (chain[level].label.indexOf("Tou") === 0 ? " pour " + chain[level].label.replace(/^Tou(te|s|t)( la| les)? /, "") : "")); }
      catch (err) { toast(imgErr(err), { ms: 7000 }); }
    };
    box.addEventListener("change", async e => {
      if (e.target.id !== "imgfile" || !e.target.files[0]) return;
      let src; try { src = await fileToDataUrl(e.target.files[0], 900, 900, false); } catch (err) { toast("Image illisible (essaie une photo JPEG ou PNG)"); return; }
      await save(src);
    });
    box.addEventListener("click", async e => {
      const lv = e.target.closest("[data-lvl]");
      const errEl = () => box.querySelector("#imgerr");
      if (lv) { level = +lv.dataset.lvl; draw(); return; }
      if (e.target.closest("[data-gal]")) box.querySelector("#imgfile").click();
      else if (e.target.closest("[data-force]")) save(box.querySelector("#imgurl").value.trim());
      else if (e.target.closest("[data-url]")) {
        const inp = box.querySelector("#imgurl"), u = cleanImageUrl(inp.value);
        inp.value = u;
        if (!okHttp(u)) { errEl().textContent = "Colle un lien qui commence par https://"; return; }
        if (PREVIEW) {
          errEl().innerHTML = "Dans cet aperçu, les images venant d’autres sites sont bloquées : elle ne s’affichera qu’une fois l’app en ligne. " +
            '<button type="button" class="linkbtn" data-force>Enregistrer quand même</button>';
          return;
        }
        errEl().textContent = "Vérification de l’image…";
        const test = new Image();
        test.onload = () => save(u);
        test.onerror = () => {
          errEl().innerHTML = (looksLikeImage(u) ? "Impossible de charger cette image (le site la protège peut-être)." :
            "Ce lien mène à une page, pas à une image. Sur Chrome : appui long sur l’image › « Copier l’adresse de l’image ». Sur Safari : appui long › « Ouvrir dans un nouvel onglet », puis copie l’adresse.") +
            ' <button type="button" class="linkbtn" data-force>Enregistrer quand même</button>';
        };
        test.src = u;
      } else if (e.target.closest("[data-rm]")) {
        try { await B.removeImage(docId(chain[level].key)); close(); toast("Image retirée"); } catch (err) { toast(imgErr(err), { ms: 7000 }); }
      }
    });
  });
};
