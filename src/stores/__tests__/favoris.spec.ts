import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  LONGUEUR_MAXIMALE_DU_NOM,
  MESSAGE_NOM_TROP_LONG,
  MESSAGE_NOM_VIDE,
  MESSAGE_SANS_ACCORD,
  MESSAGE_STOCKAGE_PLEIN,
  useFavorisStore,
} from '../favoris'
import { useItineraireStore } from '../itineraire'
import type { Lieu } from '@/services/adresses'
import type { Itineraire, ResultatItineraire } from '@/services/itineraire'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'

const lieu = (libelle: string): Lieu => ({ libelle, latitude: 45, longitude: 4 })

const itineraire: Itineraire = {
  distanceMetres: 12000,
  departementaleFortTraficMetres: 0,
  troncons: [],
  etapes: [
    { codeCommune: '69123', commune: 'Lyon', route: 'D 306', departementale: true, fortTrafic: false, distanceMetres: 12000 },
  ],
  trace: [
    { latitude: 45.75, longitude: 4.85 },
    { latitude: 45.52, longitude: 4.87 },
  ],
}
const resultat: ResultatItineraire = {
  itineraire,
  plusCourt: itineraire,
  retenuEstLePlusCourt: true,
  sansDepartementalePossible: true,
  detourTropLong: false,
}

describe('Trajets favoris gardés sur l’appareil', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.unstubAllGlobals())

  it('ne garde rien tant que la personne n’a pas donné son accord', () => {
    const memoire = simulerLocalStorage()
    const magasin = useFavorisStore()
    expect(magasin.accord).toBeNull()
    expect(magasin.enregistrer('Maison → Marché', lieu('Maison'), lieu('Marché'), resultat, 'ign')).toBe(MESSAGE_SANS_ACCORD)
    expect(magasin.favoris).toEqual([])
    expect(memoire.has('gladys:favoris')).toBe(false)
  })

  it('enregistre un trajet sous son nom, et le retrouve après rechargement', () => {
    const memoire = simulerLocalStorage()
    const magasin = useFavorisStore()
    magasin.choisirAccord('accepte')
    expect(magasin.enregistrer('  Maison → Marché  ', lieu('Maison'), lieu('Marché'), resultat, 'openstreetmap')).toBeNull()
    expect(magasin.favoris.map((favori) => favori.nom)).toEqual(['Maison → Marché'])

    setActivePinia(createPinia())
    simulerLocalStorage(Object.fromEntries(memoire))
    const apresRechargement = useFavorisStore()
    const favori = apresRechargement.favoris[0]!
    expect(favori.nom).toBe('Maison → Marché')
    expect(favori.arrivee.libelle).toBe('Marché')
    expect(favori.calculateur).toBe('openstreetmap')
    expect(favori.resultat.itineraire.trace).toHaveLength(2)
    expect(favori.resultat.itineraire.etapes[0]!.commune).toBe('Lyon')
  })

  it('refuse un nom vide ou trop long, avec un message clair', () => {
    simulerLocalStorage()
    const magasin = useFavorisStore()
    magasin.choisirAccord('accepte')
    expect(magasin.enregistrer('   ', lieu('Maison'), lieu('Marché'), resultat, 'ign')).toBe(MESSAGE_NOM_VIDE)
    expect(
      magasin.enregistrer('x'.repeat(LONGUEUR_MAXIMALE_DU_NOM + 1), lieu('Maison'), lieu('Marché'), resultat, 'ign'),
    ).toBe(MESSAGE_NOM_TROP_LONG)
    expect(magasin.favoris).toEqual([])
  })

  it('n’impose aucune limite au nombre de favoris, le plus récent en tête', () => {
    simulerLocalStorage()
    const magasin = useFavorisStore()
    magasin.choisirAccord('accepte')
    for (let rang = 1; rang <= 30; rang++) {
      magasin.enregistrer(`Trajet ${rang}`, lieu('Maison'), lieu(`Lieu ${rang}`), resultat, 'ign')
    }
    expect(magasin.favoris).toHaveLength(30)
    expect(magasin.favoris[0]!.nom).toBe('Trajet 30')
  })

  it('supprime un favori pour de bon, sans toucher aux autres', () => {
    const memoire = simulerLocalStorage()
    const magasin = useFavorisStore()
    magasin.choisirAccord('accepte')
    magasin.enregistrer('Maison → Marché', lieu('Maison'), lieu('Marché'), resultat, 'ign')
    magasin.enregistrer('Maison → Église', lieu('Maison'), lieu('Église'), resultat, 'ign')
    const aSupprimer = magasin.favoris.find((favori) => favori.nom === 'Maison → Marché')!
    magasin.supprimer(aSupprimer.id)
    expect(magasin.favoris.map((favori) => favori.nom)).toEqual(['Maison → Église'])
    expect(JSON.parse(memoire.get('gladys:favoris')!)).toHaveLength(1)

    setActivePinia(createPinia())
    simulerLocalStorage(Object.fromEntries(memoire))
    expect(useFavorisStore().favoris.map((favori) => favori.nom)).toEqual(['Maison → Église'])
  })

  it('ne demande l’accord qu’une fois : il est retenu après rechargement', () => {
    const memoire = simulerLocalStorage()
    useFavorisStore().choisirAccord('accepte')
    setActivePinia(createPinia())
    simulerLocalStorage(Object.fromEntries(memoire))
    expect(useFavorisStore().accord).toBe('accepte')
  })

  it('l’accord des favoris est distinct de celui de l’historique', () => {
    const memoire = simulerLocalStorage()
    useFavorisStore().choisirAccord('accepte')
    expect(memoire.has('gladys:accord-favoris')).toBe(true)
    expect(memoire.has('gladys:accord-historique')).toBe(false)
  })

  it('appareil plein : prévient, et ne perd aucun favori déjà enregistré', () => {
    const memoire = simulerLocalStorage()
    const magasin = useFavorisStore()
    magasin.choisirAccord('accepte')
    magasin.enregistrer('Maison → Marché', lieu('Maison'), lieu('Marché'), resultat, 'ign')

    setActivePinia(createPinia())
    simulerLocalStorage(Object.fromEntries(memoire), true)
    const magasinPlein = useFavorisStore()
    expect(magasinPlein.enregistrer('Maison → Église', lieu('Maison'), lieu('Église'), resultat, 'ign')).toBe(
      MESSAGE_STOCKAGE_PLEIN,
    )
    expect(magasinPlein.favoris.map((favori) => favori.nom)).toEqual(['Maison → Marché'])
  })

  it('un favori restauré redonne l’itinéraire sans aucun réseau', () => {
    simulerLocalStorage()
    const fetchSimule = vi.fn<() => Promise<Response>>()
    vi.stubGlobal('fetch', fetchSimule)
    const magasinItineraire = useItineraireStore()
    magasinItineraire.restaurer(resultat, 'openstreetmap')
    expect(magasinItineraire.resultat?.itineraire.trace).toHaveLength(2)
    expect(magasinItineraire.calculateurDuResultat).toBe('openstreetmap')
    expect(fetchSimule).not.toHaveBeenCalled()
  })
})
