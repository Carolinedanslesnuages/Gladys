import { describe, it, expect, afterEach, vi } from 'vitest'
import { PositionIndisponible, PositionRefusee, suivrePosition, type Coordonnees } from '../position'

type SurSucces = (position: { coords: Coordonnees }) => void
type SurEchec = (erreur: { code: number }) => void

function simulerGeolocalisation() {
  const suivi = { surSucces: null as SurSucces | null, surEchec: null as SurEchec | null }
  const geolocalisation = {
    watchPosition: vi.fn<(surSucces: SurSucces, surEchec: SurEchec) => number>((surSucces, surEchec) => {
      suivi.surSucces = surSucces
      suivi.surEchec = surEchec
      return 7
    }),
    clearWatch: vi.fn<(numero: number) => void>(),
  }
  Object.defineProperty(navigator, 'geolocation', { value: geolocalisation, configurable: true })
  return { geolocalisation, suivi }
}

describe('Suivre la position pendant le trajet', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'geolocation')
  })

  it('transmet chaque nouvelle position, puis arrête le suivi sur demande', () => {
    const { geolocalisation, suivi } = simulerGeolocalisation()
    const positionsRecues: Coordonnees[] = []
    const arreter = suivrePosition((coordonnees) => positionsRecues.push(coordonnees), () => {})
    suivi.surSucces!({ coords: { latitude: 45.1, longitude: 5.1 } })
    suivi.surSucces!({ coords: { latitude: 45.2, longitude: 5.2 } })
    expect(positionsRecues).toEqual([
      { latitude: 45.1, longitude: 5.1 },
      { latitude: 45.2, longitude: 5.2 },
    ])
    arreter()
    expect(geolocalisation.clearWatch).toHaveBeenCalledWith(7)
  })

  it('transmet la direction donnée par le GPS, sauf à l’arrêt (direction inconnue)', () => {
    const { suivi } = simulerGeolocalisation()
    const positionsRecues: Coordonnees[] = []
    suivrePosition((coordonnees) => positionsRecues.push(coordonnees), () => {})
    const enRoute = { latitude: 45.1, longitude: 5.1, heading: 90 }
    const aLArret = { latitude: 45.1, longitude: 5.1, heading: Number.NaN }
    suivi.surSucces!({ coords: enRoute } as unknown as { coords: Coordonnees })
    suivi.surSucces!({ coords: aLArret } as unknown as { coords: Coordonnees })
    expect(positionsRecues[0]!.cap).toBe(90)
    expect(positionsRecues[1]!.cap).toBeUndefined()
  })

  it('distingue la position refusée de la position introuvable', () => {
    const { suivi } = simulerGeolocalisation()
    const erreursRecues: Error[] = []
    suivrePosition(() => {}, (erreur) => erreursRecues.push(erreur))
    suivi.surEchec!({ code: 1 })
    suivi.surEchec!({ code: 3 })
    expect(erreursRecues[0]).toBeInstanceOf(PositionRefusee)
    expect(erreursRecues[1]).toBeInstanceOf(PositionIndisponible)
  })

  it('sans localisation sur l’appareil, dit que la position est indisponible', () => {
    const erreursRecues: Error[] = []
    suivrePosition(() => {}, (erreur) => erreursRecues.push(erreur))
    expect(erreursRecues[0]).toBeInstanceOf(PositionIndisponible)
  })
})
