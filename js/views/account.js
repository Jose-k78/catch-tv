// Connexion / inscription, paramètres du compte, page de profil
import { S, B, ACT, FORM, prof, avatar, changed } from "../state.js";
import { esc, toast, fmt, fmtMs, ICON, stars, lsGet, lsSet, fileToDataUrl } from "../util.js";
import { showOptions } from "./catalog.js";
import { ADMIN_UID } from "../config.js";

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
export function errText(e) { return (e && ERR[e.code]) || "Une erreur est survenue"; }
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
  if (sub === "apparence") {
    const t = lsGet("ctv.theme") || "auto";
    return h + '<h1>Apparence</h1><div class="list">' + ["auto", "light", "dark"].map(k => '<button class="item" data-act="theme" data-v="' + k + '"><span class="lbl"><b>' + TH[k] +
      '</b></span><span class="chev">' + (t === k ? "✓" : "") + "</span></button>").join("") + "</div>";
  }
  const row = (href, t, s) => '<a class="item" href="' + href + '"><span class="lbl"><b>' + t + "</b><small>" + esc(s) + '</small></span><span class="chev">›</span></a>';
  h += '<h1>Paramètres</h1><div class="list">' + row("#/profil-modifier", "Modifier mon profil", "Photo, pseudo, description, favoris") +
    row("#/parametres/email", "Adresse e-mail", u.email) + row("#/parametres/motdepasse", "Mot de passe", google ? "Connecté avec Google" : "Modifier") +
    row("#/parametres/apparence", "Apparence", TH[lsGet("ctv.theme") || "auto"]) + "</div>";
  if (!ADMIN_UID || S.isAdmin) {
    h += "<h2>" + (S.isAdmin ? "Admin" : "Installation") + '</h2><p class="note">' + (S.isAdmin ? "Tu es l’admin de l’app." : "Ton identifiant, à recopier dans la configuration pour devenir admin (voir le guide) :") + "</p>" +
      '<div class="uid" id="myuid">' + esc(u.uid) + '</div><div class="btns"><button class="btn ghost" data-act="copyuid">Copier l’identifiant</button></div>';
  }
  h += '<div style="height:18px"></div><button class="btn wide ghost" data-act="logout">Se déconnecter</button>';
  return h;
}
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
ACT.theme = el => { lsSet("ctv.theme", el.dataset.v === "auto" ? null : el.dataset.v); applyTheme(); changed("route"); };
ACT.logout = async () => { await B.signOut(); toast("Déconnecté"); location.hash = "#/"; };
ACT.copyuid = async () => { try { await navigator.clipboard.writeText(S.user.uid); toast("Identifiant copié"); } catch (e) { toast("Sélectionne et copie le texte"); } };

// ---------------- profil ----------------
export function profileView(uid) {
  const me = S.user && uid === S.user.uid;
  const p = prof(uid);
  let h = '<a class="back" href="' + (me ? "#/" : "javascript:history.back()") + '">' + ICON.back + (me ? " Accueil" : " Retour") + "</a>";
  if (!p) return h + '<p class="empty">' + (S.profiles[uid] === null ? "Profil introuvable." : "Chargement…") + "</p>";
  const hist = me ? Object.values(S.history) : (S.otherHistory[uid] || []);
  hist.sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0));
  const rated = hist.filter(x => x.rating);
  const avg = rated.length ? (rated.reduce((s, x) => s + x.rating, 0) / rated.length).toFixed(1).replace(".", ",") : "–";
  h += '<div class="prof">' + avatar(p, 96) + '<b class="name">' + esc(p.pseudo || "Membre") + "</b>" +
    (p.createdAt ? '<span class="since">Membre depuis le ' + fmtMs(p.createdAt, true) + "</span>" : "") + "</div>";
  if (p.bio) h += '<p class="bio">' + esc(p.bio) + "</p>";
  else if (me) h += '<p class="note" style="text-align:center">Ajoute une description depuis « Modifier mon profil ».</p>';
  h += '<div class="favs">' + [["Show préféré", p.favShow], ["Catcheur préféré", p.favWrestler], ["Catcheuse préférée", p.favWrestlerF]]
    .map(f => '<div class="fav"><small>' + f[0] + "</small><b>" + (f[1] ? esc(f[1]) : "–") + "</b></div>").join("") + "</div>";
  h += '<div class="stats"><div><b>' + hist.length + "</b><small>vu" + (hist.length > 1 ? "s" : "") + "</small></div><div><b>" + rated.length + "</b><small>noté" + (rated.length > 1 ? "s" : "") +
    "</small></div><div><b>" + avg + "</b><small>note moyenne</small></div></div>";
  h += '<div class="btns" style="margin-top:16px">' + (me ? '<a class="btn" href="#/profil-modifier">Modifier mon profil</a><a class="btn ghost" href="#/parametres">Paramètres</a>'
    : (S.user ? '<button class="btn" data-act="dm" data-uid="' + esc(uid) + '">' + "Envoyer un message</button>" : "")) + "</div>";
  h += "<h2>Historique des notes</h2>";
  h += hist.length ? '<div class="list">' + hist.map(x => '<div class="item"><span class="lbl"><b>' + esc(x.title) + "</b><small>" + esc(x.k) + (x.show ? " · " + esc(x.show) : " · PLE") +
    (x.d ? " · " + fmt(x.d) : "") + "</small>" + (x.comment ? '<q class="mycom">' + esc(x.comment) + "</q>" : "") + '</span><span class="rt">' + (x.rating ? stars(x.rating) : "Pas noté") + "<br>vu le " + fmtMs(x.seenAt) + "</span></div>").join("") + "</div>"
    : '<p class="note">' + (me ? "Appuie sur l’œil à côté d’un épisode ou d’un PLE pour le marquer comme vu et le noter." : "Rien pour l’instant.") + "</p>";
  return h;
}

export function editProfileView() {
  const p = S.profile || {};
  const opts = showOptions();
  return '<a class="back" href="#/profil">' + ICON.back + " Mon profil</a><h1>Modifier mon profil</h1>" +
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
      const photo = await fileToDataUrl(file, 320, 320, true);
      await B.saveProfile(S.user.uid, { photo: photo });
      const old = document.querySelector("form[data-form=profile] .prof .av");
      if (old) old.outerHTML = avatar({ photo: photo }, 96);
      toast("Photo mise à jour");
    }
    catch (e) { toast(e && e.code ? errText(e) : "Image illisible"); }
  };
  inp.click();
};
ACT.nophoto = async () => { try { await B.saveProfile(S.user.uid, { photo: "" }); toast("Photo supprimée"); } catch (e) { toast(errText(e)); } };
