import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  EVITEMENT_DEPARTEMENTALES,
  INTERDICTION_AUTOROUTES,
  ROUTE_SANS_NOM,
  calculerItineraire,
  choisirItineraire,
  estDepartementale,
  regrouperEnEtapes,
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
    expect(new URL(fetchSimule.mock.calls[0]![0]).searchParams.get('waysAttributes')).toBe(
      'vitesse_moyenne_vl|insee_commune_gauche',
    )
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
    const direct = { distanceMetres: 10000, departementaleMetres: 4000, troncons: [], etapes: [], trace: [] }
    const parLesVillages = { distanceMetres: 12500, departementaleMetres: 0, troncons: [], etapes: [], trace: [] }

    it('retient le trajet de 12,5 km sans départementale à 30 % (trajet direct : 10 km)', () => {
      expect(choisirItineraire(direct, parLesVillages, 30)).toEqual({
        itineraire: parLesVillages,
        plusCourt: direct,
        retenuEstLePlusCourt: false,
        sansDepartementalePossible: true,
        detourTropLong: false,
      })
    })

    it('le refuse à 20 % et garde le trajet direct', () => {
      expect(choisirItineraire(direct, parLesVillages, 20)).toEqual({
        itineraire: direct,
        plusCourt: direct,
        retenuEstLePlusCourt: true,
        sansDepartementalePossible: true,
        detourTropLong: true,
      })
    })
  })

  it('Critère 4 : sans trajet sans départementale, propose le plus sûr (le moins de départementale)', () => {
    const direct = { distanceMetres: 10000, departementaleMetres: 4000, troncons: [], etapes: [], trace: [] }
    const moinsDeDepartementale = { distanceMetres: 11000, departementaleMetres: 1500, troncons: [], etapes: [], trace: [] }
    expect(choisirItineraire(direct, moinsDeDepartementale, 10)).toEqual({
      itineraire: moinsDeDepartementale,
      plusCourt: direct,
      retenuEstLePlusCourt: false,
      sansDepartementalePossible: false,
      detourTropLong: false,
    })
  })

  describe('Demande #16 : le tracé du trajet, pour la carte', () => {
    const reponseAvecTrace = (coordonnees: number[][]) =>
      new Response(
        JSON.stringify({
          distance: 1000,
          geometry: { type: 'LineString', coordinates: coordonnees },
          portions: [{ steps: [{ distance: 1000, attributes: { name: { cpx_numero: 'C1' } } }] }],
        }),
      )

    it('demande le tracé en GeoJSON et garde celui du trajet retenu, en latitude et longitude', async () => {
      fetchSimule.mockImplementation((adresse) =>
        Promise.resolve(
          adresse.includes('departementale')
            ? reponseAvecTrace([
                [4.85, 45.75],
                [4.9, 45.6],
                [4.87, 45.52],
              ])
            : reponseAvecTrace([
                [4.85, 45.75],
                [4.87, 45.52],
              ]),
        ),
      )
      const resultat = await calculerItineraire(lyon, vienne, 30)
      for (const [adresse] of fetchSimule.mock.calls.filter(([adresse]) => adresse.includes('/navigation/'))) {
        expect(new URL(adresse).searchParams.get('geometryFormat')).toBe('geojson')
      }
      expect(resultat.retenuEstLePlusCourt).toBe(false)
      expect(resultat.itineraire.trace).toEqual([
        { latitude: 45.75, longitude: 4.85 },
        { latitude: 45.6, longitude: 4.9 },
        { latitude: 45.52, longitude: 4.87 },
      ])
    })

    it('un trajet sans tracé reçu garde un tracé vide, sans erreur', async () => {
      fetchSimule.mockImplementation(() => Promise.resolve(reponseIgn([{ numero: '', metres: 10000 }])))
      const resultat = await calculerItineraire(lyon, vienne, 30)
      expect(resultat.itineraire.trace).toEqual([])
    })
  })

  describe('Story #5 : les étapes du trajet, dans l’ordre', () => {
    const troncon = (metres: number, codeCommune: string, numero: string, nomDeRue = '') => ({
      distance: metres,
      attributes: { insee_commune_gauche: codeCommune, name: { cpx_numero: numero, nom_1_gauche: nomDeRue } },
    })

    it('Critère 1 : une étape par village et par route, dans l’ordre ; les tronçons qui se suivent sont réunis', () => {
      const etapes = regrouperEnEtapes([
        troncon(500, '38544', '', 'Rue de la Gare'),
        troncon(1200, '38544', 'D12'),
        troncon(2200, '38544', 'D12'),
        troncon(3000, '38001', 'D12'),
        troncon(800, '38001', 'C4'),
        troncon(300, '38001', ''),
      ])
      expect(etapes.map((etape) => [etape.codeCommune, etape.route, etape.distanceMetres])).toEqual([
        ['38544', 'Rue de la Gare', 500],
        ['38544', 'D12', 3400],
        ['38001', 'D12', 3000],
        ['38001', 'C4', 800],
        ['38001', ROUTE_SANS_NOM, 300],
      ])
    })

    it('Critère 2 : seules les étapes sur départementale sont signalées comme telles', () => {
      const etapes = regrouperEnEtapes([troncon(1000, '38544', 'D12'), troncon(1000, '38544', 'RD 4'), troncon(1000, '38544', 'N7')])
      expect(etapes.map((etape) => etape.departementale)).toEqual([true, true, false])
    })

    it('Critère 1 : retrouve le nom de chaque village grâce au service des adresses (code de commune seul)', async () => {
      const reponseItineraire = () =>
        new Response(
          JSON.stringify({
            distance: 4000,
            portions: [{ steps: [troncon(1000, '38544', 'C1'), troncon(2000, '38001', 'D12'), troncon(1000, '38999', 'C2')] }],
          }),
        )
      const reponseCommune = (nom: string | null) =>
        new Response(
          JSON.stringify({
            features: nom ? [{ geometry: { coordinates: [4.87, 45.52] }, properties: { label: nom } }] : [],
          }),
        )
      fetchSimule.mockImplementation((adresse) => {
        if (adresse.includes('/navigation/')) return Promise.resolve(reponseItineraire())
        const codeCommune = new URL(adresse).searchParams.get('citycode')
        if (codeCommune === '38999') return Promise.reject(new TypeError('Failed to fetch'))
        // 38544 : Vienne ; 38001 : inconnue du service ; 38999 : pas de réponse.
        return Promise.resolve(reponseCommune(codeCommune === '38544' ? 'Vienne' : null))
      })
      const resultat = await calculerItineraire(lyon, vienne, 30)
      const demandesDeCommunes = fetchSimule.mock.calls.map(([adresse]) => adresse).filter((adresse) => adresse.includes('/geocodage/'))
      expect(demandesDeCommunes).toHaveLength(3)
      expect(new URL(demandesDeCommunes[0]!).searchParams.get('type')).toBe('municipality')
      expect(resultat.itineraire.etapes.map((etape) => etape.commune)).toEqual(['Vienne', null, null])
      expect(resultat.plusCourt).toBe(resultat.itineraire)
    })
  })
})
