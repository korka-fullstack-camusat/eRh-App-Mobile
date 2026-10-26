#!/bin/bash
# Version web (PWA) de l'app, servie sur https://<site>/m/ : même interface que l'app mobile.
# Usage : ./scripts/build-web.sh [dossier_de_destination]      ex. ../rh-app-front/public/m
# Sur iPhone : Safari › Partager › « Sur l'écran d'accueil » → l'app s'ouvre en plein écran.
set -e
cd "$(dirname "$0")/.."
OUT="${1:-dist-web}"
rm -rf "$OUT"
CI=1 npx expo export --platform web --output-dir "$OUT"

# Expo place les polices d'icônes et les images des bibliothèques dans assets/node_modules : Git et Docker ignorent
# tout dossier nommé node_modules, ce qui supprimait les icônes (petits carrés). On le renomme en « vendor ».
if [ -d "$OUT/assets/node_modules" ]; then
  mv "$OUT/assets/node_modules" "$OUT/assets/vendor"
  grep -rl "assets/node_modules" "$OUT" --include="*.js" --include="*.html" --include="*.json" \
    | xargs -r sed -i 's#assets/node_modules#assets/vendor#g'
fi
# Le nom du fichier JS (hash) est calculé par Expo AVANT ces remplacements : on le recalcule, sinon les navigateurs et Cloudflare
# gardent l'ancien fichier (cache d'un an, « immutable ») sous le même nom et n'affichent jamais la correction.
for f in "$OUT"/_expo/static/js/web/AppEntry-*.js; do
  old="$(basename "$f")"
  new="AppEntry-$(sha256sum "$f" | cut -c1-32).js"
  if [ "$old" != "$new" ]; then
    mv "$f" "$OUT/_expo/static/js/web/$new"
    sed -i "s#$old#$new#g" "$OUT/index.html"
  fi
done
if grep -rq "node_modules" "$OUT"; then echo "ERREUR : une référence à node_modules reste dans $OUT" >&2; exit 1; fi

cp assets/web/*.png "$OUT/"
cat > "$OUT/manifest.webmanifest" <<'JSON'
{
  "name": "eRH Camusat",
  "short_name": "eRH-Camusat",
  "description": "Application RH de Camusat",
  "start_url": "/m/",
  "scope": "/m/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#003c71",
  "lang": "fr",
  "icons": [
    { "src": "/m/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/m/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/m/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
JSON

# Balises d'installation (écran d'accueil iPhone / Android) ajoutées à la page générée par Expo
python3 - "$OUT/index.html" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
tags = '''<link rel="manifest" href="/m/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/m/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="eRH-Camusat" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  '''
s = s.replace("</head>", "  " + tags + "</head>", 1)
s = s.replace('content="width=device-width, initial-scale=1, shrink-to-fit=no"',
              'content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"', 1)
s = s.replace('<html lang="en">', '<html lang="fr">', 1)
open(p, "w", encoding="utf-8").write(s)
PY
echo "OK : version web dans $OUT (à servir sous /m/)"
