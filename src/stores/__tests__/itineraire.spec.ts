import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useItineraireStore } from '../itineraire'
import type { Lieu } from '@/services/adresses'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'

const lieu = (libelle: string): Lieu => ({ libelle, latitude: 45, longitude: 4 })

const reponseIgn = (metres: number, departementaleMetres: number) =>
  new Response(
    JSON.stringify({
      distance: metres,
      portions: [
        {
          steps: [
            { distance: metres - departementaleMetres, attributes: { name: { cpx_numero: '' } } },
            { distance: departementaleMetres, attributes: { name: { cpx_numero: 'D12' } } },
          ],
        },
      ],
    }),
  )

describe('Itinéraire et détour accepté', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.unstubAllGlobals())

  it('propose 30 % de détour par défaut', () => {
    simulerLocalStorage()
    expect(useItineraireStore().seuilDetour).toBe(30)
  })

  it('garde le seuil choisi sur l’appareil et le retrouve au retour', () => {
    const memoire = simulerLocalStorage()
    useItineraireStore().choisirSeuil(20)
    expect(JSON.parse(memoire.get('leon:seuil-detour')!)).toBe(20)
    setActivePinia(createPinia())
    expect(useItineraireStore().seuilDetour).toBe(20)
  })

  it('prévient si l’appareil refuse d’enregistrer le seuil', () => {
    simulerLocalStorage({}, true)
    const magasin = useItineraireStore()
    magasin.choisirSeuil(50)
    expect(magasin.erreur).toMatch(/n’a pas pu enregistrer/)
  })

  it('calcule l’itinéraire avec le seuil choisi', async () => {
    simulerLocalStorage()
    const fetchSimule = vi.fn<(adresse: string) => Promise<Response>>()
    fetchSimule.mockResolvedValueOnce(reponseIgn(10000, 4000)).mockResolvedValueOnce(reponseIgn(12500, 0))
    vi.stubGlobal('fetch', fetchSimule)
    const magasin = useItineraireStore()
    magasin.choisirSeuil(20)
    await magasin.calculer(lieu('Lyon'), lieu('Vienne'))
    expect(magasin.resultat?.itineraire.distanceMetres).toBe(10000)
    expect(magasin.resultat?.detourTropLong).toBe(true)
    expect(magasin.resultat?.retenuEstLePlusCourt).toBe(true)
    expect(magasin.resultat?.plusCourt.distanceMetres).toBe(10000)
  })

  it('Story #5 : garde aussi le trajet le plus court, pour comparer', async () => {
    simulerLocalStorage()
    const fetchSimule = vi.fn<(adresse: string) => Promise<Response>>()
    fetchSimule.mockResolvedValueOnce(reponseIgn(10000, 4000)).mockResolvedValueOnce(reponseIgn(12500, 0))
    vi.stubGlobal('fetch', fetchSimule)
    const magasin = useItineraireStore()
    await magasin.calculer(lieu('Lyon'), lieu('Vienne'))
    expect(magasin.resultat?.itineraire.distanceMetres).toBe(12500)
    expect(magasin.resultat?.plusCourt.distanceMetres).toBe(10000)
    expect(magasin.resultat?.retenuEstLePlusCourt).toBe(false)
    expect(magasin.calculEnCours).toBe(false)
  })

  it('dit clairement quand le service ne répond pas', async () => {
    simulerLocalStorage()
    vi.stubGlobal('fetch', vi.fn<() => Promise<Response>>().mockRejectedValue(new TypeError('Failed to fetch')))
    const magasin = useItineraireStore()
    await magasin.calculer(lieu('Lyon'), lieu('Vienne'))
    expect(magasin.resultat).toBeNull()
    expect(magasin.erreur).toMatch(/a besoin du réseau/)
  })
})
