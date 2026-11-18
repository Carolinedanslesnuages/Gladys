/**
 * Guidage pendant le trajet, calculé sur l'appareil, sans réseau : où en est la personne sur le
 * tracé, ce qu'il lui reste à parcourir, et si elle s'en éloigne. Décision : docs/adr/0008-guidage-sur-la-carte.md.
 */
import type { Coordonnees } from '@/services/position'
import type { PointDuTrace } from '@/services/itineraire'

const RAYON_DE_LA_TERRE_METRES = 6_371_000

/** Au-delà de cette distance du tracé, la personne a quitté son trajet. */
export const ECART_MAXIMAL_AU_TRAJET_METRES = 100

const enRadians = (degres: number) => (degres * Math.PI) / 180

/** Distance à vol d'oiseau entre deux points, en mètres. */
export function distanceEntre(premierPoint: Coordonnees, secondPoint: Coordonnees): number {
  const ecartLatitude = enRadians(secondPoint.latitude - premierPoint.latitude)
  const ecartLongitude = enRadians(secondPoint.longitude - premierPoint.longitude)
  const demiCorde =
    Math.sin(ecartLatitude / 2) ** 2 +
    Math.cos(enRadians(premierPoint.latitude)) * Math.cos(enRadians(secondPoint.latitude)) * Math.sin(ecartLongitude / 2) ** 2
  return 2 * RAYON_DE_LA_TERRE_METRES * Math.asin(Math.min(1, Math.sqrt(demiCorde)))
}

/** Direction pour aller d'un point à l'autre, en degrés (0 = nord, 90 = est, 180 = sud, 270 = ouest). */
export function capEntre(pointDeDepart: Coordonnees, pointDArrivee: Coordonnees): number {
  const latitudeDepart = enRadians(pointDeDepart.latitude)
  const latitudeArrivee = enRadians(pointDArrivee.latitude)
  const ecartLongitude = enRadians(pointDArrivee.longitude - pointDeDepart.longitude)
  const versLEst = Math.sin(ecartLongitude) * Math.cos(latitudeArrivee)
  const versLeNord =
    Math.cos(latitudeDepart) * Math.sin(latitudeArrivee) -
    Math.sin(latitudeDepart) * Math.cos(latitudeArrivee) * Math.cos(ecartLongitude)
  return ((Math.atan2(versLEst, versLeNord) * 180) / Math.PI + 360) % 360
}

export interface Avancement {
  /** Ce qu'il reste à parcourir sur le tracé jusqu'à l'arrivée. */
  distanceRestanteMetres: number
  /** Distance entre la personne et le point du tracé le plus proche. */
  ecartAuTrajetMetres: number
  horsDuTrajet: boolean
}

/** Où en est la personne sur le tracé, à partir du point du tracé le plus proche d'elle. */
export function avancementSurLeTrace(position: Coordonnees, trace: PointDuTrace[]): Avancement | null {
  if (trace.length === 0) return null
  let rangLePlusProche = 0
  let ecartLePlusPetit = Infinity
  trace.forEach((point, rang) => {
    const ecart = distanceEntre(position, point)
    if (ecart < ecartLePlusPetit) {
      ecartLePlusPetit = ecart
      rangLePlusProche = rang
    }
  })
  let distanceRestanteMetres = 0
  for (let rang = rangLePlusProche; rang < trace.length - 1; rang += 1) {
    distanceRestanteMetres += distanceEntre(trace[rang]!, trace[rang + 1]!)
  }
  return {
    distanceRestanteMetres,
    ecartAuTrajetMetres: ecartLePlusPetit,
    horsDuTrajet: ecartLePlusPetit > ECART_MAXIMAL_AU_TRAJET_METRES,
  }
}
