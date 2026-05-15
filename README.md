# Map Viewer — Donjons et Chatons

Visionneuse de carte interactive pour le monde de *Donjons et Chatons*.

## Stack

- **Vanilla TypeScript** — aucun framework UI
- **Vite** — bundler + dev server
- **PDF.js** (`pdfjs-dist`) — rendu de la carte
- **Vercel** — hébergement + analytics

## Architecture

### Rendu de la carte (`pdf-viewer.ts`)

La carte est un fichier PDF (`/assets/carte.pdf`) rendu intégralement sur un `<canvas>` HTML via PDF.js. Le canvas contient **toujours le PDF complet** — il n'y a pas de tuilage ni de fenêtre glissante.

La navigation (pan/zoom) fonctionne par **transform CSS** sur le conteneur du canvas :

```
translate(offsetX px, offsetY px) scale(cssScale)
```

Le zoom est en deux temps :
1. **Immédiat** — scale CSS approximatif (`currentScale / renderedScale`) pour la fluidité
2. **Différé** (120 ms après la dernière interaction) — `commitRender()` re-rend le PDF à la résolution exacte via un canvas offscreen, puis copie atomiquement sur le canvas visible (pas de flash blanc)

Interactions supportées : molette, drag souris, pinch-to-zoom (touch).

### Points et marqueurs (`overlay.ts`, `data/points.ts`)

Chaque point est défini par :

```ts
type MapPoint = {
  id: string;
  name: string;
  x: number;   // coordonnée normalisée [0, 1] relative à la largeur du PDF
  y: number;   // coordonnée normalisée [0, 1] relative à la hauteur du PDF
  zoom: number; // scale recommandé pour ce point
};
```

Les marqueurs sont des `<div>` positionnés en absolu sur un overlay au-dessus du canvas. Leurs positions sont recalculées à chaque changement de `ViewState` via `renderMarkers()`.

### Navigation vers un point

`viewer.centerOn(x, y, zoom)` anime le canvas vers le point cible avec une interpolation **ease-in-out** sur 500 ms, en interpolant simultanément `offsetX`, `offsetY` et `scale`.

### État de vue (`ViewState`)

```ts
type ViewState = {
  scale: number;
  offsetX: number;
  offsetY: number;
  pdfWidth: number;   // largeur canvas CSS courante
  pdfHeight: number;  // hauteur canvas CSS courante
};
```

C'est l'état central partagé entre le viewer, l'overlay et le mode debug.

## Mode debug

Accessible via `?debug=true` dans l'URL. Permet de déplacer les marqueurs à la souris et d'éditer leurs coordonnées pour calibrer les positions sur la carte.

## Développement

```bash
pnpm install
pnpm dev      # dev server sur http://localhost:5173
pnpm build    # tsc + vite build
pnpm typecheck
```

La carte PDF doit être placée dans `public/assets/carte.pdf`.
