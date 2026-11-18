/**
 * Recherche d'adresses et de communes dans la Base Adresse Nationale (service public, sans compte),
 * servie par la Géoplateforme de l'IGN. Le texte tapé quitte l'appareil : décision tracée dans
 * docs/adr/0002-recherche-d-adresses-et-trajets-recents.md. Sans réseau, la recherche échoue
 * avec `ErreurReseau`.
 */
const SERVICE_ADRESSES = 'https://data.geopf.fr/geocodage'
/** Découpage administratif (geo.api.gouv.fr) : le nom d'une commune à partir de son seul code (ADR 0005). */
const SERVICE_COMMUNES = 'https://geo.api.gouv.fr/communes'
const NOMBRE_DE_PROPOSITIONS = 5

/** Un point de départ ou d'arrivée : ce qu'on affiche et où il se trouve. */
export interface Lieu {
  libelle: string
  latitude: number
  longitude: number
}

/** Le service d'adresses n'a pas répondu (pas de réseau, ou service indisponible). */
export class ErreurReseau extends Error {
  constructor() {
    super('Le service de recherche d’adresses ne répond pas.')
    this.name = 'ErreurReseau'
  }
}

interface ReponseBaseAdresse {
  features: { geometry: { coordinates: [number, number] }; properties: { label: string } }[]
}

async function interrogerBaseAdresse(adresseDuService: string): Promise<Lieu[]> {
  let reponse: Response
  try {
    reponse = await fetch(adresseDuService)
  } catch {
    throw new ErreurReseau()
  }
  if (!reponse.ok) throw new ErreurReseau()
  const resultat = (await reponse.json()) as ReponseBaseAdresse
  return resultat.features.map((resultatTrouve) => ({
    libelle: resultatTrouve.properties.label,
    longitude: resultatTrouve.geometry.coordinates[0],
    latitude: resultatTrouve.geometry.coordinates[1],
  }))
}

/** Adresses et communes qui correspondent au texte tapé (5 au plus, les plus probables d'abord). */
export function rechercherLieux(texteTape: string): Promise<Lieu[]> {
  const parametres = new URLSearchParams({ q: texteTape.trim(), limit: String(NOMBRE_DE_PROPOSITIONS) })
  return interrogerBaseAdresse(`${SERVICE_ADRESSES}/search?${parametres}`)
}

/** L'adresse la plus proche d'une position, ou `null` si aucune n'est connue. */
export async function lieuLePlusProche(latitude: number, longitude: number): Promise<Lieu | null> {
  const parametres = new URLSearchParams({ lat: String(latitude), lon: String(longitude), limit: '1' })
  const lieuxProches = await interrogerBaseAdresse(`${SERVICE_ADRESSES}/reverse?${parametres}`)
  return lieuxProches[0] ?? null
}

/** Code officiel (INSEE) de la commune où se trouve un point, ou `null` hors de France. */
export async function codeDeCommuneALaPosition(latitude: number, longitude: number): Promise<string | null> {
  const parametres = new URLSearchParams({ lat: String(latitude), lon: String(longitude), fields: 'code' })
  let reponse: Response
  try {
    reponse = await fetch(`${SERVICE_COMMUNES}?${parametres}`)
  } catch {
    throw new ErreurReseau()
  }
  if (!reponse.ok) throw new ErreurReseau()
  const communes = (await reponse.json()) as { code?: string }[]
  return communes[0]?.code?.trim() || null
}

/** Nom d'une commune d'après son code officiel (INSEE), ou `null` si le service ne la connaît pas. */
export async function nomDeCommune(codeCommune: string): Promise<string | null> {
  let reponse: Response
  try {
    reponse = await fetch(`${SERVICE_COMMUNES}/${encodeURIComponent(codeCommune)}?fields=nom`)
  } catch {
    throw new ErreurReseau()
  }
  if (reponse.status === 404) return null
  if (!reponse.ok) throw new ErreurReseau()
  const commune = (await reponse.json()) as { nom?: string }
  return commune.nom?.trim() || null
}
