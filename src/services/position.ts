/** Position actuelle de l'appareil : le téléphone demande d'abord l'autorisation à la personne. */
export interface Coordonnees {
  latitude: number
  longitude: number
}

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
