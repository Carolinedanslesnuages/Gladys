/**
 * Durée d'un trajet en voiture sans permis, calculée sur l'appareil (aucun réseau nécessaire).
 * Sur chaque tronçon, on roule à la vitesse habituelle de la personne (45 km/h au plus), ou à la
 * vitesse de la route si elle est plus basse. Une route sans vitesse connue compte à la vitesse habituelle.
 */

export const VITESSE_MAXIMALE_KMH = 45
export const VITESSE_MINIMALE_KMH = 10

/** Un morceau de l'itinéraire : sa longueur et la vitesse habituelle des voitures sur cette route. */
export interface Troncon {
  distanceMetres: number
  vitesseRouteKmh: number | null
}

export function dureeEnMinutes(troncons: Troncon[], vitesseHabituelleKmh: number): number {
  const vitesseVsp = Math.min(vitesseHabituelleKmh, VITESSE_MAXIMALE_KMH)
  const heures = troncons.reduce((total, troncon) => {
    const vitesseRoute = troncon.vitesseRouteKmh && troncon.vitesseRouteKmh > 0 ? troncon.vitesseRouteKmh : vitesseVsp
    return total + troncon.distanceMetres / 1000 / Math.min(vitesseVsp, vitesseRoute)
  }, 0)
  return heures * 60
}

/** « 1 h 25 min », « 20 min » : arrondi à la minute, jamais moins d'une minute. */
export function formaterDuree(minutes: number): string {
  const minutesArrondies = Math.max(1, Math.round(minutes))
  const heures = Math.floor(minutesArrondies / 60)
  const minutesRestantes = minutesArrondies % 60
  if (heures === 0) return `${minutesRestantes} min`
  return minutesRestantes === 0 ? `${heures} h` : `${heures} h ${minutesRestantes} min`
}

/** « 12 min de plus », « 1 h 5 min de moins », ou « même durée » : écart arrondi à la minute. */
export function formaterEcartDeDuree(minutesRetenu: number, minutesPlusCourt: number): string {
  const ecartMinutes = Math.round(minutesRetenu) - Math.round(minutesPlusCourt)
  if (ecartMinutes === 0) return 'même durée'
  return `${formaterDuree(Math.abs(ecartMinutes))} de ${ecartMinutes > 0 ? 'plus' : 'moins'}`
}

/** Heure de départ du jour, à partir d'un « HH:MM » saisi ; vide : maintenant. */
export function dateDeDepart(heureSaisie: string, maintenant: Date): Date {
  const correspondance = /^(\d{1,2}):(\d{2})$/.exec(heureSaisie)
  if (!correspondance) return maintenant
  const depart = new Date(maintenant)
  depart.setHours(Number(correspondance[1]), Number(correspondance[2]), 0, 0)
  return depart
}

export function heureDArrivee(depart: Date, minutes: number): Date {
  return new Date(depart.getTime() + Math.max(1, Math.round(minutes)) * 60_000)
}

/** « 8 h 20 », suivi de « le lendemain » si l'arrivée tombe le jour suivant le départ. */
export function formaterHeure(arrivee: Date, depart: Date): string {
  const texte = `${arrivee.getHours()} h ${String(arrivee.getMinutes()).padStart(2, '0')}`
  return arrivee.toDateString() === depart.toDateString() ? texte : `${texte} le lendemain`
}

/** La vitesse saisie, si elle est un nombre entre 10 et 45 km/h (virgule acceptée) ; sinon `null`. */
export function vitesseValide(saisie: string): number | null {
  const texte = saisie.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(texte)) return null
  const vitesse = Number(texte)
  return vitesse >= VITESSE_MINIMALE_KMH && vitesse <= VITESSE_MAXIMALE_KMH ? vitesse : null
}
