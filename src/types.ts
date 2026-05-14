export type MapPoint = {
  id: string;
  name: string;
  /** Coordonnée X normalisée [0, 1] relative à la largeur PDF */
  x: number;
  /** Coordonnée Y normalisée [0, 1] relative à la hauteur PDF */
  y: number;
  /** Facteur de zoom recommandé pour ce point */
  zoom: number;
};
