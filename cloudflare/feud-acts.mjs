// Actions de feud du jour (partagées par l'app et le service des notifications).
// Tirage au hasard mais identique des deux côtés : il dépend de la feud, de celui qui la lance et du jour.
// Chaque membre a donc sa propre action (pas la même que l'autre), et une action peut revenir un autre jour.
// a = vue de celui qui lance (« tu… »), b = vue de celui qui la reçoit (« X… », sans le nom).

// attaques (suivies d'un lieu)
const HIT = [
  ["lui as éclaté une chaise pliante dans le dos", "t'a éclaté une chaise pliante dans le dos"],
  ["l'as attaqué par derrière à coups de kendo stick", "t'a attaqué par derrière à coups de kendo stick"],
  ["lui as balancé un énorme coup de poing", "t'a balancé un énorme coup de poing"],
  ["lui as porté un Stunner surprise", "t'a porté un Stunner surprise"],
  ["lui as mis un RKO sorti de nulle part", "t'a mis un RKO sorti de nulle part"],
  ["l'as envoyé à travers une table", "t'a envoyé à travers une table"],
  ["lui as porté un Pedigree", "t'a porté un Pedigree"],
  ["lui as mis un Superkick", "t'a mis un Superkick"],
  ["l'as frappé avec une poubelle", "t'a frappé avec une poubelle"],
  ["lui as porté un Spear à travers la barricade", "t'a porté un Spear à travers la barricade"],
  ["lui as cassé une guitare sur la tête, façon Jeff Jarrett", "t'a cassé une guitare sur la tête, façon Jeff Jarrett"],
  ["l'as frappé avec une poêle à frire", "t'a frappé avec une poêle à frire"],
  ["lui as mis un coup de ceinture de champion", "t'a mis un coup de ceinture de champion"],
  ["lui as porté un Chokeslam sur une caisse de matériel", "t'a porté un Chokeslam sur une caisse de matériel"],
  ["l'as frappé avec un extincteur", "t'a frappé avec un extincteur"],
  ["lui as porté un Tombstone Piledriver", "t'a porté un Tombstone Piledriver"],
  ["lui as jeté une poignée de punaises dessus", "t'a jeté une poignée de punaises dessus"],
  ["l'as frappé avec un panneau stop", "t'a frappé avec un panneau stop"],
  ["lui as porté un Rainmaker", "t'a porté un Rainmaker"],
  ["lui as mis un Brogue Kick", "t'a mis un Brogue Kick"],
  ["l'as enfermé dans une prise de soumission jusqu'à ce qu'il tape", "t'a enfermé dans une prise de soumission jusqu'à ce que tu tapes"],
  ["lui as porté un Attitude Adjustment sur le capot d'une voiture", "t'a porté un Attitude Adjustment sur le capot d'une voiture"],
  ["l'as frappé avec un clavier de commentateur", "t'a frappé avec un clavier de commentateur"],
  ["lui as craché du « green mist » au visage, façon Great Muta", "t'a craché du « green mist » au visage, façon Great Muta"],
  ["l'as attaqué avec une échelle", "t'a attaqué avec une échelle"],
  ["lui as porté un Canadian Destroyer", "t'a porté un Canadian Destroyer"],
  ["l'as frappé avec un marteau de forgeron", "t'a frappé avec un marteau de forgeron"],
  ["lui as donné une claque qui a résonné dans toute la salle", "t'a donné une claque qui a résonné dans toute la salle"],
  ["lui as porté un Burning Hammer", "t'a porté un Burning Hammer"],
  ["l'as frappé avec une batte de baseball entourée de barbelés", "t'a frappé avec une batte de baseball entourée de barbelés"],
  ["lui as mis un Claymore", "t'a mis un Claymore"],
  ["l'as frappé avec une cloche de ring", "t'a frappé avec une cloche de ring"],
  ["lui as porté un Shooting Star Press depuis une échelle", "t'a porté un Shooting Star Press depuis une échelle"],
  ["l'as électrocuté avec un câble de projecteur (pour de faux)", "t'a électrocuté avec un câble de projecteur (pour de faux)"],
  ["lui as porté un Tiger Driver", "t'a porté un Tiger Driver"],
  ["l'as frappé avec un balai de ménage", "t'a frappé avec un balai de ménage"],
  ["lui as mis un Spinning Back Fist", "t'a mis un Spinning Back Fist"],
  ["l'as enfermé dans le Sharpshooter", "t'a enfermé dans le Sharpshooter"],
  ["lui as balancé un seau de glaçons sur la tête", "t'a balancé un seau de glaçons sur la tête"],
  ["l'as attaqué avec un kendo stick enflammé (pas de panique, c'est du cinéma)", "t'a attaqué avec un kendo stick enflammé (pas de panique, c'est du cinéma)"],
];
// lieux
const PLACE = ["sur le parking", "dans les coulisses", "dans le bureau du GM", "en pleine interview", "à la cantine du catering", "dans le vestiaire",
  "sur la rampe d'entrée", "au milieu du public", "à la table des commentateurs", "en direct devant les caméras de Netflix", "à l'aéroport",
  "dans l'ascenseur de l'hôtel", "pendant la séance photo", "à la salle de sport", "en pleine conférence de presse", "dans le car de la tournée",
  "devant le distributeur de boissons", "pendant la signature d'autographes", "sur le toit de l'arène", "dans la salle de maquillage",
  "en plein match de son pote", "pendant son entrée", "au bord du ring", "devant le bureau de Triple H", "dans le local des ceintures"];
// actions complètes : clins d'œil aux grandes rivalités et folies
const FULL = [
  ["Tu as débarqué chez lui et tu as tout cassé à coups de marteau, façon Triple H chez Randy Orton.", "a débarqué chez toi et a tout cassé à coups de marteau, façon Triple H chez Randy Orton."],
  ["Tu es arrivé en dépanneuse et tu as aspergé sa voiture de bière, façon Stone Cold.", "est arrivé en dépanneuse et a aspergé ta voiture de bière, façon Stone Cold."],
  ["Tu as rempli sa voiture de ciment, comme Stone Cold avec la Corvette de Vince McMahon.", "a rempli ta voiture de ciment, comme Stone Cold avec la Corvette de Vince McMahon."],
  ["Tu as éteint toutes les lumières de l'arène et, quand elles se sont rallumées, tu étais derrière lui. Gong.", "a éteint toutes les lumières de l'arène et, quand elles se sont rallumées, il était derrière toi. Gong."],
  ["Tu as fait exploser des flammes autour du ring en levant les bras, façon Kane.", "a fait exploser des flammes autour du ring en levant les bras, façon Kane."],
  ["Tu es descendu du public avec ta bande en tenue de combat, façon The Shield.", "est descendu du public avec sa bande en tenue de combat, façon The Shield."],
  ["Tu as enfilé un costume de Michael Jackson, tu as fait un moonwalk jusqu'à lui et tu lui as mis un coup de pied retourné.", "a enfilé un costume de Michael Jackson, a fait un moonwalk jusqu'à toi et t'a mis un coup de pied retourné."],
  ["Tu as échangé ses chaussures de ring contre des palmes de plongée juste avant son match.", "a échangé tes chaussures de ring contre des palmes de plongée juste avant ton match."],
  ["Tu as remplacé sa musique d'entrée par « La Danse des canards ».", "a remplacé ta musique d'entrée par « La Danse des canards »."],
  ["Tu as volé sa ceinture et tu l'as jetée dans le fleuve, façon Alundra Blayze.", "a volé ta ceinture et l'a jetée dans le fleuve, façon Alundra Blayze."],
  ["Tu as volé sa ceinture et tu as posé avec elle sur tous tes réseaux.", "a volé ta ceinture et a posé avec elle sur tous ses réseaux."],
  ["Tu as organisé une fausse cérémonie de mariage en plein Raw pour l'humilier.", "a organisé une fausse cérémonie de mariage en plein Raw pour t'humilier."],
  ["Tu as rempli son casier de serpents en plastique, façon Jake « The Snake » Roberts.", "a rempli ton casier de serpents en plastique, façon Jake « The Snake » Roberts."],
  ["Tu as engagé un sosie de lui pour gâcher son interview.", "a engagé un sosie de toi pour gâcher ton interview."],
  ["Tu t'es caché sous le ring pendant tout le show avant de lui attraper la cheville.", "s'est caché sous le ring pendant tout le show avant de t'attraper la cheville."],
  ["Tu as fait diffuser sur l'écran géant toutes ses pires vidéos d'enfance.", "a fait diffuser sur l'écran géant toutes tes pires vidéos d'enfance."],
  ["Tu as débarqué en zamboni dans l'arène, façon Stone Cold, pour lui foncer dessus.", "a débarqué en zamboni dans l'arène, façon Stone Cold, pour te foncer dessus."],
  ["Tu lui as lancé un Pie in the Face en pleine remise de prix.", "t'a lancé une tarte à la crème en pleine remise de prix."],
  ["Tu as tagué son nom en rose fluo sur le bus de la tournée.", "a tagué ton nom en rose fluo sur le bus de la tournée."],
  ["Tu as invité sa grand-mère au premier rang pour la faire monter sur le ring contre lui.", "a invité ta grand-mère au premier rang pour la faire monter sur le ring contre toi."],
  ["Tu as volé son micro et tu as fait un karaoké faux pendant dix minutes, façon Elias.", "a volé ton micro et a fait un karaoké faux pendant dix minutes, façon Elias."],
  ["Tu as engagé tout un chœur de gospel pour chanter que tu es meilleur que lui.", "a engagé tout un chœur de gospel pour chanter qu'il est meilleur que toi."],
  ["Tu t'es fait livrer une montagne de pizzas à son nom, qu'il a dû payer.", "s'est fait livrer une montagne de pizzas à ton nom, que tu as dû payer."],
  ["Tu lui as tendu la main pour faire la paix… puis tu lui as mis un Superkick.", "t'a tendu la main pour faire la paix… puis t'a mis un Superkick."],
  ["Tu as signé son contrat de match sur son dos, après l'avoir fait passer à travers la table de signature.", "a signé ton contrat de match sur ton dos, après t'avoir fait passer à travers la table de signature."],
  ["Tu as remplacé sa photo sur l'affiche du prochain PLE par celle d'un pigeon.", "a remplacé ta photo sur l'affiche du prochain PLE par celle d'un pigeon."],
  ["Tu es arrivé dans l'arène en monster truck et tu as écrasé sa voiture de location.", "est arrivé dans l'arène en monster truck et a écrasé ta voiture de location."],
  ["Tu as enfilé le masque de son idole pour lui faire croire à un retour surprise.", "a enfilé le masque de ton idole pour te faire croire à un retour surprise."],
  ["Tu as fait irruption dans son vestiaire déguisé en mascotte géante.", "a fait irruption dans ton vestiaire déguisé en mascotte géante."],
  ["Tu as coupé sa promo en criant « What? » à chaque phrase, façon Stone Cold.", "a coupé ta promo en criant « What? » à chaque phrase, façon Stone Cold."],
  ["Tu lui as fait un « Too Sweet »… puis tu l'as frappé avec le doigt encore levé.", "t'a fait un « Too Sweet »… puis t'a frappé avec le doigt encore levé."],
  ["Tu as volé son chapeau de cow-boy et tu l'as revendu aux enchères.", "a volé ton chapeau et l'a revendu aux enchères."],
  ["Tu as rempli sa baignoire de nouilles, façon Bray Wyatt version Firefly Fun House.", "a rempli ta baignoire de nouilles, façon Firefly Fun House."],
  ["Tu as fait imprimer des T-shirts « Je suis meilleur que lui » et tu les as distribués à tout le public.", "a fait imprimer des T-shirts « Je suis meilleur que lui » et les a distribués à tout le public."],
  ["Tu as attaché ses lacets ensemble pendant qu'il donnait une interview.", "a attaché tes lacets ensemble pendant que tu donnais une interview."],
  ["Tu as sauté du haut de la cage sur lui, façon Mankind à King of the Ring 1998 (en un peu moins haut).", "a sauté du haut de la cage sur toi, façon Mankind à King of the Ring 1998 (en un peu moins haut)."],
  ["Tu as fait livrer un cercueil devant sa porte avec son nom gravé dessus.", "a fait livrer un cercueil devant ta porte avec ton nom gravé dessus."],
  ["Tu as dansé la macarena sur le ring en tenant sa ceinture.", "a dansé la macarena sur le ring en tenant ta ceinture."],
  ["Tu as pris le contrôle du titantron pour diffuser « Tu es viré ! » en lettres géantes.", "a pris le contrôle du titantron pour diffuser « Tu es viré ! » en lettres géantes."],
  ["Tu as envoyé des confettis sur sa tête pendant qu'il pleurait sa défaite.", "a envoyé des confettis sur ta tête pendant que tu pleurais ta défaite."],
];
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// pair = id de la feud (uids triés), uid = celui qui lance, day = AAAA-MM-JJ (heure de Paris)
export function feudAct(pair, uid, day) {
  const h = hash(pair + "|" + uid + "|" + day);
  if (h % 4 === 0) { const f = FULL[(h >>> 2) % FULL.length]; return { a: f[0], b: f[1] }; }
  const x = HIT[(h >>> 3) % HIT.length], p = PLACE[(h >>> 9) % PLACE.length];
  return { a: "Tu " + x[0] + " " + p + ".", b: x[1] + " " + p.replace(/\bson\b/, "ton") + "." };
}
