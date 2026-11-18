import { describe, it, expect } from 'vitest'
import { avancementSurLeTrace, capEntre, distanceEntre, ECART_MAXIMAL_AU_TRAJET_METRES } from '../guidage'
import type { PointDuTrace } from '../itineraire'

// Trois points plein nord, espacés d'environ 1 112 m (0,01° de latitude).
const trace: PointDuTrace[] = [
  { latitude: 45.0, longitude: 5.0 },
  { latitude: 45.01, longitude: 5.0 },
  { latitude: 45.02, longitude: 5.0 },
]

describe('Guidage sur le tracé', () => {
  it('mesure la distance entre deux points, en mètres', () => {
    expect(distanceEntre(trace[0]!, trace[1]!)).toBeCloseTo(1112, -1)
    expect(distanceEntre(trace[0]!, trace[0]!)).toBe(0)
  })

  it('au départ, il reste tout le trajet ; à mi-chemin, la moitié ; à l’arrivée, rien', () => {
    expect(avancementSurLeTrace(trace[0]!, trace)!.distanceRestanteMetres).toBeCloseTo(2224, -1)
    expect(avancementSurLeTrace(trace[1]!, trace)!.distanceRestanteMetres).toBeCloseTo(1112, -1)
    expect(avancementSurLeTrace(trace[2]!, trace)!.distanceRestanteMetres).toBe(0)
  })

  it('sur le trajet, la personne n’est pas signalée hors du trajet', () => {
    const avancement = avancementSurLeTrace({ latitude: 45.0101, longitude: 5.0 }, trace)!
    expect(avancement.ecartAuTrajetMetres).toBeLessThan(ECART_MAXIMAL_AU_TRAJET_METRES)
    expect(avancement.horsDuTrajet).toBe(false)
  })

  it('à plus de 100 m du tracé, la personne est signalée hors du trajet', () => {
    // 0,005° de longitude à 45° de latitude : environ 390 m à l'est.
    const avancement = avancementSurLeTrace({ latitude: 45.01, longitude: 5.005 }, trace)!
    expect(avancement.ecartAuTrajetMetres).toBeCloseTo(393, -1)
    expect(avancement.horsDuTrajet).toBe(true)
  })

  it('donne la direction d’un point à l’autre : nord 0°, est 90°, sud 180°, ouest 270°', () => {
    const centre = { latitude: 45.0, longitude: 5.0 }
    expect(capEntre(centre, { latitude: 45.01, longitude: 5.0 })).toBeCloseTo(0, 1)
    expect(capEntre(centre, { latitude: 45.0, longitude: 5.01 })).toBeCloseTo(90, 0)
    expect(capEntre(centre, { latitude: 44.99, longitude: 5.0 })).toBeCloseTo(180, 1)
    expect(capEntre(centre, { latitude: 45.0, longitude: 4.99 })).toBeCloseTo(270, 0)
  })

  it('sans tracé, aucun avancement', () => {
    expect(avancementSurLeTrace(trace[0]!, [])).toBeNull()
  })
})
