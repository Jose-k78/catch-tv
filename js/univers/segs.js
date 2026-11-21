// Mode Univers : 200 segments d'avant-match et d'après-match (d'après les deux listes de 100 envoyées par Jose, en 10 familles chacune).
// Une ligne = "clé|nom|texte|fréquence|impact|conditions|effets"
//  - texte : {a} et {b} = les deux catcheurs, {c} = le partenaire de {a}, {m} = son manager, {f} = son clan, {il} / {e} = il·elle, accord de {a}
//  - fréquence : 0 commun, 1 inhabituel, 2 rare, 3 légendaire (les rares deviennent de vrais événements : actu, historique du catcheur)
//  - impact : 0 aucun, 1 faible, 2 moyen, 3 majeur
//  - conditions (toutes nécessaires) : riv rivalité, tit titre en jeu, chp {a} champion, out {a} vient de l'extérieur, los {a} a perdu,
//    win il y a un vainqueur, fac {a} dans un clan, mgr {a} a un manager, tm {a} a un partenaire, part {a} et {b} partenaires dans le match,
//    heel / face, big grand show, main main event, dirty / clean fin du match, vet vétéran contre jeune, frd amis, enemy ennemis… (voir segx.js)
//  - effets : hN chaleur de la rivalité, rN relation, b.X risque de bagarre, cN public, t1 / t-1 heel / face turn, pop, yN hype,
//    hurt {b} fatigué·e, nodq, add3, tion, ban, sanc, shot, sl, x, team, cash, endsl, kick, join, mgrq, now, crd+ / crd-, mor+ / mor-, dem,
//    gm (en mode Mark, le GM doit réagir), n1 (fait l'actu)
const FAM = {
  pre: {
    conf: ["Confrontations et face-à-face", "ring", [2, 3, 5], "confrontation face-à-face regard provocation rivalité tension"],
    surp: ["Interventions et surprises", "ring", [5, 3], "intervention surprise attaque embuscade retour début entrée"],
    mind: ["Psychologie et mind games", "ring", [2, 3], "psychologie mind games provocation moquerie mépris"],
    off: ["Le GM et les officiels", "ring", [2, 3], "gm general manager officiel annonce règle stipulation sanction arbitre"],
    prob: ["Problèmes et imprévus", "bs", [6, 3], "problème imprévu retard technique blessure"],
    grp: ["Managers, clans et partenaires", "ring", [2, 3], "manager faction clan partenaire équipe alliance accompagnateur"],
    tit: ["Championnats", "ring", [3, 5], "ceinture titre champion championnat challenger mallette"],
    pub: ["Le public", "ring", [3, 5], "public fans foule chants réaction"],
    spt: ["Technique et sport", "ring", [1, 4], "technique sportif échauffement arbitre règles force"],
    rare: ["Rares et coups de théâtre", "ring", [3, 5, 2], "rare mystère révélation scénario surprise"]
  },
  post: {
    att: ["Attaques après le match", "ring", [0, 3], "attaque agression bagarre embuscade tabassage"],
    tra: ["Trahisons et retournements", "ring", [2, 3, 5], "trahison turn retournement alliance partenaire"],
    def: ["Défis et confrontations", "ring", [2, 3], "défi challenge confrontation revanche micro"],
    tit: ["Championnats et titres", "ring", [3, 5], "ceinture titre champion championnat mallette cash-in"],
    ret: ["Retours et débuts", "ring", [5, 3], "retour début surprise nouveau revient"],
    emo: ["Émotion et respect", "ring", [3, 2], "respect émotion hommage poignée de main réconciliation"],
    cha: ["Chaos et interventions", "ring", [0, 3], "chaos bagarre générale intervention sécurité gm"],
    mind: ["Psychologie et mind games", "ring", [2, 3], "psychologie mind games provocation moquerie vidéo"],
    nic: ["Situations insolites", "ring", [3, 2], "insolite imprévu musique micro fan"],
    nar: ["Grandes histoires", "ring", [2, 5, 3], "histoire scénario révélation annonce clan tournoi"]
  }
};
const ROWS = {
  pre: {
    conf: [
      "a_faceoff|Face-à-face|{a} et {b} se retrouvent nez à nez au centre du ring.|0|1|riv|h4",
      "a_stare|Duel de regards|{a} et {b} se fixent longuement : personne ne baisse les yeux.|0|1|riv|h3 c1",
      "a_push|Provocation physique|{a} pousse {b} des deux mains. Le ton monte.|0|1|riv|h5 r-3",
      "a_shove|Bousculade|{a} et {b} se bousculent, l’arbitre s’interpose.|0|1|riv|h5 r-4 b.2",
      "a_brawl|Bagarre avant la cloche|{a} se jette sur {b} avant la cloche : il faut séparer tout le monde !|1|2|riv|h7 r-6 b.5 c3 gm",
      "a_slap|Gifle avant le match|{a} gifle {b} ! Le public explose.|1|2||h7 r-8 c4",
      "a_noback|Refus de reculer|{a} refuse de rejoindre son coin malgré l’arbitre.|0|1||h3",
      "a_beltstare|Le regard sur la ceinture|{b} fixe la ceinture que porte {a}, sans un mot.|0|1|tit|h4 y1",
      "a_mgrfight|Dispute entre managers|Les managers de {a} et de {b} se disputent au bord du ring.|1|1|mgr2|h4 c2",
      "a_ropes|Provocation depuis les cordes|{a} provoque {b} depuis son coin, debout sur la deuxième corde.|0|0||h2"
    ],
    surp: [
      "a_entatk|Attaque pendant l’entrée|{a} attaque {b} pendant son entrée, avant même la cloche !|1|2|riv|h8 r-8 hurt c3 gm",
      "a_bsatk|Attaque venue des coulisses|{a} surgit des coulisses et attaque {b} !|1|2|out|h8 r-8 hurt c3 sl gm",
      "a_facent|Tout le clan en renfort|Tout {f} accompagne {a} jusqu’au ring.|0|1|fac|c2 y1",
      "a_legacc|Avec une légende|{a} arrive accompagné{e} d’une légende du catch. Ovation !|2|2||c5 pop",
      "a_return|Retour inattendu|La musique de {a} retentit : {il} est de retour !|2|3|retn|c8 pop n1",
      "a_debut|Débuts surprise|Un nouveau visage : {a} fait ses débuts ce soir !|1|2|deb|c5 pop n1",
      "a_musicstop|Entrée interrompue|La musique de {a} s’arrête net. Silence dans la salle…|1|1||c2",
      "a_rivmusic|La musique d’un rival|La musique de {a} retentit en pleine entrée de {b} !|1|2|out|h6 c4 sl",
      "a_fakeent|Fausse entrée|Le public croit voir arriver {a}… mais c’est une mise en scène de {b}.|2|1|out|h4 c3",
      "a_ramp|Embuscade sur la rampe|{a} attend {b} en haut de la rampe et lui tombe dessus.|1|2|riv|h7 r-6 hurt gm"
    ],
    mind: [
      "a_ignore|Ignoré !|{a} fait comme si {b} n’existait pas.|0|0||h2",
      "a_fakehand|Fausse poignée de main|{a} tend la main à {b}… puis la retire en souriant.|0|1|heel|h4 r-3",
      "a_beltshow|Provocation avec la ceinture|{a} brandit son titre sous le nez de {b}.|0|1|chp|h4 y1",
      "a_mockent|Imitation de l’entrée|{a} imite la démarche de {b}. Le public hue.|1|1||h4 r-3",
      "a_mockfin|Imitation du finisher|{a} mime la prise de finition de {b}.|1|1||h4",
      "a_personal|Provocation personnelle|{a} rappelle à {b} une vieille défaite. Ça touche.|1|1|riv|h6 r-5",
      "a_slowchamp|Le champion prend son temps|{a} marche très lentement vers le ring pour énerver {b}.|0|0|chp|h3",
      "a_back|Dos tourné|{a} tourne le dos à {b} pour montrer son mépris.|0|0||h3",
      "a_boo|Faire huer l’adversaire|{a} demande au public de huer {b}.|0|1|heel|h3 c2",
      "a_camera|Message à la caméra|{a} regarde la caméra et parle directement aux fans.|0|1||y1 c1"
    ],
    off: [
      "a_rules|Annonce de dernière minute|Le GM change les règles du match de {a} juste avant la cloche.|1|2||c3 y1",
      "a_add3|Un troisième participant|Le GM annonce que {a} entre dans le match : ça devient un triple menace !|2|2|out|c5 add3",
      "a_nodq|Pas de disqualification|Le GM annonce que {a} et {b} se battront sans disqualification !|1|2|riv|c5 h4 nodq",
      "a_mgrban|Managers interdits au bord du ring|Le GM interdit au manager de {a} de rester autour du ring.|1|1|mgr|ban c1",
      "a_threat|Menace de suspension|Le GM prévient {a} : à la moindre triche, c’est la suspension.|1|1|heel|sanc",
      "a_specref|Arbitre spécial|Le GM annonce un arbitre spécial pour {a} contre {b}.|1|1|riv|y1 c2",
      "a_oldstip|Stipulation historique|Le GM ressort une vieille stipulation de la maison pour {a} contre {b}.|2|2|big,riv|c4 y1 nodq",
      "a_stakes|Enjeu en plus|Le GM annonce que le gagnant entre {a} et {b} aura un match de titre !|1|2||shot c3",
      "a_titleon|Le titre finalement en jeu|Le GM annonce que le titre de {a} sera finalement en jeu ce soir !|2|3|chpnt|tion c5 n1",
      "a_ultim|Ultimatum du GM|Le GM prévient {a} et {b} : à la moindre faute, sanction !|0|1|riv|sanc"
    ],
    prob: [
      "a_late|Catcheur en retard|{a} n’est pas encore arrivé{e} : le match est retardé.|1|1||c-3",
      "a_musicfail|Problème de musique|La musique de {a} ne marche pas. Moment gênant…|1|0||c-2",
      "a_gear|Problème d’équipement|{a} doit retourner au vestiaire pour arranger sa tenue.|1|0||c-1",
      "a_wrongname|Erreur de présentation|L’annonceur se trompe et présente le mauvais adversaire de {a} !|1|0||c1",
      "a_refswap|Problème avec l’arbitre|L’arbitre prévu pour {a} doit être remplacé au dernier moment.|1|0||",
      "a_cantgo|Incapable de combattre ?|{b} se tient le bras : le médecin hésite à le laisser combattre.|2|2||hurt c-2",
      "a_warmup|Blessure à l’échauffement|{b} s’est fait mal à l’échauffement mais veut y aller quand même.|2|2||hurt c2",
      "a_dispute|Désaccord sur les règles|{a} conteste les conditions du match devant l’arbitre.|0|1||h2",
      "a_refuse|Refus de combattre|{a} refuse de monter sur le ring tant que {b} n’est pas puni !|2|2|heel|h5 c-2 gm dem",
      "a_lights|Panne dans l’arène|Les lumières s’éteignent pendant l’entrée de {a}…|2|1||c4 y1"
    ],
    grp: [
      "a_mgrtalk|Dernières consignes du manager|{m} donne ses consignes à {a} au bord du ring.|0|0|mgr|c1",
      "a_mgrthreat|Le manager menace|{m} prévient {b} : il interviendra s’il le faut.|0|1|mgr|h4",
      "a_partacc|Un partenaire en renfort|{c} accompagne {a} jusqu’au ring.|0|0|tm|c1",
      "a_partno|Le partenaire ne vient pas|{a} arrive seul{e} : {c} n’est pas là après leur dispute.|1|2|tm|r-10 c2",
      "a_secret|Discussion secrète|{a} et {c} échangent quelques mots à voix basse avant le match.|0|0|tm|r3",
      "a_facfight|Dispute dans le clan|Ça se dispute dans {f} juste avant le combat de {a}.|1|2|fac|r-8 c2",
      "a_mgrquit|Le manager l’abandonne|{m} quitte {a} juste avant le match !|2|3|mgr|c4 n1 mgrq mor-",
      "a_recruit|Recrutement avant le match|{f} propose à {b} de rejoindre le clan de {a}.|2|2|fac|r6 h3",
      "a_tempally|Alliance d’un soir|{a} et {b} annoncent qu’ils feront équipe ce soir, juste pour ce combat.|1|1|tagm|r8",
      "a_leader|Avertissement du leader|Le chef de {f} vient donner un dernier avertissement à {a}.|1|1|fac|mor+"
    ],
    tit: [
      "a_beltpres|Présentation du titre|L’annonceur présente la ceinture de {a}, tenue bien haut par l’arbitre.|0|1|tit|y1 c2",
      "a_keepbelt|Il garde la ceinture|{a} refuse de donner sa ceinture à l’arbitre jusqu’à la dernière seconde.|0|1|tit|h3",
      "a_inspect|Inspection du titre|L’arbitre inspecte la ceinture de {a} avant le match.|0|0|tit|",
      "a_chdefy|Défi du champion|{a} prend le micro et se moque de {b}, son challenger.|0|1|tit|h4 y1",
      "a_touch|Le challenger touche le titre|{b} pose la main sur la ceinture de {a}. Gros regard.|1|1|tit|h5",
      "a_cerem|Cérémonie officielle|Les officiels présentent {a}, {b} et le championnat. Grande occasion !|1|1|tit,big|c4 y1",
      "a_lastlook|Dernier regard sur le titre|{b} jette un dernier regard à la ceinture de {a} avant de rejoindre son coin.|0|0|tit|h2",
      "a_exchamp|Un ancien champion au premier rang|{a}, ancien champion, est assis{e} au premier rang pour regarder {b}.|1|1|tit,exch|c3 h3",
      "a_case|La mallette dans la salle|{a} apparaît avec sa mallette et fixe le ring…|1|2|tit,cas|h4 c4 y1",
      "a_handbelt|La ceinture rendue à l’arbitre|{a} tend enfin sa ceinture à l’arbitre. C’est parti.|0|0|tit|"
    ],
    pub: [
      "a_chant|Le public chante son nom|Le public chante le nom de {a} pendant toute son entrée.|0|1|face|c4 pop",
      "a_boofav|Le favori hué|Surprise : le public hue {a}, pourtant aimé{e} d’habitude.|2|2|face|c-2 crd-",
      "a_wantother|Le public veut un autre|Le public scande le nom de {a}, qui n’est même pas dans le match !|1|1|out|c2 crd+",
      "a_fans|Avec les fans|{a} prend le temps de taper dans les mains des fans.|0|0|face|c2",
      "a_heckler|Un fan l’interpelle|Un fan interpelle {a} au premier rang… et {il} lui répond !|1|1||c2",
      "a_gmchant|Chants contre le GM|Le public chante contre la direction pendant l’entrée de {a}.|1|1||c1",
      "a_heelpop|Ovation pour un heel|{a} reçoit une énorme ovation… alors qu’{il} joue les méchants !|2|2|heel|c4 crd+",
      "a_split|Public divisé|La salle est coupée en deux : moitié pour {a}, moitié pour {b}.|1|1|riv|c3 y1",
      "a_sign|Une pancarte remarquée|{a} remarque une pancarte dans le public et la montre du doigt.|0|0||c1",
      "a_stands|Dans les tribunes|{a} quitte la rampe pour aller voir les fans dans les tribunes.|1|1||c3"
    ],
    spt: [
      "a_warm|Échauffement sur le ring|{a} s’échauffe sur le ring avant la cloche.|0|0||",
      "a_strength|Test de force|{a} et {b} se mesurent épaule contre épaule.|0|1||h2 c1",
      "a_gearchk|Vérification de l’équipement|L’arbitre vérifie les genouillères et les bandes de {a}.|0|0||",
      "a_talk|Quelques mots entre adversaires|{a} et {b} se parlent calmement avant le match.|0|0|frd|r2",
      "a_demo|Démonstration de technique|{a} montre quelques prises pendant l’échauffement.|0|0||c1",
      "a_coach|Conseils du mentor|Le mentor de {a} lui donne un dernier conseil.|1|0||mor+",
      "a_nopads|Sans protections|{a} retire ses protections : {il} veut un vrai combat.|1|1||c2 h2",
      "a_ropetest|Test des cordes|{a} teste les cordes avant le match.|0|0||",
      "a_count|Retour dans les coins|L’arbitre ordonne à {a} et {b} de regagner leurs coins.|0|0||",
      "a_rules2|Règles spéciales annoncées|L’annonceur explique les règles du combat entre {a} et {b}.|0|0||"
    ],
    rare: [
      "a_secretstip|Stipulation secrète|Une vidéo sur l’écran géant révèle une condition cachée du match de {a} !|3|3|big|c6 y2 nodq n1",
      "a_masked|Silhouette masquée|Une silhouette masquée observe {a} depuis les tribunes…|2|2||c4 y1",
      "a_oldriv|Un ancien rival dans les tribunes|{a} est assis{e} dans les tribunes pour regarder {b}.|2|2|out|h5 c3 sl",
      "a_boss|Le président intervient|Le président de la fédération arrive pour annoncer une décision sur le match de {a} !|3|3|big|c5 y1 n1",
      "a_forfeit|Forfait… puis retour|{a} semble abandonner, remonte la rampe… puis fait demi-tour !|2|1||c3",
      "a_partswap|Changement de partenaire|{a} change de partenaire à la dernière minute : {c} est écarté !|3|2|tm,tagm|r-10 c2",
      "a_nofriend|Refus de combattre un ami|{a} hésite à affronter {b}, son ami.|2|2|frd|r4 c2",
      "a_nomentor|Refus d’affronter son mentor|{b} ne veut pas se battre contre {a}, celui qui l’a formé.|3|2|vet,frd|r3 c3",
      "a_leave|Départ du ring|{a} refuse de participer et repart vers les coulisses !|2|2|heel|c-3 h4 gm dem",
      "a_cliff|Coup de théâtre avant la cloche|Une apparition inattendue coupe le lancement du match de {a} !|3|3|big,main|c6 y2 n1"
    ]
  },
  post: {
    att: [
      "p_assault|Attaque après le match|Mauvais perdant, {a} attaque {b} juste après la cloche.|0|2|los|h7 r-8 c2 gm",
      "p_beatdown|Tabassage collectif|{a} et {f} tombent à plusieurs sur {b}.|1|2|los,fac|h8 r-10 c3 hurt gm",
      "p_surp|Attaque surprise|{a} surgit de nulle part et attaque {b} !|1|2|out|h8 r-8 c4 sl gm",
      "p_champatk|Le champion attaque son challenger|{a}, champion{e}, attaque {b}, son prochain challenger.|1|2|chout|h7 r-6 c3 sl",
      "p_backatk|Attaque dans le dos|{a} attaque {b} dans le dos pendant sa célébration.|1|2|los|h8 r-10 c3 gm",
      "p_weapon|Attaque avec une chaise|{a} attrape une chaise et frappe {b} !|2|2|los,heel|h9 r-12 c4 hurt gm",
      "p_clan|L’attaque d’un clan|{f} débarque et attaque {b} !|1|3|facout|h8 c4 sl gm",
      "p_double|Ils continuent de se battre|{a} et {b} continuent de se battre après la fin du match.|0|1|riv|h6 r-5 c3 b.5 gm",
      "p_expart|Attaque d’un ancien partenaire|{a}, son ancien partenaire, attaque {b} !|2|3|expart|h9 r-15 c5 sl n1 gm",
      "p_mgratk|Attaque du manager|{m} attaque lui-même {b} après la défaite de {a} !|1|2|los,mgr|h6 c4"
    ],
    tra: [
      "p_heelturn|Heel turn|{a} se retourne contre {b}, son partenaire, et l’attaque !|3|3|part,face|t1 r-50 h12 c6 n1 x",
      "p_faceturn|Face turn|{a} refuse d’humilier {b} avec son clan et prend sa défense !|3|3|fac,heel|t-1 r20 c6 n1",
      "p_betray|Trahison d’un partenaire|{a} frappe {b}, son partenaire d’équipe, après le match !|2|3|part|r-45 h10 c5 n1 x",
      "p_mentor|Trahison du mentor|{a} révèle qu’{il} manipulait {b} depuis le début.|3|3|vet,frd|t1 r-50 h10 n1",
      "p_kick|Abandonné par son clan|{f} laisse {b} seul au milieu du ring et s’en va.|2|3|facl|r-30 c4 n1 kick",
      "p_fakeshake|Fausse réconciliation|{a} serre la main de {b}… puis l’attaque !|1|2|riv|h8 r-10 c4",
      "p_unlikely|Alliance inattendue|{a} et {b}, deux anciens ennemis, s’unissent contre un ennemi commun.|2|2|enemy|r25 c4 team",
      "p_secret|L’alliance secrète révélée|{a} révèle qu’{il} travaillait avec ceux qui s’en prennent à {b} !|3|3|out|h10 c5 n1 sl",
      "p_abandon|Le partenaire laissé seul|{a} laisse {b} se faire attaquer sans bouger.|1|2|part|r-20 h4 c2",
      "p_steal|Le moment volé|{a} vient voler le moment de gloire de {b}.|1|1|out|h5 c2 sl"
    ],
    def: [
      "p_open|Open challenge|{a} prend le micro : {il} veut affronter n’importe qui !|0|1|win|c2 y1",
      "p_tshot|Il réclame son match de titre|{a} réclame un match pour le titre de {b} !|0|2|winchp|shot h5 c3",
      "p_refused|Défi refusé|{b}, champion{eb}, refuse publiquement le défi de {a}.|1|1|winchp|h4 sl",
      "p_silent|Face-à-face silencieux|{a} et {b} se regardent sans dire un mot.|0|1|riv|h4",
      "p_staredown|Nez à nez|{a} rejoint {b} sur le ring : nez à nez, avant d’être séparés.|0|1|out|h5 sl",
      "p_brawl|La discussion dégénère|L’échange au micro entre {a} et {b} tourne à la bagarre !|1|2|riv|h7 r-6 b.6 c3 gm",
      "p_stipdef|Défi avec stipulation|{a} propose à {b} un match avec une stipulation spéciale.|1|2|riv|h5 y1",
      "p_now|Il veut le match tout de suite|{a} exige d’affronter {b} immédiatement !|2|2|out|h5 c4 now gm",
      "p_ultim|Ultimatum|{a} exige une revanche contre {b}, sinon ça va mal finir.|0|1|los|h5 sl",
      "p_facdef|Défi entre clans|Le clan de {a} lance un défi au clan de {b}.|2|2|fac2|h6 y1"
    ],
    tit: [
      "p_celeb|Célébration du nouveau champion|{a} célèbre son titre avec le public. Les confettis tombent !|0|2|chg|c5 pop",
      "p_beltsteal|Vol de ceinture|{a} vole la ceinture de {b} et l’emporte dans les coulisses !|1|2|chout2|h7 c3 sl",
      "p_protest|Contestation du résultat|{a} hurle sur l’arbitre : pour {il}, le compte était trop rapide.|0|1|los,dirty|h4",
      "p_cashin|Cash-in !|{a} débarque avec sa mallette et l’encaisse sur {b}, épuisé{eb} !|3|3|cas,tit|cash c8 n1",
      "p_cashstop|Cash-in interrompu|{a} arrive avec sa mallette… mais quelqu’un l’en empêche !|2|2|cas,tit|c4 h3",
      "p_humil|Le champion humilié|{a} pose son pied sur {b}, champion{eb} battu{eb}, et lève les bras.|1|2|win,chpl|h6 c3",
      "p_passbelt|Passage de flambeau symbolique|{b}, le vétéran, tend symboliquement la ceinture à {a}.|3|2|vetl|pop c4 r10",
      "p_keepbelt|Il refuse de rendre le titre|{b}, ancien{eb} champion{eb}, garde la ceinture et refuse de la rendre à {a}.|2|2|chg|h6 c2 sl",
      "p_3way|Un troisième veut sa chance|{a} débarque pour réclamer sa place dans la course au titre de {b}.|1|2|tit,out|h4 y1 sl",
      "p_reign|Un règne historique|{a} annonce qu’{il} veut battre le record du plus long règne.|1|1|ret|y1 c1"
    ],
    ret: [
      "p_return|Retour surprise|La musique de {a} retentit : {il} est de retour !|2|3|retn|c8 pop n1",
      "p_debut|Débuts dans la fédération|{a} fait ses débuts et monte sur le ring !|1|2|deb|c5 pop n1",
      "p_legend|Une légende apparaît|Une légende du catch vient saluer {a} sur le ring.|3|2|big,win|c6 pop",
      "p_exchamp|Retour d’un ancien champion|{a}, ancien{e} champion{e}, revient réclamer sa place face à {b}.|2|2|exch|c5 sl",
      "p_inj|Retour d’un blessé|{a}, qu’on croyait blessé{e}, revient plus tôt que prévu !|3|2|injb|c6 pop n1",
      "p_expartret|Retour d’un ancien partenaire|{a}, l’ancien partenaire de {b}, revient !|2|2|expart|c5 r10",
      "p_newclan|Une nouvelle force|Plusieurs catcheurs entourent {a} sur la rampe : quelque chose se prépare…|3|3|win|c5 y1 n1",
      "p_newmgr|Nouveau manager|{a} se présente avec un nouveau manager à ses côtés.|2|1|mgr|c3",
      "p_unmask|Le masque tombe|{a} enlève son masque devant tout le monde !|3|3|lucha,los|c7 n1",
      "p_retint|Retour interrompu|{a} revient… mais {b} l’attaque avant qu’{il} puisse parler !|2|2|retn,win|h7 c3 sl"
    ],
    emo: [
      "p_shake|Poignée de main|{a} et {b} se serrent la main. Respect.|0|1|clean|r8 h-3 c2",
      "p_help|Aide pour se relever|{a} aide {b} à se relever. Le public applaudit.|0|1|face,clean|r10 c2",
      "p_torch|Passage de flambeau|{b}, le vétéran, lève le bras de {a}, le jeune qui l’a battu.|2|2|vetl|r10 pop c4",
      "p_farewell|Adieu au ring|{a} prend le micro et annonce que c’est bientôt la fin…|3|3|fw|c8 n1",
      "p_family|La famille sur le ring|La famille de {a} {il2} rejoint sur le ring pour fêter ça.|2|1|chg|c4 pop",
      "p_sorry|Excuses publiques|{a} présente ses excuses à {b} devant tout le monde.|2|2|enemy|r20 h-5 c3",
      "p_recon|Réconciliation|{a} et {b} mettent fin à leur rivalité.|2|2|riv|r30 endsl c4",
      "p_hommage|Hommage au mentor|{a} dédie sa victoire à celui qui l’a formé{e}.|1|1|win|c2",
      "p_alone|Seul dans le ring|{a} reste assis{e} seul{e} dans le ring après cette défaite.|1|1|los,big|c2 mor-",
      "p_nocel|Pas de célébration|{a} repart sans célébrer, pas content{e} de sa victoire.|1|1|win,dirty|c-1"
    ],
    cha: [
      "p_refatk|L’arbitre attaqué|{a} s’en prend à l’arbitre après la décision !|1|2|los,dirty|c3 h3 gm dem",
      "p_secfail|La sécurité débordée|La sécurité n’arrive pas à séparer {a} et {b} !|1|2|riv|h8 c5 gm",
      "p_mass|Bagarre générale|Tout le vestiaire se vide : bagarre générale autour de {a} et {b} !|2|3|big|c6 h6 gm",
      "p_invade|Le ring envahi|Des catcheurs débarquent de partout autour de {a} et {b} !|2|2||c5 gm",
      "p_gm|Le GM intervient|Le GM vient lui-même calmer {a} et {b}.|1|1|riv|h-2",
      "p_officials|Les officiels arrêtent tout|Les responsables de la fédération viennent séparer {a} et {b}.|2|1||c2",
      "p_crowdbrawl|Bagarre dans le public|{a} et {b} se battent jusque dans les tribunes !|2|2|riv|h8 c5 gm",
      "p_bswait|L’attente en coulisses|{a} attend {b} à la sortie du ring, en coulisses.|1|2|out|h6 sl",
      "p_prod|Ça déborde sur la régie|La bagarre entre {a} et {b} déborde jusque dans la régie !|3|2|riv|h8 c5 gm",
      "p_offair|Le show coupé|Le chaos autour de {a} et {b} est tel que la diffusion est coupée quelques secondes !|3|3|big,riv|c6 y2 n1 gm"
    ],
    mind: [
      "p_fakecel|Fausse célébration|{a} fait semblant de féliciter {b}… puis l’attaque !|1|2|heel|h7 r-8 c3",
      "p_trophy|La ceinture brandie|{a} brandit sa ceinture devant {b}.|0|1|chp|h4",
      "p_mockfin|La prise volée|{a} fait le finisher de {b}… sur {b} !|1|2|riv|h7 c4",
      "p_music|La musique volée|{a} sort avec la musique d’entrée de {b} !|1|1|riv|h5 c2",
      "p_screen|Message sur l’écran géant|Une vidéo mystérieuse apparaît sur l’écran géant pendant que {a} célèbre…|2|2|win|y2 c4",
      "p_video|Message vidéo d’un rival|{a} apparaît sur l’écran géant pour se moquer de {b}.|1|1|out|h6 c2 sl",
      "p_fake|Fausse apparition|Le public croit reconnaître {a}… mais c’est un sosie !|2|1|out|c3",
      "p_photo|La photo symbolique|{a} prend une photo, la ceinture à la main, devant {b} au sol.|1|1|win,chp|h4",
      "p_poll|Le public choisit|{a} demande au public de choisir son prochain adversaire.|1|1|win,face|c4 y1",
      "p_riddle|Déclaration mystérieuse|{a} annonce que « tout va changer »… sans rien dire de plus.|1|1|win|y1"
    ],
    nic: [
      "p_fan|Un fan monte sur le ring|Un spectateur monte sur le ring pendant la célébration de {a} ! La sécurité l’emmène.|2|1|win|c2",
      "p_wrongmusic|Erreur de musique|La mauvaise musique est lancée pour {a}. Gros moment de gêne…|1|0|win|c1",
      "p_forgot|Le catcheur oublié|{a} vient rappeler à tout le monde qu’{il} mérite sa chance.|1|1|out|y1 mor+",
      "p_stay|Refus de quitter le ring|{a} reste assis{e} dans le ring malgré les officiels.|1|1|los|c2 h2",
      "p_mic|Problème de micro|{a} veut parler, mais son micro ne marche pas !|1|0|win|c1",
      "p_gmann|Annonce surprise du GM|Le GM annonce que {a} aura un gros match au prochain show.|1|1|win|y1",
      "p_mainev|Place dans le main event|Le GM annonce que {a} gagne sa place dans le prochain main event !|1|2|win|y1 pop",
      "p_interrupt|Il interrompt le show|{a} refuse de partir et exige une réponse de la direction !|2|2|heel|h3 c2 gm dem",
      "p_wrongguy|Le mauvais adversaire|{a} attaque {b} par erreur, croyant que c’était quelqu’un d’autre !|2|1|out|r-10 c3",
      "p_mystery|La silhouette mystérieuse|Une silhouette apparaît dans les gradins et observe {a}…|2|2|win|y1 c3"
    ],
    nar: [
      "p_reveal|Le vrai coupable révélé|{a} révèle qu’{il} était derrière toutes les attaques contre {b} !|3|3|out|h10 c6 n1 sl",
      "p_disband|Fin du clan|Le leader de {f} annonce que le clan, c’est fini.|3|3|fac,los|n1 c4 disband",
      "p_recruit|Recrutement surprise|{f} propose à {b} de rejoindre le clan.|2|2|facout|r10 c3 join",
      "p_expel|Exclusion du clan|Le leader de {f} renvoie {b} du clan devant tout le monde.|2|3|facl|r-30 c4 n1 kick",
      "p_tourn|Annonce d’un tournoi|Le GM annonce un tournoi : le vainqueur aura un match de titre.|2|2|big,win|y2 c3",
      "p_career|Le match de sa carrière|{a} annonce que son prochain match sera celui de sa carrière.|2|2|los|y1 h3",
      "p_boss|Le président intervient|Le président de la fédération contredit le GM devant {a} et {b} !|3|2|riv|c4 y1 n1",
      "p_contract|Révélation d’un contrat|{a} annonce qu’{il} a prolongé son contrat. Le public est ravi.|2|1|win,face|c3",
      "p_manager|Nouvelle carrière|{a} annonce qu’{il} va désormais accompagner les jeunes comme manager…|3|2|vet,los|n1 c3",
      "p_cliff|Cliffhanger|Le show se termine sur une apparition autour de {a} que personne ne comprend encore…|3|3|main,big|y3 c6 n1"
    ]
  }
};
// enchaînements possibles (le direct les suit parfois : chaînes de 2 à 5 segments)
export const CHAIN = {
  a_faceoff: ["a_stare", "a_push", "a_slap"], a_stare: ["a_push", "a_count"], a_push: ["a_shove", "a_brawl"], a_shove: ["a_brawl", "a_count"], a_slap: ["a_brawl", "a_shove"],
  a_brawl: ["a_count", "a_nodq", "a_ultim"], a_beltshow: ["a_noback", "a_touch", "a_chdefy"], a_noback: ["a_mgrthreat", "a_shove", "a_count"], a_mgrthreat: ["a_shove", "a_mgrfight"],
  a_chdefy: ["a_touch", "a_slap"], a_touch: ["a_shove", "a_keepbelt"], a_keepbelt: ["a_handbelt", "a_touch"], a_entatk: ["a_cantgo", "a_nodq", "a_brawl"], a_bsatk: ["a_cantgo", "a_add3"],
  a_ramp: ["a_cantgo", "a_brawl"], a_rivmusic: ["a_ramp", "a_oldriv"], a_lights: ["a_masked", "a_bsatk"], a_refuse: ["a_ultim", "a_forfeit"], a_mgrtalk: ["a_mgrthreat"],
  a_fakehand: ["a_slap", "a_push"], a_personal: ["a_slap", "a_brawl"], a_split: ["a_chant"], a_beltpres: ["a_keepbelt", "a_beltstare"], a_cerem: ["a_beltpres", "a_chdefy"],
  p_assault: ["p_secfail", "p_gm", "p_double"], p_beatdown: ["p_secfail", "p_officials"], p_surp: ["p_staredown", "p_secfail"], p_backatk: ["p_secfail", "p_gm"],
  p_double: ["p_crowdbrawl", "p_secfail"], p_brawl: ["p_secfail", "p_crowdbrawl"], p_secfail: ["p_mass", "p_gm", "p_officials"], p_mass: ["p_offair", "p_officials"],
  p_crowdbrawl: ["p_prod", "p_secfail"], p_prod: ["p_offair"], p_celeb: ["p_family", "p_cashin", "p_beltsteal"], p_heelturn: ["p_secfail", "p_screen"], p_betray: ["p_abandon", "p_secfail"],
  p_fakeshake: ["p_secfail"], p_return: ["p_retint", "p_staredown"], p_tshot: ["p_refused", "p_brawl"], p_now: ["p_gm"], p_keepbelt: ["p_brawl"], p_weapon: ["p_secfail", "p_gm"]
};
// mots associés pour la recherche : « ceinture » trouve aussi champion, titre, mallette…
export const ASSOC = [
  ["ceinture", "titre", "champion", "championne", "championnat", "mallette", "cash-in", "règne", "challenger"],
  ["bagarre", "attaque", "brawl", "chaos", "embuscade", "agression", "frappe", "tabassage", "chaise", "sécurité"],
  ["trahison", "trahit", "turn", "retournement", "abandon", "manipulait"],
  ["manager", "accompagnateur", "accompagne", "valet", "mentor", "entraîneur", "consignes"],
  ["clan", "faction", "groupe", "alliance", "équipe", "partenaire", "recrutement"],
  ["partenaire", "équipe", "tag", "coéquipier", "alliance"],
  ["public", "fans", "fan", "foule", "chants", "chante", "spectateur", "pancarte", "tribunes", "ovation"],
  ["gm", "general manager", "directeur", "direction", "officiel", "officiels", "président", "annonce", "sanction", "suspension"],
  ["retour", "débuts", "début", "surprise", "nouveau", "revient", "légende"],
  ["respect", "poignée", "main", "hommage", "réconciliation", "excuses", "émotion", "flambeau", "famille"],
  ["micro", "promo", "interview", "discours", "parle", "message", "déclaration"],
  ["blessure", "blessé", "médecin", "fatigué"],
  ["arbitre", "règles", "disqualification", "stipulation", "compte"],
  ["musique", "entrée", "lumières"],
  ["vidéo", "écran", "caméra", "message"],
  ["mystère", "masque", "masqué", "silhouette", "mystérieuse", "révèle", "révélation", "secret", "secrète"],
  ["légende", "vétéran", "ancien", "mentor", "hommage", "jeune"],
  ["défi", "challenge", "revanche", "ultimatum", "match"],
  ["contrat", "signature", "carrière", "retraite", "adieu"]
];
export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");
const parseFx = s => { const F = {}; (s || "").split(" ").filter(Boolean).forEach(t => { const m = t.match(/^([hrcyt])(-?\d+)$/); if (m) F[m[1]] = +m[2]; else if (/^b\.\d+$/.test(t)) F.b = +("0" + t.slice(1)); else F[t] = 1; }); return F; };
export const SEGX = {}, SFAM = {};
Object.keys(ROWS).forEach(ph => Object.keys(ROWS[ph]).forEach(fam => {
  const D = FAM[ph][fam]; SFAM[ph + ":" + fam] = D[0];
  ROWS[ph][fam].forEach(r => {
    const x = r.split("|"), k = x[0], d = x[2], F = parseFx(x[6]), fr = +x[3], imp = +x[4];
    const p = /\{b\}/.test(d) ? 2 : /\{a\}/.test(d) ? 1 : 0;
    SEGX[k] = { n: x[1], d: d, at: D[1], p: p, st: D[2], min: Math.max(1, 1 + imp + (fr >= 2 ? 1 : 0)), ph: ph, fam: fam, fr: fr, imp: imp, c: x[5] ? x[5].split(",") : [], fx: F, kw: D[3],
      heat: F.h, rel: F.r, brawl: F.b, turn: F.t === 1 ? 1 : undefined, pop: F.pop ? 1 : 0, hype: F.y };
    SEGX[k].h = norm(x[1] + " " + d.replace(/\{[a-z0-9]+\}/g, " ") + " " + D[0] + " " + D[3]);
  });
}));
// les segments d'avant (les anciens) dans la recherche aussi
export const segHay = (k, S) => S.h || (S.h = norm(S.n + " " + (S.at === "bs" ? "coulisses backstage" : "ring") + " " + ({ contract: "contrat signature", celeb: "célébration fête", debut: "retour débuts surprise", attack: "attaque bagarre", gm: "gm annonce direction", video: "vidéo écran", tribute: "hommage légende", open: "défi challenge micro", brawl: "bagarre attaque", ambush: "attaque embuscade", betray: "trahison turn", alliance: "alliance équipe partenaire", sign: "contrat signature nouveau", injangle: "blessure blessé", guest: "célébrité invité", promo: "micro promo interview", face: "face-à-face confrontation", locker: "vestiaire discussion", office: "gm bureau direction", mystery: "mystère attaque" }[k] || "")));
// recherche : chaque mot tapé doit se trouver (lui ou un mot associé) dans le segment ; les vrais mots passent devant les associations
export function segSearch(SEG, q, keys) {
  const W = norm(q).split(/\s+/).filter(x => x.length >= 2); if (!W.length) return keys.slice();
  const A = ASSOC.map(g => g.map(norm));
  const terms = W.map(w => { const out = [w]; A.forEach(g => { if (g.some(t => t.indexOf(w) === 0 || w.indexOf(t) === 0)) g.forEach(t => { if (out.indexOf(t) < 0) out.push(t); }); }); return out; });
  return keys.map(k => { const h = segHay(k, SEG[k]); let sc = 0; for (const T of terms) { const d = h.indexOf(T[0]) >= 0 ? 3 : T.slice(1).some(t => h.indexOf(t) >= 0) ? 1 : 0; if (!d) return null; sc += d; } return [k, sc]; })
    .filter(Boolean).sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
