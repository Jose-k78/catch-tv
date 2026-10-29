// Annonces du modérateur : publiées dans l'app (cloche 🔔 et bandeau de l'accueil pendant 7 jours)
// et envoyées en notification sur le téléphone de tous les membres qui les ont activées.
import { S, B, ACT, FORM, changed } from "../state.js";
import { esc, toast, timeLabel, lsGet, lsSet } from "../util.js";
import { pushPing, pushUrl } from "../push.js";
import { allPle, evHref } from "./catalog.js";

const okLink = h => typeof h === "string" && (/^#\/[^\s"<>]{0,200}$/.test(h) || /^https:\/\/[^\s"<>]{4,300}$/.test(h));
const ext = h => /^https:/.test(h) ? ' target="_blank" rel="noopener"' : "";
const dismissed = () => { try { return JSON.parse(lsGet("ctv.annx") || "[]"); } catch (e) { return []; } };
export const annList = () => (S.ann || []).filter(a => a && a.id && a.t);

// bandeau de l'accueil : la dernière annonce de moins de 7 jours (fermable)
export function annBar() {
  const a = annList()[0]; if (!a || Date.now() - (a.at || 0) > 7 * 864e5 || dismissed().indexOf(a.id) >= 0) return "";
  return '<div class="annbar"><span class="annico">📣</span><span class="anntxt"><b>' + esc(a.t) + "</b>" + (a.x ? "<small>" + esc(a.x) + "</small>" : "") + "</span>" +
    (okLink(a.h) ? '<a class="btn small" href="' + esc(a.h) + '"' + ext(a.h) + ">Voir</a>" : "") +
    '<button class="ibx" data-act="annx" data-id="' + esc(a.id) + '" aria-label="Fermer">×</button></div>';
}
ACT.annx = el => { const d = dismissed(); d.unshift(el.dataset.id); lsSet("ctv.annx", JSON.stringify(d.slice(0, 30))); changed("ann"); };
// dans la page des notifications
export function annSection() {
  const list = annList().slice(0, 5); if (!list.length) return "";
  return '<h2 style="margin-top:6px">📣 Annonces</h2><div class="convs">' + list.map(a => '<a class="conv-item' + (a.at > ((S.reads && S.reads.notifs) || 0) ? " unread" : "") + '" href="' + esc(okLink(a.h) ? a.h : "#/notifs") + '"' + (okLink(a.h) ? ext(a.h) : "") + '>' +
    '<span class="av grpav" style="width:44px;height:44px;font-size:22px">📣</span><span class="mid"><b>' + esc(a.t) + "</b>" + (a.x ? "<small>" + esc(a.x) + "</small>" : "") + '</span><span class="end">' + esc(timeLabel(a.at)) + "</span></a>").join("") + "</div>";
}
export const annUnread = () => annList().filter(a => a.at > ((S.reads && S.reads.notifs) || 0) && !(S.user && a.by === S.user.uid)).length;

// ---------- Modération › Faire une annonce ----------
function linkOptions() {
  const up = allPle().filter(e => e.d && e.d >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.d.localeCompare(b.d))[0];
  return [["", "Aucun lien"], ["#/", "Accueil"], ["#/sondages", "Sondages"], ["#/pronostics", "Pronostics"], ["#/storyline", "Storyline du jour"], ["#/matchs", "Matchs à découvrir"], ["#/idees", "Partagez vos idées"]]
    .concat(up ? [[evHref(up), "Prochain PLE : " + up.t]] : []).concat([["autre", "Autre lien…"]]);
}
export function adminAnnView() {
  let h = '<h1>📣 Faire une annonce</h1><p class="note" style="margin-bottom:12px">Elle apparaît chez tous les membres (cloche 🔔 et bandeau de l’accueil pendant 7 jours) et part en notification sur leur téléphone.</p>' +
    '<form class="pform annform" data-form="annsend"><label class="fld">Titre<input name="t" maxlength="60" required placeholder="Soirée spéciale Crown Jewel !"></label>' +
    '<label class="fld">Texte<textarea name="x" maxlength="300" rows="3" placeholder="Rendez-vous samedi soir dans la Gorilla Position pour vivre le show ensemble."></textarea></label>' +
    '<label class="fld">Lien (facultatif)<select name="l">' + linkOptions().map(o => '<option value="' + esc(o[0]) + '">' + esc(o[1]) + "</option>").join("") + "</select></label>" +
    '<label class="fld" id="annother" hidden>Autre lien<input name="o" maxlength="300" placeholder="#/p/WWE ou https://…"></label>' +
    '<button class="btn wide">Publier et envoyer à tous les membres</button></form>';
  const list = annList();
  h += "<h2>Historique</h2>" + (list.length ? '<div class="list">' + list.map(a => '<div class="item"><span class="lbl"><b>' + esc(a.t) + "</b><small>" + esc(a.x || "") + (a.h ? " · " + esc(a.h) : "") + " · " + esc(timeLabel(a.at)) + "</small></span>" +
    '<button class="btn small ghost" data-act="anndel" data-id="' + esc(a.id) + '">Supprimer</button></div>').join("") + "</div>" : '<p class="note">Aucune annonce pour l’instant.</p>');
  return h;
}
document.addEventListener("change", e => { if (e.target.name === "l" && e.target.closest(".annform")) { const o = document.getElementById("annother"); if (o) o.hidden = e.target.value !== "autre"; } });
FORM.annsend = async f => {
  if (!S.isAdmin) return;
  const t = f.t.value.trim().slice(0, 60), x = f.x.value.trim().slice(0, 300);
  let h = f.l.value === "autre" ? f.o.value.trim() : f.l.value;
  if (!t) { toast("Écris un titre"); return; }
  if (h && !okLink(h)) { toast("Lien invalide : #/… (page de l’app) ou https://…"); return; }
  const btn = f.querySelector("button"); btn.disabled = true;
  try {
    const id = await B.addAnnonce(S.user.uid, { t: t, x: x, h: h || "" });
    f.reset();
    toast("📣 Annonce publiée dans l’app");
    if (await pushUrl()) { const r = await pushPing({ type: "ann", id: id }); toast(r && r.sent != null ? "📣 Envoyée sur " + r.sent + " téléphone" + (r.sent > 1 ? "s" : "") : "Annonce publiée, mais l’envoi des notifications a échoué" + (r && r.error ? " (" + r.error + ")" : ""), { ms: 5000 }); }
    else toast("Annonce publiée dans l’app (les notifications ne sont pas encore installées)", { ms: 5000 });
  } catch (e) { toast(e && e.code === "permission-denied" ? "Refusé par Firebase : publie d’abord les règles v8" : "Publication impossible"); }
  btn.disabled = false;
};
ACT.anndel = async el => { try { await B.deleteAnnonce(el.dataset.id); toast("Annonce supprimée"); } catch (e) { toast("Suppression impossible"); } };
