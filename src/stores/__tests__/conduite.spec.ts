import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useConduiteStore } from '../conduite'
import { useItineraireStore } from '../itineraire'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'
import { trajetSimule, trajetSimuleAncien } from '@/__tests__/trajet-simule'

type SurPosition = (position: { coords: { latitude: number; longitude: number } }) => void
type SurErreur = (erreur: { code: number }) => void

let surPosition: SurPosition
let surErreur: SurErreur
const arreterLeSuiviSimule = vi.fn<(numero: number) => void>()

beforeEach(() => {
  setActivePinia(createPinia())
  simulerLocalStorage()
  arreterLeSuiviSimule.mockClear()
  vi.stubGlobal('navigator', {
    ...navigator,
    geolocation: {
      watchPosition: (succes: SurPosition, echec: SurErreur) => {
        surPosition = succes
        surErreur = echec
        return 7
      },
      clearWatch: arreterLeSuiviSimule,
    },
  })
})
afterEach(() => vi.unstubAllGlobals())

const demarrerAvecUnTrajet = () => {
  useItineraireStore().restaurer(trajetSimule(), 'ign')
  const conduite = useConduiteStore()
  conduite.demarrer()
  return conduite
}

describe('Store de conduite', () => {
  it('au départ, suit la position puis affiche la première consigne avec le sens du virage', () => {
    const conduite = demarrerAvecUnTrajet()
    expect(conduite.etat).toBe('attente')
    surPosition({ coords: { latitude: 45, longitude: 4 } })
    expect(conduite.etat).toBe('en-cours')
    expect(conduite.consigne?.texte).toBe('Tournez à droite vers Saint-Martin')
  })

  it('met la consigne et la distance à jour quand la position change', () => {
    const conduite = demarrerAvecUnTrajet()
    surPosition({ coords: { latitude: 45, longitude: 4 } })
    const distanceAuDepart = conduite.consigne!.distanceMetres
    surPosition({ coords: { latitude: 45.006, longitude: 4 } })
    expect(conduite.consigne!.distanceMetres).toBeLessThan(distanceAuDepart - 500)
    surPosition({ coords: { latitude: 45.0095, longitude: 4 } })
    expect(conduite.consigne?.texte).toBe('Vous arrivez à destination')
  })

  it('signale une position refusée', () => {
    const conduite = demarrerAvecUnTrajet()
    surErreur({ code: 1 })
    expect(conduite.etat).toBe('refuse')
  })

  it('signale une position indisponible, puis réessaie', () => {
    const conduite = demarrerAvecUnTrajet()
    surErreur({ code: 2 })
    expect(conduite.etat).toBe('indisponible')
    conduite.reessayer()
    expect(conduite.etat).toBe('attente')
    surPosition({ coords: { latitude: 45, longitude: 4 } })
    expect(conduite.etat).toBe('en-cours')
  })

  it('arrête le suivi et oublie la position', () => {
    const conduite = demarrerAvecUnTrajet()
    surPosition({ coords: { latitude: 45, longitude: 4 } })
    conduite.arreter()
    expect(arreterLeSuiviSimule).toHaveBeenCalledWith(7)
    expect(conduite.etat).toBe('arret')
    expect(conduite.position).toBeNull()
  })

  it('ne démarre pas pour un trajet enregistré avant les consignes', () => {
    useItineraireStore().restaurer(trajetSimuleAncien(), 'ign')
    const conduite = useConduiteStore()
    conduite.demarrer()
    expect(conduite.consignesAbsentes).toBe(true)
    expect(conduite.etat).toBe('arret')
  })

  it('refuse de démarrer sans trajet', () => {
    const conduite = useConduiteStore()
    conduite.demarrer()
    expect(conduite.etat).toBe('arret')
    expect(conduite.consignesAbsentes).toBe(false)
  })
})
