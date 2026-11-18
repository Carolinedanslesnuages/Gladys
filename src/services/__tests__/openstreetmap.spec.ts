import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  IMPORTANCE_PAR_CLASSE_DE_ROUTE,
  calculerItineraireOpenStreetMap,
  completerLesCodes,
  decoderTrace,
  enTronconRecu,
  leMoinsCharge,
  type TrajetPossible,
} from '../openstreetmap'
import { ErreurReseau, type Lieu } from '../adresses'
import { IMPORTANCE_ROUTE_CALME, estDepartementale } from '../itineraire'
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

  it('demande d’autres chemins et garde le moins chargé quand le premier prend une route secondaire', async () => {
    const parLaSecondaire = [
      { kilometres: 6, classe: 'secondary', noms: ['D 31'], codeCommune: '21231' },
      { kilometres: 5, classe: 'tertiary', noms: ['D 20'], codeCommune: '21054' },
    ]
    const parLesVillages = [
      { kilometres: 7, classe: 'tertiary', noms: ['D 109'], codeCommune: '21049' },
      { kilometres: 5, classe: 'tertiary', noms: ['D 20'], codeCommune: '21054' },
    ]
    fetchSimule.mockImplementation(
      simulerOpenStreetMap({ ...trajetsDijonBeaune, fuyantLesGrandsAxes: parLaSecondaire, autresChemins: [parLesVillages] }, nomsDesCommunes),
    )
    const resultat = await calculerItineraireOpenStreetMap(dijon, beaune, 30)
    const demandeFuyante = fetchSimule.mock.calls
      .filter(([adresse]) => adresse.endsWith('/route'))
      .map(([, options]) => JSON.parse(String(options?.body)))
      .find((corps) => corps.costing_options.motor_scooter.use_primary === 0)
    expect(demandeFuyante.alternates).toBe(2)
    expect(resultat.itineraire.distanceMetres).toBe(12000)
    expect(resultat.itineraire.departementaleFortTraficMetres).toBe(0)
    expect(resultat.itineraire.etapes.map((etape) => etape.route)).toEqual(['D 109', 'D 20'])
  })

  it('choisit le chemin le moins chargé dans la limite du détour, à égalité le plus court', () => {
    const chemin = (distanceMetres: number, departementaleFortTraficMetres: number): TrajetPossible => ({
      itineraire: { distanceMetres, departementaleFortTraficMetres, troncons: [], etapes: [], trace: [] },
      tronconsRecus: [],
      debutsDesTroncons: [],
    })
    const charge = chemin(11000, 3000)
    const calmeMaisLoin = chemin(20000, 0)
    const calme = chemin(12000, 1000)
    const calmeEtCourt = chemin(11500, 1000)
    expect(leMoinsCharge([charge, calmeMaisLoin, calme, calmeEtCourt], 13000)).toBe(calmeEtCourt)
    expect(leMoinsCharge([calmeMaisLoin, chemin(25000, 2000)], 13000)).toBe(calmeMaisLoin)
    expect(leMoinsCharge([], 13000)).toBeNull()
  })

  it('compte les routes métropolitaines (anciennes départementales, « M 974 ») comme des départementales', () => {
    expect(estDepartementale('M 974')).toBe(true)
    expect(estDepartementale('M974')).toBe(true)
    expect(estDepartementale('Rue de Mazy')).toBe(false)
    expect(enTronconRecu({ length: 1, road_class: 'primary', names: ['Avenue Jean Jaurès', 'M 974'] }).attributes?.cpx_numero).toBe('M 974')
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
