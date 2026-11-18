/**
 * Calcul d'itinéraire avec OpenStreetMap, en essai à côté de l'IGN (docs/adr/0007-calcul-d-itineraire-openstreetmap.md) :
 * calculateur Valhalla public de l'association FOSSGIS, sans compte. Profil « cyclomoteur » : jamais
 * d'autoroute, 45 km/h au plus, comme une voiture sans permis. Le départ et l'arrivée quittent
 * l'appareil ; sans réseau, le calcul échoue avec `ErreurReseau`.
 */
import { codeDeCommuneALaPosition, ErreurReseau, type Lieu } from '@/services/adresses'
import {
  avecLesEtapesDuTrajetRetenu,
  choisirItineraire,
  estDepartementale,
  itineraireDepuisTroncons,
  nommerLesVillages,
  regrouperEnEtapes,
  type Itineraire,
  type PointDuTrace,
  type ResultatItineraire,
  type TronconRecu,
} from '@/services/itineraire'

const SERVICE_OPENSTREETMAP = 'https://valhalla1.openstreetmap.de'
/** Base Adresse Nationale (IGN) : la commune de chaque tronçon, en une seule demande. */
const SERVICE_COMMUNES_PAR_POSITION = 'https://data.geopf.fr/geocodage/reverse/csv'
const PROFIL_VSP = 'motor_scooter'
/** Au-delà, une demande sans réponse compte comme un service indisponible (pas d'attente sans fin). */
const DELAI_MAXIMUM_MILLISECONDES = 45000

/**
 * Classe de route OpenStreetMap ramenée à l'importance BD TOPO, pour juger le trafic comme avec
 * l'IGN : de 1 à 3 (route principale ou secondaire), fort trafic ; à partir de 4, route calme.
 */
export const IMPORTANCE_PAR_CLASSE_DE_ROUTE: Record<string, number> = {
  motorway: 1,
  trunk: 1,
  primary: 2,
  secondary: 3,
  tertiary: 4,
  unclassified: 5,
  residential: 5,
  service_other: 6,
}

/** Un tronçon décrit par OpenStreetMap (longueur en kilomètres, vitesse en km/h). */
export interface TronconOpenStreetMap {
  length: number
  speed?: number
  road_class?: string
  names?: string[]
  begin_shape_index?: number
}

interface Trajet {
  summary: { length: number }
  legs: { shape: string }[]
}

interface ReponseTrajet {
  trip: Trajet
  /** Les autres chemins proposés par le calculateur, quand on les demande. */
  alternates?: { trip: Trajet }[]
}

/**
 * La préférence `use_primary` ne fuit que les routes principales : une route secondaire (jaune sur
 * la carte) reste permise. On demande donc aussi deux autres chemins, pour garder le moins chargé.
 */
const AUTRES_CHEMINS_DEMANDES = 2

interface ReponseAttributs {
  edges?: TronconOpenStreetMap[]
  shape?: string
}

/** Un trajet possible, avec ses tronçons et le point où chacun commence (pour trouver sa commune). */
export interface TrajetPossible {
  itineraire: Itineraire
  tronconsRecus: TronconRecu[]
  debutsDesTroncons: (PointDuTrace | null)[]
}

/** Décode un tracé OpenStreetMap (polyligne codée, précision 6 décimales) en points latitude et longitude. */
export function decoderTrace(traceCodee: string): PointDuTrace[] {
  const points: PointDuTrace[] = []
  let position = 0
  let latitude = 0
  let longitude = 0
  const lireEcart = (): number => {
    let valeur = 0
    let decalage = 0
    let morceau: number
    do {
      morceau = traceCodee.charCodeAt(position) - 63
      position += 1
      valeur |= (morceau & 0x1f) << decalage
      decalage += 5
    } while (morceau >= 0x20 && position < traceCodee.length)
    return valeur & 1 ? ~(valeur >> 1) : valeur >> 1
  }
  while (position < traceCodee.length) {
    latitude += lireEcart()
    longitude += lireEcart()
    points.push({ latitude: latitude / 1e6, longitude: longitude / 1e6 })
  }
  return points
}

/** Un tronçon OpenStreetMap sous la forme BD TOPO : numéro « D… », nom de rue, vitesse, importance. */
export function enTronconRecu(tronconOsm: TronconOpenStreetMap): TronconRecu {
  const noms = tronconOsm.names ?? []
  return {
    distance: tronconOsm.length * 1000,
    attributes: {
      cpx_numero: noms.find((nom) => estDepartementale(nom)),
      nom_1_gauche: noms.find((nom) => !estDepartementale(nom)),
      vitesse_moyenne_vl: tronconOsm.speed,
      importance: tronconOsm.road_class ? IMPORTANCE_PAR_CLASSE_DE_ROUTE[tronconOsm.road_class] : undefined,
    },
  }
}

async function demander<Reponse>(action: string, corps: object): Promise<Reponse> {
  let reponse: Response
  try {
    reponse = await fetch(`${SERVICE_OPENSTREETMAP}/${action}`, {
      method: 'POST',
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(DELAI_MAXIMUM_MILLISECONDES),
    })
  } catch {
    throw new ErreurReseau()
  }
  if (!reponse.ok) throw new ErreurReseau()
  return (await reponse.json()) as Reponse
}

const demandeDeTrajet = (depart: Lieu, arrivee: Lieu, options: object, autresChemins = 0) => ({
  locations: [
    { lat: depart.latitude, lon: depart.longitude },
    { lat: arrivee.latitude, lon: arrivee.longitude },
  ],
  costing: PROFIL_VSP,
  costing_options: { [PROFIL_VSP]: options },
  units: 'kilometers',
  directions_type: 'none',
  ...(autresChemins > 0 ? { alternates: autresChemins } : {}),
})

/**
 * Parmi les chemins qui fuient les grands axes, le moins chargé en fort trafic, à égalité le plus
 * court. Ceux qui tiennent dans le détour accepté passent avant les autres.
 */
export function leMoinsCharge(cheminsPossibles: TrajetPossible[], distanceMaximaleMetres: number): TrajetPossible | null {
  const dansLeDetour = (chemin: TrajetPossible) => chemin.itineraire.distanceMetres <= distanceMaximaleMetres
  const candidats = cheminsPossibles.some(dansLeDetour) ? cheminsPossibles.filter(dansLeDetour) : cheminsPossibles
  return candidats.reduce<TrajetPossible | null>((meilleur, chemin) => {
    if (!meilleur) return chemin
    const ecart = chemin.itineraire.departementaleFortTraficMetres - meilleur.itineraire.departementaleFortTraficMetres
    return ecart < 0 || (ecart === 0 && chemin.itineraire.distanceMetres < meilleur.itineraire.distanceMetres)
      ? chemin
      : meilleur
  }, null)
}

/** Les routes empruntées par un trajet, avec leur classe et leur vitesse. Écarte un trajet par autoroute. */
async function decrireLeTrajet(trajet: Trajet): Promise<TrajetPossible | null> {
  // Un départ et une arrivée : le trajet n'a qu'une seule partie.
  const traceCodee = trajet.legs[0]?.shape ?? ''
  const attributs = await demander<ReponseAttributs>('trace_attributes', {
    encoded_polyline: traceCodee,
    shape_match: 'edge_walk',
    costing: PROFIL_VSP,
    filters: {
      attributes: ['edge.names', 'edge.length', 'edge.speed', 'edge.road_class', 'edge.begin_shape_index', 'shape'],
      action: 'include',
    },
  })
  const tronconsOsm = attributs.edges ?? []
  if (tronconsOsm.some((tronconOsm) => tronconOsm.road_class === 'motorway')) return null
  const tronconsRecus = tronconsOsm.map((tronconOsm) => enTronconRecu(tronconOsm))
  const pointsDesTroncons = decoderTrace(attributs.shape ?? '')
  return {
    itineraire: itineraireDepuisTroncons(tronconsRecus, trajet.summary.length * 1000, decoderTrace(traceCodee)),
    tronconsRecus,
    debutsDesTroncons: tronconsOsm.map((tronconOsm) => pointsDesTroncons[tronconOsm.begin_shape_index ?? -1] ?? null),
  }
}

/** Code officiel de la commune de chaque point (une seule demande) ; `undefined` pour un point inconnu. */
export async function codesDesCommunes(points: (PointDuTrace | null)[]): Promise<(string | undefined)[]> {
  const lignes = points.map((point) => (point ? `${point.latitude},${point.longitude}` : '0,0'))
  const formulaire = new FormData()
  formulaire.append('data', new Blob([`lat,lon\n${lignes.join('\n')}\n`], { type: 'text/csv' }), 'troncons.csv')
  formulaire.append('result_columns', 'result_citycode')
  const reponse = await fetch(SERVICE_COMMUNES_PAR_POSITION, {
    method: 'POST',
    body: formulaire,
    signal: AbortSignal.timeout(DELAI_MAXIMUM_MILLISECONDES),
  })
  if (!reponse.ok) throw new ErreurReseau()
  const lignesRecues = (await reponse.text()).trim().split('\n').slice(1)
  return points.map((point, rang) => (point ? lignesRecues[rang]?.split(',')[2]?.trim() || undefined : undefined))
}

const memeRoute = (premier: TronconRecu, second: TronconRecu) =>
  premier.attributes?.cpx_numero === second.attributes?.cpx_numero &&
  premier.attributes?.nom_1_gauche === second.attributes?.nom_1_gauche

/**
 * Complète les codes manquants (tronçon loin de toute adresse) : une demande au découpage
 * administratif par suite de tronçons sans code sur la même route, au milieu de la suite.
 */
export async function completerLesCodes(
  tronconsRecus: TronconRecu[],
  debutsDesTroncons: (PointDuTrace | null)[],
  codesTrouves: (string | undefined)[],
): Promise<(string | undefined)[]> {
  const suitesSansCode: number[][] = []
  tronconsRecus.forEach((tronconRecu, rang) => {
    if (codesTrouves[rang]) return
    const suiteEnCours = suitesSansCode[suitesSansCode.length - 1]
    const rangPrecedent = suiteEnCours?.[suiteEnCours.length - 1]
    if (suiteEnCours && rangPrecedent === rang - 1 && memeRoute(tronconsRecus[rangPrecedent]!, tronconRecu)) {
      suiteEnCours.push(rang)
    } else {
      suitesSansCode.push([rang])
    }
  })
  const codesComplets = tronconsRecus.map((_tronconRecu, rang) => codesTrouves[rang])
  await Promise.all(
    suitesSansCode.map(async (suite) => {
      const pointDuMilieu = debutsDesTroncons[suite[Math.floor(suite.length / 2)]!]
      if (!pointDuMilieu) return
      const code = await codeDeCommuneALaPosition(pointDuMilieu.latitude, pointDuMilieu.longitude).catch(() => null)
      for (const rang of suite) codesComplets[rang] = code ?? undefined
    }),
  )
  return codesComplets
}

/** Itinéraire sans autoroute, qui évite les départementales à fort trafic dans la limite du seuil. */
export async function calculerItineraireOpenStreetMap(
  depart: Lieu,
  arrivee: Lieu,
  seuilDetourPourcent: number,
): Promise<ResultatItineraire> {
  // Deux demandes à la fois au plus : le service public demande de ne pas le solliciter en rafale.
  const [plusCourt, cheminsFuyants] = await Promise.all([
    demander<ReponseTrajet>('route', demandeDeTrajet(depart, arrivee, { shortest: true })).then((reponse) =>
      decrireLeTrajet(reponse.trip),
    ),
    demander<ReponseTrajet>('route', demandeDeTrajet(depart, arrivee, { use_primary: 0 }, AUTRES_CHEMINS_DEMANDES)),
  ])
  if (!plusCourt) throw new Error('Le trajet le plus court passe par une autoroute.')
  const cheminsDecrits: TrajetPossible[] = []
  for (const trajet of [cheminsFuyants.trip, ...(cheminsFuyants.alternates ?? []).map((autre) => autre.trip)]) {
    const cheminDecrit = await decrireLeTrajet(trajet)
    if (cheminDecrit) cheminsDecrits.push(cheminDecrit)
  }
  const distanceMaximale = plusCourt.itineraire.distanceMetres * (1 + seuilDetourPourcent / 100)
  const fuyantLesGrandsAxes = leMoinsCharge(cheminsDecrits, distanceMaximale) ?? plusCourt
  const resultat = choisirItineraire(plusCourt.itineraire, fuyantLesGrandsAxes.itineraire, seuilDetourPourcent)
  const trajetRetenu = resultat.itineraire === plusCourt.itineraire ? plusCourt : fuyantLesGrandsAxes
  const codes = await completerLesCodes(
    trajetRetenu.tronconsRecus,
    trajetRetenu.debutsDesTroncons,
    await codesDesCommunes(trajetRetenu.debutsDesTroncons).catch(() => []),
  )
  const etapes = regrouperEnEtapes(
    trajetRetenu.tronconsRecus.map((tronconRecu, rang) => ({
      ...tronconRecu,
      attributes: { ...tronconRecu.attributes, insee_commune_gauche: codes[rang] },
    })),
  )
  return avecLesEtapesDuTrajetRetenu(resultat, await nommerLesVillages(etapes))
}
