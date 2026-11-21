// Mode Univers v2 (lot du 18 nov., 2e partie) : catalogues du jeu (types de match, stipulations, fins, consignes, segments, staff,
// gimmicks, traditions des fédérations, villes, salles, pays, diffuseurs, licences, événements hors du ring, trophées) + statuts des personnes.
let UD = null, UDp = null;
// data/statuts.json (décédés, retraités, staff, hors jeu) et data/gimmicks.json (surnoms connus), chargés une fois
export function loadUData() {
  if (UD) return Promise.resolve(UD);
  if (!UDp) UDp = Promise.all(["data/statuts.json", "data/gimmicks.json"].map(u => fetch(u + "?v=" + Math.floor(Date.now() / 36e5)).then(r => r.ok ? r.json() : {}).catch(() => ({}))))
    .then(([st, gm]) => (UD = { st: st || {}, gm: (gm && gm.items) || {} }));
  return UDp;
}
export const udata = () => UD || { st: {}, gm: {} };

// ---------- types de match ----------
// s = nombre de camps (n = libre, entre min et max), p = catcheurs par camp, q = bonus de note, f = fatigue, i = risque de blessure, c = public
export const MT = {
  simple: { n: "Simple", s: 2, p: 1, q: 0, f: 1, i: 1, c: 0 },
  tag: { n: "Par équipes", s: 2, p: 2, q: 0, f: 0.85, i: 0.9, c: 0 },
  mixte: { n: "Par équipes mixtes", s: 2, p: 2, q: 1, f: 0.85, i: 0.9, c: 1, mix: true },
  six: { n: "6 catcheurs (3 contre 3)", s: 2, p: 3, q: 2, f: 0.8, i: 0.9, c: 2 },
  huit: { n: "8 catcheurs (4 contre 4)", s: 2, p: 4, q: 2, f: 0.75, i: 0.9, c: 2 },
  handicap: { n: "Handicap (1 contre 2)", s: 2, p: [1, 2], q: -2, f: 1.1, i: 1, c: 0 },
  triple: { n: "Triple Threat", s: 3, p: 1, q: 3, f: 0.9, i: 1.1, c: 2 },
  fatal4: { n: "Fatal 4-Way", s: 4, p: 1, q: 3, f: 0.85, i: 1.1, c: 2 },
  battle: { n: "Bataille royale", s: "n", min: 6, max: 20, p: 1, q: 0, f: 0.7, i: 1, c: 3 },
  rumble: { n: "Royal Rumble", s: "n", min: 10, max: 30, p: 1, q: 4, f: 0.8, i: 1.1, c: 6 },
  gauntlet: { n: "Gauntlet", s: "n", min: 4, max: 10, p: 1, q: 2, f: 1.2, i: 1.1, c: 2 },
  chamber: { n: "Elimination Chamber", s: 6, p: 1, q: 6, f: 1.3, i: 1.5, c: 5 },
  ladder: { n: "Échelles", s: "n", min: 2, max: 8, p: 1, q: 5, f: 1.3, i: 1.6, c: 4 },
  tlc: { n: "TLC (tables, échelles, chaises)", s: "n", min: 2, max: 6, p: 1, q: 6, f: 1.4, i: 1.8, c: 5 },
  table: { n: "Tables", s: 2, p: 1, q: 2, f: 1.1, i: 1.2, c: 2 },
  cage: { n: "Cage", s: 2, p: 1, q: 5, f: 1.25, i: 1.4, c: 5 },
  cell: { n: "Cellule (Hell in a Cell)", s: 2, p: 1, q: 7, f: 1.4, i: 1.7, c: 6 },
  wargames: { n: "WarGames", s: 2, p: [4, 5], q: 6, f: 1.2, i: 1.4, c: 6 },
  nodq: { n: "No DQ / Street Fight", s: 2, p: 1, q: 3, f: 1.15, i: 1.3, c: 3 },
  lms: { n: "Last Man Standing", s: 2, p: 1, q: 4, f: 1.3, i: 1.4, c: 3 },
  iquit: { n: "I Quit", s: 2, p: 1, q: 3, f: 1.2, i: 1.3, c: 3 },
  ironman: { n: "Iron Man (30 min)", s: 2, p: 1, q: 3, f: 1.6, i: 1.2, c: 1, dur: 30 },
  falls: { n: "2 chutes sur 3", s: 2, p: 1, q: 3, f: 1.3, i: 1.1, c: 1 },
  sub: { n: "Soumission", s: 2, p: 1, q: 1, f: 1, i: 1, c: 0 },
  lumber: { n: "Lumberjack", s: 2, p: 1, q: 2, f: 1, i: 1.05, c: 3 },
  fca: { n: "Falls Count Anywhere", s: 2, p: 1, q: 4, f: 1.2, i: 1.4, c: 4 },
  ultimatex: { n: "Ultimate X", s: "n", min: 3, max: 6, p: 1, q: 5, f: 1.2, i: 1.6, c: 4 },
  open: { n: "Open challenge", s: 2, p: 1, q: 1, f: 1, i: 1, c: 2, open: true }
};
export const STIP = {
  "": "Aucun enjeu", loser: "Le perdant quitte la fédération", career: "Titre contre carrière", mask: "Masque contre masque", hair: "Cheveux contre cheveux",
  maskhair: "Masque contre cheveux", shot: "Le gagnant aura un match de titre", retire: "Le perdant prend sa retraite", case: "Mallette en jeu"
};
export const FIN = {
  auto: ["Au choix de l’arbitre (IA)", 0], clean: ["Tombé propre", 1], subm: ["Soumission", 1], rollup: ["Roll-up surprise", 0], cheat: ["Triche (pieds dans les cordes)", -1],
  interf: ["Intervention extérieure", -1], dq: ["Disqualification", -3], co: ["Décompte à l’extérieur", -3], dco: ["Double décompte à l’extérieur", -4], nc: ["No contest", -5],
  refbump: ["Arbitre K.O., puis tombé", -1], low: ["Coup bas dans le dos de l’arbitre", -1]
};
export const CONS = {
  "": ["Aucune consigne", 0, 1], strong: ["Faire briller les deux", 2, 1.05], protect: ["Protéger le perdant", 0, 1], squash: ["Squash rapide", -6, 0.6],
  story: ["Raconter l’histoire", 2, 1], comedy: ["Match comique", -1, 0.9], safe: ["Jouer la sécurité", -3, 0.7], wild: ["Tout donner", 5, 1.4]
};
export const DUR = { court: ["Court", 8], moyen: ["Moyen", 15], long: ["Long", 22], epique: ["Épique", 30] };
export const ENT = [["Entrées simples", 0, 0], ["Musique et lumières", 15, 2], ["Pyro", 50, 4], ["Grand spectacle", 140, 7]];
// segments (ring = sur le ring, bs = en coulisses) ; n = nombre de participants ; st = stats utilisées (index de ST)
export const SEG = {
  promo: { n: "Interview au micro", at: "ring", p: 1, st: [2, 3], min: 6 }, face: { n: "Face-à-face", at: "ring", p: 2, st: [2, 3, 5], min: 7, heat: 6 },
  contract: { n: "Signature de contrat", at: "ring", p: 2, st: [2, 3], min: 8, heat: 7, brawl: 0.5 }, celeb: { n: "Célébration", at: "ring", p: 1, st: [3, 5], min: 5 },
  debut: { n: "Débuts / retour surprise", at: "ring", p: 1, st: [5, 3], min: 4, pop: 1 }, attack: { n: "Attaque sur le ring", at: "ring", p: 2, st: [0, 3], min: 4, heat: 8 },
  gm: { n: "Annonce du GM", at: "ring", p: 0, st: [], min: 4 }, video: { n: "Vidéo de promo", at: "ring", p: 1, st: [3, 0], min: 3, hype: 1 },
  tribute: { n: "Hommage", at: "ring", p: 1, st: [3, 5], min: 5 }, open: { n: "Open challenge lancé au micro", at: "ring", p: 1, st: [2, 5], min: 4 },
  parking: { n: "Arrivée au parking", at: "bs", p: 1, st: [0, 5], min: 2 }, bsint: { n: "Interview en coulisses", at: "bs", p: 1, st: [2, 3], min: 3 },
  office: { n: "Dans le bureau du GM", at: "bs", p: 1, st: [2, 3], min: 3 }, locker: { n: "Discussion au vestiaire", at: "bs", p: 2, st: [2, 3], min: 3, rel: 6 },
  brawl: { n: "Bagarre en coulisses", at: "bs", p: 2, st: [0, 3], min: 3, heat: 7, rel: -8 }, ambush: { n: "Attaque surprise", at: "bs", p: 2, st: [3, 5], min: 2, heat: 9 },
  mystery: { n: "Mystère : qui a attaqué ?", at: "bs", p: 1, st: [3, 2], min: 3, hype: 1 }, alliance: { n: "Une alliance se forme", at: "bs", p: 2, st: [2, 3], min: 3, rel: 20 },
  betray: { n: "Trahison", at: "bs", p: 2, st: [2, 3, 5], min: 4, rel: -45, turn: 1, heat: 12 }, comedy: { n: "Moment comique", at: "bs", p: 1, st: [2, 3], min: 3 },
  sign: { n: "Signature d’un nouveau", at: "bs", p: 1, st: [5, 3], min: 3, pop: 1 }, injangle: { n: "Blessure jouée pour l’histoire", at: "bs", p: 1, st: [3, 2], min: 3, heat: 6 },
  catering: { n: "Au catering", at: "bs", p: 2, st: [2, 3], min: 2, rel: 4 }, guest: { n: "Célébrité invitée", at: "ring", p: 1, st: [3, 5], min: 5, hype: 1 }
};
// ---------- staff ----------
export const SROLE = {
  comm: ["Commentateur·rice", "Les matchs sont mieux notés à la télé ; un bon duo marche mieux."], prod: ["Producteur·rice", "De meilleurs matchs et moins de botchs."],
  writer: ["Scénariste", "Les storylines chauffent plus vite."], coach: ["Coach", "Le centre de développement et les jeunes progressent plus vite."],
  med: ["Médecin / kiné", "Les blessés reviennent plus tôt."], scout: ["Recruteur·euse", "Dévoile les vraies stats et trouve des talents."],
  ref: ["Arbitre", "Moins d’erreurs, de meilleures fins de match."], ann: ["Annonceur·euse", "Le public est un peu plus chaud."],
  gm: ["GM à l’écran", "Ses annonces chauffent les storylines."], mgr: ["Manager / valet", "Lié à un catcheur : l’aide au micro et peut intervenir."],
  social: ["Réseaux sociaux", "Plus de buzz, de meilleurs posts."], biz: ["Directeur·rice commercial·e", "Plus de sponsors et de merch."]
};
// ---------- gimmicks ----------
// st = stats qui comptent pour ce personnage (index de ST : 0 Apparence, 1 Ring, 2 Micro, 3 Charisme, 4 Endurance, 5 Star power, 6 Fiabilité)
export const GT = {
  monstre: ["Monstre", [0, 5, 4]], heros: ["Héros", [3, 5, 2]], comique: ["Comique", [2, 3]], arrogant: ["Arrogant", [2, 3, 0]], mystique: ["Mystique", [0, 3]],
  rebelle: ["Rebelle", [3, 2, 1]], technicien: ["Technicien", [1, 6, 4]], sportif: ["Sportif", [1, 4, 0]], showman: ["Showman", [3, 2, 5]], combattant: ["Combattant", [1, 4, 6]],
  leader: ["Leader", [2, 5, 3]], cool: ["Cool", [3, 0, 5]], outsider: ["Outsider", [1, 3]], luchador: ["Luchador", [1, 0, 3]], ace: ["Ace", [1, 5, 3]]
};
export const GNAME = { monstre: ["The Monster", "Le Colosse", "The Destroyer", "The Beast"], heros: ["The Hero", "The People's Champion", "Le Héros du peuple"], comique: ["The Joker", "Le Roi du rire"],
  arrogant: ["The Chosen One", "The Prodigy", "Le Meilleur du monde"], mystique: ["The Phantom", "L’Ombre", "The Oracle"], rebelle: ["The Rebel", "L’Insoumis"], technicien: ["The Technician", "Le Professeur"],
  sportif: ["The Athlete", "Le Champion olympique"], showman: ["The Showstopper", "Mister Spectacle"], combattant: ["The Warrior", "Le Gladiateur"], leader: ["The Boss", "Le Chef de clan"],
  cool: ["Mister Cool", "The Icon"], outsider: ["The Underdog", "L’Outsider"], luchador: ["El Enmascarado", "El Volador"], ace: ["The Ace", "L’As"] };
// ---------- traditions (matchs et tournois qui reviennent chaque année) ----------
// k = type, m = mois (0 = janvier), t = type de match ou format, z = taille, pr = récompense (shot = match de titre, case = mallette, trophy = trophée), x = h/f/hf
export const TRAD0 = {
  WWE: [{ n: "Royal Rumble", k: "match", t: "rumble", m: 0, z: 30, pr: "shot", x: "hf" }, { n: "Elimination Chamber", k: "match", t: "chamber", m: 2, z: 6, pr: "shot", x: "hf" },
    { n: "King and Queen of the Ring", k: "tour", t: "bracket", m: 4, z: 8, pr: "shot", x: "hf" }, { n: "Money in the Bank", k: "match", t: "ladder", m: 5, z: 6, pr: "case", x: "hf" },
    { n: "WarGames", k: "match", t: "wargames", m: 10, z: 8, pr: "trophy", x: "h" }, { n: "Dusty Rhodes Tag Team Classic", k: "tour", t: "bracket", m: 1, z: 8, pr: "shot", x: "h", tag: true }],
  AEW: [{ n: "Casino Gauntlet", k: "match", t: "battle", m: 4, z: 12, pr: "shot", x: "hf" }, { n: "Owen Hart Cup", k: "tour", t: "bracket", m: 5, z: 8, pr: "shot", x: "hf" },
    { n: "Blood & Guts", k: "match", t: "wargames", m: 7, z: 10, pr: "trophy", x: "h" }, { n: "Continental Classic", k: "tour", t: "league", m: 10, z: 12, pr: "trophy", x: "h" }],
  NJPW: [{ n: "New Japan Cup", k: "tour", t: "bracket", m: 2, z: 16, pr: "shot", x: "h" }, { n: "Best of the Super Juniors", k: "tour", t: "league", m: 4, z: 12, pr: "shot", x: "h" },
    { n: "G1 Climax", k: "tour", t: "league", m: 6, z: 16, pr: "case", x: "h" }, { n: "World Tag League", k: "tour", t: "league", m: 10, z: 8, pr: "shot", x: "h", tag: true }],
  Stardom: [{ n: "Cinderella Tournament", k: "tour", t: "bracket", m: 3, z: 16, pr: "trophy", x: "f" }, { n: "5★STAR Grand Prix", k: "tour", t: "league", m: 6, z: 16, pr: "shot", x: "f" },
    { n: "Goddesses of Stardom Tag League", k: "tour", t: "league", m: 10, z: 8, pr: "shot", x: "f", tag: true }],
  AAA: [{ n: "Rey de Reyes", k: "tour", t: "bracket", m: 2, z: 8, pr: "trophy", x: "h" }, { n: "Lucha de Apuestas (Triplemanía)", k: "match", t: "simple", m: 7, z: 2, pr: "apuestas", x: "h" }],
  CMLL: [{ n: "Gran Alternativa", k: "tour", t: "bracket", m: 3, z: 8, pr: "trophy", x: "h", tag: true }, { n: "Lucha de Apuestas (Aniversario)", k: "match", t: "simple", m: 8, z: 2, pr: "apuestas", x: "h" }],
  TNA: [{ n: "Ultimate X", k: "match", t: "ultimatex", m: 5, z: 6, pr: "shot", x: "h" }, { n: "Feast or Fired", k: "match", t: "battle", m: 11, z: 12, pr: "case", x: "hf" }],
  ROH: [{ n: "Survival of the Fittest", k: "match", t: "battle", m: 5, z: 6, pr: "shot", x: "h" }],
  Marigold: [{ n: "Dream Star Grand Prix", k: "tour", t: "league", m: 6, z: 10, pr: "shot", x: "f" }]
};
// ---------- le monde ----------
// c = chaleur du public (-5 froid … +6 brûlant), g = goûts (styles aimés), r = région
export const CITIES = [
  ["Chicago", 6, ["bag", "tec"], "us"], ["Philadelphie", 5, ["bag"], "us"], ["New York", 3, ["equ"], "us"], ["Boston", 2, ["tec"], "us"], ["Los Angeles", 1, ["aer"], "us"], ["Las Vegas", -2, ["equ"], "us"],
  ["Orlando", -3, ["equ"], "us"], ["Houston", 1, ["bag"], "us"], ["Atlanta", 2, ["bag"], "us"], ["Seattle", 1, ["tec"], "us"], ["Toronto", 4, ["tec"], "us"], ["Montréal", 5, ["aer", "tec"], "us"],
  ["Londres", 5, ["tec"], "eu"], ["Manchester", 3, ["bag"], "eu"], ["Paris", 4, ["aer"], "eu"], ["Berlin", 2, ["tec"], "eu"], ["Madrid", 2, ["aer"], "eu"], ["Rome", 1, ["equ"], "eu"],
  ["Tokyo", 3, ["pur", "tec"], "jp"], ["Osaka", 4, ["pur"], "jp"], ["Nagoya", 2, ["pur"], "jp"], ["Mexico", 5, ["aer"], "mx"], ["Monterrey", 3, ["aer"], "mx"], ["Guadalajara", 3, ["aer"], "mx"],
  ["Sydney", 1, ["equ"], "au"], ["Riyad", -1, ["equ"], "me"]
];
export const REGIONS = { us: "Amérique du Nord", eu: "Europe", jp: "Japon", mx: "Mexique", au: "Australie", me: "Moyen-Orient" };
export const VENUES = [["Bar", 300, 4], ["Gymnase", 1500, 15], ["Salle", 5000, 45], ["Aréna", 15000, 140], ["Stade", 50000, 600]];
export const TOURS = { jp: [["Japon", 220, ["pur", "tec"]]], mx: [["Mexique", 140, ["aer"]]], eu: [["Europe", 180, ["tec", "aer"]]], au: [["Australie", 200, ["equ"]]] };
export const NETS = ["Canal Fight", "Arena TV", "Neo Stream", "Ring+", "Vortex Sports", "Planète Catch", "Golden Channel", "Ultra Sport"];
export const LIC = { fig: ["Figurines", 40, 25], game: ["Jeu vidéo officiel", 60, 90], doc: ["Documentaire", 50, 45], comic: ["Bande dessinée", 35, 12] };
export const STRAT = { stars: "Signe les plus grandes stars", jeunes: "Mise sur les jeunes", econome: "Fait des économies", agressif: "Agressive avec la concurrence" };
export const STRAT0 = { WWE: "stars", AEW: "agressif", NJPW: "jeunes", AAA: "econome", TNA: "econome", CMLL: "jeunes", Stardom: "jeunes", ROH: "econome", Marigold: "jeunes" };
// ---------- revendications pendant une négociation (selon le caractère) ----------
export const DEM = {
  partner: "Signer aussi son partenaire", wintitle: "Gagner un titre dès son arrivée", shot: "Un match de titre dans les 60 jours", me: "Être en main event",
  debut: "Débuter dans un grand show", noclean: "Ne jamais perdre proprement", days: "Pas plus de 6 matchs par mois", part: "Temps partiel (non exclusif)",
  bonus: "Prime de 20 k$ par grand show", merch: "10 % du merch à son nom", creative: "Contrôle créatif (pas de changement de gimmick sans accord)", mgr: "Venir avec son manager"
};
// ---------- trophées du mode Univers ----------
export const ACH = {
  first: ["Premier show", "Jouer ton premier show"], r4: ["Un show à 4★", "Faire un show noté 4★ ou plus"], r5: ["Le show parfait", "Faire un show noté 5★"],
  m1: ["Le million", "Dépasser 1 M de téléspectateurs"], top: ["Numéro 1", "Meilleure audience de la semaine, toutes fédérations"], title: ["Nouveau champion", "Faire changer un titre de mains"],
  tour: ["Tournoi bouclé", "Finir un tournoi"], star: ["Grosse signature", "Signer une star (popularité 80+)"], year: ["Toujours là", "Finir une année sans être viré"],
  rich: ["Coffre-fort", "Avoir 10 M$ en banque"], stade: ["Stade plein", "Remplir un stade"], abroad: ["Tournée mondiale", "Faire une tournée à l’étranger"],
  part: ["Main dans la main", "Signer un partenariat"], oclegend: ["Ça fait boum", "Une légende répond à un open challenge"], hof: ["Immortel", "Faire une cérémonie du Hall of Fame"],
  turn: ["Changement de camp", "Faire un heel turn ou un face turn"], team: ["Inséparables", "Une amitié crée une tag team"], repack: ["Nouvelle peau", "Réussir un changement de gimmick"],
  war: ["Guerre gagnée", "Battre un rival qui passe le même soir"], buy: ["Empire", "Racheter une fédération"], crowd: ["La voix du peuple", "Suivre un catcheur poussé par le public"],
  mis1: ["Bon élément", "Réussir une mission du propriétaire"], mis10: ["L’homme de confiance", "Réussir 10 missions du propriétaire"],
  war3: ["Série noire pour la rivale", "Battre la rivale 3 semaines de suite"], war10: ["Dix victoires", "Gagner 10 semaines de la guerre des audiences"], rivko: ["Plus grand que la rivale", "Dépasser la rivale en popularité"]
};
// événements hors du ring (poids, fonction dans life.js)
export const CELEBS = ["un rappeur très connu", "une star de cinéma", "un champion de MMA", "une chanteuse pop", "un footballeur célèbre", "un youtubeur géant"];
export const SPONS = ["Volt Energy", "Titan Gym", "Rapido Pizza", "Nova Phone", "Iron Cola", "Kraken Games", "Blaze Shoes", "Orbit Snacks"];
export const MAGN = "TCC 100";
