// Image d'une fiche catcheur : n'importe quel membre peut en ajouter une (depuis son téléphone ou par une adresse https).
// Elle s'affiche tout de suite ; l'admin (et celui qui l'a ajoutée) peut l'enlever, les autres peuvent la signaler.
import { S, B, ACT, nameOf, need } from "../state.js";
import { esc, okHttp, toast, modal, fileToDataUrl } from "../util.js";
import { wslug } from "./comments.js";
import { errText } from "./account.js";

let cur = "";            // nom du catcheur de la fiche ouverte
export function wImageBox(name) { cur = name; return '<div id="wimg" class="wimg" data-w="' + esc(wslug(name)) + '"></div>'; }
export function renderWImage() {
  const box = document.getElementById("wimg"); if (!box) return;
  const d = (S.wimg || {})[box.dataset.w];
  if (d && d.uid) need(d.uid);
  const mine = d && S.user && d.uid === S.user.uid;
  box.innerHTML = d && d.src ? '<img src="' + esc(d.src) + '" alt="' + esc(cur) + '" loading="lazy" referrerpolicy="no-referrer"><div class="wimgbar"><small>Image ajoutée par ' + esc(nameOf(d.uid)) + "</small>" +
      (S.user ? '<button class="linkbtn" data-act="wimgadd">Changer</button>' : "") +
      (S.user && (mine || S.isAdmin) ? '<button class="linkbtn danger" data-act="wimgdel">Enlever</button>' : S.user ? '<button class="linkbtn" data-act="wimgrep">Signaler</button>' : "") + "</div>"
    : S.user ? '<button class="wimgadd" data-act="wimgadd">📷 Ajouter une image</button>' : "";
  const img = box.querySelector("img"); if (img) img.onerror = () => { img.replaceWith(Object.assign(document.createElement("p"), { className: "note small", textContent: "Image introuvable (lien cassé)." })); };
}
async function save(src) {
  const slug = wslug(cur);
  try { await B.setWImage(slug, { w: slug, name: cur.slice(0, 60), uid: S.user.uid, src: src }); toast("Image ajoutée ✓"); }
  catch (e) { toast(errText(e)); }
}
ACT.wimgadd = () => {
  if (!S.user) { location.hash = "#/connexion"; return; }
  modal((box, close) => {
    box.innerHTML = "<h3>Image de " + esc(cur) + '</h3><button class="btn wide" data-file>📷 Depuis mon téléphone</button>' +
      '<label class="fld" style="margin-top:12px">Ou colle l’adresse d’une image<input id="wimgurl" type="url" inputmode="url" placeholder="https://…"></label>' +
      '<button class="btn wide ghost" data-url>Utiliser cette adresse</button><p class="note small" style="margin-top:8px">Mets seulement une image que tu as le droit de partager. L’admin peut l’enlever.</p>' +
      '<button class="btn wide ghost" style="margin-top:6px" data-no>Annuler</button><input type="file" accept="image/*" hidden id="wimgfile">';
    box.addEventListener("click", e => {
      if (e.target.closest("[data-no]")) return close();
      if (e.target.closest("[data-file]")) {
        const inp = box.querySelector("#wimgfile");
        inp.onchange = async () => {
          const f = inp.files[0]; if (!f) return;
          try { const src = await fileToDataUrl(f, 900, 1100, false, 360000); close(); save(src); } catch (x) { toast("Image illisible"); }
        };
        inp.click(); return;
      }
      if (e.target.closest("[data-url]")) {
        const u = box.querySelector("#wimgurl").value.trim();
        if (!okHttp(u) || !/^https:/i.test(u) || u.length > 600) { toast("Colle une adresse qui commence par https://"); return; }
        close(); save(u);
      }
    });
  });
};
ACT.wimgdel = async () => { try { await B.deleteWImage(wslug(cur)); toast("Image enlevée"); } catch (e) { toast(errText(e)); } };
ACT.wimgrep = () => { const d = (S.wimg || {})[wslug(cur)]; if (!d) return; ACT.report({ dataset: { uid: d.uid, conv: "wimg:" + wslug(cur), text: "Image de la fiche " + cur } }); };
