// Liens ajoutés par le modérateur (« Autre visionnage ») : data/links.json = { updated, items: { clé: [{ t, u, at }] } }
// Clés : "ev:K|show|date" (un show ou un PLE, en direct ou en replay), "m:texte du match", "ent:Nom" (entrance),
// "entm:Nom" (musique d'entrée), "tn:id" (tournoi). Enregistré avec la clé GitHub du modérateur (comme les images).
// YouTube et Dailymotion se lisent dans l'app ; les autres sites s'ouvrent à part.
// Les membres peuvent demander une vidéo (« Je veux voir le show ») ou signaler un lien : ça arrive dans les signalements du modo ;
// quand le modo ajoute le lien, les membres qui l'avaient demandé reçoivent une notification.
import { S, B, ACT, changed } from "./state.js";
import { esc, toast, modal, okHttp, ICON } from "./util.js";
import { ghGetJson, ghPutJson, ghToken } from "./github.js";
import { PREVIEW } from "./content.js";

export const linksOf = key => ((S.links || {})[key] || []).filter(x => x && okHttp(x.u));
const ytId = u => { const m = String(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/); return m ? m[1] : ""; };
const dmId = u => { const m = String(u).match(/(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-zA-Z0-9]+)/); return m ? m[1] : ""; };
export const playable = u => !!(ytId(u) || dmId(u));
const rkey = key => String(key).slice(0, 54);

// lecteur dans l'app (YouTube nocookie ou Dailymotion)
export function playLink(u, t) {
  const y = ytId(u), d = dmId(u);
  if (!y && !d) { window.open(u, "_blank", "noopener"); return; }
  const src = y ? "https://www.youtube-nocookie.com/embed/" + y + "?autoplay=1&rel=0" : "https://www.dailymotion.com/embed/video/" + d + "?autoplay=1";
  modal((box, close) => {
    box.classList.add("vidmodal");
    box.innerHTML = "<h3>" + esc(t || "Vidéo") + "</h3>" + (PREVIEW ? '<p class="note">La vidéo se lira ici une fois l’app en ligne.</p>' :
      '<div class="player"><iframe src="' + esc(src) + '" title="' + esc(t || "Vidéo") + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>') +
      '<a class="linkbtn" href="' + esc(u) + '" target="_blank" rel="noopener">Ouvrir à part ↗</a><button class="btn wide ghost" style="margin-top:10px" data-close>Fermer</button>';
    box.addEventListener("click", ev => { if (ev.target.closest("[data-close]")) close(); });
  });
}
ACT.mlplay = el => playLink(el.dataset.u, el.dataset.t);

// boutons « Autre visionnage » d'une clé (+ ajout / suppression pour le modo, signalement pour les membres)
// opt : { label, title (nom du show pour la notification), href (lien de la page), ask (bouton « Je veux voir le show »), empty }
export function linksHTML(key, opt) {
  opt = opt || {};
  const L = linksOf(key);
  let h = L.map((x, i) => '<div class="mlink"><button class="btn wide ghost evwatch" data-act="mlplay" data-u="' + esc(x.u) + '" data-t="' + esc(x.t || opt.title || "") + '">' + ICON.play + " " + esc(opt.label || "Autre visionnage") + (x.t ? " · " + esc(x.t) : "") + (playable(x.u) ? "" : " ↗") + "</button>" +
    (S.isAdmin ? '<button class="iconbtn mldel" data-act="mldel" data-k="' + esc(key) + '" data-i="' + i + '" aria-label="Supprimer ce lien">✕</button>'
      : S.user ? '<button class="iconbtn mlrep" data-act="mlrep" data-k="' + esc(key) + '" data-u="' + esc(x.u) + '" aria-label="Signaler ce lien" title="Signaler">⚑</button>' : "") + "</div>").join("");
  if (!L.length && opt.ask && S.user && !S.isAdmin) {
    const asked = (S.myAsks || {})[key];
    h += '<button class="btn wide ghost" data-act="mlask" data-k="' + esc(key) + '" data-t="' + esc(opt.title || "") + '"' + (asked ? " disabled" : "") + ">" + (asked ? "✓ Demande envoyée au modérateur" : "🙋 Je veux voir le show") + "</button>";
  }
  if (S.isAdmin) h += '<button class="linkbtn mladd" data-act="mladd" data-k="' + esc(key) + '" data-t="' + esc(opt.title || "") + '" data-h="' + esc(opt.href || "") + '">🔗 Ajouter un lien (modo)</button>' +
    (asksFor(key).length ? '<small class="note small">🙋 ' + asksFor(key).length + " demande" + (asksFor(key).length > 1 ? "s" : "") + " de membres</small>" : "");
  return h || (opt.empty || "");
}
const asksFor = key => (S.reports || []).filter(r => r.target === "voir:" + rkey(key));

ACT.mlask = async el => {
  if (!S.user) { location.hash = "#/connexion"; return; }
  const key = el.dataset.k;
  try {
    await B.report(S.user.uid, { target: "voir:" + rkey(key), reason: "Demande de vidéo", text: ("Je veux voir le show : " + (el.dataset.t || key) + " · " + location.hash).slice(0, 500) });
    S.myAsks = Object.assign({}, S.myAsks || {}, { [key]: 1 });
    try { const a = JSON.parse(localStorage.getItem("ctv.asks") || "{}"); a[key] = 1; localStorage.setItem("ctv.asks", JSON.stringify(a)); } catch (e) {}
    el.disabled = true; el.textContent = "✓ Demande envoyée au modérateur"; toast("Le modérateur est prévenu 🙋");
  } catch (e) { toast("Impossible pour l’instant"); }
};
try { S.myAsks = JSON.parse(localStorage.getItem("ctv.asks") || "{}") || {}; } catch (e) { S.myAsks = {}; }

ACT.mlrep = el => {
  if (!S.user) return;
  const R = ["Vidéo plus disponible", "Ne correspond pas", "Mauvaise qualité", "Autre"];
  modal((box, close) => {
    box.innerHTML = '<h3>Signaler ce lien</h3><div class="list">' + R.map(r => '<button class="item" data-r="' + esc(r) + '"><span class="lbl"><b>' + esc(r) + "</b></span></button>").join("") + '</div><button class="btn wide ghost" style="margin-top:10px" data-close>Annuler</button>';
    box.addEventListener("click", async ev => {
      if (ev.target.closest("[data-close]")) return close();
      const b = ev.target.closest("[data-r]"); if (!b) return;
      close();
      try { await B.report(S.user.uid, { target: "lien:" + rkey(el.dataset.k), reason: b.dataset.r.slice(0, 40), text: el.dataset.u.slice(0, 500) }); toast("Merci, le modérateur est prévenu"); } catch (e) { toast("Impossible pour l’instant"); }
    });
  });
};

// ---------- modo : ajouter / supprimer (data/links.json via GitHub) ----------
async function saveLinks(fn, msg) {
  if (!ghToken()) { if (ACT.ghkey) ACT.ghkey(); return false; }
  const cur = await ghGetJson("data/links.json"), d = cur.data || { items: {} };
  d.items = d.items || {}; fn(d.items); d.updated = new Date().toISOString();
  await ghPutJson("data/links.json", d, msg);
  S.links = d.items; changed("content");
  return true;
}
ACT.mladd = el => {
  if (!S.isAdmin) return;
  const key = el.dataset.k, title = el.dataset.t || "", href = el.dataset.h || location.hash;
  modal((box, close) => {
    box.innerHTML = '<h3>Ajouter un lien</h3><p class="sub">' + esc(title || key) + '</p><form data-mlf><label class="fld">Lien (YouTube, Dailymotion ou un site)<input name="u" type="url" required placeholder="https://…"></label>' +
      '<label class="fld">Nom affiché (facultatif)<input name="t" maxlength="60" placeholder="Ex. : replay complet"></label><button class="btn wide">Enregistrer</button></form><button class="btn wide ghost" style="margin-top:10px" data-close>Annuler</button>';
    box.addEventListener("click", ev => { if (ev.target.closest("[data-close]")) close(); });
    box.querySelector("[data-mlf]").addEventListener("submit", async ev => {
      ev.preventDefault();
      const u = ev.target.u.value.trim(), t = ev.target.t.value.trim().slice(0, 60);
      if (!okHttp(u)) { toast("Colle un lien qui commence par https://"); return; }
      close();
      try {
        const okd = await saveLinks(items => { (items[key] = items[key] || []).push({ t: t, u: u, at: new Date().toISOString().slice(0, 10) }); }, "Lien du modérateur : " + (title || key));
        if (!okd) return;
        toast("Lien ajouté ✓");
        // prévenir les membres qui avaient demandé la vidéo, puis effacer leurs demandes
        asksFor(key).forEach(r => {
          if (r.by && r.by !== S.user.uid) B.pushNotif(r.by, "video_" + Date.now().toString(36) + r.id.slice(0, 6), { type: "reply", from: S.user.uid, w: "", name: (title || "Le show").slice(0, 60), cid: "video", text: "La vidéo est disponible 🎬", a: href.slice(0, 300) }).catch(() => {});
          B.deleteReport(r.id).catch(() => {});
        });
      } catch (e) { if (e && e.message !== "nokey") toast("Pas enregistré : " + e.message, { ms: 5000 }); }
    });
  });
};
ACT.mldel = async el => {
  if (!S.isAdmin) return;
  const key = el.dataset.k, i = +el.dataset.i;
  try { if (await saveLinks(items => { (items[key] || []).splice(i, 1); if (items[key] && !items[key].length) delete items[key]; }, "Lien du modérateur retiré")) toast("Lien retiré"); }
  catch (e) { if (e && e.message !== "nokey") toast("Pas enregistré : " + e.message, { ms: 5000 }); }
};
