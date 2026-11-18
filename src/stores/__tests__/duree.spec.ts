import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDureeStore } from '../duree'
import { useItineraireStore } from '../itineraire'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'

/**
 * Itinéraire de 15 km à 30 km/h puis 15 km à 80 km/h, posé directement dans le magasin ;
 * le plus court fait 22,5 km sur une route à 80 km/h.
 */
function poserItineraire(): void {
  useItineraireStore().resultat = {
    itineraire: {
      distanceMetres: 30000,
      departementaleMetres: 0,
      troncons: [
        { distanceMetres: 15000, vitesseRouteKmh: 30 },
        { distanceMetres: 15000, vitesseRouteKmh: 80 },
      ],
      etapes: [],
    },
    plusCourt: {
      distanceMetres: 22500,
      departementaleMetres: 22500,
      troncons: [{ distanceMetres: 22500, vitesseRouteKmh: 80 }],
      etapes: [],
    },
    retenuEstLePlusCourt: false,
    sansDepartementalePossible: true,
    detourTropLong: false,
  }
}

describe('Durée du trajet et heure d’arrivée', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.unstubAllGlobals())

  it('roule à 45 km/h au plus par défaut, et pas de durée sans itinéraire', () => {
    simulerLocalStorage()
    const magasin = useDureeStore()
    expect(magasin.vitesseHabituelle).toBe(45)
    expect(magasin.dureeMinutes).toBeNull()
    expect(magasin.horaires(new Date())).toBeNull()
  })

  it('Critère 1 et 3 : 50 min à 45 km/h, 52 min 30 à 40 km/h (la route à 30 reste à 30)', () => {
    simulerLocalStorage()
    poserItineraire()
    const magasin = useDureeStore()
    expect(magasin.dureeMinutes).toBeCloseTo(50)
    magasin.choisirVitesse(40)
    expect(magasin.dureeMinutes).toBeCloseTo(52.5)
  })

  it('Story #5 : durée du trajet le plus court à la même vitesse (30 min à 45 km/h, 33 min 45 à 40 km/h)', () => {
    simulerLocalStorage()
    expect(useDureeStore().dureePlusCourtMinutes).toBeNull()
    poserItineraire()
    const magasin = useDureeStore()
    expect(magasin.dureePlusCourtMinutes).toBeCloseTo(30)
    magasin.choisirVitesse(40)
    expect(magasin.dureePlusCourtMinutes).toBeCloseTo(33.75)
  })

  it('Critère 2 : l’arrivée suit l’heure de départ choisie', () => {
    simulerLocalStorage()
    poserItineraire()
    const magasin = useDureeStore()
    magasin.choisirHeureDepart('08:00')
    const horaires = magasin.horaires(new Date(2026, 10, 18, 7, 0))!
    expect(horaires.arrivee).toEqual(new Date(2026, 10, 18, 8, 50))
  })

  it('garde la vitesse sur l’appareil et la retrouve à la réouverture', () => {
    const memoire = simulerLocalStorage()
    useDureeStore().choisirVitesse(40)
    expect(JSON.parse(memoire.get('gladys:vitesse-habituelle')!)).toBe(40)
    setActivePinia(createPinia())
    expect(useDureeStore().vitesseHabituelle).toBe(40)
  })

  it('prévient si l’appareil refuse d’enregistrer la vitesse', () => {
    simulerLocalStorage({}, true)
    const magasin = useDureeStore()
    magasin.choisirVitesse(30)
    expect(magasin.vitesseHabituelle).toBe(30)
    expect(magasin.erreur).toMatch(/n’a pas pu enregistrer/)
  })
})
