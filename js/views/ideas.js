// « Partagez vos idées » : les membres proposent des idées pour l'app et votent pour celles des autres ;
// l'admin les voit aussi dans Modération et leur donne un statut (prévu, fait, refusé).
import { S, B, ACT, FORM, avatar, prof, nameOf, need, changed } from "../state.js";
import { esc, ICON, timeLabel, toast, modal } from "../util.js";
import { errText } from "./account.js";

const ST = { "": "", "prévu": "🛠️ Prévu", "fait": "✅ Fait", "refusé": "✖️ Pas retenu" };
let sort = "top";
const list = () => (S.ideas || []).filter(i => S.blocks.indexOf(i.uid) < 0).slice().sort(sort === "top"
  ? (a, b) => (b.votes || []).length - (a.votes || []).length || b.at - a.at : (a, b) => b.at - a.at);

function ideaRow(i) {
  need(i.uid);
  const v = i.votes || [], on = S.user && v.indexOf(S.user.uid) >= 0, mine = S.user && i.uid === S.user.uid;
  return '<div class="idea' + (i.st ? " st-" + esc(i.st) : "") + '"><button class="ivote' + (on ? " on" : "") + '" data-act="ivote" data-id="' + esc(i.id) + '" aria-label="Voter pour cette idée">▲<b>' + v.length + "</b></button>" +
    '<div class="ibody"><p>' + esc(i.text) + "</p><small>" + avatar(prof(i.uid), 18) + " " + esc(nameOf(i.uid)) + " · " + esc(timeLabel(i.at)) + (i.st ? ' · <span class="ist">' + ST[i.st] + "</span>" : "") + "</small>" +
    (S.isAdmin ? '<div class="iadm">' + ["prévu", "fait", "refusé", ""].map(s => '<button class="chip' + (i.st === s ? " on" : "") + '" data-act="ist" data-id="' + esc(i.id) + '" data-st="' + s + '">' + (s ? ST[s] : "Sans statut") + "</button>").join("") + "</div>" : "") +
    (mine || S.isAdmin ? '<button class="linkbtn danger" data-act="idel" data-id="' + esc(i.id) + '">Supprimer</button>' : "") + "</div></div>";
}
export function ideasView() {
  const all = list();
  let h = '<a class="back" href="javascript:history.back()">' + ICON.back + " Retour</a><h1>Partagez vos idées</h1>" +
    '<p class="note small">Une idée pour améliorer TCC TV ? Propose-la et vote ▲ pour celles des autres. Les plus demandées passent en premier.</p>' +
    '<form class="ideaform" data-form="idea"><textarea name="t" maxlength="500" rows="3" required placeholder="Mon idée : …"></textarea><button class="btn">Proposer</button></form>' +
    '<div class="chips" style="margin:12px 0 6px"><button class="chip' + (sort === "top" ? " on" : "") + '" data-act="isort" data-s="top">Les plus votées</button><button class="chip' + (sort === "new" ? " on" : "") + '" data-act="isort" data-s="new">Les plus récentes</button></div>';
  return h + (all.length ? '<div class="ideas">' + all.map(ideaRow).join("") + "</div>" : '<p class="note">Pas encore d’idée. Lance-toi !</p>');
}
FORM.idea = async f => {
  const t = f.t.value.trim().replace(/\s+\n/g, "\n");
  if (t.length < 5) { toast("Décris ton idée en quelques mots"); return; }
  try { await B.addIdea(S.user.uid, t.slice(0, 500)); f.reset(); toast("Merci pour ton idée ✓"); } catch (e) { toast(errText(e)); }
};
ACT.ivote = async el => {
  if (!S.user) return;
  const i = (S.ideas || []).find(x => x.id === el.dataset.id); if (!i) return;
  const on = (i.votes || []).indexOf(S.user.uid) < 0;
  try { await B.voteIdea(i.id, S.user.uid, on); } catch (e) { toast(errText(e)); }
};
ACT.isort = el => { sort = el.dataset.s; changed("ideas"); };
ACT.ist = async el => { if (!S.isAdmin) return; try { await B.setIdeaStatus(el.dataset.id, el.dataset.st); } catch (e) { toast(errText(e)); } };
ACT.idel = el => {
  modal((box, close) => {
    box.innerHTML = '<h3>Supprimer cette idée ?</h3><button class="btn wide danger" data-ok>Supprimer</button><button class="btn wide ghost" data-close>Annuler</button>';
    box.addEventListener("click", async ev => {
      if (ev.target.closest("[data-close]")) return close();
      if (!ev.target.closest("[data-ok]")) return;
      close();
      try { await B.deleteIdea(el.dataset.id); toast("Idée supprimée"); } catch (e) { toast(errText(e)); }
    });
  });
};
