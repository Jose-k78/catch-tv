# Catch TV

Le catch façon Netflix : PLE, shows hebdo, actu en français, profils, notes « déjà vu » et messagerie entre fans.

Tant que Firebase n'est pas configuré, l'app tourne en **mode démo** : tout reste dans le navigateur.
Pour que n'importe qui puisse s'inscrire et discuter, suis les étapes ci-dessous (environ 20 minutes, gratuit).

## 1. Mettre l'app en ligne avec GitHub Pages

1. Crée un compte sur [github.com](https://github.com) si tu n'en as pas.
2. Crée un dépôt public nommé `catch-tv` et envoie-y tous les fichiers de ce dossier.
   Plus simple : relie GitHub à Claude (claude.ai > Paramètres > Connecteurs > GitHub) et demande à Claude de le faire.
3. Dans le dépôt : **Settings > Pages > Source : Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
4. Après une minute, l'app est en ligne à l'adresse `https://TON-PSEUDO.github.io/catch-tv/`.

## 2. Créer le projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com) avec ton compte Google et crée un projet (par exemple `catch-tv`). Google Analytics n'est pas nécessaire.
2. Dans la page du projet, ajoute une **application Web** (icône `</>`), donne-lui un nom, puis copie l'objet `firebaseConfig` affiché.
3. Colle-le dans `js/config.js` à la place de `null` (ou envoie-le à Claude). Ces informations ne sont pas secrètes : la sécurité vient des règles de l'étape 4.

## 3. Activer la connexion

1. Menu **Authentication > Commencer**.
2. Onglet **Méthode de connexion** : active **Adresse e-mail/Mot de passe**, puis **Google**.
3. Onglet **Paramètres > Domaines autorisés** : ajoute `TON-PSEUDO.github.io`.

## 4. Créer la base de données

1. Menu **Firestore Database > Créer une base de données**, emplacement en Europe (par exemple `europe-west9` Paris), **mode production**.
2. Onglet **Règles** : remplace tout par le contenu du fichier `firestore.rules`, puis **Publier**.

## 5. Devenir admin

1. Ouvre l'app en ligne, crée ton compte.
2. Va dans **Mon profil > Paramètres** et copie **ton identifiant**.
3. Mets-le dans `js/config.js` (`ADMIN_UID`) et dans les règles Firestore à la place de `COLLE_TON_UID_ICI`, puis republie les règles.

Toi seul verras alors les boutons pour changer les images des vignettes. Les règles refusent toute modification venant d'un autre compte.

## 6. Mettre à jour les règles après une nouvelle version

Quand une nouvelle version ajoute des fonctions qui touchent à la base (amis, feuds, favoris, blocages, signalements…), le fichier `firestore.rules` change.
Copie tout son contenu dans **Firestore Database > Règles**, puis **Publier**. Sans ça, Firebase refuse les nouvelles actions (« Action non autorisée »).

## 7. Notifications sur le téléphone quand l'app est fermée

Pour l'instant, les alertes (messages, demandes d'amis, feuds) s'affichent seulement quand l'app est ouverte.
Les vraies notifications push demandent un petit serveur qui les envoie : avec Firebase, ce sont les **Cloud Functions** + **Firebase Cloud Messaging**,
qui exigent de passer le projet au forfait **Blaze** (paiement à l'usage, avec une carte bancaire ; gratuit en dessous de quotas larges, mais une carte est obligatoire).
Sur iPhone, il faut aussi que l'app soit ajoutée à l'écran d'accueil (iOS 16.4 ou plus récent).

## 8. Installer l'app sur ton téléphone

Ouvre l'adresse dans Safari (iPhone) ou Chrome (Android), puis **Partager > Sur l'écran d'accueil** ou **Menu > Ajouter à l'écran d'accueil**.

## Contenu du dossier

| Fichier | Rôle |
| --- | --- |
| `index.html`, `css/`, `js/` | L'app |
| `data/calendar.json` | Le calendrier (PLE, shows hebdo, couleurs, liens, comptes X) |
| `news.json` | Les articles en français, mis à jour automatiquement |
| `data/recaps.json` | Les résumés sans spoiler des épisodes et PLE, mis à jour automatiquement |
| `data/titles.json` | Les titres, champions actuels et anciens champions, mis à jour automatiquement |
| `data/matches.json` | Les matchs à revoir (vidéos des chaînes YouTube officielles), renouvelés chaque semaine |
| `data/titles.json` | Les champions actuels et l'historique des titres |
| `data/highlights.json` | Highlights officiels et résultats (cachés derrière le bouton spoiler) des derniers shows |
| `data/wrestlers.json` | Catcheurs suivis : matchs de référence, derniers matchs, actu |
| `js/images.js` | Images des vignettes : héritage, photos libres Wikimedia Commons, affiches maison |
| `js/config.js` | Configuration Firebase et identifiant admin |
| `firestore.rules` | Règles de sécurité de la base de données |
| `tools/build-preview.cjs` | Construit un aperçu tout-en-un (mode démo) |
