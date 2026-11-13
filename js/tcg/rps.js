// TCCCG — pierre-feuille-ciseaux du premier tour, animation discrète (choix de Jose, 13 nov.) :
// les deux gants (adversaire en haut, toi en bas) se secouent 3 fois, puis se montrent. Le gagnant grossit un peu avec un léger
// halo, le perdant pâlit et rapetisse ; une petite étiquette GAGNÉ / PERDU / ÉGALITÉ à côté de ta main, et au centre une flèche
// vers celui qui commence (« À TOI » / « À LUI » / « ENCORE »). Pas d'éclair, pas de tremblement : on comprend sans lire.
import { SFX } from "./sfx.js";

// les pièces d'un gant (repère : paume en 0,0, doigts vers le haut)
function parts(shape) {
  const P = [], r = (x, y, w, h, rr, tf, th) => P.push({ x, y, w, h, rr, tf: tf || "", th: !!th });
  if (shape === "p") { r(-100, -80, 200, 165, 62); for (let k = 0; k < 4; k++) r(-100 + k * 50, -108, 50, 70, 25); r(-112, -6, 140, 52, 26, "", true); }
  else if (shape === "f") { [[-68, 150, -9], [-23, 172, -3], [22, 162, 3], [66, 132, 10]].forEach(f => r(-21, -f[1], 42, f[1] + 20, 21, "translate(" + f[0] + " -40) rotate(" + f[2] + ")")); r(-92, -60, 184, 145, 48); r(-22, -110, 44, 120, 22, "translate(-88 30) rotate(-54)", true); }
  else { r(-21, -170, 42, 190, 21, "translate(-34 -50) rotate(-14)"); r(-21, -178, 42, 198, 21, "translate(12 -50) rotate(11)"); r(-100, -70, 200, 155, 58); r(0, -98, 50, 64, 25); r(50, -92, 50, 60, 25); r(-112, 4, 140, 50, 25, "", true); }
  return P;
}
const rect = (p, extra) => '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="' + p.rr + '"' + (p.tf ? ' transform="' + p.tf + '"' : "") + (extra || "") + "/>";
export function glove(shape, col, dark) {
  const P = parts(shape), lines = shape === "p" ? ["M-50 -100L-50 -52", "M0 -100L0 -52", "M50 -100L50 -52"] : shape === "c" ? ["M50 -96L50 -52"] : [];
  return '<svg viewBox="-150 -250 300 440" aria-hidden="true">' +
    '<g fill="' + col + '" stroke="#050a1c" stroke-width="26" stroke-linejoin="round"><rect x="-86" y="70" width="172" height="92" rx="22" fill="#eef2ff"/>' + P.map(p => rect(p)).join("") + "</g>" +
    '<rect x="-86" y="70" width="172" height="92" rx="22" fill="#eef2ff"/><rect x="-86" y="104" width="172" height="24" fill="' + col + '"/>' +
    P.map(p => rect(p, ' fill="' + col + '"' + (p.th ? ' stroke="' + dark + '" stroke-width="12"' : ""))).join("") +
    lines.map(d => '<path d="' + d + '" fill="none" stroke="' + dark + '" stroke-width="9" stroke-linecap="round"/>').join("") + "</svg>";
}
const ME = ["#ffd23f", "#e9b800"], FOE = ["#e23b3b", "#a8202a"];
const simple = () => { try { return localStorage.getItem("ctv.tgfx") === "simple" || matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
// joue l'animation sur le plateau ; res = "win" | "lose" | "tie" (pour toi) ; se termine toute seule
export function rpsAnim(host, me, foe, res) {
  return new Promise(done => {
    const ov = document.createElement("div"); ov.className = "tpfc" + (simple() ? " simple" : "");
    ov.innerHTML = '<div class="tpfch foe"></div><div class="tpfcm" aria-live="polite"><span class="tpfcd"><i></i><i></i><i></i></span></div><div class="tpfcme"><div class="tpfch me"></div></div>';
    (host || document.body).appendChild(ov);
    const F = ov.querySelector(".tpfch.foe"), M = ov.querySelector(".tpfch.me"), mid = ov.querySelector(".tpfcm"), dots = ov.querySelectorAll(".tpfcd i");
    F.innerHTML = glove("p", FOE[0], FOE[1]); M.innerHTML = glove("p", ME[0], ME[1]);
    const shake = simple() ? 0 : 3, step = 500;
    if (shake) { F.classList.add("shake"); M.classList.add("shake"); }
    for (let k = 0; k < shake; k++) setTimeout(() => { dots[k] && dots[k].classList.add("on"); SFX.tick(); }, (k + 1) * step);
    setTimeout(() => {
      F.classList.remove("shake"); M.classList.remove("shake");
      F.innerHTML = glove(foe, FOE[0], FOE[1]); M.innerHTML = glove(me, ME[0], ME[1]);
      F.classList.add("show", res === "tie" ? "tie" : res === "lose" ? "win" : "lose"); M.classList.add("show", res === "tie" ? "tie" : res === "win" ? "win" : "lose");
      const col = res === "win" ? "#ffd23f" : res === "lose" ? "#ff6b6b" : "#eef2ff";
      mid.innerHTML = '<span class="tpfcr ' + res + '"><svg viewBox="0 0 60 40" aria-hidden="true"><path d="' + (res === "tie" ? "M10 12H50M10 28H50" : res === "win" ? "M8 8L30 30L52 8" : "M8 32L30 10L52 32") + '" fill="none" stroke="' + col + '" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg><b>' + (res === "win" ? "À TOI" : res === "lose" ? "À LUI" : "ENCORE") + "</b></span>";
      const pill = document.createElement("span"); pill.className = "tpfcp " + res; pill.textContent = res === "win" ? "GAGNÉ" : res === "lose" ? "PERDU" : "ÉGALITÉ"; ov.querySelector(".tpfcme").appendChild(pill);
      SFX.tick();
      setTimeout(() => { ov.classList.add("out"); setTimeout(() => { ov.remove(); done(); }, 260); }, res === "tie" ? 1100 : 1500);
    }, shake * step + 150);
  });
}
