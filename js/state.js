// État global de l'app + petits helpers partagés par les vues
import { esc, ICON, okImg, docId } from "./util.js";

export const S = {
  P: {},                 // promotions (calendrier)
  news: { items: [], updated: "" },
  recaps: {},            // résumés des épisodes (clé "promo|show|date")
  user: null,            // {uid,email,providers}
  profile: null,         // mon profil
  profiles: {},          // cache des profils publics (uid -> profil | null)
  history: {},           // mon historique (id -> item)
  otherHistory: {},      // historique d'autres membres (uid -> [items])
  images: {},            // images des vignettes (id -> src)
  free: {},              // photos libres trouvées (requête -> {src, author, lic, link})
  matches: [],           // matchs à revoir (vidéos officielles)
  titles: [],            // titres et champions actuels
  titlesUpdated: "",
  room: [],              // messages du salon
  convs: [],             // mes conversations privées
  convMsgs: {},          // messages des conversations ouvertes
  reads: {},             // { general: ms }
  highlights: {},        // vidéos + résultats (clé "promo|show|date")
  wrestlers: {},         // fiches des catcheurs suivis (matchs de référence, derniers matchs, actu)
  friends: [],           // mes liens d'amitié {id, members, from, status}
  feuds: [],             // mes feuds {id, members, days, count, countDay, best}
  blocks: [],            // membres que j'ai bloqués
  reports: [],           // signalements (admin)
  memberFriends: {},     // amis d'un autre membre (uid -> [liens])
  users: null,           // liste des membres
  wcomments: {},         // commentaires des fiches catcheurs (slug -> [commentaires])
  notifs: [],            // mes notifications (likes, réponses)
  activity: [],          // activité des membres (notes, commentaires)
  storylines: [],        // storylines du jour (la plus récente en premier)
  rosters: {},           // rosters par promotion et par show / division
  rostersSrc: {},
  isAdmin: false,
  demo: false,
  authReady: false,
};

export let B = null;                       // backend actif (firebase ou démo)
export function setBackend(b) { B = b; }

export const ACT = {};                     // actions des boutons (data-act)
export const FORM = {};                    // formulaires (data-form)

const listeners = new Set();
export function onChange(f) { listeners.add(f); }
export function changed(what) { listeners.forEach(f => f(what)); }

// --- profils publics en cache ---
const profSubs = {};
export function need(uid) {
  if (!uid || profSubs[uid] || !B) return;
  profSubs[uid] = B.watchUser(uid, p => { S.profiles[uid] = p; changed("profiles"); });
}
export function prof(uid) {
  if (S.user && uid === S.user.uid && S.profile) return S.profile;
  need(uid);
  return S.profiles[uid] || null;
}
export function nameOf(uid) { const p = prof(uid); return (p && p.pseudo) || "Membre"; }

export function avatar(p, size, cls) {
  const st = "width:" + size + "px;height:" + size + "px";
  if (p && okImg(p.photo)) return '<img class="av ' + (cls || "") + '" style="' + st + '" src="' + esc(p.photo) + '" alt="">';
  const nm = (p && p.pseudo || "").trim();
  const ini = nm ? nm.split(/\s+/).map(w => w.charAt(0)).join("").slice(0, 2).toUpperCase() : "";
  return '<span class="av av0 ' + (cls || "") + '" style="' + st + ';font-size:' + Math.round(size * .38) + 'px">' + (ini ? esc(ini) : ICON.user) + "</span>";
}

export function imageFor(key) { const s = S.images[docId(key)]; return okImg(s) ? s : ""; }
