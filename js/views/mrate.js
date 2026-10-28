// Notes des combats : depuis les highlights d'un show et les matchs à revoir.
// Rangées dans l'historique des notes (identifiant « m_… »), et reliées automatiquement au match complet,
// à la vidéo de highlights ou au résumé match par match dès qu'ils apparaissent dans l'app.
import { S, B, ACT } from "../state.js";
import { esc, modal, toast, fmt, ICON, stars, docId, okDay } from "../util.js";
import { errText } from "./account.js";
import { hlHref, hlOf, okVid, titleAt } from "./highlights.js";

const N = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
// « Titre IWGP : A & B contre C — Ladder match (WrestleMania) » -> ["a", "b", "c"]
export function fighters(title) {
  let t = String(title || "").replace(/\([^)]*\)/g, " ");
  if (/:/.test(t)) t = t.replace(/^[^:]{0,70}:\s*/, "");
  t = t.split(/\s+[—–-]\s+/)[0];
  const sides = t.split(/\s+(?:contre|vs\.?|versus|v\.|face [àa])\s+/i);
  if (sides.length < 2) return null;
  const out = [];
  sides.forEach(sd => sd.split(/\s*(?:&|,|\bet\b|\band\b)\s*/i).forEach(x => { x = N(x).replace(/[^a-z0-9' .-]/g, "").replace(/^(?:les|le|la) /, "").trim(); if (x) out.push(x); }));
  return out.length >= 2 ? out.sort() : null;
}
export function mkey(k, title) { const f = fighters(title); return k + "|" + (f ? f.join("+") : N(title)); }
export function mid(k, title, d) { return docId("m_" + mkey(k, title) + (okDay(d) ? "|" + d : "")).slice(0, 300); }
export const isMatchNote = h => !!h && typeof h.id === "string" && h.id.indexOf("m_") === 0;

// Ma note pour ce combat : exacte (même date) ; pour un match complet sans date, la note la plus récente du même combat
export function myMatchNote(k, title, d) {
  const exact = S.history[mid(k, title, d)]; if (exact) return exact;
  if (okDay(d)) return null;
  const key = mkey(k, title);
  return Object.values(S.history).filter(h => isMatchNote(h) && mkey(h.k, h.title) === key).sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0))[0] || null;
}

// Ce que l'app connaît de ce combat : match complet, vidéo de highlights, résumé match par match
export function matchLinks(k, title, d) {
  const key = mkey(k, title), out = {};
  const full = (S.matches || []).find(m => m && m.k === k && okVid(m.id) && mkey(m.k, m.t) === key);
  if (full) out.full = { id: full.id, t: full.t };
  const H = S.highlights || {};
  Object.keys(H).sort((a, b) => (b.split("|")[2] || "").localeCompare(a.split("|")[2] || "")).forEach(hk => {
    const p = hk.split("|"), h = H[hk]; if (p[0] !== k || !h || (okDay(d) && p[2] !== d)) return;
    if (!out.hl) { const v = (h.v || []).find(x => okVid(x.id) && mkey(k, x.t) === key); if (v) out.hl = { id: v.id, t: v.t }; }
    if (!out.sum) { const m = (h.m || []).find(x => x && mkey(k, x.t) === key); if (m) out.sum = { href: hlHref(p[0], p[1], p[2]), label: titleAt(p[0], p[1], p[2]) + " du " + fmt(p[2]) }; }
  });
  return out;
}

// « X a battu Y et conserve… » / « X defeated Y to win… » -> « X contre Y » ;
// les deux camps sont classés par ordre alphabétique pour ne pas trahir le vainqueur
const R_FR = /^(.+?)\s+(?:a|ont)\s+(?:battu|vaincu|éliminé|dominé)\s+(.+)$/i;
const R_EN = /^(.+?)\s+(?:defeated|defeat|def\.|beat|pinned|submitted|eliminated|outlasted)\s+(.+)$/i;
const R_TITLE = /^(.+?)\s+(?:conserve|conservent|remporte|remportent|retained|retains|won|wins)\s+[^,;]+?\s+(?:face à|face a|contre|against|over)\s+(.+)$/i;
const R_DRAW_VS = /^(.+?)\s+(?:vs\.?|versus|contre)\s+(.+?)\s+(?:ended|went|fought|se termin|s'est termin|s’est termin|en match nul|time limit|à égalité)/i;
const R_DRAW_AND = /^(.+?)\s+(?:and|et)\s+(.+?)\s+(?:fought to a|wrestled to a|went to a|ended in a|font match nul|se neutralisent)/i;
const CUT = /\s+(?:et (?:conserve|remporte|devien|se qualifie|rejoi|décroche|gagne|s'empare|s’empare|garde|signe|avance|obtien)|en (?:demi|finale|quart|huiti|deux|trois|\d)|pour |par |après |dans |lors |grâce |au terme |malgré |avec |sur (?:un|une|décision|tapis|soumission|tombé|compte)|à (?:l'issue|l’issue|la suite)|by |via |to (?:retain|win|become|earn|qualify|advance|capture|claim|keep|remain)|in (?=[a-z0-9])|after |following |when |with (?=[a-z])|at (?=[a-z0-9])|for (?:the|a) |and (?=[a-zà-ÿ])|et (?=[a-zà-ÿ]))|,\s+(?=[a-zà-ÿ])|\s*[;:—–]\s*|\s+-\s+|\s+puis\s+/; // sensible à la casse : un nom commence par une majuscule, une suite de phrase par une minuscule
const PREFIX = /^(?:in|at|on|during|after|before|après|lors|dans|en|au|pendant)\b[^,]*,\s*/i;
export function fromResult(line) {
  const s = String(line || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
  if (!s) return "";
  let m = s.match(R_DRAW_VS) || s.match(R_DRAW_AND), a, b;
  if (m) { a = m[1]; b = m[2]; }
  else {
    m = s.match(R_FR) || s.match(R_EN) || s.match(R_TITLE);
    if (!m) return "";
    a = m[1]; b = m[2].split(CUT)[0];
  }
  // « X, venue d'Evolve, a battu… » : on retire l'apposition ; « In a dark match, X defeated… » : on retire le début de phrase
  a = a.replace(PREFIX, "").replace(/,\s*[a-zà-ÿ][^,]*,/g, "").trim();
  b = b.trim();
  if (!a || !b || a.length > 110 || b.length > 110 || /\b(?:match|bagarre|segment)\b/i.test(a)) return "";
  const sides = [a, b].map(x => x.replace(/\s+and\s+/g, " et ").replace(/^["«“\s]+|["»”\s]+$/g, "")).sort((x, y) => N(x).localeCompare(N(y)));
  const t = sides[0] + " contre " + sides[1];
  return t.charAt(0).toUpperCase() + t.slice(1);
}
// Combats à noter sur la page highlights d'un show (sans doublon avec les vidéos et le match par match)
export function showFights(k, show, d, h, skip) {
  const seen = {}, out = [];
  (skip || []).forEach(t => { seen[mkey(k, t)] = 1; });
  const add = t => { if (!t || !fighters(t)) return; const key = mkey(k, t); if (seen[key]) return; seen[key] = 1; out.push(t); };
  const pr = S.P[k], ple = pr && (!show || show === "PLE") ? (pr.e || []).find(e => e.d === d) : null;
  if (ple && Array.isArray(ple.card)) ple.card.forEach(c => add(String(c).replace(/\s*\(c\)/gi, "")));
  ((h && h.res) || []).forEach(r => add(fromResult(r)));
  return out;
}

// Bouton « ☆ Noter » / « ★★★★ » à côté d'un combat
export function rateBtn(k, title, show, d) {
  if (!k || !title) return "";
  const h = S.user ? myMatchNote(k, title, d) : null;
  return '<button class="mratebtn' + (h ? " on" : "") + '" data-act="mrate" data-k="' + esc(k) + '" data-t="' + esc(title) + '" data-show="' + esc(show || "") + '" data-d="' + esc(okDay(d) ? d : "") + '" aria-label="' +
    (h ? "Ta note : " + (h.rating || 0) + " sur 5" : "Noter ce combat") + '">' + (h && h.rating ? stars(h.rating) : h ? ICON.check + " Vu" : "☆ Noter") + "</button>";
}

ACT.mrate = el => {
  if (!S.user) { toast("Connecte-toi pour noter les combats"); location.hash = "#/connexion"; return; }
  const ds = el.dataset, it = { k: ds.k, t: ds.t, show: ds.show || "", d: ds.d || "" };
  const had = myMatchNote(it.k, it.t, it.d);
  // match complet déjà noté depuis des highlights : on modifie cette note-là
  const id = had ? had.id : mid(it.k, it.t, it.d);
  let rating = had ? had.rating || 0 : 0, comment = had ? had.comment || "" : "";
  modal((box, close) => {
    const where = had && had.id !== mid(it.k, it.t, it.d) ? (had.show ? had.show + " · " : "") + (okDay(had.d) ? fmt(had.d) : "") : [it.show, okDay(it.d) ? fmt(it.d) : ""].filter(Boolean).join(" · ");
    box.innerHTML = "<h3>" + (had ? "Ta note" : "Noter ce combat") + '</h3><p class="sub">' + esc(it.t) + "<br>" + esc(it.k) + (where ? " · " + esc(where) : "") + "</p>" +
      '<div class="rate">' + [1, 2, 3, 4, 5].map(i => '<button type="button" class="' + (i <= rating ? "on" : "") + '" data-r="' + i + '" aria-label="' + i + ' étoile' + (i > 1 ? "s" : "") + '">' + ICON.star + "</button>").join("") + "</div>" +
      '<label class="fld">Ton avis (facultatif)<textarea id="mcom" maxlength="280" rows="3" placeholder="Le moment fort, ce que tu as pensé du match…">' + esc(comment) + "</textarea></label>" +
      '<button class="btn wide" data-ok>Enregistrer</button>' + (had ? '<button class="btn wide ghost" style="margin-top:10px" data-del>Retirer ma note</button>' : "");
    box.addEventListener("click", async e => {
      const r = e.target.closest("[data-r]");
      if (r) { rating = +r.dataset.r === rating ? 0 : +r.dataset.r; box.querySelectorAll(".rate button").forEach(b => b.classList.toggle("on", +b.dataset.r <= rating)); return; }
      try {
        if (e.target.closest("[data-ok]")) {
          comment = box.querySelector("#mcom").value.trim().slice(0, 280);
          const keep = had || {};
          await B.setSeen(S.user.uid, id, { title: String(had ? keep.title : it.t).slice(0, 150), k: it.k, show: String(had ? keep.show : it.show).slice(0, 40), d: had ? keep.d || "" : it.d, rating: rating, comment: comment });
          close(); toast(rating ? "Combat noté " + rating + "/5" : "Avis enregistré");
          const aid = S.user.uid + "_r_" + id;
          if (rating || comment) B.setActivity(aid, { uid: S.user.uid, kind: "mrate", k: it.k, show: String(had ? keep.show : it.show).slice(0, 40), d: had ? keep.d || "" : it.d,
            title: String(had ? keep.title : it.t).slice(0, 150), rating: rating, comment: comment.slice(0, 500), w: "", name: "" }).catch(() => {});
          else B.removeActivity(aid).catch(() => {});
        } else if (e.target.closest("[data-del]")) {
          await B.unsetSeen(S.user.uid, id); close(); toast("Note retirée");
          B.removeActivity(S.user.uid + "_r_" + id).catch(() => {});
        }
      } catch (err) { toast(errText(err)); }
    });
  });
};

// Où mène une note de l'historique (show vu ou combat noté) : page highlights du show, page du show,
// page d'archives de l'événement (générée depuis Wikipédia), sinon la vidéo du match complet
const enc = encodeURIComponent;
export const evQuery = (name, d) => (/\d/.test(name) || !okDay(d) ? name : name + " " + d.slice(0, 4));
export function noteTarget(h) {
  if (!h || !h.k) return null;
  const k = h.k, d = okDay(h.d) ? h.d : "", pr = S.P[k], weekly = !!(pr && pr.s && h.show && pr.s[h.show]);
  if (!isMatchNote(h)) {
    const sh = h.show || "PLE";
    if (d && hlOf(k, sh, d)) return { href: hlHref(k, sh, d) };
    if (weekly) return { href: "#/p/" + enc(k) + "/" + enc(h.show) };
    return pr ? { href: "#/p/" + enc(k) } : null;
  }
  if (d && pr) {
    if (weekly && hlOf(k, h.show, d)) return { href: hlHref(k, h.show, d) };
    if (hlOf(k, "PLE", d)) return { href: hlHref(k, "PLE", d) };
  }
  if (weekly) return { href: "#/p/" + enc(k) + "/" + enc(h.show) };
  if (h.show) return { href: "#/evenement/" + enc(evQuery(h.show, d)) };
  const L = matchLinks(k, h.title, h.d);
  return L.full ? { play: L.full } : null;
}
// Titre cliquable (lien ou bouton vidéo)
export function noteTitle(h, label) {
  const t = noteTarget(h);
  if (!t) return label;
  if (t.play) return '<button class="histlink" data-act="play" data-id="' + esc(t.play.id) + '" data-t="' + esc(t.play.t) + '">' + label + "</button>";
  return '<a class="histlink" href="' + esc(t.href) + '">' + label + "</a>";
}

// Ligne d'un combat noté dans l'historique : liens vers le match complet, la vidéo, le résumé
export function matchNoteLinks(h) {
  const L = matchLinks(h.k, h.title, h.d), b = [];
  if (L.full) b.push('<button class="chip" data-act="play" data-id="' + esc(L.full.id) + '" data-t="' + esc(L.full.t) + '">▶ Match complet</button>');
  if (L.hl && (!L.full || L.hl.id !== L.full.id)) b.push('<button class="chip" data-act="play" data-id="' + esc(L.hl.id) + '" data-t="' + esc(L.hl.t) + '">▶ Highlights</button>');
  if (L.sum) b.push('<a class="chip" href="' + esc(L.sum.href) + '">Résumé · ' + esc(L.sum.label) + "</a>");
  return b.length ? '<span class="chips mlinks">' + b.join("") + "</span>" : "";
}
