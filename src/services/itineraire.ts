/**
 * Calcul d'itinéraire par le service public de l'IGN (Géoplateforme, sans compte). Le départ et
 * l'arrivée quittent l'appareil : décision tracée dans docs/adr/0003-calcul-d-itineraire.md.
 * Chaque demande interdit les autoroutes, voies rapides et chemins de terre. Sans réseau, le calcul échoue avec
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
 * Jamais de chemin de terre : une VSP ne peut pas y rouler. Pour l'IGN, ce sont les « routes
 * empierrées » (non revêtues) ; les vrais « chemins » sont déjà écartés par le profil voiture.
 * Le service accepte au plus 3 contraintes par demande.
 */
export const INTERDICTION_CHEMINS_DE_TERRE = JSON.stringify({
  constraintType: 'banned',
  key: 'nature',
  operator: '=',
  value: 'route_empierree',
})

/** Éviter autant que possible les routes départementales. */
export const EVITEMENT_DEPARTEMENTALES = JSON.stringify({
  constraintType: 'avoid',
  key: 'cpx_classement_administratif',
  operator: '=',
  value: 'departementale',
})

/** Une étape du trajet, à lire avant de partir : un village, une route, une distance. */
export interface Etape {
  /** Code officiel (INSEE) de la commune traversée, ou `null` s'il est inconnu. */
  codeCommune: string | null
  /** Nom du village, retrouvé à partir de son code ; `null` s'il est inconnu. */
  commune: string | null
  route: string
  departementale: boolean
  distanceMetres: number
}

/** Un itinéraire calculé : sa distance totale et ce qu'il garde de départementale (en mètres). */
export interface Itineraire {
  distanceMetres: number
  departementaleMetres: number
  /** Ses tronçons, avec la vitesse de chaque route, pour calculer la durée sur l'appareil. */
  troncons: Troncon[]
  /** Ses étapes, dans l'ordre : les tronçons qui se suivent sur la même route et dans le même village n'en font qu'une. */
  etapes: Etape[]
}

interface AttributsDuTroncon {
  name?: { cpx_numero?: string; nom_1_gauche?: string; cpx_toponyme_route_nommee?: string }
  vitesse_moyenne_vl?: number | string
  insee_commune_gauche?: string
}

interface TronconRecu {
  distance: number
  attributes?: AttributsDuTroncon
}

interface ReponseItineraire {
  distance: number
  portions: { steps: TronconRecu[] }[]
}

export const ROUTE_SANS_NOM = 'Route sans nom'

/** Vitesse habituelle des voitures sur la route (BD TOPO), ou `null` si elle est inconnue. */
const vitesseDeLaRoute = (vitesseBrute: number | string | undefined): number | null => {
  const vitesse = Number(vitesseBrute)
  return vitesseBrute !== undefined && vitesseBrute !== '' && vitesse > 0 ? vitesse : null
}

/** Une route départementale porte un numéro « D… » (ou « RD… ») dans les données de l'IGN. */
export const estDepartementale = (numeroDeRoute: string | undefined) => /^R?D\s?\d/i.test(numeroDeRoute ?? '')

/** Le numéro de la route (« D12 »), sinon le nom de la rue, sinon « Route sans nom ». */
const nomDeLaRoute = (attributs: AttributsDuTroncon | undefined): string =>
  attributs?.name?.cpx_numero?.trim() ||
  attributs?.name?.nom_1_gauche?.trim() ||
  attributs?.name?.cpx_toponyme_route_nommee?.trim() ||
  ROUTE_SANS_NOM

/** Regroupe, dans l'ordre du trajet, les tronçons qui se suivent sur la même route et dans la même commune. */
export function regrouperEnEtapes(troncons: TronconRecu[]): Etape[] {
  const etapes: Etape[] = []
  for (const troncon of troncons) {
    const codeCommune = troncon.attributes?.insee_commune_gauche?.trim() || null
    const route = nomDeLaRoute(troncon.attributes)
    const etapePrecedente = etapes[etapes.length - 1]
    if (etapePrecedente && etapePrecedente.codeCommune === codeCommune && etapePrecedente.route === route) {
      etapePrecedente.distanceMetres += troncon.distance
      continue
    }
    etapes.push({
      codeCommune,
      commune: null,
      route,
      departementale: estDepartementale(troncon.attributes?.name?.cpx_numero),
      distanceMetres: troncon.distance,
    })
  }
  return etapes
}

/**
 * Donne à chaque étape le nom de son village : une demande par commune au service public des
 * adresses, qui ne reçoit que le code de la commune. Un nom introuvable reste `null`, sans erreur.
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
    distanceUnit: 'meter',
    waysAttributes: 'vitesse_moyenne_vl|insee_commune_gauche',
  })
  let reponse: Response
  try {
    reponse = await fetch(`${SERVICE_ITINERAIRE}?${parametres}`)
  } catch {
    throw new ErreurReseau()
  }
  if (!reponse.ok) throw new ErreurReseau()
  const resultat = (await reponse.json()) as ReponseItineraire
  const etapes = resultat.portions.flatMap((portion) => portion.steps)
  return {
    distanceMetres: resultat.distance,
    departementaleMetres: etapes
      .filter((etape) => estDepartementale(etape.attributes?.name?.cpx_numero))
      .reduce((total, etape) => total + etape.distance, 0),
    troncons: etapes.map((etape) => ({
      distanceMetres: etape.distance,
      vitesseRouteKmh: vitesseDeLaRoute(etape.attributes?.vitesse_moyenne_vl),
    })),
    etapes: regrouperEnEtapes(etapes),
  }
}

/** Ce que l'appli retient et dit à la personne. */
export interface ResultatItineraire {
  itineraire: Itineraire
  /** Le trajet le plus court sans autoroute, gardé pour la comparaison (et les stories à venir). */
  plusCourt: Itineraire
  /** Vrai : le trajet retenu est le plus court lui-même. */
  retenuEstLePlusCourt: boolean
  /** Faux : aucun trajet sans départementale n'existe ; on propose quand même le plus sûr. */
  sansDepartementalePossible: boolean
  /** Vrai : un trajet sans départementale existe, mais son détour dépasse le seuil choisi. */
  detourTropLong: boolean
}

/**
 * Choisit entre le trajet le plus court (sans autoroute) et celui qui évite les départementales :
 * ce dernier est retenu si son détour ne dépasse pas le seuil choisi (en %).
 */
export function choisirItineraire(
  plusCourt: Itineraire,
  evitantDepartementales: Itineraire,
  seuilDetourPourcent: number,
): ResultatItineraire {
  const sansDepartementalePossible = evitantDepartementales.departementaleMetres === 0
  if (!sansDepartementalePossible) {
    const plusSur =
      evitantDepartementales.departementaleMetres < plusCourt.departementaleMetres ? evitantDepartementales : plusCourt
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

/** Itinéraire sans autoroute ni voie rapide, qui évite les départementales dans la limite du seuil. */
export async function calculerItineraire(depart: Lieu, arrivee: Lieu, seuilDetourPourcent: number): Promise<ResultatItineraire> {
  const [plusCourt, evitantDepartementales] = await Promise.all([
    demanderItineraire(depart, arrivee, [INTERDICTION_AUTOROUTES, INTERDICTION_CHEMINS_DE_TERRE]),
    demanderItineraire(depart, arrivee, [INTERDICTION_AUTOROUTES, INTERDICTION_CHEMINS_DE_TERRE, EVITEMENT_DEPARTEMENTALES]),
  ])
  const resultat = choisirItineraire(plusCourt, evitantDepartementales, seuilDetourPourcent)
  const itineraireRetenu = { ...resultat.itineraire, etapes: await nommerLesVillages(resultat.itineraire.etapes) }
  return {
    ...resultat,
    itineraire: itineraireRetenu,
    plusCourt: resultat.retenuEstLePlusCourt ? itineraireRetenu : resultat.plusCourt,
  }
}
