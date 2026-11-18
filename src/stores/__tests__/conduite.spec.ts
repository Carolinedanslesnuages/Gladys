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

describe('Voix des consignes', () => {
  const dire = vi.fn<(enonce: { text: string }) => void>()
  class EnonceSimule {
    voice: unknown = null
    lang = ''
    constructor(public text: string) {}
  }
  beforeEach(() => {
    dire.mockClear()
    vi.stubGlobal('SpeechSynthesisUtterance', EnonceSimule)
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { getVoices: () => [{ lang: 'fr-FR', localService: true }], speak: dire, cancel: () => {} },
    })
  })
  afterEach(() => Reflect.deleteProperty(window, 'speechSynthesis'))

  it('dit la consigne en français à 200 m du virage', () => {
    demarrerAvecUnTrajet()
    surPosition({ coords: { latitude: 45, longitude: 4 } })
    expect(dire).not.toHaveBeenCalled()
    surPosition({ coords: { latitude: 45.0092, longitude: 4 } })
    expect(dire).toHaveBeenCalledTimes(1)
    expect(dire.mock.calls[0]![0].text).toMatch(/^Dans 1\d0 m, tournez à droite vers Saint-Martin$/)
  })

  it('ne répète pas la même consigne, puis dit la suivante', () => {
    const conduite = demarrerAvecUnTrajet()
    surPosition({ coords: { latitude: 45.0092, longitude: 4 } })
    surPosition({ coords: { latitude: 45.0093, longitude: 4 } })
    surPosition({ coords: { latitude: 45.0094, longitude: 4 } })
    expect(dire).toHaveBeenCalledTimes(1)
    surPosition({ coords: { latitude: 45.0098, longitude: 4 } })
    expect(conduite.consigne?.texte).toBe('Vous arrivez à destination')
    expect(dire).toHaveBeenCalledTimes(1)
    surPosition({ coords: { latitude: 45.01, longitude: 4.0088 } })
    expect(dire).toHaveBeenCalledTimes(2)
    expect(dire.mock.calls[1]![0].text).toContain('vous arrivez à destination')
  })

  it('sans voix française, le dit et garde la consigne affichée', () => {
    Reflect.deleteProperty(window, 'speechSynthesis')
    const conduite = demarrerAvecUnTrajet()
    surPosition({ coords: { latitude: 45, longitude: 4 } })
    expect(conduite.voixAbsente).toBe(false)
    surPosition({ coords: { latitude: 45.0092, longitude: 4 } })
    expect(conduite.voixAbsente).toBe(true)
    expect(conduite.consigne?.texte).toBe('Tournez à droite vers Saint-Martin')
  })
})
