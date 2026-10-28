// ================== CONFIGURATION ==================
// 1) Colle ici la configuration de ton projet Firebase
//    (Console Firebase > Paramètres du projet > Tes applications > Config).
//    Tant que c'est null, l'app tourne en « mode démo » : tout est enregistré
//    seulement dans ce navigateur.
export const firebaseConfig = {
  apiKey: "AIzaSyCN-O04bc7r5l5l4W88X6XW3Szu4VQAgns",
  authDomain: "catch-ttc-tv.firebaseapp.com",
  projectId: "catch-ttc-tv",
  storageBucket: "catch-ttc-tv.firebasestorage.app",
  messagingSenderId: "817081331415",
  appId: "1:817081331415:web:d79adc645429eb5f350a92",
  measurementId: "G-L4HVXLZCLS"
};
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
export const ADMIN_UID = "gYOlkXsJc3WedSykoBNyeWg2ELx1";

// Clé GIPHY (gratuite) pour la recherche de GIFs dans le chat. Vide = recherche désactivée (envoi depuis la galerie ou par lien seulement).
export const GIPHY_KEY = "";
