import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  EVITEMENT_DEPARTEMENTALES,
  INTERDICTION_AUTOROUTES,
  calculerItineraire,
  choisirItineraire,
  estDepartementale,
} from '../itineraire'
import { ErreurReseau, type Lieu } from '../adresses'

const lyon: Lieu = { libelle: 'Lyon', latitude: 45.75, longitude: 4.85 }
const vienne: Lieu = { libelle: 'Vienne', latitude: 45.52, longitude: 4.87 }

/** Réponse de l'IGN : une étape par route, avec son numéro (« D… » pour une départementale). */
const reponseIgn = (etapes: { numero: string; metres: number }[]) =>
  new Response(
    JSON.stringify({
      distance: etapes.reduce((total, etape) => total + etape.metres, 0),
      portions: [{ steps: etapes.map((etape) => ({ distance: etape.metres, attributes: { name: { cpx_numero: etape.numero } } })) }],
    }),
  )

let fetchSimule: ReturnType<typeof vi.fn<(adresse: string) => Promise<Response>>>

describe('Calcul d’itinéraire (service de l’IGN)', () => {
  beforeEach(() => {
    fetchSimule = vi.fn<(adresse: string) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchSimule)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('Critère 1 : chaque demande de calcul interdit les autoroutes et les voies rapides', async () => {
    fetchSimule.mockImplementation(() => Promise.resolve(reponseIgn([{ numero: '', metres: 10000 }])))
    await calculerItineraire(lyon, vienne, 30)
    expect(fetchSimule).toHaveBeenCalledTimes(2)
    for (const [adresse] of fetchSimule.mock.calls) {
      const parametres = new URL(adresse).searchParams
      expect(parametres.get('constraints')!.split('|')).toContain(INTERDICTION_AUTOROUTES)
      expect(parametres.get('start')).toBe('4.85,45.75')
      expect(parametres.get('end')).toBe('4.87,45.52')
    }
    expect(JSON.parse(INTERDICTION_AUTOROUTES)).toMatchObject({ constraintType: 'banned', value: 'autoroute' })
    expect(fetchSimule.mock.calls.some(([adresse]) => adresse.includes(encodeURIComponent(EVITEMENT_DEPARTEMENTALES)))).toBe(
      true,
    )
  })

  it('compte les kilomètres sur départementale d’après le numéro de route', async () => {
    fetchSimule.mockImplementation(() =>
      Promise.resolve(
        reponseIgn([
          { numero: 'D386', metres: 2000 },
          { numero: '', metres: 5000 },
          { numero: 'RD 4', metres: 1200 },
          { numero: 'N7', metres: 800 },
        ]),
      ),
    )
    const resultat = await calculerItineraire(lyon, vienne, 30)
    expect(resultat.itineraire).toMatchObject({ distanceMetres: 9000, departementaleMetres: 3200 })
    expect(estDepartementale('N7')).toBe(false)
    expect(estDepartementale(undefined)).toBe(false)
  })

  it('Story #4 : demande la vitesse de chaque route et la garde par tronçon', async () => {
    fetchSimule.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            distance: 3000,
            portions: [
              {
                steps: [
                  { distance: 1000, attributes: { name: { cpx_numero: '' }, vitesse_moyenne_vl: '30' } },
                  { distance: 1500, attributes: { name: { cpx_numero: '' }, vitesse_moyenne_vl: 80 } },
                  { distance: 500, attributes: { name: { cpx_numero: '' } } },
                ],
              },
            ],
          }),
        ),
      ),
    )
    const resultat = await calculerItineraire(lyon, vienne, 30)
    expect(new URL(fetchSimule.mock.calls[0]![0]).searchParams.get('waysAttributes')).toBe('vitesse_moyenne_vl')
    expect(resultat.itineraire.troncons).toEqual([
      { distanceMetres: 1000, vitesseRouteKmh: 30 },
      { distanceMetres: 1500, vitesseRouteKmh: 80 },
      { distanceMetres: 500, vitesseRouteKmh: null },
    ])
  })

  it('signale l’absence de réseau', async () => {
    fetchSimule.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(calculerItineraire(lyon, vienne, 30)).rejects.toBeInstanceOf(ErreurReseau)
  })

  describe('Critère 2 : on évite les départementales si le détour reste sous le seuil choisi', () => {
    const direct = { distanceMetres: 10000, departementaleMetres: 4000, troncons: [] }
    const parLesVillages = { distanceMetres: 12500, departementaleMetres: 0, troncons: [] }

    it('retient le trajet de 12,5 km sans départementale à 30 % (trajet direct : 10 km)', () => {
      expect(choisirItineraire(direct, parLesVillages, 30)).toEqual({
        itineraire: parLesVillages,
        sansDepartementalePossible: true,
        detourTropLong: false,
      })
    })

    it('le refuse à 20 % et garde le trajet direct', () => {
      expect(choisirItineraire(direct, parLesVillages, 20)).toEqual({
        itineraire: direct,
        sansDepartementalePossible: true,
        detourTropLong: true,
      })
    })
  })

  it('Critère 4 : sans trajet sans départementale, propose le plus sûr (le moins de départementale)', () => {
    const direct = { distanceMetres: 10000, departementaleMetres: 4000, troncons: [] }
    const moinsDeDepartementale = { distanceMetres: 11000, departementaleMetres: 1500, troncons: [] }
    expect(choisirItineraire(direct, moinsDeDepartementale, 10)).toEqual({
      itineraire: moinsDeDepartementale,
      sansDepartementalePossible: false,
      detourTropLong: false,
    })
  })
})
