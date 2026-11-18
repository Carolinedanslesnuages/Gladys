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
    Math.cos(enRadians(premierPoint.latitude)) *
      Math.cos(enRadians(secondPoint.latitude)) *
      Math.sin(ecartLongitude / 2) ** 2
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

/** Rang du point du tracé le plus proche de la personne, et sa distance à elle. */
function pointLePlusProche(position: Coordonnees, trace: PointDuTrace[]) {
  let rangLePlusProche = 0
  let ecartLePlusPetit = Infinity
  trace.forEach((point, rang) => {
    const ecart = distanceEntre(position, point)
    if (ecart < ecartLePlusPetit) {
      ecartLePlusPetit = ecart
      rangLePlusProche = rang
    }
  })
  return { rangLePlusProche, ecartLePlusPetit }
}

/** On lit la direction de la route sur ses premiers mètres devant soi (pas sur un détail du tracé). */
const DISTANCE_DE_VISEE_METRES = 30

/**
 * Direction de la route devant la personne, en degrés : du point du tracé le plus proche d'elle vers
 * la suite du trajet. Aucune à l'arrivée ou sans trajet.
 */
export function capDuTraceDevant(position: Coordonnees, trace: PointDuTrace[]): number | null {
  if (trace.length < 2) return null
  const { rangLePlusProche } = pointLePlusProche(position, trace)
  const pointDeLaPersonne = trace[rangLePlusProche]!
  const pointsDevant = trace.slice(rangLePlusProche + 1)
  const pointVise =
    pointsDevant.find(
      (point) => distanceEntre(pointDeLaPersonne, point) >= DISTANCE_DE_VISEE_METRES,
    ) ?? pointsDevant[pointsDevant.length - 1]
  return pointVise ? capEntre(pointDeLaPersonne, pointVise) : null
}

/** Où en est la personne sur le tracé, à partir du point du tracé le plus proche d'elle. */
export function avancementSurLeTrace(
  position: Coordonnees,
  trace: PointDuTrace[],
): Avancement | null {
  if (trace.length === 0) return null
  const { rangLePlusProche, ecartLePlusPetit } = pointLePlusProche(position, trace)
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
