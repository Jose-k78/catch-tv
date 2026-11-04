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
- **Vidéos officielles uniquement** dans ce que Claude ajoute (chaînes YouTube officielles, plateformes officielles). Claude ne
  cherche ni n'ajoute jamais de copie piratée (VK Video, OK.ru, archive.org…). Les liens que le modo colle lui-même sont son choix :
  le lecteur reconnaît Dailymotion, Vimeo, OK.ru, VK, archive.org, Twitch, Streamable, Rumble, Facebook, fichiers vidéo (`parseVideo`
  de js/links.js), YouTube est lu par le lecteur YouTube (youtube.com/embed : sans pub pour un compte Premium connecté).
- **Jamais de photos de vraies personnes récupérées sur le web** (pas d'affiches officielles, pas de photos Wikipédia
  de catcheurs ajoutées automatiquement, pas de Smackdown Hotel pour les images). Les seules photos de catcheurs sont
  celles que Jose fournit lui-même : dossier `img/catcheurs/` (sa référence, prioritaire sur l'image d'un membre).
- Matchs de référence d'une fiche : vidéo officielle connue → « ▶ Voir » dans l'app ; sinon simple recherche YouTube
  « noms + événement + full match » (« 🔎 Chercher le match ») et c'est le membre qui choisit la vidéo. Pour NJPW, Stardom
  et Marigold : choix entre YouTube, Dailymotion et la plateforme officielle (`refButton` de js/views/groups.js).
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
- `js/assets.js` : images des dossiers de Jose, liste `data/logos.json` = { shows, events, titles, groups } →
  `img/shows/` (logos des shows), `img/events/` (logos des grands événements), `img/titres/` (ceintures), `img/groupes/`
  (logos des tag teams / factions) ; `{ "Nom du fichier": { f, v: [anciennes versions] } }`, **la version la plus récente
  toujours en premier** (`f`). `showLogo`, `eventLogo(e)`, `beltOf(id titre)` (table `BELT`), `archivedBelts()` (anciennes
  ceintures : seulement dans les archives, trouvées par la recherche, page `#/ceinture/nom`), groupes (`groupsOf`, `groupChip`).
- `js/views/groups.js` : fiche d'un tag team / d'une faction `#/groupe/id` (logo, membres actuels / anciens, années,
  matchs de référence) d'après `data/groups.json` ; logo de ses groupes actuels dans un coin de la photo de la fiche catcheur.
  Un membre peut ajouter un logo seulement si le groupe n'en a pas (Firestore `wimages/groupe-…`, l'admin l'enlève).
- `js/views/palmares.js` : palmarès d'un catcheur (titres des 9 promotions, fois, jours — sans spoiler depuis le 4 nov., à la demande de Jose) et
  durée des règnes / records d'un titre, calculés d'après `hist` de `data/titles.json` (historique complet complété chaque
  matin) ou le champ `tt` d'une fiche.
- `js/views/patchnotes.js` : patch notes (`data/patchnotes.json`, `mod: true` = réservé au modérateur) ; Paramètres › Patch
  notes pour tous, Modération › Patch notes pour écrire une note (clé GitHub de l'admin) ; point rouge tant que non lu.
- Fiche catcheur : grande photo agrandie au toucher (`ACT.zoom`, plein écran), image d'un membre toujours possible (en petit
  sous la photo du dossier), rubrique Palmarès. Profil d'un membre : ses catcheurs suivis avec leur photo.
- Feuds : « Lancer une feud » puis « Continuer la feud » ; action du jour tirée au hasard dans `cloudflare/feud-acts.mjs`
  (partagé par l'app et le service des notifications : même action des deux côtés, différente pour chacun).
- TCCCG (`js/views/tccg.js`, `#/tccg/…`) : prototype de la partie cartes (TCG), réservé au modérateur, interface noir et
  doré (`body.tccg`), onglets Accueil / Call Up / Roster / Échange / Shop « en chantier » ; icône « Bientôt » dans la barre du bas.
- Plus de photos automatiques Wikimedia ni de page « Crédits photos » (retirées le 30 oct.) : seules les images choisies par
  le modérateur. Fonds animés et musique : copies légères (`media/bg/*-leger.mp4`, `media/music-leger.mp3`, originaux
  gardés), musique en pause par défaut.
- Modération › Images de l'app (`js/views/imagesadmin.js`, `#/parametres/images/<rubrique>`) : choisir la version en
  avant (`f`) parmi les versions (`v`) des photos des catcheurs (3 au plus : `slug-v2/-v3.webp`), ceintures, logos de shows,
  d'événements et de groupes ; ajouter une image (WebP fait dans le navigateur, envoyé avec la clé GitHub de l'admin) ;
  supprimer une version. Le robot `photos.mjs` connaît les versions (une photo déposée à la main passe en avant).
- TCC Play (`js/views/player.js`, `#/player`, dans la barre du bas à la place de Recherche ; Recherche est un onglet en haut,
  juste après Accueil ; logo `TPLAY` / icône `TPLAY_ICON` de js/links.js) : style Prime Video (onglets par
  promotion puis par show, barre de recherche), shows rangés par année / mois / date + « Choisir une date »
  (`#/player/e/K|show|date`) : le lien ⭐ par défaut du modo se lance dans le lecteur de l'app, sinon la 1re vidéo officielle ;
  ⚙️ réglages modo (`#/player/reglages`). Vidéos officielles (feed.yt, highlights, matches.json), j'aime local, commentaires
  `video-<id>`. Jamais d'archive.org ni de VK ajoutés par Claude. Onglet « Autre » (`#/autre`, après Marigold) : WWF/WCW/ECW.
- « Vu en highlights » : entrée d'historique avec rating 0 et comment `"[HL]"` (pas de changement des règles Firestore) ;
  trophées highlights dans trophies.js (hl, hlx, hlp, hls). Badges « CETTE NUIT » (19 h–5 h Paris) / « AUJOURD’HUI » (6 h–18 h), d'après l'heure réelle du show (`dayWord`).
- Babies du mois = tournoi à 8 (`js/views/babies.js`) : document Firestore `polls/bk-AAAA-MM` (type « bracket », 8 noms choisis
  par le modo), votes dans `pollvotes` (poll `bk-AAAA-MM-mN`), 3 votes pour gagner un duel, un duel de plus par jour ; fin du mois
  sans finale → « Pas de babies désignée ». Sondages : « Match nul » ajouté aux dream matchs, « Qui a voté quoi ». Pronostics :
  bouton « Match nul » (valeur `Match nul`), points sur le profil (`pickPoints`).
- Historique : `s_<id>` = note d'une storyline, `f_<id>` = storyline préférée (mêmes champs que les autres notes, pas de
  changement des règles) ; bouton ✏️ pour modifier / supprimer ses notes sur son profil (`editNote` de modals.js).
- Liens du modérateur (`js/links.js`, `data/links.json`) : « Autre visionnage » des shows (`ev:K|show|date`), entrances
  (`ent:Nom`, `entm:Nom`), tournois (`tn:id`), recherche VS (`m:a vs b`) ; YouTube et Dailymotion lus dans l'app. Demandes
  « Je veux voir le show » et signalements de lien / photo / fiche / entrance → collection `reports` (cible `voir:…`, `lien:…`,
  `photo:Nom`, `catcheur:Nom`, `entrance:Nom`) ; à l'ajout du lien, notification aux membres qui l'avaient demandé.
- Shows passés : une seule rubrique « Déjà passés » (accueil, page d'une promotion, page d'un show) + page `#/passes[/K[/show]]` ;
  chaque carte ouvre la page du show (`#/ev/…`) : résumé, résultats (spoiler), highlights, liens officiels, TCC Play, lecteur intégré
  (lien ⭐ du modo, lancé en sourdine). Liens du modo : modifier ✏️, ⭐ par défaut, supprimer ; « story:<id> » pour la storyline.
- TCCCG v2 (`js/tcg/`, cahier des charges de Jose du 2 nov. + ses idées) : partie de chaque joueur dans Firestore `tcg/{uid}`
  (`store.js` : tout le monde commence à zéro, niveau 1→50, ressources $ / Momentum / Pop / Push / gimmicks, objets, médailles,
  cartes `{c, r, lv, xp}`, booster gratuit N/R du jour, tuto, attente des combats). `data.js` : 1 catcheur avec photo = 1 carte
  (rareté de base par célébrité, rareté max N→R / R→SSR / SR→UR / SSR→UR ou LR pour les 2 % du haut), 5 archétypes et leur cycle,
  5 stats, finisher, faction, face/heel ; cartes « version show » (`slug@K|show|date`, 2 j après les résultats, +12 % vainqueur /
  +5 %), cartes champion (`slug#champ`, boost permanent) ; champion en vrai = +10 % tant qu'il a le titre ; objets d'éveil (C/R/E/L/M)
  et de combat. `callup.js` : boosters des shows des 7 derniers jours (5 gimmicks = 3 cartes, 50 = Mega 15), packs de départ (MPP),
  boosters du modo, agents libres (modo) ; animation 3-2-1 / rampe / lueurs / déchirure / slide. `roster.js` : éveil, entraînement,
  fusion des doublons, médailles, virer, favorites. `fight.js` : combats liés aux shows de la semaine (un match = 2 adversaires,
  version show), Dark Match, PLE plus durs ; memory 2 contre 2 par élimination, 3 TAG chacun (IA aussi), objets, soutiens liés
  (+10 %), récompenses du cahier, attente 1 h. `home.js` : accueil, missions, tuto, Shop. `modo.js` (`#/tccg/modo`, aussi dans
  Paramètres › Modération) : tout le réglage dans `data/tcg.json` (cartes, persos créés, taux, objets, boosters, combats, musiques,
  dos des cartes). Pour l'instant réservé au modo (`S.realAdmin`).
- Rubrique Tournoi (`js/views/tournois.js`, `#/tournois`, `#/tournois/g1`, `#/tournoi/<id>`) d'après `data/tournaments.json`.
- Lecteur musical (`js/ytmusic.js`) : playlists YouTube du modo dans `data/media.json` (`pls`), bouton 🎵 en haut ; juste le
  son (lecteur caché, demande de Jose), commandes dans un petit panneau sous 🎵.
- Mode modification du modo : `S.realAdmin` = c'est le modo ; `S.isAdmin` = modo ET bouton ✏️ activé (`ctv.edit`). Sans le
  bouton, le modo voit l'app comme un membre. Toujours tester avec `S.isAdmin` pour afficher une option de modification.
- Accueil : aujourd'hui / cette nuit (6 h–18 h = aujourd'hui, 19 h–5 h = cette nuit), vient de sortir, programme, prochain PLE
  (WWE) ou PPV (autres, `bigWord`), infos. Communauté (sondages, pronostics, storyline, activité) dans l'onglet Membres ;
  Explorer, TCC Play, tournois et « à découvrir » dans l'onglet Recherche. « Draw » au lieu de « Match nul ».
- Babies : sans choix du modo, 8 catcheuses tirées au hasard dans les rosters féminins (même tirage pour tout le mois).
- Clans / équipes : le modo les ajoute, modifie, supprime depuis la fiche d'un groupe (data/groups.json via GitHub).
- Vitrine : jusqu'à 5 trophées (`tro.v1`…`v5`). Appui long sur une note de son profil pour la modifier.
- Mode TCCCG collant (profil, paramètres, trophées restent en noir et doré) ; réglage « À l'ouverture » (`ctv.start`, modo)
  et intro au logo TCCCG. NJPW Strong = promotion rangée sous NJPW (`PARENT`) ; un titre peut apparaître dans une autre
  promotion avec `also: ["NJPW"]` (IWGP Women's).
- Boîte à idées : icône 💡 dans l'en-tête de Messages. Les favoris des amis ne s'affichent plus sur la page Favoris.
- `js/share.js` : appui long / clic droit sur un élément `[data-sh]` (carte JSON via `shAttr()` de util.js) →
  partage dans la Gorilla Position ou en privé ; champ `card` des messages.
- `js/push.js` + `sw.js` (service worker sans cache) : notifications Firebase Cloud Messaging (petite icône Android :
  `icons/badge-96.png`, blanc sur transparent, sinon carré blanc) ; réglages dans
  `push/{uid}` ; bandeau « Installer l'app ». `data/push.json` = { vapid (clé publique), url (service Cloudflare) }.
- `cloudflare/` : service des notifications instantanées (messages privés, feuds, annonces), installé par
  `.github/workflows/push-worker.yml`. `cloudflare/push-core.mjs` est partagé avec le robot.
- `firestore.rules` : règles (version 9 : collection `tcg`). À chaque changement, donner le texte complet à Jose pour qu'il le colle
  dans Firebase › Firestore › Règles › Publier.

## Consignes pour les tâches planifiées (à suivre à chaque passage, en plus de leur propre consigne)

- 7 h 44 : ne plus créer de sondage de type « babies » (la Babies du mois est un tournoi à 8 géré dans l'app).
- 19 h 23 :
  - vérifier les **jours et heures de diffusion** de chaque show hebdo (`data/calendar.json` : `wd`, heures) et les corriger ;
  - tenir `data/tournaments.json` à jour (format décrit dans son champ `note`) : tout tournoi en cours ou annoncé des
    promotions de l'app (G1 Climax, World Tag League, 5★STAR Grand Prix, tournois CMLL, Dusty Rhodes Tag Team Classic…),
    avancement du tableau ou des blocs, vainqueur, puis l'article de bilan (`art`) à la fin ; compléter `series.*.past` ;
  - fiches (`data/wrestlers.json`) : `dc` = date de décès (AAAA-MM-JJ) pour un catcheur décédé ; `tt` = palmarès complet
    (titres et tournois gagnés, Royal Rumble… seulement des promotions de l'app) ;
  - groupes : membres de The 946 (WWE, depuis 2026), MFT, The Bloodline 2026.
  - résumés des PLE / PPV : s'aider aussi de https://mibih.wordpress.com/category/wrestling-reviews/latest-wrestling-ppv-reviews/ (réécrire en français, ne pas copier) ;
  - shows déplacés : `no` (dates sans épisode) et `e` (épisode spécial à une autre date) dans `data/calendar.json` ; heures toujours
    données dans le fuseau du show (`h` + `tz`) : le changement d'heure est calculé par l'app ;
  - ne jamais toucher à `data/links.json` (liens du modo), aux images ni à `data/logos.json` / `data/photos.json`.

## Données et mises à jour automatiques

- Fichiers JSON dans `data/` et `news.json`, mis à jour par 3 tâches planifiées (heure de Paris) :
  7 h 44 (actu en secours, storyline, sondages), 8 h 21 (résultats/segments/vidéos, titres et défenses, historique
  complet de 2 titres par jour, résumés d'avant-show), 19 h 23 (calendrier, heures, cartes, liens directs, rosters, fiches,
  8 groupes vérifiés par jour dans `data/groups.json` ; lundi : matchs à découvrir). Les tâches ne touchent jamais aux images
  ni à `data/logos.json` / `data/photos.json`.
- Robot GitHub Actions (`.github/workflows/robot.yml`, à xx h 07 et xx h 37) : `robot.mjs` écrit `data/feed.json`
  (actu RSS ou page d'accueil, vidéos YouTube officielles), puis `notify.mjs` envoie les notifications (infos,
  favoris, rappel des feuds à 21 h) et tient `data/push-state.json`.
- L'app lit `data/feed.json` sur raw.githubusercontent.com (frais), sinon la copie du site.

## Tester

- **Code regroupé** : `index.html` charge `js/app.min.js` (tout le code en un fichier compact), reconstruit
  automatiquement par `.github/workflows/build.yml` à chaque modification de `js/` ; à la main : `node tools/build-app.cjs`
  (le refaire avant chaque envoi). `dev.html` charge les fichiers séparés de `js/` : c'est elle qu'on ouvre pour les tests.
- Bundle de vérification : `node -e` avec esbuild (`/opt/npm-tools/node_modules/esbuild`, entrée `js/app.js`).
- Aperçu tout-en-un (mode démo) : `node tools/build-preview.cjs sortie.html --artifact`.
- Navigateur : serveur local `python3 -m http.server 8766` dans le dépôt + Playwright (Chromium préinstallé) ;
  bloquer gstatic/wikipedia/youtube (l'app passe alors en démo), servir un faux `feed.json` pour raw.githubusercontent.
- Ne jamais supprimer `media/` : il contient les vrais fichiers de Jose (fonds animés, musique).
