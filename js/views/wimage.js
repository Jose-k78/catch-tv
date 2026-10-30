// Image ajoutée par un membre : sur la fiche d'un catcheur (toujours possible, même s'il a déjà une photo du dossier de l'admin :
// elle s'affiche alors en petit sous la photo) ou le logo d'un tag team / d'une faction qui n'en a pas.
// N'importe quel membre peut en ajouter une (depuis son téléphone ou par une adresse https) ; l'admin (et celui qui l'a ajoutée)
// peut l'enlever, les autres peuvent la signaler.
import { S, B, ACT, nameOf, need } from "../state.js";
import { esc, okHttp, toast, modal, fileToDataUrl } from "../util.js";
import { wslug } from "./comments.js";
import { errText } from "./account.js";

// slug de la fiche : catcheur = wslug(nom) ; groupe = « groupe-… »
export const gslug = id => ("groupe-" + wslug(id)).slice(0, 80);
// opts : { slug, label (« Image » / « Logo »), small (photo du dossier déjà là) }
export function wImageBox(name, opts) {
  const o = opts || {};
  return '<div id="wimg" class="wimg' + (o.small ? " small" : "") + '" data-w="' + esc(o.slug || wslug(name)) + '" data-n="' + esc(name) + '" data-l="' + esc(o.label || "image") + '"></div>';
}
const box = () => document.getElementById("wimg");
export function renderWImage() {
  const b = box(); if (!b) return;
  const d = (S.wimg || {})[b.dataset.w], name = b.dataset.n, lbl = b.dataset.l, small = b.classList.contains("small");
  if (d && d.uid) need(d.uid);
  const mine = d && S.user && d.uid === S.user.uid;
  const bar = d && d.src ? '<div class="wimgbar"><small>' + (small ? "Photo ajoutée par " : lbl === "logo" ? "Logo ajouté par " : "Image ajoutée par ") + esc(nameOf(d.uid)) + "</small>" +
    (S.user ? '<button class="linkbtn" data-act="wimgadd">Changer</button>' : "") +
    (S.user && (mine || S.isAdmin) ? '<button class="linkbtn danger" data-act="wimgdel">Enlever</button>' : S.user ? '<button class="linkbtn" data-act="wimgrep">Signaler</button>' : "") + "</div>" : "";
  b.innerHTML = d && d.src ? '<button class="wimgpic" data-act="zoom" data-src="' + esc(d.src) + '" data-alt="' + esc(name) + '" aria-label="Agrandir"><img src="' + esc(d.src) + '" alt="' + esc(name) + '" loading="lazy" referrerpolicy="no-referrer"></button>' + bar
    : S.user ? '<button class="wimgadd" data-act="wimgadd">📷 ' + (small ? "Ajouter une photo" : lbl === "logo" ? "Ajouter le logo" : "Ajouter une image") + "</button>" : "";
  const img = b.querySelector("img"); if (img) img.onerror = () => { img.closest("button").replaceWith(Object.assign(document.createElement("p"), { className: "note small", textContent: "Image introuvable (lien cassé)." })); };
}
async function save(src) {
  const b = box(); if (!b) return;
  const slug = b.dataset.w, name = b.dataset.n;
  try { await B.setWImage(slug, { w: slug, name: name.slice(0, 60), uid: S.user.uid, src: src }); toast((b.dataset.l === "logo" ? "Logo" : "Image") + " ajouté" + (b.dataset.l === "logo" ? "" : "e") + " ✓"); }
  catch (e) { toast(errText(e)); }
}
ACT.wimgadd = () => {
  if (!S.user) { location.hash = "#/connexion"; return; }
  const b = box(); if (!b) return;
  const name = b.dataset.n, logo = b.dataset.l === "logo";
  modal((m, close) => {
    m.innerHTML = "<h3>" + (logo ? "Logo de " : "Image de ") + esc(name) + '</h3><button class="btn wide" data-file>📷 Depuis mon téléphone</button>' +
      '<label class="fld" style="margin-top:12px">Ou colle l’adresse d’une image<input id="wimgurl" type="url" inputmode="url" placeholder="https://…"></label>' +
      '<button class="btn wide ghost" data-url>Utiliser cette adresse</button><p class="note small" style="margin-top:8px">Mets seulement une image que tu as le droit de partager. L’admin peut l’enlever.</p>' +
      '<button class="btn wide ghost" style="margin-top:6px" data-no>Annuler</button><input type="file" accept="image/*" hidden id="wimgfile">';
    m.addEventListener("click", e => {
      if (e.target.closest("[data-no]")) return close();
      if (e.target.closest("[data-file]")) {
        const inp = m.querySelector("#wimgfile");
        inp.onchange = async () => {
          const f = inp.files[0]; if (!f) return;
          try { const src = await fileToDataUrl(f, 900, 1100, false, 360000); close(); save(src); } catch (x) { toast("Image illisible"); }
        };
        inp.click(); return;
      }
      if (e.target.closest("[data-url]")) {
        const u = m.querySelector("#wimgurl").value.trim();
        if (!okHttp(u) || !/^https:/i.test(u) || u.length > 600) { toast("Colle une adresse qui commence par https://"); return; }
        close(); save(u);
      }
    });
  });
};
ACT.wimgdel = async () => { const b = box(); if (!b) return; try { await B.deleteWImage(b.dataset.w); toast("Image enlevée"); } catch (e) { toast(errText(e)); } };
ACT.wimgrep = () => {
  const b = box(); if (!b) return;
  const d = (S.wimg || {})[b.dataset.w]; if (!d) return;
  ACT.report({ dataset: { uid: d.uid, conv: "wimg:" + b.dataset.w, text: "Image de la fiche " + b.dataset.n } });
};

// ---------- photo en plein écran (appui sur une photo) ----------
ACT.zoom = el => {
  const src = el.dataset.src; if (!src) return;
  const ov = document.createElement("div");
  ov.className = "zoomov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Photo agrandie");
  ov.innerHTML = '<img src="' + esc(src) + '" alt="' + esc(el.dataset.alt || "") + '"><button class="zoomx" aria-label="Fermer">✕</button>' + (el.dataset.alt ? "<small>" + esc(el.dataset.alt) + "</small>" : "");
  const close = () => { ov.classList.remove("on"); setTimeout(() => ov.remove(), 180); document.removeEventListener("keydown", esc_); };
  const esc_ = e => { if (e.key === "Escape") close(); };
  ov.addEventListener("click", close);
  document.addEventListener("keydown", esc_);
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add("on"));
};
