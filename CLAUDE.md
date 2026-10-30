# TCC TV — mémo pour Claude

App de catch façon Netflix de Jose (GitHub Jose-k78), en français. PWA statique sur GitHub Pages :
https://jose-k78.github.io/catch-tv/ — dépôt Jose-k78/catch-tv. Firebase : projet `catch-ttc-tv`,
admin (modérateur) `gYOlkXsJc3WedSykoBNyeWg2ELx1`.

## Règles de travail (demandées par Jose, toujours valables)

- **« L'heure du codage »** : toutes ses idées, ajouts, modifications et commentaires sont **mis de côté** (on répond,
  on précise, on pose les questions utiles) et **on ne code que quand il dit « l'heure du codage »**. Ensuite on code
  tout ce qui a été mis de côté, on teste, on publie.
- Réponses en français, simples (il n'est pas développeur). Pas de jargon inutile.
- Commits signés : `git -c user.name="Jose-k78" -c user.email="Jose-k78@users.noreply.github.com" commit`,
  avec à la fin du message les lignes `Co-Authored-By: Claude …` et `Claude-Session: …` demandées par la session.
- Quand il demande des conseils sur l'app, reproposer les idées mises de côté : restreindre la clé API Firebase
  à son site, validation des inscriptions, nom de domaine perso. Il a refusé : mode hors ligne, question spoiler à l'inscription.
- Plus tard, quand il le demandera : les ceintures, les commentaires de feud selon le nombre de jours, un mini TCG.

## Règles de contenu (non négociables)

- Seul l'admin modifie les images et le contenu de l'app. Les images des fiches catcheurs : n'importe quel membre
  les ajoute, l'admin peut les enlever.
- **Vidéos officielles uniquement** (chaînes YouTube officielles, plateformes officielles). Jamais de copie piratée
  ou non officielle (VK Video, archive.org… refusés), même « cachée ».
- **Jamais de photos de vraies personnes récupérées sur le web** (pas d'affiches officielles, pas de photos Wikipédia
  de catcheurs ajoutées automatiquement, pas de Smackdown Hotel pour les images). Les seules photos de catcheurs sont
  celles que Jose fournit lui-même : dossier `img/catcheurs/` (sa référence, prioritaire sur l'image d'un membre).
- Matchs de référence d'une fiche : vidéo officielle connue → « ▶ Voir » dans l'app ; sinon simple recherche YouTube
  « noms + événement + full match » (« 🔎 Chercher le match ») et c'est le membre qui choisit la vidéo.
- Spoilers : résultats, champions récents, défenses de titre toujours derrière un spoiler. Dans le bandeau et les
  notifications, un changement de titre s'affiche comme une défense (« 🙈 Défense de titre · Raw du 27 oct. »), avec le
  même texte que le champion ait gardé ou perdu son titre.
- Les clés secrètes ne passent jamais par Claude : la clé GitHub de l'admin reste sur son téléphone (localStorage
  `ctv.ghtoken`) ; FIREBASE_SA, CLOUDFLARE_API_TOKEN et CLOUDFLARE_ACCOUNT_ID sont des secrets GitHub qu'il colle lui-même.

## Architecture

- `index.html` + `js/app.js` (point d'entrée, routage par hash `#/…`, abonnements Firebase, rechargement auto des
  données au retour sur l'app et toutes les 30 min) ; état global `S` et délégation d'événements `ACT` (data-act) /
  `FORM` (data-form) dans `js/state.js` ; `changed(what)` redessine les vues listées dans la table `REL` d'app.js.
- `B` = backend : `js/backend/firebase.js` (Firestore + Auth, SDK depuis gstatic) ou `js/backend/demo.js`
  (localStorage, mêmes fonctions) — toute nouvelle fonction doit exister dans les deux.
- Vues dans `js/views/` : catalog (accueil, promotions, shows, **page d'un événement `#/ev/k/show/date`**), search
  (recherche + fiche catcheur), highlights, titles, ticker (bandeau défilant : un tour complet par onglet, mémoire
  des infos passées), polls, picks (pronostics), chat (Gorilla Position + messages privés, cartes partagées),
  account (profil, paramètres), admin (modération), annonces, trophies, activity, event (archives Wikipédia)…
- `js/wrestlers.js` : `linkNames(texte)` rend cliquables les noms de catcheurs connus (fiches, rosters, champions) —
  partout sauf dans les messages du chat ; `namesIn(texte)`.
- `js/photos.js` : photos des catcheurs (`photoOf(nom)`, `face`, `versus(ligne)` face à face, `faceRow`, `faceImg`) d'après
  `data/photos.json` = { items: { slug: { f: fichier, n: [noms] } } } et les fichiers de `img/catcheurs/` (WebP 300×300).
  Affichées sur la fiche, les résultats de recherche, les sondages, la page d'un événement (affiche + résumé), les résumés
  des shows et les highlights. Le robot tient la liste à jour (`.github/scripts/photos.mjs`, aussi lancé à chaque ajout
  dans le dossier) : nom de fichier = nom du catcheur, la photo la plus récente gagne, > 400 Ko → copie WebP légère.
- `js/share.js` : appui long / clic droit sur un élément `[data-sh]` (carte JSON via `shAttr()` de util.js) →
  partage dans la Gorilla Position ou en privé ; champ `card` des messages.
- `js/push.js` + `sw.js` (service worker sans cache) : notifications Firebase Cloud Messaging (petite icône Android :
  `icons/badge-96.png`, blanc sur transparent, sinon carré blanc) ; réglages dans
  `push/{uid}` ; bandeau « Installer l'app ». `data/push.json` = { vapid (clé publique), url (service Cloudflare) }.
- `cloudflare/` : service des notifications instantanées (messages privés, feuds, annonces), installé par
  `.github/workflows/push-worker.yml`. `cloudflare/push-core.mjs` est partagé avec le robot.
- `firestore.rules` : règles (version 8). À chaque changement, donner le texte complet à Jose pour qu'il le colle
  dans Firebase › Firestore › Règles › Publier.

## Données et mises à jour automatiques

- Fichiers JSON dans `data/` et `news.json`, mis à jour par 3 tâches planifiées (heure de Paris) :
  7 h 44 (actu en secours, storyline, sondages), 8 h 21 (résultats/segments/vidéos, titres et défenses, résumés
  d'avant-show), 19 h 23 (calendrier, heures, cartes, liens directs, rosters, fiches ; lundi : matchs à découvrir).
- Robot GitHub Actions (`.github/workflows/robot.yml`, à xx h 07 et xx h 37) : `robot.mjs` écrit `data/feed.json`
  (actu RSS ou page d'accueil, vidéos YouTube officielles), puis `notify.mjs` envoie les notifications (infos,
  favoris, rappel des feuds à 21 h) et tient `data/push-state.json`.
- L'app lit `data/feed.json` sur raw.githubusercontent.com (frais), sinon la copie du site.

## Tester

- Bundle : `node -e` avec esbuild (`/opt/npm-tools/node_modules/esbuild`, entrée `js/app.js`).
- Aperçu tout-en-un (mode démo) : `node tools/build-preview.cjs sortie.html --artifact`.
- Navigateur : serveur local `python3 -m http.server 8766` dans le dépôt + Playwright (Chromium préinstallé) ;
  bloquer gstatic/wikipedia/youtube (l'app passe alors en démo), servir un faux `feed.json` pour raw.githubusercontent.
- Ne jamais supprimer `media/` : il contient les vrais fichiers de Jose (fonds animés, musique).
