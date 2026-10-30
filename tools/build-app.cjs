// Regroupe tout le code de l'app en un seul fichier compact : js/app.min.js (chargé par index.html).
// Lancé automatiquement par .github/workflows/build.yml à chaque modification de js/ ; à la main : node tools/build-app.cjs
// (dev.html charge encore les fichiers séparés de js/ : pratique pour travailler et pour les tests).
const esbuild = require(process.env.ESBUILD || "/opt/npm-tools/node_modules/esbuild");
const path = require("path"), root = path.join(__dirname, "..");
esbuild.build({ entryPoints: [path.join(root, "js/app.js")], bundle: true, minify: true, format: "esm", target: "es2019", outfile: path.join(root, "js/app.min.js"), logLevel: "warning", legalComments: "none" })
  .then(() => console.log("ok js/app.min.js"))
  .catch(() => process.exit(1));
