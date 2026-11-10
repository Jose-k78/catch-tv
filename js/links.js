// Liens ajoutés par le modérateur (TCC Play, ex « Autre visionnage ») : data/links.json = { updated, items: { clé: [{ t, u, at, def }] } }
// Clés : "ev:K|show|date" (un show ou un PLE, en direct ou en replay), "m:texte du match", "ent:Nom" (entrance),
// "entm:Nom" (musique d'entrée), "tn:id" (tournoi), "story:id" (storyline du jour). Enregistré avec la clé GitHub du modo.
// À la validation, le lien collé est reconnu (Dailymotion, Vimeo, OK.ru, VK, archive.org, Twitch, Streamable, Rumble, fichier vidéo…)
// et transformé en lecteur intégré qui se lance tout seul ; un lien YouTube est lu par le lecteur YouTube de l'app ;
// une page internet qui n'est pas une vidéo est refusée (pas d'écran noir ni « Forbidden » dans le lecteur).
// Les membres peuvent demander une vidéo (« Je veux voir le show ») ou signaler un lien : ça arrive dans les signalements du modo ;
// quand le modo ajoute le lien, les membres qui l'avaient demandé reçoivent une notification.
import { S, B, ACT, changed } from "./state.js";
import { esc, toast, modal, okHttp, ICON } from "./util.js";
import { ghGetJson, ghPutJson, ghToken } from "./github.js";
import { PREVIEW } from "./content.js";

export const linksOf = key => ((S.links || {})[key] || []).filter(x => x && okHttp(x.u));
const rkey = key => String(key).slice(0, 54);

// ---------- reconnaissance d'un lien vidéo ----------
// parseVideo(url, { muted }) -> { ok, kind: "youtube" | "embed" | "file", platform, src, msg }
// muted : départ automatique sans appui (page qui s'ouvre) -> les navigateurs n'autorisent l'autoplay qu'en sourdine
export function parseVideo(raw, opt) {
  opt = opt || {};
  let u = String(raw || "").trim().replace(/^<iframe[^>]*src=["']([^"']+)["'].*$/is, "$1"); // code <iframe> collé : on garde son adresse
  if (/^\/\//.test(u)) u = "https:" + u;
  if (/^http:\/\//i.test(u)) u = "https://" + u.slice(7);
  let url; try { url = new URL(u); } catch (e) { return { ok: false, msg: "Ce n’est pas un lien valide." }; }
  if (url.protocol !== "https:") return { ok: false, msg: "Le lien doit commencer par https://" };
  const host = url.hostname.replace(/^(www|m|mobile)\./, ""), path = url.pathname, q = url.searchParams, mu = opt.muted ? 1 : 0;
  const parentHost = (typeof location !== "undefined" && location.hostname) || "localhost";
  let m;
  // YouTube : lu par le lecteur YouTube de l'app (connecté au compte YouTube du navigateur : pas de pub avec Premium)
  if (/(^|\.)youtube\.com$|^youtu\.be$|youtube-nocookie\.com$/.test(host)) {
    const id = host === "youtu.be" ? path.slice(1, 12) : (q.get("v") || (path.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/) || [])[1] || "");
    if (!/^[\w-]{11}$/.test(id)) return { ok: false, msg: "Lien YouTube incomplet : colle le lien de la vidéo." };
    return { ok: true, kind: "youtube", platform: "YouTube", id: id, src: "https://www.youtube.com/embed/" + id + "?autoplay=1&rel=0&playsinline=1" + (mu ? "&mute=1" : "") };
  }
  // Dailymotion
  if (/(^|\.)dailymotion\.com$|^dai\.ly$/.test(host)) {
    const id = host === "dai.ly" ? path.slice(1) : (path.match(/\/(?:embed\/)?video\/([a-zA-Z0-9]+)/) || [])[1] || q.get("video");
    if (id) return { ok: true, kind: "embed", platform: "Dailymotion", src: "https://www.dailymotion.com/embed/video/" + id + "?autoplay=1" + (mu ? "&mute=1" : "") };
  }
  // Vimeo
  if (/(^|\.)vimeo\.com$/.test(host) && (m = path.match(/(?:\/video)?\/(\d{5,})(?:\/([0-9a-f]{6,}))?/))) {
    const h = m[2] || q.get("h");
    return { ok: true, kind: "embed", platform: "Vimeo", src: "https://player.vimeo.com/video/" + m[1] + "?autoplay=1" + (h ? "&h=" + h : "") + (mu ? "&muted=1" : "") };
  }
  // OK.ru
  if (/(^|\.)ok\.ru$/.test(host) && (m = path.match(/\/(?:video|videoembed|live)\/(\d+)/))) return { ok: true, kind: "embed", platform: "OK.ru", src: "https://ok.ru/videoembed/" + m[1] + "?autoplay=1" };
  // VK / VK Video
  if (/(^|\.)(vk\.com|vk\.ru|vkvideo\.ru)$/.test(host)) {
    let oid = q.get("oid"), vid = q.get("id"), hash = q.get("hash");
    const z = (q.get("z") || "") + " " + path;
    if (!(oid && vid) && (m = z.match(/video(-?\d+)_(\d+)/))) { oid = m[1]; vid = m[2]; }
    if (oid && vid) return { ok: true, kind: "embed", platform: "VK", src: "https://vk.com/video_ext.php?oid=" + oid + "&id=" + vid + (hash ? "&hash=" + hash : "") + "&hd=2&autoplay=1" };
  }
  // archive.org
  if (/(^|\.)archive\.org$/.test(host) && (m = path.match(/\/(?:details|embed)\/([^/?#]+)(?:\/([^?#]+))?/))) return { ok: true, kind: "embed", platform: "archive.org", src: "https://archive.org/embed/" + m[1] + (m[2] ? "/" + m[2] : "") + "?autoplay=1" };
  // Twitch (vidéo, clip ou chaîne en direct)
  if (/(^|\.)twitch\.tv$/.test(host)) {
    if ((m = path.match(/\/videos\/(\d+)/))) return { ok: true, kind: "embed", platform: "Twitch", src: "https://player.twitch.tv/?video=" + m[1] + "&parent=" + parentHost + "&autoplay=true" + (mu ? "&muted=true" : "") };
    if (host.indexOf("clips.") === 0 || /\/clip\//.test(path)) { const c = path.split("/").filter(Boolean).pop(); if (c) return { ok: true, kind: "embed", platform: "Twitch", src: "https://clips.twitch.tv/embed?clip=" + c + "&parent=" + parentHost + "&autoplay=true" }; }
    if ((m = path.match(/^\/([\w]+)\/?$/))) return { ok: true, kind: "embed", platform: "Twitch", src: "https://player.twitch.tv/?channel=" + m[1] + "&parent=" + parentHost + "&autoplay=true" + (mu ? "&muted=true" : "") };
  }
  // Streamable
  if (/(^|\.)streamable\.com$/.test(host) && (m = path.match(/^\/(?:e\/|o\/)?([a-z0-9]+)/i))) return { ok: true, kind: "embed", platform: "Streamable", src: "https://streamable.com/e/" + m[1] + "?autoplay=1" + (mu ? "&muted=1" : "") };
  // Rumble (lien « embed » seulement)
  if (/(^|\.)rumble\.com$/.test(host) && (m = path.match(/\/embed\/([\w]+)/))) return { ok: true, kind: "embed", platform: "Rumble", src: "https://rumble.com/embed/" + m[1] + "/?autoplay=2" };
  // Facebook (vidéo publique)
  if (/(^|\.)facebook\.com$|^fb\.watch$/.test(host) && /video|watch|reel/.test(u)) return { ok: true, kind: "embed", platform: "Facebook", src: "https://www.facebook.com/plugins/video.php?href=" + encodeURIComponent(u) + "&autoplay=1" };
  // fichier vidéo direct
  if (/\.(mp4|webm|ogv|ogg|mov|m4v)$/i.test(path)) return { ok: true, kind: "file", platform: "Fichier vidéo", src: u };
  // autre lecteur déjà au format « embed » (adresse de lecteur, pas une page)
  if (/\/(embed|player|videoembed|video_ext)\b/i.test(path) || /^(player|embed)\./.test(url.hostname)) return { ok: true, kind: "embed", platform: "Lecteur intégré", src: u + (u.indexOf("?") < 0 ? "?autoplay=1" : "&autoplay=1") };
  return { ok: false, msg: "Ce lien est une page internet, pas une vidéo : il ne peut pas s’ouvrir dans le lecteur. Colle le lien de la vidéo elle-même (ou son code « intégrer »)." };
}
// lecteur HTML d'un lien (iframe, ou <video> pour un fichier)
export function playerHTML(u, t, opt) {
  const v = parseVideo(u, opt);
  if (!v.ok) return '<p class="note">' + esc(v.msg) + "</p>";
  if (PREVIEW) return '<p class="note">La vidéo se lira ici une fois l’app en ligne.</p>';
  if (v.kind === "file") return '<div class="player"><video src="' + esc(v.src) + '" controls autoplay playsinline' + (opt && opt.muted ? " muted" : "") + "></video></div>";
  return '<div class="player"><iframe src="' + esc(v.src) + '" title="' + esc(t || "Vidéo") + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
}
export const embedSrc = u => { const v = parseVideo(u); return v.ok ? v.src : ""; };
export const playable = u => parseVideo(u).ok;
export const isYouTube = u => parseVideo(u).kind === "youtube";
// icône TCC Play (barre du bas) : écran avec le bouton lecture
export const TPLAY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="13" rx="3"/><path d="M10 8.3v5.4l4.6-2.7z" fill="currentColor"/><path d="M8 20.5h8"/></svg>';
// logo TCC Play (petit, en ligne)
export const TPLAY = '<span class="tplaylogo" aria-label="TCC Play"><i>▶</i><b>TCC</b>Play</span>';
// lien par défaut d'une clé (⭐ choisi par le modo) : se lance directement dans le lecteur
export const defaultLink = key => linksOf(key).find(x => x.def) || null;

// lecteur dans l'app
// tous les liens s'ouvrent dans le lecteur de l'app (si le site refuse d'être intégré : « Ouvrir à part »)
export function playLink(u, t) {
  if (!okHttp(u)) return;
  const v = parseVideo(u);
  if (!v.ok) { toast(v.msg, { ms: 5000 }); return; }
  modal((box, close) => {
    box.classList.add("vidmodal");
    box.innerHTML = "<h3>" + esc(t || "Vidéo") + '</h3><small class="note small">' + (v.kind === "youtube" ? "▶ YouTube" : TPLAY + " · " + esc(v.platform)) + "</small>" + playerHTML(u, t) +
      '<button class="btn wide ghost" style="margin-top:10px" data-close>Fermer</button>';
    box.addEventListener("click", ev => { if (ev.target.closest("[data-close]")) close(); });
  });
}
ACT.mlplay = el => playLink(el.dataset.u, el.dataset.t);

// boutons « Autre visionnage » d'une clé (+ ajout / suppression pour le modo, signalement pour les membres)
// opt : { label, title (nom du show pour la notification), href (lien de la page), ask (bouton « Je veux voir le show »), empty }
export function linksHTML(key, opt) {
  opt = opt || {};
  const L = linksOf(key);
  let h = L.map((x, i) => '<div class="mlink"><button class="btn wide ghost evwatch" data-act="mlplay" data-u="' + esc(x.u) + '" data-t="' + esc(x.t || opt.title || "") + '">' + (isYouTube(x.u) ? ICON.play + " YouTube" : TPLAY) + (opt.label ? " · " + esc(opt.label) : "") + (x.t ? " · " + esc(x.t) : "") + (x.def ? " ⭐" : "") + "</button>" +
    (S.isAdmin ? '<button class="iconbtn mledit" data-act="mledit" data-k="' + esc(key) + '" data-i="' + i + '" aria-label="Modifier ce lien" title="Modifier">✏️</button><button class="iconbtn mldef' + (x.def ? " on" : "") + '" data-act="mldef" data-k="' + esc(key) + '" data-i="' + i + '" aria-label="Lien par défaut" title="Lien par défaut">⭐</button><button class="iconbtn mldel" data-act="mldel" data-k="' + esc(key) + '" data-i="' + i + '" aria-label="Supprimer ce lien">✕</button>'
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
export async function saveLinks(fn, msg) {
  if (!ghToken()) { if (ACT.ghkey) ACT.ghkey(); return false; }
  const cur = await ghGetJson("data/links.json"), d = cur.data || { items: {} };
  d.items = d.items || {}; fn(d.items); d.updated = new Date().toISOString();
  await ghPutJson("data/links.json", d, msg);
  S.links = d.items; changed("content");
  return true;
}
function linkForm(key, title, href, idx) {
  const cur = idx != null ? (linksOf(key)[idx] || {}) : {};
  modal((box, close) => {
    box.innerHTML = "<h3>" + (idx != null ? "Modifier le lien" : "Ajouter un lien") + '</h3><p class="sub">' + esc(title || key) + '</p><form data-mlf>' +
      '<label class="fld">Lien de la vidéo (Dailymotion, Vimeo, OK.ru, VK, archive.org, Twitch, YouTube…) ou code « intégrer »<input name="u" required placeholder="https://…" value="' + esc(cur.u || "") + '"></label>' +
      '<p class="note small" id="mlchk"></p>' +
      '<label class="fld">Nom affiché (facultatif)<input name="t" maxlength="60" placeholder="Ex. : replay complet" value="' + esc(cur.t || "") + '"></label><label class="chk"><input type="checkbox" name="def"' + (cur.def ? " checked" : "") + '> ⭐ Lien par défaut (se lance directement)</label>' +
      '<button class="btn wide">Valider</button></form><button class="btn wide ghost" style="margin-top:10px" data-close>Annuler</button>';
    const chk = () => { const v = parseVideo(box.querySelector("[name=u]").value), o = box.querySelector("#mlchk"); if (!box.querySelector("[name=u]").value.trim()) { o.textContent = ""; return v; }
      o.innerHTML = v.ok ? (v.kind === "youtube" ? "▶ Lien YouTube : il sera lu avec le lecteur YouTube de l’app (pas dans TCC Play)." : "✅ " + esc(v.platform) + " reconnu : lecture automatique dans TCC Play.") : "⚠️ " + esc(v.msg); return v; };
    box.querySelector("[name=u]").addEventListener("input", chk); chk();
    box.addEventListener("click", ev => { if (ev.target.closest("[data-close]")) close(); });
    box.querySelector("[data-mlf]").addEventListener("submit", async ev => {
      ev.preventDefault();
      const v = chk(), u = ev.target.u.value.trim().replace(/^<iframe[^>]*src=["']([^"']+)["'].*$/is, "$1"), t = ev.target.t.value.trim().slice(0, 60), def = ev.target.def.checked;
      if (!v.ok) { toast(v.msg, { ms: 5000 }); return; }
      if (v.kind === "youtube") toast("Lien YouTube : lu avec le lecteur YouTube de l’app", { ms: 3500 });
      close();
      const rec = Object.assign({ t: t, u: u, p: v.platform, at: new Date().toISOString().slice(0, 10) }, def ? { def: true } : {});
      try {
        const okd = await saveLinks(items => { items[key] = items[key] || []; if (def) items[key].forEach(x => delete x.def); if (idx != null && items[key][idx]) items[key][idx] = rec; else items[key].push(rec); }, (idx != null ? "Lien modifié par le modérateur : " : "Lien du modérateur : ") + (title || key));
        if (!okd) return;
        toast(idx != null ? "Lien modifié ✓" : "Lien ajouté ✓");
        if (idx == null) asksFor(key).forEach(r => {
          if (r.by && r.by !== S.user.uid) B.pushNotif(r.by, "video_" + Date.now().toString(36) + r.id.slice(0, 6), { type: "reply", from: S.user.uid, w: "", name: (title || "Le show").slice(0, 60), cid: "video", text: "La vidéo est disponible 🎬", a: (href || location.hash).slice(0, 300) }).catch(() => {});
          B.deleteReport(r.id).catch(() => {});
        });
      } catch (e) { if (e && e.message !== "nokey") toast("Pas enregistré : " + e.message, { ms: 5000 }); }
    });
  });
}
ACT.mladd = el => { if (S.isAdmin) linkForm(el.dataset.k, el.dataset.t || "", el.dataset.h || location.hash, null); };
ACT.mledit = el => { if (S.isAdmin) linkForm(el.dataset.k, "", location.hash, +el.dataset.i); };
ACT.mldef = async el => {
  if (!S.isAdmin) return;
  const key = el.dataset.k, i = +el.dataset.i;
  try { if (await saveLinks(items => { (items[key] || []).forEach((x, j) => { if (j === i) x.def = !x.def; else delete x.def; }); }, "Lien par défaut choisi par le modérateur")) toast("Lien par défaut mis à jour ⭐"); }
  catch (e) { if (e && e.message !== "nokey") toast("Pas enregistré : " + e.message, { ms: 5000 }); }
};
ACT.mldel = async el => {
  if (!S.isAdmin) return;
  const key = el.dataset.k, i = +el.dataset.i;
  try { if (await saveLinks(items => { (items[key] || []).splice(i, 1); if (items[key] && !items[key].length) delete items[key]; }, "Lien du modérateur retiré")) toast("Lien retiré"); }
  catch (e) { if (e && e.message !== "nokey") toast("Pas enregistré : " + e.message, { ms: 5000 }); }
};
