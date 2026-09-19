# Logo Meriz : assets

Variante retenue : **A5P « Accolées · pastille »** du labo (`../logo/index.html`).
Deux cerises accolées sur une tige en V, en blanc sur une pastille indigo.
Dessin repris tel quel, rendu identique au pixel près au SVG du labo.

Couleurs :

| Rôle | Valeur |
|---|---|
| Pastille, version claire | `#4338CA` (indigo de la marque) |
| Pastille, version sombre | `#6366F1` |
| Dessin | `#FFFFFF` |
| Mot « Meriz », fond clair | `#1E1B4B` |
| Mot « Meriz », fond sombre | `#FFFFFF` |

`apercu.html` montre chaque fichier en situation (tailles réelles, fonds, masques).

## Fichiers

### `svg/` : sources vectorielles

| Fichier | Usage |
|---|---|
| `meriz-logo.svg` | Logo maître, carré 64 × 64. À utiliser partout par défaut, il reste lisible sur fond clair comme sur fond sombre. |
| `meriz-logo-dark.svg` | Variante pour fond sombre (pastille `#6366F1`, plus lumineuse). Pour les thèmes sombres où l'indigo `#4338CA` paraît terne. |
| `meriz-lockup.svg` | Icône + mot « Meriz », pour les en-têtes de l'app et du site sur fond clair. 191 × 64, texte vectorisé (aucune police à charger). |
| `meriz-lockup-dark.svg` | Même lockup pour fond sombre (pastille `#6366F1`, mot en blanc). |

Lockup : le mot est en Outfit SemiBold (licence OFL), vectorisé. La hauteur des capitales fait la moitié de l'icône, centrée verticalement. L'espace entre l'icône et le M vaut un quart de l'icône. Pour une hauteur d'en-tête donnée, fixer seulement `height` ; la largeur suit.

### `png/` : icône, fond transparent

| Fichier | Usage |
|---|---|
| `meriz-icon-1024.png` | Stores, grands visuels, source de secours |
| `meriz-icon-512.png` | Icône d'app, réseaux sociaux |
| `meriz-icon-256.png` | Icône de bureau |
| `meriz-icon-128.png` | Icône de bureau, docs |
| `meriz-icon-64.png` | Listes, barres d'outils |
| `meriz-icon-32.png` | Favicon haute densité, barre des tâches |
| `meriz-icon-16.png` | Favicon, onglets |

### `web/` : site et PWA

| Fichier | Usage |
|---|---|
| `favicon.svg` | Favicon moderne (vectoriel) |
| `favicon.ico` | Favicon classique, contient 16, 32 et 48 px |
| `apple-touch-icon.png` | 180 × 180, plein cadre sans transparence : iOS arrondit lui-même les coins |
| `icon-192.png`, `icon-512.png` | Icônes du manifeste web (`purpose: "any"`) |
| `icon-maskable-192.png`, `icon-maskable-512.png` | Icônes maskable (`purpose: "maskable"`) : fond plein, dessin réduit à 85 % et centré dans la zone de sécurité (cercle de 80 %) |

Balises à placer plus tard dans le `<head>` :

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

Entrées du manifeste :

```json
"icons": [
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
  { "src": "/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

### `tauri/` : logiciel de bureau

| Fichier | Usage |
|---|---|
| `app-icon.png` | Source 1024 × 1024, fond transparent, pour `npx tauri icon exports/tauri/app-icon.png`. La commande génère toutes les icônes Windows, macOS et Linux. |

### `outils/` : régénération

`generer.mjs` recrée tous les fichiers ci-dessus à partir du dessin. Il utilise resvg pour les PNG et opentype.js pour vectoriser le mot. Si les couleurs changent :

```
cd exports/outils
npm install
npm run generer
```
