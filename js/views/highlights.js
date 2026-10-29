// Highlights d'un épisode ou d'un PLE : vidéos des chaînes officielles, résumé match par match
// (promotions japonaises) et résultats cachés derrière « Voir les résultats (spoiler) »
import { S, ACT } from "../state.js";
import { esc, ICON, fmt, okHttp, okDay, shAttr } from "../util.js";
import { linkNames } from "../wrestlers.js";
import { hlHidden, unlock, noSpoil } from "../spoil.js";
import { rateBtn, fighters, showFights } from "./mrate.js";

export const hlKey = (k, show, d) => k + "|" + (show || "PLE") + "|" + d;
export function hlOf(k, show, d) { const h = S.highlights[hlKey(k, show, d)]; return h && typeof h === "object" ? h : null; }
export const okVid = id => typeof id === "string" && /^[\w-]{11}$/.test(id);
export const hlHref = (k, show, d) => "#/hl/" + encodeURIComponent(k) + "/" + encodeURIComponent(show || "PLE") + "/" + d;

// Recherche limitée à la chaîne YouTube officielle de la promotion (sinon recherche YouTube classique)
export function ytSearch(k, q) {
  const ch = S.P[k] && S.P[k].yt;
  if (ch && /^UC[\w-]{20,}$/.test(ch)) return "https://www.youtube.com/channel/" + ch + "/search?query=" + encodeURIComponent(q);
  if (ch && /^@[\w.-]+$/.test(ch)) return "https://www.youtube.com/" + ch + "/search?query=" + encodeURIComponent(q);
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(k + " " + q);
}

// Titre de l'épisode (épisode spécial) ou du PLE à cette date
export function titleAt(k, show, d) {
  const pr = S.P[k]; if (!pr) return show || k;
  if (!show || show === "PLE") { const e = (pr.e || []).find(x => x.d === d); return e ? e.t : "PLE"; }
  const s = pr.s && pr.s[show], sp = s && (s.e || []).find(x => x.d === d);
  return sp ? sp.t : show;
}

// Bloc « résultats » repliable
export function spoilBlock(label, inner) {
  return '<div class="spoil"><button class="btn ghost spoilbtn" data-act="reveal">👀 ' + esc(label) + '</button><div class="spoilbody">' + inner + "</div></div>";
}
ACT.reveal = el => { const b = el.closest(".spoil"); if (b) b.classList.add("open"); };

// ctx = {k, show, d} : ajoute « ☆ Noter » à chaque combat (pas aux segments sans adversaires)
export function vidList(list, ctx) {
  // titre qui dévoile un résultat (vidéo ajoutée par le robot) : caché derrière le bouton spoiler
  return '<div class="list">' + list.filter(v => okVid(v.id)).map(v => '<div class="item vid"' + shAttr(Object.assign({ ty: "vid", t: String(v.t || ""), s: ctx && ctx.lbl ? ctx.lbl : v.ch || "Vidéo officielle", id: v.id }, v.sp ? { sp: true } : {})) + '><button class="vmain" data-act="play" data-id="' + esc(v.id) + '" data-t="' + esc(v.sp ? "Vidéo officielle" : v.t) + '">' +
    '<span class="vplay">' + ICON.play + '</span><span class="lbl">' + (v.sp ? '<b class="spoil inline"><span class="spoilbody">' + esc(v.t) + '</span><span class="vsp" data-act="reveal">🙈 Titre caché (spoiler) · toucher pour voir</span></b>' : "<b>" + esc(v.t) + "</b>") +
    "<small>" + esc(v.ch || "Chaîne officielle") + "</small></span></button>" +
    (ctx && !v.sp && fighters(v.t) ? rateBtn(ctx.k, v.t, ctx.show, ctx.d) : "") + "</div>").join("") + "</div>";
}

export function hlView(k, show, d) {
  const pr = S.P[k];
  if (!pr || !okDay(d)) return '<a class="back" href="#/">' + ICON.back + ' Accueil</a><p class="empty">Show introuvable.</p>';
  const key = hlKey(k, show, d), h = hlOf(k, show, d) || {}, isPle = !show || show === "PLE";
  const title = h.t || titleAt(k, show, d), c = (!isPle && pr.s && pr.s[show] && pr.s[show].c) || pr.c;
  const bg = c.length >= 3 ? "linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,.42)),linear-gradient(120deg," + c[0] + " 0 34%," + c[1] + " 34% 66%," + c[2] + " 66% 100%)" : "linear-gradient(160deg," + c[0] + "," + c[1] + ")";
  let out = '<a class="back" href="javascript:history.back()">' + ICON.back + " Retour</a>" +
    '<section class="hlhead" style="background:' + esc(bg) + '"><span class="eyebrow">' + esc(k) + " · " + (isPle ? "PLE" : esc(show)) + " · HIGHLIGHTS</span><h1>" + esc(title) + "</h1><small>" + fmt(d) + "</small>" +
    '<button class="iconbtn sharebtn light" data-act="share"' + shAttr({ ty: "hl", t: "Highlights · " + title, s: k + " · " + fmt(d), h: hlHref(k, show, d), k: k, sp: true }) + ' aria-label="Partager">↗</button></section>';
  if (hlHidden(key, k, isPle ? "" : show, d)) {
    return out + '<div class="lockbox"><span class="lockico">🙈</span><b>Mode sans spoiler</b><p>Les highlights et les résultats de ce show restent cachés tant que tu ne l’as pas marqué comme vu.</p>' +
      '<div class="btns"><button class="btn" data-act="seen" data-k="' + esc(k) + '" data-show="' + esc(isPle ? "" : show) + '" data-d="' + esc(d) + '" data-t="' + esc(title) + '">' + ICON.eye + " Je l’ai vu</button>" +
      '<button class="btn ghost" data-act="unlockhl" data-key="' + esc(key) + '">Afficher quand même</button></div></div>';
  }
  const vids = (h.v || []).filter(v => okVid(v.id));
  const q = (isPle ? title : show + " " + fmt(d)) + " highlights";
  out += "<h2>Vidéos officielles</h2>" + (vids.length ? vidList(vids, { k: k, show: isPle ? title : show, d: d, lbl: (isPle ? title : k + " " + show) + " · " + fmt(d) }) : '<p class="note">Pas encore de vidéo officielle ajoutée pour ce show.</p>') +
    '<p class="note small" style="margin-top:8px"><a class="linkbtn" style="padding:0" href="' + esc(ytSearch(k, q)) + '" target="_blank" rel="noopener">Chercher sur la chaîne YouTube officielle ↗</a></p>';
  if (Array.isArray(h.m) && h.m.length) {
    // promotions japonaises : résumé classique de chaque match, la vidéo quand elle existe
    out += '<h2>Match par match</h2>';
    out += '<div class="spoil mbm"><div class="mlist">' + h.m.map((m, i) => '<article class="mbmi"><span class="mno">' + (i + 1) + '</span><div class="epbody"><b class="eptitle">' + linkNames(m.t) + "</b>" +
      '<p class="recap spoilbody">' + linkNames(m.r || "") + "</p>" + '<div class="mbtns">' + (okVid(m.v) ? '<button class="btn small ghost" data-act="play" data-id="' + esc(m.v) + '" data-t="' + esc(m.t) + '">▶ Vidéo</button>' : "") +
      rateBtn(k, m.t, isPle ? title : show, d) + "</div></div></article>").join("") +
      '</div><button class="btn ghost spoilbtn" data-act="reveal">👀 Voir les résumés des matchs (spoiler)</button></div>';
  }
  // les autres combats du show (carte du PLE, résultats) : titres neutres, à noter
  const skip = vids.map(v => v.t).concat((h.m || []).map(m => m && m.t)).filter(Boolean);
  const fights = showFights(k, show, d, h, skip), lbl = isPle ? title : show;
  if (fights.length) out += "<h2>" + (vids.length || (h.m || []).length ? "Les autres combats" : "Les combats du show") + '</h2><div class="list fights">' +
    fights.map(t => '<div class="item"><span class="lbl"><b>' + linkNames(t) + "</b></span>" + rateBtn(k, t, lbl, d) + "</div>").join("") + "</div>";
  if (Array.isArray(h.res) && h.res.length) {
    out += "<h2>Résultats</h2>" + spoilBlock("Voir les résultats (spoiler)", '<ul class="res">' + h.res.map(r => "<li>" + linkNames(r) + "</li>").join("") + "</ul>");
  } else if (!h.m) out += '<p class="note" style="margin-top:14px">Les résultats seront ajoutés lors de la prochaine mise à jour.</p>';
  // le reste du show : promos, interviews, attaques, face-à-face, retours… dans l'ordre du show
  const seg = (Array.isArray(h.seg) ? h.seg : []).filter(x => x && (x.t || typeof x === "string"));
  if (seg.length) out += "<h2>Les segments du show</h2>" + spoilBlock("Voir les segments (spoiler)", '<ul class="segs">' + seg.map(x => {
    const ty = typeof x === "string" ? "" : String(x.k || ""), t = typeof x === "string" ? x : x.t;
    return "<li>" + (ty ? '<span class="segk">' + esc(SEGICO[ty] || "🎬") + " " + esc(ty) + "</span>" : "") + "<span>" + linkNames(t) + "</span></li>";
  }).join("") + "</ul>");
  if (h.s) out += '<p class="note small" style="margin-top:12px">Source : ' + (okHttp(h.u) ? '<a href="' + esc(h.u) + '" target="_blank" rel="noopener">' + esc(h.s) + "</a>" : esc(h.s)) + "</p>";
  out += '<p class="note small" style="margin-top:10px">☆ Note les combats que tu as vus : ils rejoignent ton historique des notes, avec le match complet dès qu’il est publié.</p>';
  if (!noSpoil()) out += '<p class="note small" style="margin-top:6px">Astuce : active le « mode sans spoiler » dans les paramètres pour tout cacher tant que tu n’as pas vu le show.</p>';
  return out;
}
const SEGICO = { "Promo": "🎤", "Interview": "🎙️", "Attaque": "💥", "Face-à-face": "🔥", "Retour": "😱", "Débuts": "✨", "Annonce": "📢", "Contrat": "✍️", "Célébration": "🎉", "Backstage": "🚪", "Trahison": "🗡️", "Blessure": "🤕" };
ACT.unlockhl = el => unlock("hl:" + el.dataset.key);
