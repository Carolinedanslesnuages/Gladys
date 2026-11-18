/**
 * Recherche d'adresses et de communes dans la Base Adresse Nationale (service public, sans compte),
 * servie par la Géoplateforme de l'IGN. Le texte tapé quitte l'appareil : décision tracée dans
 * docs/adr/0002-recherche-d-adresses-et-trajets-recents.md. Sans réseau, la recherche échoue
 * avec `ErreurReseau`.
 */
const SERVICE_ADRESSES = 'https://data.geopf.fr/geocodage'
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
