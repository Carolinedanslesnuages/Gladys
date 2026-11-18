/**
 * Calcul d'itinéraire par le service public de l'IGN (Géoplateforme, sans compte). Le départ et
 * l'arrivée quittent l'appareil : décision tracée dans docs/adr/0003-calcul-d-itineraire.md.
 * Chaque demande interdit les autoroutes et voies rapides. Sans réseau, le calcul échoue avec
 * `ErreurReseau`.
 */
import { ErreurReseau, type Lieu } from '@/services/adresses'

const SERVICE_ITINERAIRE = 'https://data.geopf.fr/navigation/itineraire'

/** Jamais d'autoroute ni de voie rapide (« type autoroutier » de la BD TOPO). */
export const INTERDICTION_AUTOROUTES = JSON.stringify({
  constraintType: 'banned',
  key: 'wayType',
  operator: '=',
  value: 'autoroute',
})

/** Éviter autant que possible les routes départementales. */
export const EVITEMENT_DEPARTEMENTALES = JSON.stringify({
  constraintType: 'avoid',
  key: 'cpx_classement_administratif',
  operator: '=',
  value: 'departementale',
})

/** Un itinéraire calculé : sa distance totale et ce qu'il garde de départementale (en mètres). */
export interface Itineraire {
  distanceMetres: number
  departementaleMetres: number
}

interface ReponseItineraire {
  distance: number
  portions: { steps: { distance: number; attributes?: { name?: { cpx_numero?: string } } }[] }[]
}

/** Une route départementale porte un numéro « D… » (ou « RD… ») dans les données de l'IGN. */
export const estDepartementale = (numeroDeRoute: string | undefined) => /^R?D\s?\d/i.test(numeroDeRoute ?? '')

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
  }
}

/** Ce que l'appli retient et dit à la personne. */
export interface ResultatItineraire {
  itineraire: Itineraire
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
    return { itineraire: plusSur, sansDepartementalePossible, detourTropLong: false }
  }
  const distanceMaximale = plusCourt.distanceMetres * (1 + seuilDetourPourcent / 100)
  const detourAccepte = evitantDepartementales.distanceMetres <= distanceMaximale
  return {
    itineraire: detourAccepte ? evitantDepartementales : plusCourt,
    sansDepartementalePossible,
    detourTropLong: !detourAccepte,
  }
}

/** Itinéraire sans autoroute ni voie rapide, qui évite les départementales dans la limite du seuil. */
export async function calculerItineraire(depart: Lieu, arrivee: Lieu, seuilDetourPourcent: number): Promise<ResultatItineraire> {
  const [plusCourt, evitantDepartementales] = await Promise.all([
    demanderItineraire(depart, arrivee, [INTERDICTION_AUTOROUTES]),
    demanderItineraire(depart, arrivee, [INTERDICTION_AUTOROUTES, EVITEMENT_DEPARTEMENTALES]),
  ])
  return choisirItineraire(plusCourt, evitantDepartementales, seuilDetourPourcent)
}
