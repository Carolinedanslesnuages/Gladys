import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  IMPORTANCE_PAR_CLASSE_DE_ROUTE,
  calculerItineraireOpenStreetMap,
  completerLesCodes,
  decoderTrace,
  enTronconRecu,
} from '../openstreetmap'
import { ErreurReseau, type Lieu } from '../adresses'
import { IMPORTANCE_ROUTE_CALME } from '../itineraire'
import { encoderTrace, simulerOpenStreetMap, type TrajetsSimules } from '@/__tests__/openstreetmap-simule'

const dijon: Lieu = { libelle: 'Dijon', latitude: 47.322, longitude: 5.0415 }
const beaune: Lieu = { libelle: 'Beaune', latitude: 47.026, longitude: 4.84 }

/** Le plus court : 10 km dont 4 km sur la D974, route principale. Par les villages : 12 km, routes calmes. */
const trajetsDijonBeaune: TrajetsSimules = {
  plusCourt: [
    { kilometres: 4, classe: 'primary', noms: ['Route de Dijon', 'D 974'], codeCommune: '21231' },
    { kilometres: 6, classe: 'tertiary', noms: ['Rue de Beaune'], codeCommune: '21054' },
  ],
  fuyantLesGrandsAxes: [
    { kilometres: 2, classe: 'residential', noms: ['Rue de Longvic'], codeCommune: '21231' },
    { kilometres: 3, classe: 'tertiary', noms: ['D 109'], codeCommune: '21049' },
    { kilometres: 2, classe: 'tertiary', noms: ['D 109'], codeCommune: '21049', loinDesAdresses: true },
    { kilometres: 5, classe: 'tertiary', noms: ['D 20'], codeCommune: '21054' },
  ],
}
const nomsDesCommunes = { '21231': 'Dijon', '21049': 'Barges', '21054': 'Beaune' }

let fetchSimule: ReturnType<typeof vi.fn<(adresse: string, options?: RequestInit) => Promise<Response>>>

describe('Calcul d’itinéraire avec OpenStreetMap (demande #18)', () => {
  beforeEach(() => {
    fetchSimule = vi.fn<(adresse: string, options?: RequestInit) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchSimule)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('décode le tracé reçu (polyligne à 6 décimales)', () => {
    const points = [
      { latitude: 47.322, longitude: 5.0415 },
      { latitude: 47.026, longitude: 4.84 },
    ]
    expect(decoderTrace(encoderTrace(points))).toEqual(points)
    expect(decoderTrace('')).toEqual([])
  })

  it('juge le trafic comme avec l’IGN : route principale ou secondaire à fort trafic, tertiaire calme', () => {
    expect(IMPORTANCE_PAR_CLASSE_DE_ROUTE.secondary).toBeLessThan(IMPORTANCE_ROUTE_CALME)
    expect(IMPORTANCE_PAR_CLASSE_DE_ROUTE.tertiary).toBe(IMPORTANCE_ROUTE_CALME)
    expect(enTronconRecu({ length: 1.5, road_class: 'secondary', names: ['Rue de Beaune', 'D 35'], speed: 50 })).toEqual({
      distance: 1500,
      attributes: { cpx_numero: 'D 35', nom_1_gauche: 'Rue de Beaune', vitesse_moyenne_vl: 50, importance: 3 },
    })
  })

  it('calcule avec le profil cyclomoteur (45 km/h, sans autoroute) et évite la départementale à fort trafic', async () => {
    fetchSimule.mockImplementation(simulerOpenStreetMap(trajetsDijonBeaune, nomsDesCommunes))
    const resultat = await calculerItineraireOpenStreetMap(dijon, beaune, 30)
    const demandesDeTrajet = fetchSimule.mock.calls.filter(([adresse]) => adresse.endsWith('/route'))
    expect(demandesDeTrajet).toHaveLength(2)
    for (const [, options] of demandesDeTrajet) expect(JSON.parse(String(options?.body)).costing).toBe('motor_scooter')
    expect(resultat.plusCourt.distanceMetres).toBe(10000)
    expect(resultat.plusCourt.departementaleFortTraficMetres).toBe(4000)
    expect(resultat.itineraire.distanceMetres).toBe(12000)
    expect(resultat.itineraire.departementaleFortTraficMetres).toBe(0)
    expect(resultat.retenuEstLePlusCourt).toBe(false)
    expect(resultat.itineraire.trace).toHaveLength(5)
  })

  it('nomme les villages, même loin de toute adresse, et regroupe les tronçons d’une même route', async () => {
    fetchSimule.mockImplementation(simulerOpenStreetMap(trajetsDijonBeaune, nomsDesCommunes))
    const { itineraire } = await calculerItineraireOpenStreetMap(dijon, beaune, 30)
    expect(itineraire.etapes.map((etape) => [etape.commune, etape.route, etape.distanceMetres, etape.fortTrafic])).toEqual([
      ['Dijon', 'Rue de Longvic', 2000, false],
      ['Barges', 'D 109', 5000, false],
      ['Beaune', 'D 20', 5000, false],
    ])
  })

  it('garde le plus court si le détour dépasse le seuil choisi', async () => {
    fetchSimule.mockImplementation(simulerOpenStreetMap(trajetsDijonBeaune, nomsDesCommunes))
    const resultat = await calculerItineraireOpenStreetMap(dijon, beaune, 10)
    expect(resultat.detourTropLong).toBe(true)
    expect(resultat.itineraire.etapes[0]).toMatchObject({ commune: 'Dijon', route: 'D 974', fortTrafic: true })
  })

  it('refuse un trajet qui passerait par une autoroute', async () => {
    fetchSimule.mockImplementation(
      simulerOpenStreetMap(
        { ...trajetsDijonBeaune, plusCourt: [{ kilometres: 10, classe: 'motorway', noms: ['A 31'] }] },
        nomsDesCommunes,
      ),
    )
    await expect(calculerItineraireOpenStreetMap(dijon, beaune, 30)).rejects.toThrow(/autoroute/)
  })

  it('sans réseau, échoue avec une erreur réseau', async () => {
    fetchSimule.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(calculerItineraireOpenStreetMap(dijon, beaune, 30)).rejects.toBeInstanceOf(ErreurReseau)
  })

  it('complète les communes manquantes avec une seule demande par suite de tronçons sur la même route', async () => {
    fetchSimule.mockResolvedValue(new Response(JSON.stringify([{ code: '21049' }])))
    const troncons = [
      enTronconRecu({ length: 1, names: ['D 109'] }),
      enTronconRecu({ length: 1, names: ['D 109'] }),
      enTronconRecu({ length: 1, names: ['D 20'] }),
    ]
    const debuts = [0, 1, 2].map((rang) => ({ latitude: 47 + rang / 100, longitude: 5 }))
    expect(await completerLesCodes(troncons, debuts, [undefined, undefined, '21054'])).toEqual(['21049', '21049', '21054'])
    expect(fetchSimule).toHaveBeenCalledTimes(1)
  })
})
