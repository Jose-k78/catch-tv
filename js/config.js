// ================== CONFIGURATION ==================
// 1) Colle ici la configuration de ton projet Firebase
//    (Console Firebase > Paramètres du projet > Tes applications > Config).
//    Tant que c'est null, l'app tourne en « mode démo » : tout est enregistré
//    seulement dans ce navigateur.
export const firebaseConfig = null;
/* Exemple :
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "catch-tv-xxxx.firebaseapp.com",
  projectId: "catch-tv-xxxx",
  storageBucket: "catch-tv-xxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/

// 2) Ton identifiant d'admin (UID). Tu le trouves dans l'app :
//    Mon profil > Paramètres > « Ton identifiant ». Mets le même dans firestore.rules.
export const ADMIN_UID = "";
