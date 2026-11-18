// Ajouts du module leaflet-rotate à Leaflet : la carte peut tourner (docs/adr/0012-carte-dans-le-sens-de-la-marche.md).
import 'leaflet'

declare module 'leaflet' {
  interface MapOptions {
    rotate?: boolean
    bearing?: number
    rotateControl?: boolean
    touchRotate?: boolean
    shiftKeyRotate?: boolean
  }
  interface Map {
    /** Tourne la carte de ce nombre de degrés, dans le sens des aiguilles d'une montre. */
    setBearing(degres: number): void
    getBearing(): number
  }
}
