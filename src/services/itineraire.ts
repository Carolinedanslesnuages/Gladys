/**
 * Calcul d'itinéraire par le service public de l'IGN (Géoplateforme, sans compte). Le départ et
 * l'arrivée quittent l'appareil : décision tracée dans docs/adr/0003-calcul-d-itineraire.md.
 * Chaque demande interdit les autoroutes et voies rapides. Sans réseau, le calcul échoue avec
 * `ErreurReseau`.
 */
import { ErreurReseau, nomDeCommune, type Lieu } from '@/services/adresses'
import type { Troncon } from '@/services/duree'

const SERVICE_ITINERAIRE = 'https://data.geopf.fr/navigation/itineraire'

/** Jamais d'autoroute ni de voie rapide (« type autoroutier » de la BD TOPO). */
export const INTERDICTION_AUTOROUTES = JSON.stringify({
  constraintType: 'banned',
  key: 'wayType',
  operator: '=',
  value: 'autoroute',
})

/**
 * Importance BD TOPO (1 : liaison nationale … 6 : sans circulation) à partir de laquelle une
 * route est calme : 4 (liaison locale) et au-delà. De 1 à 3, le trafic est fort (ex. : la D930).
 */
export const IMPORTANCE_ROUTE_CALME = 4

/** Éviter autant que possible les routes à fort trafic ; les départementales calmes restent permises. */
export const EVITEMENT_FORT_TRAFIC = JSON.stringify({
  constraintType: 'avoid',
  key: 'importance',
  operator: '<',
  value: IMPORTANCE_ROUTE_CALME,
})

/** Une étape du trajet, à lire avant de partir : un village, une route, une distance. */
export interface Etape {
  /** Code officiel (INSEE) de la commune traversée, ou `null` s'il est inconnu. */
  codeCommune: string | null
  /** Nom du village, retrouvé à partir de son code ; `null` s'il est inconnu. */
  commune: string | null
  route: string
  departementale: boolean
  /** Vrai : départementale à fort trafic, à éviter. Faux pour une départementale calme. */
  fortTrafic: boolean
  distanceMetres: number
}

/** Un itinéraire calculé : sa distance totale et ce qu'il garde de départementale à fort trafic (en mètres). */
export interface Itineraire {
  distanceMetres: number
  departementaleFortTraficMetres: number
  /** Ses tronçons, avec la vitesse de chaque route, pour calculer la durée sur l'appareil. */
  troncons: Troncon[]
  /** Ses étapes, dans l'ordre : les tronçons qui se suivent sur la même route et dans le même village n'en font qu'une. */
  etapes: Etape[]
  /** Son tracé, du départ à l'arrivée, pour la carte ; vide si le service ne l'a pas donné. */
  trace: PointDuTrace[]
}

/** Un point du tracé, en degrés. */
export interface PointDuTrace {
  latitude: number
  longitude: number
}

/** Les deux calculateurs d'itinéraire proposés : l'IGN, ou OpenStreetMap en essai (ADR 0007). */
export type Calculateur = 'ign' | 'openstreetmap'

/** Ce qu'on sait d'un tronçon, sous la forme de la BD TOPO de l'IGN (OpenStreetMap s'y ramène). */
export interface AttributsDuTroncon {
  cpx_numero?: string
  nom_1_gauche?: string
  cpx_toponyme_route_nommee?: string
  vitesse_moyenne_vl?: number | string
  insee_commune_gauche?: string
  importance?: number | string
}

export interface TronconRecu {
  distance: number
  attributes?: AttributsDuTroncon
}

interface ReponseItineraire {
  distance: number
  /** Tracé GeoJSON : chaque point est [longitude, latitude]. */
  geometry?: { coordinates?: number[][] }
  portions: { steps: TronconRecu[] }[]
}

/** Le tracé reçu de l'IGN, en points latitude et longitude ; les points incomplets sont écartés. */
const traceRecu = (geometrie: ReponseItineraire['geometry']): PointDuTrace[] =>
  (geometrie?.coordinates ?? []).flatMap(([longitude, latitude]) =>
    typeof longitude === 'number' && typeof latitude === 'number' ? [{ latitude, longitude }] : [],
  )

export const ROUTE_SANS_NOM = 'Route sans nom'

/** Vitesse habituelle des voitures sur la route (BD TOPO), ou `null` si elle est inconnue. */
const vitesseDeLaRoute = (vitesseBrute: number | string | undefined): number | null => {
  const vitesse = Number(vitesseBrute)
  return vitesseBrute !== undefined && vitesseBrute !== '' && vitesse > 0 ? vitesse : null
}

/** Une route départementale porte un numéro « D… » (ou « RD… ») dans les données de l'IGN. */
export const estDepartementale = (numeroDeRoute: string | undefined) => /^R?D\s?\d/i.test(numeroDeRoute ?? '')

/**
 * Départementale à fort trafic : importance de 1 à 3. Une importance inconnue compte comme un
 * fort trafic, par prudence.
 */
export const estDepartementaleAFortTrafic = (attributs: AttributsDuTroncon | undefined): boolean => {
  if (!estDepartementale(attributs?.cpx_numero)) return false
  const importance = Number(attributs?.importance)
  return !(importance >= IMPORTANCE_ROUTE_CALME)
}

/** Le numéro de la route (« D12 »), sinon le nom de la rue, sinon « Route sans nom ». */
const nomDeLaRoute = (attributs: AttributsDuTroncon | undefined): string =>
  attributs?.cpx_numero?.trim() ||
  attributs?.nom_1_gauche?.trim() ||
  attributs?.cpx_toponyme_route_nommee?.trim() ||
  ROUTE_SANS_NOM

/** Regroupe, dans l'ordre du trajet, les tronçons qui se suivent sur la même route et dans la même commune. */
export function regrouperEnEtapes(troncons: TronconRecu[]): Etape[] {
  const etapes: Etape[] = []
  for (const troncon of troncons) {
    const codeCommune = troncon.attributes?.insee_commune_gauche?.trim() || null
    const route = nomDeLaRoute(troncon.attributes)
    const fortTrafic = estDepartementaleAFortTrafic(troncon.attributes)
    const etapePrecedente = etapes[etapes.length - 1]
    if (etapePrecedente && etapePrecedente.codeCommune === codeCommune && etapePrecedente.route === route) {
      etapePrecedente.distanceMetres += troncon.distance
      etapePrecedente.fortTrafic ||= fortTrafic
      continue
    }
    etapes.push({
      codeCommune,
      commune: null,
      route,
      departementale: estDepartementale(troncon.attributes?.cpx_numero),
      fortTrafic,
      distanceMetres: troncon.distance,
    })
  }
  return etapes
}

/**
 * Donne à chaque étape le nom de son village : une demande par commune au service public du
 * découpage administratif, qui ne reçoit que le code de la commune. Un nom introuvable reste `null`, sans erreur.
 */
export async function nommerLesVillages(etapes: Etape[]): Promise<Etape[]> {
  const codesDesCommunes = [...new Set(etapes.flatMap((etape) => (etape.codeCommune ? [etape.codeCommune] : [])))]
  const nomsTrouves = await Promise.all(
    codesDesCommunes.map((codeCommune) => nomDeCommune(codeCommune).catch(() => null)),
  )
  const nomParCode = new Map(codesDesCommunes.map((codeCommune, rang) => [codeCommune, nomsTrouves[rang] ?? null]))
  return etapes.map((etape) => ({
    ...etape,
    commune: etape.codeCommune ? (nomParCode.get(etape.codeCommune) ?? null) : null,
  }))
}

async function demanderItineraire(depart: Lieu, arrivee: Lieu, contraintes: string[]): Promise<Itineraire> {
  const parametres = new URLSearchParams({
    resource: 'bdtopo-pgr',
    profile: 'car',
    optimization: 'shortest',
    start: `${depart.longitude},${depart.latitude}`,
    end: `${arrivee.longitude},${arrivee.latitude}`,
    constraints: contraintes.join('|'),
    getSteps: 'true',
    geometryFormat: 'geojson',
    distanceUnit: 'meter',
    waysAttributes: 'vitesse_moyenne_vl|insee_commune_gauche|importance',
  })
  let reponse: Response
  try {
    reponse = await fetch(`${SERVICE_ITINERAIRE}?${parametres}`)
  } catch {
    throw new ErreurReseau()
  }
  if (!reponse.ok) throw new ErreurReseau()
  const resultat = (await reponse.json()) as ReponseItineraire
  return itineraireDepuisTroncons(
    resultat.portions.flatMap((portion) => portion.steps),
    resultat.distance,
    traceRecu(resultat.geometry),
  )
}

/** Un itinéraire à partir de ses tronçons : kilomètres à fort trafic, vitesses et étapes. */
export function itineraireDepuisTroncons(
  tronconsRecus: TronconRecu[],
  distanceMetres: number,
  trace: PointDuTrace[],
): Itineraire {
  return {
    distanceMetres,
    departementaleFortTraficMetres: tronconsRecus
      .filter((tronconRecu) => estDepartementaleAFortTrafic(tronconRecu.attributes))
      .reduce((total, tronconRecu) => total + tronconRecu.distance, 0),
    troncons: tronconsRecus.map((tronconRecu) => ({
      distanceMetres: tronconRecu.distance,
      vitesseRouteKmh: vitesseDeLaRoute(tronconRecu.attributes?.vitesse_moyenne_vl),
    })),
    etapes: regrouperEnEtapes(tronconsRecus),
    trace,
  }
}

/** Le résultat, avec les étapes du trajet retenu remplacées (le plus court les reçoit aussi s'il est retenu). */
export function avecLesEtapesDuTrajetRetenu(resultat: ResultatItineraire, etapes: Etape[]): ResultatItineraire {
  const itineraireRetenu = { ...resultat.itineraire, etapes }
  return {
    ...resultat,
    itineraire: itineraireRetenu,
    plusCourt: resultat.retenuEstLePlusCourt ? itineraireRetenu : resultat.plusCourt,
  }
}

/** Ce que l'appli retient et dit à la personne. */
export interface ResultatItineraire {
  itineraire: Itineraire
  /** Le trajet le plus court sans autoroute, gardé pour la comparaison (et les stories à venir). */
  plusCourt: Itineraire
  /** Vrai : le trajet retenu est le plus court lui-même. */
  retenuEstLePlusCourt: boolean
  /** Faux : aucun trajet sans départementale à fort trafic n'existe ; on propose quand même le plus sûr. */
  sansDepartementalePossible: boolean
  /** Vrai : un trajet sans départementale à fort trafic existe, mais son détour dépasse le seuil choisi. */
  detourTropLong: boolean
}

/**
 * Choisit entre le trajet le plus court (sans autoroute) et celui qui évite les départementales à fort trafic :
 * ce dernier est retenu si son détour ne dépasse pas le seuil choisi (en %).
 */
export function choisirItineraire(
  plusCourt: Itineraire,
  evitantDepartementales: Itineraire,
  seuilDetourPourcent: number,
): ResultatItineraire {
  const sansDepartementalePossible = evitantDepartementales.departementaleFortTraficMetres === 0
  if (!sansDepartementalePossible) {
    const plusSur =
      evitantDepartementales.departementaleFortTraficMetres < plusCourt.departementaleFortTraficMetres
        ? evitantDepartementales
        : plusCourt
    return {
      itineraire: plusSur,
      plusCourt,
      retenuEstLePlusCourt: plusSur === plusCourt,
      sansDepartementalePossible,
      detourTropLong: false,
    }
  }
  const distanceMaximale = plusCourt.distanceMetres * (1 + seuilDetourPourcent / 100)
  const detourAccepte = evitantDepartementales.distanceMetres <= distanceMaximale
  return {
    itineraire: detourAccepte ? evitantDepartementales : plusCourt,
    plusCourt,
    retenuEstLePlusCourt: !detourAccepte,
    sansDepartementalePossible,
    detourTropLong: !detourAccepte,
  }
}

/** Itinéraire sans autoroute ni voie rapide, qui évite les départementales à fort trafic dans la limite du seuil. */
export async function calculerItineraire(depart: Lieu, arrivee: Lieu, seuilDetourPourcent: number): Promise<ResultatItineraire> {
  const [plusCourt, evitantDepartementales] = await Promise.all([
    demanderItineraire(depart, arrivee, [INTERDICTION_AUTOROUTES]),
    demanderItineraire(depart, arrivee, [INTERDICTION_AUTOROUTES, EVITEMENT_FORT_TRAFIC]),
  ])
  const resultat = choisirItineraire(plusCourt, evitantDepartementales, seuilDetourPourcent)
  return avecLesEtapesDuTrajetRetenu(resultat, await nommerLesVillages(resultat.itineraire.etapes))
}
