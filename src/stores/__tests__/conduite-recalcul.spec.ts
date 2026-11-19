import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useConduiteStore } from '../conduite'
import { useItineraireStore } from '../itineraire'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'
import { trajetSimule } from '@/__tests__/trajet-simule'
import type { Etape, Itineraire, ResultatItineraire } from '@/services/itineraire'

type SurPosition = (position: { coords: { latitude: number; longitude: number } }) => void

let surPosition: SurPosition
const arreterLeSuiviSimule = vi.fn<(numero: number) => void>()

function simulerAppareil(enLigne: boolean): void {
  vi.stubGlobal('navigator', {
    onLine: enLigne,
    geolocation: {
      watchPosition: (succes: SurPosition) => {
        surPosition = succes
        return 7
      },
      clearWatch: arreterLeSuiviSimule,
    },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  simulerLocalStorage()
  simulerAppareil(true)
})
afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window, 'speechSynthesis')
})

const surLeTrajet = { coords: { latitude: 45.003, longitude: 4 } }
/** Environ 157 m à l'est du tracé. */
const loinDuTrajet = { coords: { latitude: 45.003, longitude: 4.002 } }
/** Environ 47 m à l'est du tracé. */
const aPeuPresSurLeTrajet = { coords: { latitude: 45.003, longitude: 4.0006 } }

const cheminVersSaintMartin = (sansDepartementalePossible: boolean): ResultatItineraire => {
  const etapeNouvelle: Etape = {
    codeCommune: null,
    commune: 'Saint-Martin',
    route: 'Rue des Tilleuls',
    departementale: !sansDepartementalePossible,
    fortTrafic: !sansDepartementalePossible,
    distanceMetres: 800,
  }
  const itineraire: Itineraire = {
    distanceMetres: 800,
    departementaleFortTraficMetres: sansDepartementalePossible ? 0 : 300,
    troncons: [{ distanceMetres: 800, vitesseRouteKmh: 50 }],
    etapes: [etapeNouvelle],
    trace: [
      { latitude: 45.003, longitude: 4.002 },
      { latitude: 45.01, longitude: 4 },
    ],
  }
  return {
    itineraire,
    plusCourt: itineraire,
    retenuEstLePlusCourt: true,
    sansDepartementalePossible,
    detourTropLong: false,
  }
}

const demarrerAvecUnTrajet = () => {
  useItineraireStore().restaurer(trajetSimule(), 'ign')
  const conduite = useConduiteStore()
  conduite.demarrer()
  return conduite
}

const envoyerPositionsHorsTrajet = (nombreDePositions: number) => {
  for (let rang = 0; rang < nombreDePositions; rang += 1) surPosition(loinDuTrajet)
}

describe('Sortie du trajet et recalcul', () => {
  it('à 50 m du trajet, ne dit rien et ne recalcule pas', () => {
    const conduite = demarrerAvecUnTrajet()
    const calcul = vi.spyOn(useItineraireStore(), 'calculerUnChemin')
    for (let rang = 0; rang < 5; rang += 1) surPosition(aPeuPresSurLeTrajet)
    expect(conduite.recalcul).toBe('aucun')
    expect(calcul).not.toHaveBeenCalled()
  })

  it('à 150 m du trajet, plusieurs positions de suite : le détecte et calcule depuis la position vers le village suivant', () => {
    const conduite = demarrerAvecUnTrajet()
    const calcul = vi.spyOn(useItineraireStore(), 'calculerUnChemin').mockResolvedValue(cheminVersSaintMartin(true))
    envoyerPositionsHorsTrajet(2)
    expect(conduite.recalcul).toBe('aucun')
    envoyerPositionsHorsTrajet(1)
    expect(conduite.recalcul).toBe('en-cours')
    expect(conduite.villageVise).toBe('Saint-Martin')
    expect(calcul).toHaveBeenCalledTimes(1)
    const [depart, arrivee] = calcul.mock.calls[0]!
    expect(depart).toMatchObject({ latitude: 45.003, longitude: 4.002 })
    expect(arrivee).toMatchObject({ latitude: 45.01, longitude: 4 })
  })

  it('un écart isolé du GPS ne déclenche rien', () => {
    const conduite = demarrerAvecUnTrajet()
    vi.spyOn(useItineraireStore(), 'calculerUnChemin')
    surPosition(loinDuTrajet)
    surPosition(loinDuTrajet)
    surPosition(surLeTrajet)
    surPosition(loinDuTrajet)
    expect(conduite.recalcul).toBe('aucun')
  })

  it('un chemin qui évite les départementales est pris : le trajet suivi est remplacé, pas le favori', async () => {
    const conduite = demarrerAvecUnTrajet()
    const magasinItineraire = useItineraireStore()
    vi.spyOn(magasinItineraire, 'calculerUnChemin').mockResolvedValue(cheminVersSaintMartin(true))
    envoyerPositionsHorsTrajet(3)
    await vi.waitFor(() => expect(conduite.recalcul).toBe('refait'))
    const trajetSuivi = magasinItineraire.resultat!.itineraire
    expect(trajetSuivi.etapes[0]!.route).toBe('Rue des Tilleuls')
    expect(trajetSuivi.etapes[trajetSuivi.etapes.length - 1]!.route).toBe('D12')
    expect(trajetSuivi.trace[0]).toMatchObject({ latitude: 45.003, longitude: 4.002 })
    expect(trajetSuivi.trace[trajetSuivi.trace.length - 1]).toMatchObject({ latitude: 45.01, longitude: 4.01 })
    expect(localStorage.getItem('gladys:favoris')).toBeNull()
  })

  it('sans chemin évitant les départementales, le dit et propose le plus sûr, pris seulement après accord', async () => {
    const conduite = demarrerAvecUnTrajet()
    const magasinItineraire = useItineraireStore()
    vi.spyOn(magasinItineraire, 'calculerUnChemin').mockResolvedValue(cheminVersSaintMartin(false))
    envoyerPositionsHorsTrajet(3)
    await vi.waitFor(() => expect(conduite.recalcul).toBe('a-accepter'))
    expect(magasinItineraire.resultat!.itineraire.etapes[0]!.route).toBe('Rue de Lyon')
    conduite.accepterLeCheminPropose()
    expect(conduite.recalcul).toBe('refait')
    expect(magasinItineraire.resultat!.itineraire.etapes[0]!.route).toBe('Rue des Tilleuls')
  })

  it('sans réseau, dit que le recalcul est impossible et garde le trajet d’origine', () => {
    simulerAppareil(false)
    const conduite = demarrerAvecUnTrajet()
    const magasinItineraire = useItineraireStore()
    const calcul = vi.spyOn(magasinItineraire, 'calculerUnChemin')
    envoyerPositionsHorsTrajet(3)
    expect(conduite.recalcul).toBe('sans-reseau')
    expect(calcul).not.toHaveBeenCalled()
    expect(magasinItineraire.resultat!.itineraire.etapes[0]!.route).toBe('Rue de Lyon')
    expect(conduite.etat).toBe('en-cours')
  })

  it('réseau coupé pendant le calcul : même message, sans blocage', async () => {
    const conduite = demarrerAvecUnTrajet()
    vi.spyOn(useItineraireStore(), 'calculerUnChemin').mockRejectedValue(new Error('réseau'))
    envoyerPositionsHorsTrajet(3)
    await vi.waitFor(() => expect(conduite.recalcul).toBe('sans-reseau'))
    expect(conduite.etat).toBe('en-cours')
  })

  it('de retour sur le trajet, le message de recalcul disparaît', () => {
    simulerAppareil(false)
    const conduite = demarrerAvecUnTrajet()
    envoyerPositionsHorsTrajet(3)
    expect(conduite.recalcul).toBe('sans-reseau')
    surPosition(surLeTrajet)
    expect(conduite.recalcul).toBe('aucun')
  })

  it('dit la sortie du trajet à la voix', () => {
    const dire = vi.fn<(enonce: { text: string }) => void>()
    class EnonceSimule {
      voice: unknown = null
      lang = ''
      constructor(public text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', EnonceSimule)
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { getVoices: () => [{ lang: 'fr-FR', localService: true }], speak: dire, cancel: () => {} },
    })
    demarrerAvecUnTrajet()
    vi.spyOn(useItineraireStore(), 'calculerUnChemin').mockResolvedValue(cheminVersSaintMartin(true))
    envoyerPositionsHorsTrajet(3)
    expect(dire.mock.calls[0]![0].text).toBe(
      'Vous avez quitté le trajet. Je cherche un nouveau chemin vers Saint-Martin.',
    )
  })
})
