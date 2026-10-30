// Connexion / inscription, paramètres du compte, page de profil
import { S, B, ACT, FORM, prof, avatar, changed } from "../state.js";
import { esc, toast, fmt, fmtMs, ICON, stars, lsGet, lsSet, fileToDataUrl, modal } from "../util.js";
import { showOptions, logoOf } from "./catalog.js";
import { docId, okHttp } from "../util.js";
import { cleanImageUrl } from "../modals.js";
import { ADMIN_UID } from "../config.js";
import { friendState, friendsOf, feudInfo, feudBadge, isBlocked, requestsIn, feudLabel, myFeudAct, theirFeudAct } from "../social.js";
import { favChips } from "./favs.js";
import { photoOf } from "../photos.js";
import { patchView, patchModView, pnNew } from "./patchnotes.js";
import { noSpoil, setNoSpoil } from "../spoil.js";
import { isMatchNote, matchNoteLinks, noteTitle } from "./mrate.js";
import { sourcesView, statusView, mediaView, pushGuideView } from "./admin.js";
import { notifSettingsView, pushOnHere, pushReady } from "../push.js";
import { adminAnnView, annList } from "./annonces.js";
import { introMode, INTRO } from "../intro.js";
import { showcase } from "./trophies.js";
import { cropImage } from "../crop.js";

const ERR = {
  "auth/invalid-email": "Adresse e-mail invalide",
  "auth/missing-email": "Entre ton adresse e-mail",
  "auth/email-already-in-use": "Un compte existe déjà avec cette adresse",
  "auth/weak-password": "Mot de passe trop court (6 caractères minimum)",
  "auth/missing-password": "Entre ton mot de passe",
  "auth/invalid-credential": "E-mail ou mot de passe incorrect",
  "auth/wrong-password": "E-mail ou mot de passe incorrect",
  "auth/user-not-found": "E-mail ou mot de passe incorrect",
  "auth/too-many-requests": "Trop de tentatives, réessaie dans quelques minutes",
  "auth/popup-closed-by-user": "Connexion Google annulée",
  "auth/cancelled-popup-request": "Connexion Google annulée",
  "auth/popup-blocked": "La fenêtre Google a été bloquée par le navigateur",
  "auth/network-request-failed": "Problème de connexion internet",
  "auth/requires-recent-login": "Reconnecte-toi puis réessaie",
  "auth/unauthorized-domain": "Ce site n’est pas encore autorisé dans Firebase (voir le guide)",
  "auth/operation-not-allowed": "Ce mode de connexion n’est pas activé dans Firebase (voir le guide)",
  "permission-denied": "Action non autorisée",
  "demo/google": "La connexion Google marchera une fois Firebase installé",
  "demo/reset": "Disponible une fois Firebase installé",
  "demo/quota": "Espace de la démo plein (image trop lourde ?)",
};
export function errText(e) { return (e && ERR[e.code]) || "Une erreur est survenue" + (e && e.code ? " (" + e.code + ")" : ""); }
const field = (id, label, attrs) => '<label class="fld">' + label + '<input id="' + id + '" ' + attrs + "></label>";

// ---------------- connexion ----------------
export function authView(mode) {
  let h = '<a class="back" href="#/">' + ICON.back + " Accueil</a><h1>" + (mode === "oubli" ? "Mot de passe oublié" : "Mon compte") + "</h1>";
  if (mode === "oubli") {
    return h + '<form data-form="reset"><p class="note" style="margin-bottom:14px">Entre ton e-mail, tu recevras un lien pour choisir un nouveau mot de passe.</p>' +
      field("a_email", "E-mail", 'type="email" autocomplete="email" required') + '<p class="err" id="ferr"></p><button class="btn wide">Envoyer le lien</button></form>' +
      '<p style="text-align:center"><a class="linkbtn" href="#/connexion">Retour à la connexion</a></p>';
  }
  h += '<div class="seg"><a href="#/connexion" class="' + (mode !== "inscription" ? "on" : "") + '">Connexion</a><a href="#/inscription" class="' + (mode === "inscription" ? "on" : "") + '">Inscription</a></div>';
  if (mode === "inscription") {
    h += '<form data-form="signup">' + field("a_pseudo", "Pseudo", 'maxlength="30" autocomplete="nickname" required') +
      field("a_email", "E-mail", 'type="email" autocomplete="email" required') +
      field("a_pass", "Mot de passe (6 caractères minimum)", 'type="password" autocomplete="new-password" minlength="6" required') +
      field("a_pass2", "Confirmer le mot de passe", 'type="password" autocomplete="new-password" minlength="6" required') +
      '<p class="err" id="ferr"></p><button class="btn wide">Créer mon compte</button></form>';
  } else {
    h += '<form data-form="signin">' + field("a_email", "E-mail", 'type="email" autocomplete="email" required') +
      field("a_pass", "Mot de passe", 'type="password" autocomplete="current-password" required') +
      '<p class="err" id="ferr"></p><button class="btn wide">Se connecter</button></form>' +
      '<p style="text-align:center"><a class="linkbtn" href="#/oubli">Mot de passe oublié ?</a></p>';
  }
  h += '<div class="sep">ou</div><button class="btn wide google" data-act="google">Continuer avec Google</button>';
  if (S.demo) h += '<div class="demo">Mode démo : les comptes sont enregistrés seulement dans ce navigateur. Le premier compte créé est l’admin.</div>';
  return h;
}
function ferr(t) { const e = document.getElementById("ferr"); if (e) e.textContent = t; }
const v = id => { const e = document.getElementById(id); return e ? e.value.trim() : ""; };
async function busy(f, fn) {
  const b = f.querySelector("button:not([type=button])"); if (b) b.disabled = true;
  try { await fn(); } catch (e) { ferr(errText(e)); } finally { if (b) b.disabled = false; }
}
FORM.signin = f => busy(f, async () => { await B.signIn(v("a_email"), document.getElementById("a_pass").value); location.hash = "#/profil"; });
FORM.signup = f => busy(f, async () => {
  const p1 = document.getElementById("a_pass").value;
  if (!v("a_pseudo")) { ferr("Choisis un pseudo"); return; }
  if (p1 !== document.getElementById("a_pass2").value) { ferr("Les deux mots de passe ne correspondent pas"); return; }
  await B.signUp(v("a_email"), p1, v("a_pseudo")); toast("Bienvenue !"); location.hash = "#/profil";
});
FORM.reset = f => busy(f, async () => { await B.resetPassword(v("a_email")); toast("E-mail envoyé, regarde ta boîte de réception"); location.hash = "#/connexion"; });
ACT.google = async () => { try { await B.signInGoogle(); location.hash = "#/profil"; } catch (e) { ferr(errText(e)); toast(errText(e)); } };

// ---------------- paramètres ----------------
const TH = { auto: "Automatique", light: "Clair", dark: "Sombre" };
export function applyTheme() { const t = lsGet("ctv.theme"), r = document.documentElement; if (t === "light" || t === "dark") r.setAttribute("data-theme", t); else r.removeAttribute("data-theme"); }

export function settingsView(sub) {
  const u = S.user, google = u.providers.indexOf("password") < 0 && !S.demo;
  let h = '<a class="back" href="#/profil">' + ICON.back + " Mon profil</a>";
  if (sub === "email") {
    return h + "<h1>Adresse e-mail</h1>" + (google ? '<p class="note">Tu es connecté avec Google : ton e-mail se change depuis ton compte Google.</p>' :
      '<form data-form="email"><p class="note" style="margin-bottom:14px">Actuelle : ' + esc(u.email) + "</p>" + field("s_email", "Nouvelle adresse", 'type="email" autocomplete="email" required') +
      field("s_pass", "Mot de passe actuel", 'type="password" autocomplete="current-password" required') + '<p class="err" id="ferr"></p><button class="btn wide">Changer mon e-mail</button></form>');
  }
  if (sub === "motdepasse") {
    return h + "<h1>Mot de passe</h1>" + (google ? '<p class="note">Tu es connecté avec Google : pas de mot de passe à gérer ici.</p>' :
      '<form data-form="pass">' + field("s_cur", "Mot de passe actuel", 'type="password" autocomplete="current-password" required') +
      field("s_new", "Nouveau mot de passe", 'type="password" autocomplete="new-password" minlength="6" required') +
      field("s_new2", "Confirmer le nouveau mot de passe", 'type="password" autocomplete="new-password" minlength="6" required') +
      '<p class="err" id="ferr"></p><button class="btn wide">Changer mon mot de passe</button></form>');
  }
  if (sub === "supprimer") {
    return h + '<h1>Supprimer mon compte</h1><div class="lockbox" style="margin:0 16px 14px;text-align:left;align-items:flex-start"><b>⚠️ C’est définitif</b><p>Ton compte et toutes tes données seront effacés et ne pourront pas être récupérés :</p>' +
      '<ul class="dellist"><li>ton profil, ta photo et ta description</li><li>ton historique « déjà vu » et tes notes</li><li>tes favoris, tes amis et tes feuds</li><li>tes commentaires, tes likes et ton activité</li><li>tes notifications et tes messages (Gorilla Position et messages privés)</li></ul></div>' +
      '<form data-form="delacc">' + (google ? '<p class="note" style="margin-bottom:12px">Tu es connecté avec Google : une fenêtre Google va s’ouvrir pour confirmer que c’est bien toi.</p>'
        : field("d_pass", "Ton mot de passe (pour confirmer)", 'type="password" autocomplete="current-password" required')) +
      '<label class="chk"><input type="checkbox" id="d_ok"> Je comprends que tout sera supprimé définitivement</label>' +
      '<p class="err" id="ferr"></p><button class="btn wide danger">Supprimer définitivement mon compte</button></form>';
  }
  if (sub === "spoiler") {
    const on = noSpoil();
    return h + '<h1>Mode sans spoiler</h1><p class="note" style="margin-bottom:14px">Cache les champions couronnés récemment, les résultats et les highlights tant que tu n’as pas marqué le show comme vu (bouton œil). Réglage enregistré sur cet appareil.</p>' +
      '<div class="list"><button class="item" data-act="nospoil" data-v="1"><span class="lbl"><b>Activé</b><small>Je veux tout découvrir en regardant</small></span><span class="chev">' + (on ? "✓" : "") + "</span></button>" +
      '<button class="item" data-act="nospoil" data-v="0"><span class="lbl"><b>Désactivé</b><small>Les résultats restent quand même derrière le bouton « spoiler »</small></span><span class="chev">' + (on ? "" : "✓") + "</span></button></div>";
  }
  if (sub === "bloques") {
    return h + "<h1>Membres bloqués</h1>" + (S.blocks.length ? '<div class="list">' + S.blocks.map(uid => '<div class="item"><span class="lbl favfriend">' + avatar(prof(uid), 32) + "<b>" + esc((prof(uid) || {}).pseudo || "Membre") +
      '</b></span><button class="btn small ghost" data-act="block" data-uid="' + esc(uid) + '">Débloquer</button></div>').join("") + "</div>" : '<p class="note">Tu n’as bloqué personne.</p>');
  }
  if (sub === "signalements" && S.isAdmin) {
    return h + "<h1>Signalements</h1>" + (S.reports.length ? '<div class="list">' + S.reports.map(r => '<div class="item rep"><span class="lbl"><b>' + esc(r.reason || "Signalement") + "</b><small>" +
      "Par " + esc((prof(r.by) || {}).pseudo || "un membre") + " · visé : " + (r.target ? '<a href="#/profil/' + encodeURIComponent(r.target) + '">' + esc((prof(r.target) || {}).pseudo || "membre") + "</a>" : "–") + (r.at ? " · " + fmtMs(r.at) : "") + "</small>" +
      (r.msgText ? '<q class="mycom">' + esc(r.msgText) + "</q>" : "") + (r.text ? '<small>« ' + esc(r.text) + " »</small>" : "") + '</span><span class="repbtns">' +
      (r.msg ? '<button class="btn small" data-act="repdelmsg" data-id="' + esc(r.id) + '">Supprimer le message</button>' : "") +
      (String(r.conv || "").indexOf("wimg:") === 0 ? '<button class="btn small" data-act="repdelimg" data-id="' + esc(r.id) + '">Supprimer l’image</button>' : "") +
      '<button class="btn small ghost" data-act="repdone" data-id="' + esc(r.id) + '">Classer</button></span></div>').join("") + "</div>" : '<p class="note">Aucun signalement. 👍</p>');
  }
  if (sub === "logos" && S.isAdmin) {
    const rows = [];
    Object.keys(S.P).forEach(k => { rows.push([k, ""]); Object.keys(S.P[k].s || {}).forEach(n => rows.push([k, n])); });
    return h + '<h1>Logos des onglets</h1><p class="note" style="margin-bottom:14px">Le logo remplace le nom dans les onglets en haut de l’accueil (promotions) et des pages promotion (shows). Une image PNG au fond transparent ou blanc rend le mieux.</p>' +
      '<div class="list">' + rows.map(r => {
        const lg = logoOf(r[0], r[1]), own = S.images[docId("logo:" + r[0] + (r[1] ? "|" + r[1] : ""))];
        return '<div class="item logorow"><span class="lbl"><b>' + esc(r[1] ? r[0] + " · " + r[1] : r[0]) + "</b><small>" + (own ? "Logo choisi par toi" : lg ? "Logo par défaut" : "Nom écrit (pas de logo)") + "</small></span>" +
          (lg ? '<span class="logoprev"><img src="' + esc(lg) + '" alt=""></span>' : "") +
          '<span class="repbtns"><button class="btn small" data-act="logoset" data-k="' + esc(r[0]) + '" data-n="' + esc(r[1]) + '">' + (lg ? "Changer" : "Ajouter") + "</button>" +
          (own ? '<button class="btn small ghost" data-act="logodel" data-k="' + esc(r[0]) + '" data-n="' + esc(r[1]) + '">Retirer</button>' : "") + "</span></div>";
      }).join("") + "</div>";
  }
  if (sub === "sources" && S.isAdmin) return h + sourcesView();
  if (sub === "etat" && S.isAdmin) return h + statusView();
  if (sub === "medias" && S.isAdmin) return h + mediaView();
  if (sub === "notifs") return h + notifSettingsView();
  if (sub === "patchnotes") return h + patchView();
  if (sub === "patchnotes-modo" && S.isAdmin) return h + patchModView();
  if (sub === "annonces" && S.isAdmin) return h + adminAnnView();
  if (sub === "notifs-install" && S.isAdmin) return h + pushGuideView();
  if (sub === "apparence") {
    const t = lsGet("ctv.theme") || "auto", im = introMode();
    return h + '<h1>Apparence</h1><h2 style="margin-top:4px">Thème</h2><div class="list">' + ["auto", "light", "dark"].map(k => '<button class="item" data-act="theme" data-v="' + k + '"><span class="lbl"><b>' + TH[k] +
      '</b></span><span class="chev">' + (t === k ? "✓" : "") + "</span></button>").join("") + "</div>" +
      '<h2>Intro au démarrage</h2><div class="list">' + Object.keys(INTRO).map(k => '<button class="item" data-act="intromode" data-v="' + k + '"><span class="lbl"><b>' + INTRO[k][0] + "</b><small>" + INTRO[k][1] +
      '</small></span><span class="chev">' + (im === k ? "✓" : "") + "</span></button>").join("") + '</div><div class="btns" style="justify-content:flex-start;margin:10px 16px 0"><button class="btn ghost" data-act="introplay">▶ Revoir l’intro</button></div>' +
      '<p class="note small" style="margin-top:8px">Sur téléphone, le son de la cloche ne peut partir qu’après un appui sur l’écran : touche l’écran pendant l’intro pour l’entendre.</p>';
  }
  const row = (href, t, s) => '<a class="item" href="' + href + '"><span class="lbl"><b>' + t + "</b><small>" + esc(s) + '</small></span><span class="chev">›</span></a>';
  h += '<h1>Paramètres</h1><div class="list">' + row("#/profil-modifier", "Modifier mon profil", "Photo, pseudo, description, favoris") +
    row("#/parametres/email", "Adresse e-mail", u.email) + row("#/parametres/motdepasse", "Mot de passe", google ? "Connecté avec Google" : "Modifier") +
    row("#/parametres/apparence", "Apparence", TH[lsGet("ctv.theme") || "auto"] + " · intro " + INTRO[introMode()][2]) +
    row("#/parametres/spoiler", "Mode sans spoiler", noSpoil() ? "Activé" : "Désactivé") +
    row("#/parametres/notifs", "🔔 Notifications", pushOnHere() ? "Activées sur ce téléphone" : pushReady() ? "Pas encore activées sur ce téléphone" : "Bientôt disponibles") +
    row("#/parametres/bloques", "Membres bloqués", S.blocks.length ? S.blocks.length + " membre" + (S.blocks.length > 1 ? "s" : "") : "Aucun") +
    row("#/parametres/patchnotes", "📝 Patch notes" + (pnNew() ? ' <span class="pdot" aria-label="nouveau"></span>' : ""), pnNew() ? "Nouveautés à découvrir" : "Les nouveautés de l’app") + "</div>" +
    '<h2>Communauté</h2><div class="list">' + row("#/sondages", "📊 Sondages", "Vote et découvre l’avis des membres") + row("#/pronostics", "🎯 Pronostics", "Tes pronostics et le classement") +
    row("#/idees", "💡 Partagez vos idées", "Propose des nouveautés pour l’app et vote pour celles des autres") + "</div>";
  if (!ADMIN_UID || S.isAdmin) {
    if (S.isAdmin) h += '<h2>Modération</h2><div class="list">' + row("#/parametres/annonces", "📣 Faire une annonce", annList().length ? "Dernière : " + annList()[0].t : "Notification à tous les membres") +
      row("#/parametres/patchnotes-modo", "📝 Patch notes · modération", "Ce que peut faire le modérateur · écrire une note") +
      row("#/parametres/signalements", "Signalements", S.reports.length ? S.reports.length + " en attente" : "Aucun") +
      row("#/parametres/logos", "Logos des onglets", "Remplacer les noms des promotions et des shows par leur logo") +
      row("#/parametres/medias", "Fonds animés et musique", Object.keys((S.media && S.media.bg) || {}).length + " vidéo" + (Object.keys((S.media && S.media.bg) || {}).length > 1 ? "s" : "") + " · " + (S.media && S.media.music ? "musique choisie" : "pas de musique")) +
      row("#/idees", "Idées des membres", (S.ideas || []).length ? (S.ideas || []).filter(i => !i.st).length + " sans réponse · " + S.ideas.length + " au total" : "Voir les idées proposées") +
      row("#/parametres/sources", "Sources des données", (S.sources || []).filter(x => x.on !== false).length + " sites utilisés par les mises à jour") +
      row("#/parametres/etat", "État des mises à jour", "Date de chaque donnée et derniers envois") +
      row("#/parametres/notifs-install", "🔔 Installer les notifications", pushReady() ? "Clé push web enregistrée · voir les étapes" : "4 étapes, environ 10 minutes") + "</div>";
    h += "<h2>" + (S.isAdmin ? "Admin" : "Installation") + '</h2><p class="note">' + (S.isAdmin ? "Tu es l’admin de l’app." : "Ton identifiant, à recopier dans la configuration pour devenir admin (voir le guide) :") + "</p>" +
      '<div class="uid" id="myuid">' + esc(u.uid) + '</div><div class="btns"><button class="btn ghost" data-act="copyuid">Copier l’identifiant</button></div>';
  }
  h += '<div style="height:18px"></div><button class="btn wide ghost" data-act="logout">Se déconnecter</button>' +
    '<p style="text-align:center;margin-top:14px"><a class="linkbtn" href="#/parametres/supprimer">Supprimer mon compte</a></p>';
  return h;
}
FORM.delacc = f => busy(f, async () => {
  if (!document.getElementById("d_ok").checked) { ferr("Coche la case pour confirmer"); return; }
  const pw = document.getElementById("d_pass");
  await B.deleteAccount(pw ? pw.value : "");
  toast("Ton compte a été supprimé. À bientôt peut-être !", { ms: 5000 }); location.hash = "#/";
});
FORM.email = f => busy(f, async () => {
  const r = await B.changeEmail(v("s_email"), document.getElementById("s_pass").value);
  toast(r === "verify" ? "Clique sur le lien reçu sur ta nouvelle adresse pour confirmer" : "E-mail modifié", { ms: 5000 });
  location.hash = "#/parametres";
});
FORM.pass = f => busy(f, async () => {
  const n = document.getElementById("s_new").value;
  if (n !== document.getElementById("s_new2").value) { ferr("Les deux mots de passe ne correspondent pas"); return; }
  await B.changePassword(document.getElementById("s_cur").value, n); toast("Mot de passe modifié"); location.hash = "#/parametres";
});
ACT.nospoil = el => { setNoSpoil(el.dataset.v === "1"); toast(el.dataset.v === "1" ? "🙈 Mode sans spoiler activé" : "Mode sans spoiler désactivé"); changed("route"); };
ACT.repdelimg = async el => {
  const r = S.reports.find(x => x.id === el.dataset.id); if (!r) return;
  try { await B.deleteWImage(String(r.conv).slice(5)); await B.deleteReport(r.id); toast("Image supprimée"); } catch (e) { toast(errText(e)); }
};
ACT.repdone = async el => { try { await B.deleteReport(el.dataset.id); toast("Signalement classé"); } catch (e) { toast(errText(e)); } };
ACT.repdelmsg = async el => {
  const r = S.reports.find(x => x.id === el.dataset.id); if (!r) return;
  try {
    if (r.conv === "general") await B.deleteRoomMsg(r.msg); else await B.deleteDM(r.conv, r.msg);
    await B.deleteReport(r.id); toast("Message supprimé");
  } catch (e) { toast(errText(e)); }
};
// Logo PNG (transparence conservée), 96 px de haut maximum
function fileToPng(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(u);
      const r = Math.min(1, 96 / img.naturalHeight, 400 / img.naturalWidth), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * r)); c.height = Math.max(1, Math.round(img.naturalHeight * r));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(u); reject(new Error("image")); };
    img.src = u;
  });
}
ACT.logoset = el => {
  const key = docId("logo:" + el.dataset.k + (el.dataset.n ? "|" + el.dataset.n : "")), label = el.dataset.n || el.dataset.k;
  modal((box, close) => {
    box.innerHTML = "<h3>Logo · " + esc(label) + '</h3><button class="btn wide" data-gal>Choisir dans ma galerie</button><div class="sep">ou</div>' +
      '<label class="fld">Lien de l’image<input id="logourl" type="url" inputmode="url" placeholder="https://…"></label><p class="err" id="logoerr"></p>' +
      '<button class="btn wide ghost" data-url>Utiliser ce lien</button><button class="btn wide ghost" style="margin-top:10px" data-no>Annuler</button><input type="file" accept="image/*" hidden id="logofile">';
    const save = async src => { try { await B.setImage(key, src, S.user.uid); close(); toast("Logo enregistré"); } catch (e) { box.querySelector("#logoerr").textContent = e && e.code === "permission-denied" ? "Refusé par Firebase : publie les dernières règles, puis réessaie." : errText(e); } };
    box.addEventListener("change", async e => { if (e.target.id === "logofile" && e.target.files[0]) { try { await save(await fileToPng(e.target.files[0])); } catch (x) { box.querySelector("#logoerr").textContent = "Image illisible"; } } });
    box.addEventListener("click", e => {
      if (e.target.closest("[data-gal]")) box.querySelector("#logofile").click();
      else if (e.target.closest("[data-no]")) close();
      else if (e.target.closest("[data-url]")) { const u = cleanImageUrl(box.querySelector("#logourl").value); if (!okHttp(u)) { box.querySelector("#logoerr").textContent = "Colle un lien qui commence par https://"; return; } save(u); }
    });
  });
};
ACT.logodel = async el => { try { await B.removeImage(docId("logo:" + el.dataset.k + (el.dataset.n ? "|" + el.dataset.n : ""))); toast("Logo retiré"); } catch (e) { toast(errText(e)); } };
ACT.theme = el => { lsSet("ctv.theme", el.dataset.v === "auto" ? null : el.dataset.v); applyTheme(); changed("route"); };
ACT.logout = async () => { await B.signOut(); toast("Déconnecté"); location.hash = "#/"; };
ACT.copyuid = async () => { try { await navigator.clipboard.writeText(S.user.uid); toast("Identifiant copié"); } catch (e) { toast("Sélectionne et copie le texte"); } };

// ---------------- profil ----------------
export function profileView(uid) {
  const me = S.user && uid === S.user.uid;
  const p = prof(uid);
  let h = '<a class="back" href="' + (me ? "#/" : "javascript:history.back()") + '">' + ICON.back + (me ? " Accueil" : " Retour") + "</a>";
  if (!p) return h + '<p class="empty">' + (S.profiles[uid] === null ? "Profil introuvable." : "Chargement…") + "</p>";
  const blocked = !me && isBlocked(uid);
  const all = (me ? Object.values(S.history) : (S.otherHistory[uid] || []).slice()).sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0));
  const hist = all.filter(x => !isMatchNote(x)), fights = all.filter(isMatchNote);
  const rated = all.filter(x => x.rating);
  const avg = rated.length ? (rated.reduce((s, x) => s + x.rating, 0) / rated.length).toFixed(1).replace(".", ",") : "–";
  // bannière horizontale (comme sur Twitter), chargée à part
  const bn = (S.banners || {})[uid];
  if (bn) h += '<div class="pbanner" style="background-image:url(\'' + esc(bn) + '\')"></div>';
  else if (me && bn === "") h += '<a class="pbanner empty" href="#/profil-modifier">＋ Ajouter une bannière</a>';
  h += '<div class="prof' + (bn ? " withbanner" : "") + '">' + (!me && S.user ? '<button class="iconbtn profmenu" data-act="membermenu" data-uid="' + esc(uid) + '" aria-label="Plus d’options">' + ICON.dots + "</button>" : "") +
    avatar(p, 96) + '<b class="name">' + esc(p.pseudo || "Membre") + "</b>" +
    (p.createdAt ? '<span class="since">Membre depuis le ' + fmtMs(p.createdAt, true) + "</span>" : "") + (!me && S.user ? feudBadge(uid, true) : "") + "</div>";
  if (blocked) return h + '<p class="note" style="text-align:center">Tu as bloqué ce membre.</p><div class="btns"><button class="btn ghost" data-act="block" data-uid="' + esc(uid) + '">Débloquer</button></div>';
  if (p.bio) h += '<p class="bio">' + esc(p.bio) + "</p>";
  else if (me) h += '<p class="note" style="text-align:center">Ajoute une description depuis « Modifier mon profil ».</p>';
  // boutons : ami, message, feud
  if (me) h += '<div class="btns" style="margin:4px 16px 0"><a class="btn" href="#/profil-modifier">Modifier mon profil</a><a class="btn ghost" href="#/parametres">Paramètres' + (pnNew() ? ' <span class="pdot" aria-label="nouveau"></span>' : "") + "</a></div>";
  else if (S.user) {
    const st = friendState(uid), fi = feudInfo(uid);
    const fb = st === "ok" ? '<button class="btn ghost" data-act="frienddel" data-uid="' + esc(uid) + '">✓ Amis</button>'
      : st === "out" ? '<button class="btn ghost" data-act="frienddel" data-uid="' + esc(uid) + '">Demande envoyée · annuler</button>'
      : st === "in" ? '<button class="btn" data-act="friendok" data-uid="' + esc(uid) + '">Accepter</button><button class="btn ghost" data-act="frienddel" data-uid="' + esc(uid) + '">Refuser</button>'
      : '<button class="btn" data-act="friendadd" data-uid="' + esc(uid) + '">Ajouter en ami</button>';
    h += '<div class="btns" style="margin:4px 16px 0">' + fb + '<button class="btn ghost" data-act="dm" data-uid="' + esc(uid) + '">Message</button>' +
      '<button class="btn feudbtn' + (fi.mine ? " done" : "") + '" data-act="feud" data-uid="' + esc(uid) + '">🔥 ' + (fi.mine ? (fi.theirs ? "Feud du jour faite" : "Feud du jour faite · à " + esc((prof(uid) || {}).pseudo || "lui") + " de jouer") : feudLabel(fi)) + "</button></div>";
    // actions du jour : la sienne contre toi, la tienne contre lui
    if (fi.theirs) h += '<p class="feudrecv">🔥 ' + esc(theirFeudAct(uid)) + "</p>";
    if (fi.mine) h += '<p class="feudrecv mine">🔥 ' + esc(myFeudAct(uid)) + "</p>";
    if (fi.count || fi.mine || fi.theirs) h += '<p class="note small" style="text-align:center;margin-top:8px">' + (fi.count ? "🔥 " + fi.count + " jour" + (fi.count > 1 ? "s" : "") + " de feud d’affilée" : "Feud en cours") +
      (fi.best > fi.count ? " · record : " + fi.best : "") + (fi.hourglass ? " · ⏳ pensez à la feud du jour avant minuit" : "") + "</p>";
  }
  h += '<div class="favs">' + [["Show préféré", p.favShow], ["Catcheur préféré", p.favWrestler], ["Catcheuse préférée", p.favWrestlerF]]
    .map((f, i) => '<div class="fav"><small>' + f[0] + "</small>" + (i && f[1] && photoOf(f[1]) ? '<a href="#/catcheur/' + encodeURIComponent(f[1]) + '"><img class="favpic" src="' + esc(photoOf(f[1])) + '" alt="" loading="lazy" onerror="this.remove()"></a>' : "") + "<b>" + (f[1] ? esc(f[1]) : "–") + "</b></div>").join("") + "</div>";
  h += '<div class="stats"><div><b>' + hist.length + "</b><small>show" + (hist.length > 1 ? "s" : "") + " vu" + (hist.length > 1 ? "s" : "") + "</small></div><div><b>" + fights.length + "</b><small>combat" + (fights.length > 1 ? "s" : "") + " noté" + (fights.length > 1 ? "s" : "") +
    "</small></div><div><b>" + avg + "</b><small>note moyenne</small></div><div><b>" + friendsOf(uid).length + "</b><small>ami" + (friendsOf(uid).length > 1 ? "s" : "") + "</small></div></div>";
  // vitrine des trophées
  h += showcase(uid);
  // favoris ⭐
  const fc = favChips(p);
  h += "<h2>⭐ Favoris</h2>" + (fc || '<p class="note">' + (me ? "Appuie sur l’étoile d’un catcheur pour le suivre." : "Pas encore de favori.") + "</p>");
  // amis
  const fr = friendsOf(uid);
  h += "<h2>Amis" + (fr.length ? " (" + fr.length + ")" : "") + "</h2>";
  if (me && requestsIn().length) h += '<a class="titletile" style="margin-top:0;margin-bottom:10px" href="#/membres/demandes"><span class="tt-belt" style="background:var(--red);color:#fff">👋</span><span class="tt-txt"><b>' +
    requestsIn().length + " demande" + (requestsIn().length > 1 ? "s" : "") + ' d’ami</b><small>Accepter ou refuser</small></span><span class="chev">›</span></a>';
  h += fr.length ? '<div class="frow">' + fr.map(o => '<a class="fitem" href="#/profil/' + encodeURIComponent(o) + '">' + avatar(prof(o), 54) + "<small>" + esc((prof(o) || {}).pseudo || "…") + "</small>" + (S.user && o !== S.user.uid ? feudBadge(o) : "") + "</a>").join("") + "</div>"
    : '<p class="note">' + (me ? "Trouve des membres avec l’onglet Membres." : "Pas encore d’amis.") + "</p>";
  // mes feuds
  if (me) {
    const act = S.feuds.map(f => { const o = f.members[0] === uid ? f.members[1] : f.members[0]; return { o: o, i: feudInfo(o) }; }).filter(x => (x.i.count || x.i.mine || x.i.theirs) && !isBlocked(x.o)).sort((a, b) => b.i.count - a.i.count);
    if (act.length) h += "<h2>🔥 Mes feuds</h2><div class=\"list\">" + act.map(x => '<a class="item" href="#/profil/' + encodeURIComponent(x.o) + '"><span class="lbl favfriend">' + avatar(prof(x.o), 32) + "<b>" + esc((prof(x.o) || {}).pseudo || "Membre") + "</b></span>" +
      '<span class="rt">' + (x.i.mine && x.i.theirs ? "✓ faite aujourd’hui" : x.i.theirs ? "à renvoyer !" : x.i.mine ? "en attente" : "à lancer") + "</span>" + feudBadge(x.o) + "</a>").join("") + "</div>";
  }
  // historique : shows et combats mêlés, les plus récents d'abord ; 10 visibles, le reste derrière « Voir plus »
  h += "<h2>Historique des notes" + (all.length ? ' <small class="cnt">' + all.length + "</small>" : "") + "</h2>";
  h += all.length ? '<div class="list histlist">' + all.map((x, i) => {
    const fight = isMatchNote(x);
    return '<div class="item' + (fight ? " fightnote" : "") + '"' + (i >= HIST_MAX && !histOpen ? " hidden" : "") + '><span class="lbl"><b>' + noteTitle(x, (fight ? "🤼 " : "") + esc(x.title)) + "</b><small>" + esc(x.k) +
      (fight ? (x.show ? " · " + esc(x.show) : "") : x.show ? " · " + esc(x.show) : " · PLE") + (x.d ? " · " + fmt(x.d) : "") + "</small>" + (x.comment ? '<q class="mycom">' + esc(x.comment) + "</q>" : "") +
      (fight ? matchNoteLinks(x) : "") + (S.user && (x.rating || x.comment) ? '<a class="arep small" href="#/activite/' + encodeURIComponent(uid + "_r_" + x.id) + '">💬 Réactions et réponses</a>' : "") + '</span><span class="rt">' + (x.rating ? stars(x.rating) : fight ? "Pas noté" : "Pas noté") + "<br>" + (fight ? "noté le " : "vu le ") + fmtMs(x.seenAt) + "</span></div>";
  }).join("") + "</div>" + (all.length > HIST_MAX ? '<div class="btns" style="margin:10px 16px 0"><button class="btn ghost" data-act="histmore">' + (histOpen ? "Voir moins" : "Voir plus (" + (all.length - HIST_MAX) + ")") + "</button></div>" : "")
    : '<p class="note">' + (me ? "Appuie sur l’œil à côté d’un épisode ou d’un PLE pour le marquer comme vu et le noter. Tu peux aussi noter chaque combat depuis les highlights et les matchs à découvrir." : "Rien pour l’instant.") + "</p>";
  return h;
}

const HIST_MAX = 5;
let histOpen = false;
ACT.histmore = el => {
  histOpen = !histOpen;
  const items = document.querySelectorAll(".histlist .item");
  items.forEach((it, i) => { it.hidden = !histOpen && i >= HIST_MAX; });
  el.textContent = histOpen ? "Voir moins" : "Voir plus (" + (items.length - HIST_MAX) + ")";
  if (!histOpen) { const l = document.querySelector(".histlist"); if (l) l.scrollIntoView({ block: "start", behavior: "smooth" }); }
};

export function editProfileView() {
  const p = S.profile || {};
  const opts = showOptions();
  return '<a class="back" href="#/profil">' + ICON.back + " Mon profil</a><h1>Modifier mon profil</h1>" +
    '<h2 style="margin-top:4px">Bannière</h2><div class="pbanner edit' + (bnOf() ? "" : " empty") + '" id="bnprev"' + (bnOf() ? ' style="background-image:url(\'' + esc(bnOf()) + '\')"' : "") + ">" + (bnOf() ? "" : "Pas encore de bannière") + "</div>" +
    '<div class="btns" style="margin:8px 16px 0"><button type="button" class="btn" data-act="banner">' + (bnOf() ? "Changer la bannière" : "Ajouter une bannière") + "</button>" + (bnOf() ? '<button type="button" class="btn ghost" data-act="nobanner">Supprimer</button>' : "") +
    '</div><p class="note small" style="margin-top:6px">Photo horizontale, recadrée en 3:1 (comme sur Twitter).</p><input type="file" accept="image/*" hidden id="bannerfile">' +
    '<form data-form="profile"><div class="prof">' + avatar(p, 96) + '<div class="btns"><button type="button" class="btn" data-act="photo">' + (p.photo ? "Changer la photo" : "Ajouter une photo") + "</button>" +
    (p.photo ? '<button type="button" class="btn ghost" data-act="nophoto">Supprimer</button>' : "") + '</div><input type="file" accept="image/*" hidden id="photofile"></div>' +
    field("e_pseudo", "Pseudo", 'maxlength="30" required value="' + esc(p.pseudo || "") + '"') +
    '<label class="fld">Description<textarea id="e_bio" maxlength="300" placeholder="Parle un peu de toi, de ton catch…">' + esc(p.bio || "") + "</textarea></label>" +
    '<label class="fld">Show préféré<select id="e_show"><option value="">–</option>' + opts.map(o => "<option" + (o === p.favShow ? " selected" : "") + ">" + esc(o) + "</option>").join("") +
    (p.favShow && opts.indexOf(p.favShow) < 0 ? "<option selected>" + esc(p.favShow) + "</option>" : "") + "</select></label>" +
    field("e_wr", "Catcheur préféré", 'maxlength="40" value="' + esc(p.favWrestler || "") + '"') +
    field("e_wrf", "Catcheuse préférée", 'maxlength="40" value="' + esc(p.favWrestlerF || "") + '"') +
    '<p class="err" id="ferr"></p><button class="btn wide">Enregistrer</button></form>';
}
FORM.profile = f => busy(f, async () => {
  if (!v("e_pseudo")) { ferr("Choisis un pseudo"); return; }
  await B.saveProfile(S.user.uid, { pseudo: v("e_pseudo"), bio: document.getElementById("e_bio").value.trim().slice(0, 300),
    favShow: v("e_show"), favWrestler: v("e_wr"), favWrestlerF: v("e_wrf") });
  toast("Profil enregistré"); location.hash = "#/profil";
});
ACT.photo = () => {
  const inp = document.getElementById("photofile"); if (!inp) return;
  inp.onchange = async () => {
    const file = inp.files[0]; inp.value = ""; if (!file) return;
    try {
      const photo = await cropImage(file, { ratio: 1, round: true, out: 400, maxLen: 300000, title: "Recadrer ta photo" });
      if (!photo) return;
      await B.saveProfile(S.user.uid, { photo: photo });
      const old = document.querySelector("form[data-form=profile] .prof .av");
      if (old) old.outerHTML = avatar({ photo: photo }, 96);
      toast("Photo mise à jour");
    }
    catch (e) { toast(e && e.code ? errText(e) : "Image illisible"); }
  };
  inp.click();
};
const bnOf = () => (S.banners || {})[S.user ? S.user.uid : ""] || "";
ACT.banner = () => {
  const inp = document.getElementById("bannerfile"); if (!inp) return;
  inp.onchange = async () => {
    const file = inp.files[0]; inp.value = ""; if (!file) return;
    try {
      const src = await cropImage(file, { ratio: 3, out: 1500, maxLen: 380000, title: "Recadrer ta bannière" });
      if (!src) return;
      await B.setBanner(S.user.uid, src);
      S.banners = S.banners || {}; S.banners[S.user.uid] = src; changed("profiles");
      toast("Bannière mise à jour");
    } catch (e) { toast(e && e.code ? errText(e) : "Image illisible"); }
  };
  inp.click();
};
ACT.nobanner = async () => { try { await B.setBanner(S.user.uid, ""); S.banners[S.user.uid] = ""; changed("profiles"); toast("Bannière supprimée"); } catch (e) { toast(errText(e)); } };
ACT.nophoto = async () => { try { await B.saveProfile(S.user.uid, { photo: "" }); toast("Photo supprimée"); } catch (e) { toast(errText(e)); } };
