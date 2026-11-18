/** Position actuelle de l'appareil : le téléphone demande d'abord l'autorisation à la personne. */
export interface Coordonnees {
  latitude: number
  longitude: number
  /** Direction du déplacement, en degrés (0 = nord, 90 = est), quand l'appareil la connaît. */
  cap?: number
}

/** Direction donnée par le GPS : absente à l'arrêt (le téléphone renvoie alors `null` ou `NaN`). */
const capDuGps = (cap: number | null | undefined) => (typeof cap === 'number' && Number.isFinite(cap) ? cap : undefined)

/** La personne a refusé de donner sa position. */
export class PositionRefusee extends Error {
  constructor() {
    super('Position refusée.')
    this.name = 'PositionRefusee'
  }
}

/** L'appareil n'a pas pu trouver sa position (pas de GPS, délai dépassé…). */
export class PositionIndisponible extends Error {
  constructor() {
    super('Position indisponible.')
    this.name = 'PositionIndisponible'
  }
}

const CODE_PERMISSION_REFUSEE = 1

export function positionActuelle(): Promise<Coordonnees> {
  return new Promise((resoudre, rejeter) => {
    if (!('geolocation' in navigator)) {
      rejeter(new PositionIndisponible())
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resoudre({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (erreurPosition) =>
        rejeter(erreurPosition.code === CODE_PERMISSION_REFUSEE ? new PositionRefusee() : new PositionIndisponible()),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
}

/**
 * Suit la position de l'appareil pendant le trajet : `surPosition` reçoit chaque nouvelle position.
 * Elle reste sur l'appareil. Renvoie la fonction qui arrête le suivi.
 */
export function suivrePosition(
  surPosition: (coordonnees: Coordonnees) => void,
  surErreur: (erreur: PositionRefusee | PositionIndisponible) => void,
): () => void {
  if (!('geolocation' in navigator)) {
    surErreur(new PositionIndisponible())
    return () => {}
  }
  const numeroDeSuivi = navigator.geolocation.watchPosition(
    (position) =>
      surPosition({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        cap: capDuGps(position.coords.heading),
      }),
    (erreurPosition) =>
      surErreur(erreurPosition.code === CODE_PERMISSION_REFUSEE ? new PositionRefusee() : new PositionIndisponible()),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
  )
  return () => navigator.geolocation.clearWatch(numeroDeSuivi)
}
