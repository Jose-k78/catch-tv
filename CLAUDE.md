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
- TCCCG (`js/views/tccg.js`, `#/tccg/…`) : la partie cartes (TCG), **ouverte à tous les membres connectés depuis le 6 nov.**
  (les réglages restent au modo : `S.isAdmin`), interface noir et doré (`body.tccg`), onglets Accueil / Call Up / Roster / Échange / Shop ;
  icône « TCCCG » dans la barre du bas (pastille rouge = propositions d'échange reçues).
- Plus de photos automatiques Wikimedia ni de page « Crédits photos » (retirées le 30 oct.) : seules les images choisies par
  le modérateur. Fonds animés et musique : copies légères (`media/bg/*-leger.mp4`, `media/music-leger.mp3`, originaux
  gardés), musique en pause par défaut.
- Modération › Images de l'app (`js/views/imagesadmin.js`, `#/parametres/images/<rubrique>`) : choisir la version en
  avant (`f`) parmi les versions (`v`) des photos des catcheurs (3 au plus : `slug-v2/-v3.webp`), ceintures, logos de shows,
  d'événements et de groupes ; ajouter une image (WebP fait dans le navigateur, envoyé avec la clé GitHub de l'admin) ;
  supprimer une version. Le robot `photos.mjs` connaît les versions (une photo déposée à la main passe en avant).
- TCC Play (`js/views/player.js`, `#/player`, dans la barre du bas ; la Recherche est une rubrique de l'accueil + bouton 🔍 en haut
  (`#srchbtn` dans index.html et dev.html), plus d'onglet Recherche ; « 🎲 Au hasard dans TCC Play » = liens du modo tirés au hasard ; logo `TPLAY` / icône `TPLAY_ICON` de js/links.js) : style Prime Video (onglets par
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
  dos des cartes).
- TCCCG (lot du 6 nov.) :
  - cartes aussi pour les catcheurs **sans photo** (rosters + fiches) : carte vide « Image à venir », identifiant = même nom de fichier
    que le robot des photos (`slugOf` de data.js) pour garder la carte quand Jose ajoute la photo ; le modo met l'image (Modo › Cartes ›
    « 🖼️ Sans image ») ; rareté d'après le score, comparée aux cartes avec photo ;
  - la carte prend le **format de son image** (`--ar`, mesuré au chargement de l'image, card.js) ; toucher l'image d'une grande carte = zoom ;
  - Call Up : « ✨ Vitrine » (cartes au max : rareté max, niveau max) ; bouton « 👁️ Cartes » sur chaque booster (vitrine, ⭐ cartes vedettes,
    toutes les cartes possibles) ; **vedettes** = catcheurs du show (booster d'un show, dont le reste = la promotion) ou champions (pack
    de promotion), ×3 par défaut (`featx`) ; en mode ✏️ le modo ajoute / retire / met en vedette / modifie / duplique : `data/tcg.json`
    « bx » = { idBooster: { add, del, feat, nofeat } } ; animation d'invocation : écran géant, rampe, ring dessinés (SVG) ;
  - éditeur de cartes du modo (`ACT.tcgmedit`, 8 nov.) : nom (`name`), années (`years`), promotion (`k`), faction (`fac`), raretés, archétype,
    stats, finisher, gimmick, médailles, boosters, image, buff, masquer ; « ⧉ Dupliquer » (copie complète dans `custom`), « ↺ carte d'origine » ;
    une carte renommée garde son nom réel `rn` pour les shows / titres / rosters (`realKey` de data.js) ;
  - envoi de fichiers du modo réparé (`upload` de modo.js) : images allégées en JPEG, sons / vidéos envoyés tels quels (25 Mo max) ;
  - combats : on choisit qui on affronte parmi tous les catcheurs du match (1 contre 1, 2 contre 2…, autant de cartes que d'adversaires),
    difficulté **Low** (normal) / **Mid** (×1,3) / **Top** (stats ×2), gains selon difficulté et nombre ; combat en cours gardé sur le
    téléphone (`ctv.tcgfight.<uid>`, 3 jours) : « Reprendre » sur l'accueil et dans Combats ; cases jamais vues brillantes, vues assombries ;
    **défis entre membres** (équipe d'un autre joueur menée par l'IA, ressources pour le gagnant, un peu pour le perdant) ;
  - **Échange** (`js/tcg/trade.js`) : rosters des membres, propositions (cartes et/ou ressources, ce qu'on donne est mis de côté),
    **enchères** de 24 h en argent (offre mise de côté dans `esc`, rendue si dépassée ; le vendeur valide quand il veut, sinon la plus
    haute gagne) ; tout dans la collection Firestore `tcgx` (ty trade / auc / duel), règlement automatique (`settle`) à chaque mise à jour.
- Lot du 11 nov. (1re partie de la grande refonte) :
  - images du dossier PC de Jose (pack Pro Wrestling Simulator, promotions de l'app seulement) : photos (ancienne gardée en version), titres
    remplacés (`BELT` de assets.js pointe vers les nouveaux noms ; 15 titres sans image dans le pack gardent l'ancienne), événements, équipes ;
    **banque d'images** `data/bank.json` (`S.bank` : slug → variantes dans `img/tcg/alt/`, `-alt`, `-champ`) ;
  - TCCCG : image alternative en UR / LR (`picOf` de card.js ; auto = 1re variante / version champion ; modo : vignettes Base / UR / LR de
    l'éditeur de carte → `bankPick`, champs `img`, `imgUR`, `imgLR`, "-" = aucune) ; 3 boosters gratuits par tranche de 5 h (`d.free` =
    "tranche:nombre:jour", `freeLeft`), 5 cartes par booster, SSR à 10 % ; cadeau unique (`items.gift1`) : 250 gimmicks + `items.mitb`
    (mallette → carte SSR au choix, booster « mitb » = Booster Agent Libre) ;
  - petite ceinture (`beltBadge` de photos.js) sur la photo du champion si le titre est tenu depuis plus de 7 jours (pas de spoiler) ;
  - recherche : fiches en premier, `knownNames` inclut les photos et les membres des groupes ; fiche : Entrance et « Son actu » retirées ;
  - page d'un show passé : notes de tous les membres (`B.showRates(k, d)`) ; notifications d'actu sans titre d'article.
  - 2e partie : fiche d'un ancien show (`eventView`) avec « J'ai vu ce show », note, notes des membres, liens du modo (`ev:K|titre|date`) ;
    TCC Play : fiches des shows dans la recherche (`#parch`), « La sélection du modo » (`play:mix`), chaîne YouTube par show (`chan:K|show`,
    `ACT.pchan`), le tout dans ⚙️ Réglages ; redirections du modo (`js/redir.js`, `redir:<lien>` dans links.json, appui long en mode ✏️ ou
    menu de partage) ; matchs à découvrir en vignettes ; `feudAct` sans répétition.
  - design v3 (11 nov.) : bloc « DESIGN V3 » à la fin de css/style.css (variables `--r` / `--r2`, sombre par défaut, onglets soulignés,
    cartes et boutons carrés, TCC Play façon YouTube) ; il surcharge les composants de TCC TV (`body:not(.tccg)`), le TCCCG garde son noir et or.
    Toute nouvelle règle de design va dans ce bloc. Icônes de l'en-tête en SVG au trait (index.html, dev.html, media.js).
  - tous les boosters = 5 cartes (`pull(b, mega ? 15 : 5)`, le champ `n` n'est plus utilisé) ; grande affiche `.hero.bb` en tête d'accueil ;
    calendrier : `tour: 1` sur un événement = simple date de tournée (affichée, mais jamais « prochain PPV » ni compte à rebours du bandeau) ;
    la tâche de 19 h 23 doit ajouter les dates de tournée NJPW / Stardom / Marigold avec `tour: 1` (sources : njpw1972.com, wwr-stardom.com,
    voicesofwrestling.com « upcoming schedules ») ; animations TCCCG (bloc « animations retravaillées » de style.css).
  - doublons : `photos.json` a un champ `merged` { ancien slug: nouveau } (catcheurs fusionnés ; `S.photosMerged`, `cardById` suit le lien
    pour que les joueurs gardent leurs cartes) et des alias (anciens noms, vrais noms) dans `n` ; `knownNames` cumule les alias ;
    `#/player/e/K|show|date` redirige vers `#/ev/…` (une seule page par show) ; la page Recherche vide n'a plus Explorer (il est sur l'accueil).
  - Jose a renoncé aux robots GitHub (on garde les tâches de Claude). Reste seulement : compléter les dates Stardom / Marigold de fin 2026
    (sources données par Jose : https://wwr-stardom.com/schedule/?ym=AAAAMM et https://dsf-marigold.com/events/ (+ /page/2/) ; Marigold fait
    le 11 nov. ; Stardom fait le 11 nov. d'après les captures de Jose : novembre = Stardom World « 配信スケジュール » (https://www.stardom-world.com/),
    décembre = aperçu Google à revérifier ; la page wwr-stardom ne renvoie qu'octobre à Claude — chaque mois, compléter avec `tour: 1`).
- Lot du 11 nov. (après-midi) :
  - **Évolution par ceinture** (`js/tcg/evo.js` + data.js) : objet `belt:<idTitre>` ; donner une ceinture que le catcheur a vraiment tenue
    (historique des titres `S.titles`) change l'id de SA carte en `<base>~<idTitre>` (une seule carte, niveau et rareté gardés, la ceinture
    est perdue ; redonner une ceinture = revenir à cette forme). Bonus selon le prestige (`prestige` : mondial +15 %, secondaire +10 %,
    équipe +8 %, répartition `TILT`), pouvoir tiré au hasard rangé dans la carte (`inst.pw`, `POWERS`, appliqués dans fight.js).
    Modo (`data/tcg.json`) : `evo["<base>|<titre>"] = { off, name, years, gimmick, img, bonus, st, pw }`, `evoAdd[base] = [titres]`,
    `beltPrice[idTitre]`. Ceintures : gagnées en combat (`BELT_DROP` × difficulté), 4 « ceintures du jour » au Shop (`dailyBelts`),
    onglet Objets (`beltsSection`). Vraie ceinture en petit sur les cartes (`beltMark`).
  - Combats : tableau des types + ▲▼ (avantage) à la préparation, gains détaillés (`gainsBox`, `gainLine`), bande des types en combat ;
    Call Up : confirmation avant d'invoquer (`openNow`), révélation plus longue (appui ignoré 0,9 s) ; Roster : appui long =
    sélection multiple pour virer ; médaille possible sans doublon (confirmation).
  - « Je veux voir » (`js/want.js`) : entrées d'historique `w_<id du show ou mid du combat>` (commentaire `[WANT]` / `[WANTM]`, note 0),
    exclues des compteurs ; retirées toutes seules quand le show / combat est vu (`syncWants`) ; page `#/aregarder`, lien discret
    accueil + profil seulement si la liste n'est pas vide. Page d'un show : « À venir » en rangée qui défile.
  - Tournois : outils du modo (`js/views/tnedit.js`) — créer, modifier (tableau et blocs en texte), supprimer, gagnant de chaque match,
    clôturer / rouvrir, à la une (`feat`), image (`img`, dossier img/tournois/), verrou `lock` (la tâche du soir n'y touche plus).
  - **Sauvegardes TCCCG** (11 nov. au soir, Jose a perdu sa partie) : la cause = une partie vide affichée avant l'arrivée de la vraie
    (ou après une erreur de connexion) puis enregistrée par-dessus. Maintenant : `S.tcgReady` (vraie partie reçue de Firebase ; un
    « pas de partie » venant seulement du cache est ignoré), écran « Chargement de ta partie » tant qu'elle n'est pas là, `commit`
    met les changements en attente (`flushWait`), et refuse d'enregistrer une partie « en recul » (`behind` : niveau ou boosters
    ouverts plus bas que `S.tcgSrv`). Copies : robot (`.github/scripts/tcg-backup.mjs`, étape de robot.yml toutes les 30 min) →
    Firestore `tcgbak/{uid}_max` (la plus avancée, jamais remplacée par une partie qui recule) et `{uid}_j0…_j6` (une par jour) ;
    téléphone (`ctv.tcgbak.<uid>` : last, best, days). Page `#/tccg/sauvegardes` (`js/tcg/backup.js`) : restaurer ; le modo restaure
    pour un membre. Règles v12 : une partie ne peut plus reculer (sauf modo), `tcgbak` lisible par son joueur et le modo.
- Notes : demi-étoiles de 0 à 5,5 (`RMAX`, `fmtR`, `stars`, `ratePick` / `pickRate` de util.js ; 6e étoile orange = bonus).
- Historique : `g_<id>` = note d'un segment, `q_<id>` = segment préféré (comment = nom du show) ; préfixes m_/s_/f_/g_/q_ exclus
  des compteurs de shows (spoil.js, trophies.js, account.js). Profil : « Ses segments préférés ».
- Page d'un show passé (`pastPage` de catalog.js) : lecteur en haut (lien ⭐ du modo, sinon 1er lien, sinon vidéo officielle),
  note du show (moyenne des membres) dessous, « Vidéos du show », résumé sans spoiler, résumé avec spoiler (matchs notables
  `rateBtn`, segments ☆ notables / ♡ favoris), Où regarder, puis les liens du modo tout en bas.
- Matchs de référence : lien du modo sous la clé `ref:<match>|<événement>` (links.json) lancé directement, 🔗 en mode modification.
- TCC Play › recherche : bloc « Sur le web » (API publiques Dailymotion et archive.org, sans clé) + raccourcis YouTube / VK Video /
  OK.ru / Dailymotion / archive.org. C'est une simple recherche : Claude n'ajoute toujours aucun de ces liens.
- TCCCG combats animés : `js/tcg/sfx.js` (sons fabriqués par l'app ; fichiers du modo dans `data/tcg.json` « bgm » : win, lose,
  fight, bell, hit, finisher, taunt, crowd ; fond des combats = asset `fightbg`), intro 3-2-1 + 3 cloches, bandeau de tour,
  dégâts animés, popups KO / TAG, finisher animé. Vrais finishers dans `data/finishers.json` (`items: { nom: finisher }`).
  Accueil TCCCG façon Dokkan (carte leader + bulle, bannières, gros bouton COMBATS).
- Rubrique Tournoi (`js/views/tournois.js`, `#/tournois`, `#/tournois/g1`, `#/tournoi/<id>`) d'après `data/tournaments.json`.
- Lecteur musical (`js/ytmusic.js`) : playlists YouTube du modo dans `data/media.json` (`pls`), bouton 🎵 en haut ; juste le
  son (lecteur caché, demande de Jose), commandes dans un petit panneau sous 🎵.
- Mode modification du modo : `S.realAdmin` = c'est le modo ; `S.isAdmin` = modo ET bouton ✏️ activé (`ctv.edit`). Sans le
  bouton, le modo voit l'app comme un membre. Toujours tester avec `S.isAdmin` pour afficher une option de modification.
- Accueil : aujourd'hui / cette nuit (6 h–18 h = aujourd'hui, 19 h–5 h = cette nuit), vient de sortir, programme, prochain PLE
  (WWE) ou PPV (autres, `bigWord`), infos. Communauté (sondages, pronostics, storyline, activité) dans l'onglet Membres ;
  Matchs à découvrir aussi sur l'accueil ; rubrique Recherche en bas de l'accueil (barre, catcheur à découvrir, Explorer). « Draw » au lieu de « Match nul ».
- Babies : sans choix du modo, 8 catcheuses tirées au hasard dans les rosters féminins (même tirage pour tout le mois).
- Clans / équipes : le modo les ajoute, modifie, supprime depuis la fiche d'un groupe (data/groups.json via GitHub).
- Vitrine : jusqu'à 5 trophées (`tro.v1`…`v5`). Bouton « 🏆 Mes trophées » sur son profil (retiré de l'en-tête le 7 nov. : l'en-tête
  dépassait de l'écran et le téléphone dézoomait tout le site — toujours vérifier la largeur à 320 px avant d'ajouter un bouton en haut). Appui long sur une note de son profil pour la modifier.
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
- `firestore.rules` : règles (version 12 : partie TCCCG qui ne recule pas, collection `tcgbak` ; version 11 : collection `tcgx` pour échanges / enchères / défis, champs `name` et `esc` de `tcg` ;
  version 10 : notes = nombre de 0 à 5,5). À chaque changement, donner le texte complet à Jose pour qu'il le colle
  dans Firebase › Firestore › Règles › Publier.

## Consignes pour les tâches planifiées (à suivre à chaque passage, en plus de leur propre consigne)

- 7 h 44 : ne plus créer de sondage de type « babies » (la Babies du mois est un tournoi à 8 géré dans l'app).
- 19 h 23 :
  - vérifier les **jours et heures de diffusion** de chaque show hebdo (`data/calendar.json` : `wd`, heures) et les corriger ;
  - tenir `data/tournaments.json` à jour (format décrit dans son champ `note`) : tout tournoi en cours ou annoncé des
    promotions de l'app (G1 Climax, World Tag League, 5★STAR Grand Prix, tournois CMLL, Dusty Rhodes Tag Team Classic…),
    avancement du tableau ou des blocs, vainqueur, puis l'article de bilan (`art`) à la fin ; compléter `series.*.past` ;
    **un tournoi avec `"lock": true` a été verrouillé par le modo : ne jamais le modifier ni le supprimer** (on peut seulement
    compléter `series.*.past`) ; ne pas retirer les champs posés par le modo (`feat` = à la une, `img` = image, `modo` = date
    de sa dernière modif). Si un tournoi n'est pas verrouillé mais a `modo`, garder ses choix (gagnants, noms) et seulement compléter ;
  - fiches (`data/wrestlers.json`) : `dc` = date de décès (AAAA-MM-JJ) pour un catcheur décédé ; `tt` = palmarès complet
    (titres et tournois gagnés, Royal Rumble… seulement des promotions de l'app) ;
  - groupes : membres de The 946 (WWE, depuis 2026), MFT, The Bloodline 2026.
  - résumés des PLE / PPV : s'aider aussi de https://mibih.wordpress.com/category/wrestling-reviews/latest-wrestling-ppv-reviews/ (réécrire en français, ne pas copier) ;
  - shows déplacés : `no` (dates sans épisode) et `e` (épisode spécial à une autre date) dans `data/calendar.json` ; heures toujours
    données dans le fuseau du show (`h` + `tz`) : le changement d'heure est calculé par l'app ;
  - compléter `data/finishers.json` (finisher actuel de chaque catcheur des rosters, d'après Wikipédia ; ne pas écraser ceux déjà là) ;
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
