// Amis, feuds 🔥, blocages et signalements : état dérivé + actions des boutons
import { S, B, ACT, changed, nameOf, need } from "./state.js";
import { esc, modal, toast } from "./util.js";
import { parisDay, parisHour } from "./time.js";
import { feudCount } from "./feud.js";
import { errText } from "./views/account.js";

export const pairOf = (a, b) => [a, b].sort().join("_");
const me = () => S.user && S.user.uid;
const otherIn = f => f.members[0] === me() ? f.members[1] : f.members[0];

// ---------- amis ----------
export function linkWith(uid) { return S.friends.find(f => f.members.indexOf(uid) >= 0) || null; }
// "none" | "out" (demande envoyée) | "in" (demande reçue) | "ok"
export function friendState(uid) {
  const f = linkWith(uid); if (!f) return "none";
  if (f.status === "ok") return "ok";
  return f.from === me() ? "out" : "in";
}
export function friendsOf(uid) {
  const list = S.user && uid === me() ? S.friends : (S.memberFriends[uid] || []);
  return list.filter(f => f.status === "ok").map(f => f.members[0] === uid ? f.members[1] : f.members[0]).filter(u => !isBlocked(u));
}
export function requestsIn() { return S.friends.filter(f => f.status === "pending" && f.from !== me() && !isBlocked(otherIn(f))); }

// ---------- feuds ----------
export function feudWith(uid) { return S.feuds.find(f => f.members.indexOf(uid) >= 0) || null; }
export function feudInfo(uid) {
  const f = feudWith(uid), day = parisDay(), m = me();
  const count = feudCount(f, day), days = (f && f.days) || {};
  const mine = days[m] === day, theirs = days[uid] === day;
  // ⏳ le soir (à partir de 18 h, heure de Paris) si la feud du jour n'est pas faite des deux côtés
  return { f: f, count: count, best: (f && f.best) || 0, mine: mine, theirs: theirs, hourglass: (count > 0 || mine || theirs) && !(mine && theirs) && parisHour() >= 18 };
}
export function feudsToReturn() {
  const day = parisDay();
  return S.feuds.filter(f => { const o = otherIn(f); return !isBlocked(o) && f.days[o] === day && f.days[me()] !== day; });
}
export function feudBadge(uid, big) {
  const i = feudInfo(uid);
  if (!i.count && !i.hourglass) return "";
  return '<span class="feudpill' + (big ? " big" : "") + '" title="Jours de feud d’affilée">🔥 ' + i.count + (i.hourglass ? ' <span class="hg" title="Pense à la feud du jour avant minuit">⏳</span>' : "") + "</span>";
}

// ---------- blocages ----------
export function isBlocked(uid) { return S.blocks.indexOf(uid) >= 0; }

// Badge de l'onglet Membres : demandes d'amis + feuds à renvoyer
export function socialBadge() { return S.user ? requestsIn().length + feudsToReturn().length : 0; }

// ---------- actions ----------
function needUser() { if (S.user) return true; toast("Connecte-toi d’abord"); location.hash = "#/connexion"; return false; }
async function run(p, ok) { try { const r = await p; if (ok) toast(typeof ok === "function" ? ok(r) : ok); return r; } catch (e) { console.error(e); toast(errText(e)); } }
export function confirmBox(title, sub, okLabel, onOk, danger) {
  modal((box, close) => {
    box.innerHTML = "<h3>" + esc(title) + "</h3>" + (sub ? '<p class="sub">' + esc(sub) + "</p>" : "") +
      '<button class="btn wide' + (danger ? " danger" : "") + '" data-ok>' + esc(okLabel) + '</button><button class="btn wide ghost" style="margin-top:10px" data-no>Annuler</button>';
    box.addEventListener("click", e => { if (e.target.closest("[data-ok]")) { close(); onOk(); } else if (e.target.closest("[data-no]")) close(); });
  });
}

ACT.friendadd = el => {
  if (!needUser()) return;
  const uid = el.dataset.uid, st = friendState(uid);
  if (st === "in") return ACT.friendok(el);
  if (st !== "none") return;
  run(B.requestFriend(me(), uid), "Demande envoyée à " + nameOf(uid));
};
ACT.friendok = el => { const uid = el.dataset.uid; run(B.acceptFriend(pairOf(me(), uid)), "🤝 Vous êtes maintenant amis"); };
ACT.frienddel = el => {
  const uid = el.dataset.uid, st = friendState(uid), id = pairOf(me(), uid);
  if (st === "ok") confirmBox("Retirer " + nameOf(uid) + " de tes amis ?", "", "Retirer", () => run(B.removeFriend(id), "Ami retiré"), true);
  else run(B.removeFriend(id), st === "in" ? "Demande refusée" : "Demande annulée");
};

ACT.feud = el => {
  if (!needUser()) return;
  const uid = el.dataset.uid, i = feudInfo(uid), name = nameOf(uid);
  if (i.mine) { toast(i.theirs ? "🔥 Feud du jour faite des deux côtés !" : "Tu as déjà lancé ta feud aujourd’hui. À " + name + " de répondre !"); return; }
  const sub = i.theirs ? name + " t’a lancé une feud aujourd’hui. Renvoie-la pour faire monter le compteur !"
    : "Une feud par jour : le compteur monte quand vous la lancez tous les deux le même jour (avant minuit, heure de Paris).";
  confirmBox("Vous voulez lancer une feud ?", sub, "🔥 Lancer la feud", () => run(B.sendFeud(me(), uid, parisDay()), r => {
    if (!r) return "Feud déjà lancée aujourd’hui";
    return r.countDay === parisDay() ? "🔥 " + r.count + " jour" + (r.count > 1 ? "s" : "") + " de feud avec " + name + " !" : "🔥 Feud lancée ! À " + name + " de répondre avant minuit";
  }));
};

ACT.block = el => {
  const uid = el.dataset.uid, name = nameOf(uid);
  if (isBlocked(uid)) { run(B.setBlocks(me(), S.blocks.filter(x => x !== uid)), name + " est débloqué"); return; }
  confirmBox("Bloquer " + name + " ?", "Tu ne verras plus ses messages et il ou elle ne pourra plus t’écrire, t’ajouter en ami ni te lancer de feud.", "Bloquer", async () => {
    await run(B.setBlocks(me(), S.blocks.concat([uid])), name + " est bloqué");
    if (linkWith(uid)) B.removeFriend(pairOf(me(), uid)).catch(() => {});
  }, true);
};

const REASONS = ["Insultes ou harcèlement", "Spam ou arnaque", "Contenu choquant", "Faux profil", "Autre"];
// data-uid = membre visé ; facultatif : data-conv, data-msg, data-text (message signalé)
ACT.report = el => {
  if (!needUser()) return;
  const d = el.dataset, name = nameOf(d.uid);
  let reason = "";
  modal((box, close) => {
    box.innerHTML = "<h3>Signaler " + (d.msg ? "ce message" : esc(name)) + "</h3>" + (d.text ? '<p class="sub"><q class="mycom" style="text-align:left">' + esc(d.text.slice(0, 200)) + "</q></p>" : '<p class="sub">Le signalement est envoyé à l’admin de l’app, de façon anonyme pour le membre.</p>') +
      '<div class="levels">' + REASONS.map(r => '<button type="button" class="lvl" data-r="' + esc(r) + '">' + esc(r) + "</button>").join("") + "</div>" +
      '<label class="fld">Précisions (facultatif)<textarea id="reptxt" maxlength="500" rows="3"></textarea></label><p class="err" id="reperr"></p>' +
      '<button class="btn wide" data-send>Envoyer le signalement</button><button class="btn wide ghost" style="margin-top:10px" data-no>Annuler</button>';
    box.addEventListener("click", async e => {
      const r = e.target.closest("[data-r]");
      if (r) { reason = r.dataset.r; box.querySelectorAll("[data-r]").forEach(b => b.classList.toggle("on", b === r)); return; }
      if (e.target.closest("[data-no]")) return close();
      if (e.target.closest("[data-send]")) {
        if (!reason) { box.querySelector("#reperr").textContent = "Choisis un motif"; return; }
        const ok = await run(B.report(me(), { target: d.uid || "", reason: reason, text: box.querySelector("#reptxt").value.trim().slice(0, 500), conv: d.conv || "", msg: d.msg || "", msgText: (d.text || "").slice(0, 1000) }).then(() => true));
        if (ok) { close(); toast("Merci, ton signalement a été envoyé"); }
      }
    });
  });
};

// Menu « ··· » d'un membre
ACT.membermenu = el => {
  const uid = el.dataset.uid, name = nameOf(uid), st = friendState(uid);
  modal((box, close) => {
    box.innerHTML = "<h3>" + esc(name) + '</h3><div class="sheet">' +
      (st === "ok" ? '<button class="item" data-a="frienddel">Retirer de mes amis</button>' : "") +
      '<button class="item" data-a="block">' + (isBlocked(uid) ? "Débloquer" : "Bloquer") + "</button>" +
      '<button class="item danger" data-a="report">Signaler</button></div><button class="btn wide ghost" style="margin-top:12px" data-no>Fermer</button>';
    box.addEventListener("click", e => {
      const a = e.target.closest("[data-a]");
      if (a) { close(); ACT[a.dataset.a]({ dataset: { uid: uid } }); }
      else if (e.target.closest("[data-no]")) close();
    });
  });
};

// ---------- notifications dans l'app (demandes d'amis, feuds reçues) ----------
let fInit = false, feInit = false;
const seenReq = {}, seenOk = {}, seenFeud = {};
export function resetSocial() { fInit = false; feInit = false; }
export function onFriends(list) {
  const m = me();
  list.forEach(f => {
    const o = f.members[0] === m ? f.members[1] : f.members[0]; need(o);
    if (fInit && f.status === "pending" && f.from !== m && !seenReq[f.id] && !isBlocked(o))
      later(() => toast("👋 " + nameOf(o) + " veut être ton ami", { top: true, ms: 6000, onClick: () => { location.hash = "#/membres/demandes"; } }));
    if (fInit && f.status === "ok" && f.from === m && !seenOk[f.id] && seenReq[f.id] === "out")
      later(() => toast("🤝 " + nameOf(o) + " a accepté ta demande d’ami", { top: true, ms: 5000, onClick: () => { location.hash = "#/profil/" + encodeURIComponent(o); } }));
    seenReq[f.id] = f.status === "pending" ? (f.from === m ? "out" : "in") : "ok";
    if (f.status === "ok") seenOk[f.id] = 1;
  });
  fInit = true;
  S.friends = list; changed("friends");
}
export function onFeuds(list) {
  const m = me(), day = parisDay();
  list.forEach(f => {
    const o = f.members[0] === m ? f.members[1] : f.members[0]; need(o);
    const theirs = f.days && f.days[o];
    if (feInit && theirs === day && seenFeud[f.id] !== day && !isBlocked(o)) {
      const mine = f.days[m] === day;
      later(() => toast(mine ? "🔥 " + nameOf(o) + " a renvoyé la feud : " + feudCount(f, day) + " jour" + (feudCount(f, day) > 1 ? "s" : "") + " d’affilée !"
        : "🔥 " + nameOf(o) + " t’a lancé une feud ! Renvoie-la avant minuit", { top: true, ms: 6000, onClick: () => { location.hash = "#/profil/" + encodeURIComponent(o); } }));
    }
    seenFeud[f.id] = theirs || "";
  });
  feInit = true;
  S.feuds = list; changed("feuds");
}
// laisse le temps au pseudo d'arriver avant d'afficher la notification
function later(f) { setTimeout(f, 400); }
