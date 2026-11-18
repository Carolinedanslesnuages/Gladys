import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import VueDsfr from '@gouvminint/vue-dsfr'
import TrajetView from '../TrajetView.vue'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const reponseBaseAdresse = (libelles: string[]) =>
  new Response(
    JSON.stringify({
      features: libelles.map((libelle) => ({ geometry: { coordinates: [4.85, 45.75] }, properties: { label: libelle } })),
    }),
  )

const definirEnLigne = (valeur: boolean) => Object.defineProperty(navigator, 'onLine', { value: valeur, configurable: true })

const simulerPosition = (accordee: boolean) =>
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (
        succes: (position: { coords: { latitude: number; longitude: number } }) => void,
        echec: (erreurPosition: { code: number }) => void,
      ) => (accordee ? succes({ coords: { latitude: 45.75, longitude: 4.85 } }) : echec({ code: 1 })),
    },
  })

let fetchSimule: ReturnType<typeof vi.fn<(adresse: string) => Promise<Response>>>

const monter = () => mount(TrajetView, { global: { plugins: [VueDsfr] }, attachTo: document.body })
type Ecran = ReturnType<typeof monter>

async function taper(ecran: Ecran, idChamp: string, texte: string): Promise<void> {
  await ecran.find(`#${idChamp}`).setValue(texte)
  await vi.advanceTimersByTimeAsync(400)
  await flushPromises()
}

const boutonNomme = (ecran: Ecran, intitule: string) =>
  ecran.findAll('button').find((bouton) => bouton.text() === intitule || bouton.attributes('aria-label') === intitule)!

async function choisirLieu(ecran: Ecran, idChamp: string, texte: string, libelle: string): Promise<void> {
  fetchSimule.mockResolvedValueOnce(reponseBaseAdresse([libelle]))
  await taper(ecran, idChamp, texte)
  await boutonNomme(ecran, libelle).trigger('click')
}

async function preparerTrajet(ecran: Ecran, depart: string, arrivee: string): Promise<void> {
  await choisirLieu(ecran, 'depart', depart, depart)
  await choisirLieu(ecran, 'arrivee', arrivee, arrivee)
  await ecran.find('form').trigger('submit')
  await flushPromises()
}

const statut = (ecran: Ecran) => ecran.find('#annonce-trajet')

describe('Écran « Préparer mon trajet »', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    simulerLocalStorage()
    definirEnLigne(true)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fetchSimule = vi.fn<(adresse: string) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchSimule)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    definirEnLigne(true)
    document.body.innerHTML = ''
  })

  describe('Critère 1 : saisir une adresse ou une commune pour le départ et l’arrivée', () => {
    it('propose des communes et des adresses pendant la saisie et retient le choix', async () => {
      const ecran = monter()
      fetchSimule.mockResolvedValueOnce(reponseBaseAdresse(['Vienne', 'Vienne-en-Arthies']))
      await taper(ecran, 'depart', 'Vienne')
      expect(fetchSimule.mock.calls[0]![0]).toContain('q=Vienne')
      expect(ecran.text()).toContain('Vienne-en-Arthies')
      expect(ecran.text()).toContain('2 propositions, choisissez-en une')
      await boutonNomme(ecran, 'Vienne').trigger('click')
      expect((ecran.find('#depart').element as HTMLInputElement).value).toBe('Vienne')
      expect(ecran.text()).toContain('Lieu retenu : Vienne')
      expect(document.activeElement?.id).toBe('depart')

      fetchSimule.mockResolvedValueOnce(reponseBaseAdresse(['8 Place Bellecour 69002 Lyon']))
      await taper(ecran, 'arrivee', '8 place Bellecour Lyon')
      await boutonNomme(ecran, '8 Place Bellecour 69002 Lyon').trigger('click')
      expect(ecran.text()).toContain('Lieu retenu : 8 Place Bellecour 69002 Lyon')
      ecran.unmount()
    })

    it('demande de choisir un lieu dans la liste avant de valider', async () => {
      const ecran = monter()
      await ecran.find('form').trigger('submit')
      expect(ecran.text()).toContain('Choisissez votre départ dans la liste des propositions.')
      expect(ecran.text()).toContain('Choisissez votre arrivée dans la liste des propositions.')
      expect(ecran.find('#depart').attributes('aria-describedby')).toBeTruthy()
      ecran.unmount()
    })
  })

  describe('Critère 2 : utiliser ma position actuelle comme départ', () => {
    it('remplit le départ avec l’adresse la plus proche quand la position est accordée', async () => {
      simulerPosition(true)
      fetchSimule.mockResolvedValueOnce(reponseBaseAdresse(['12 Rue de la République 69001 Lyon']))
      const ecran = monter()
      await boutonNomme(ecran, 'Utiliser ma position actuelle').trigger('click')
      await flushPromises()
      expect(fetchSimule.mock.calls[0]![0]).toContain('/reverse?lat=45.75&lon=4.85')
      expect((ecran.find('#depart').element as HTMLInputElement).value).toBe('12 Rue de la République 69001 Lyon')
      expect(ecran.text()).toContain('Départ rempli avec votre position actuelle')
      ecran.unmount()
    })

    it('affiche un message clair quand la position est refusée', async () => {
      simulerPosition(false)
      const ecran = monter()
      await boutonNomme(ecran, 'Utiliser ma position actuelle').trigger('click')
      await flushPromises()
      expect(ecran.text()).toContain('Position refusée : autorisez la localisation')
      expect(fetchSimule).not.toHaveBeenCalled()
      ecran.unmount()
    })
  })

  describe('Critère 3 : message clair si l’adresse est introuvable ou si le réseau manque', () => {
    it('dit que l’adresse est introuvable', async () => {
      fetchSimule.mockResolvedValueOnce(reponseBaseAdresse([]))
      const ecran = monter()
      await taper(ecran, 'arrivee', 'Xyzzyville')
      expect(ecran.text()).toContain('Adresse introuvable : « Xyzzyville ». Vérifiez l’orthographe')
      ecran.unmount()
    })

    it('dit que la recherche a besoin du réseau quand le service ne répond pas', async () => {
      fetchSimule.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      const ecran = monter()
      await taper(ecran, 'depart', 'Lyon')
      expect(ecran.text()).toContain('La recherche d’adresse a besoin du réseau')
      ecran.unmount()
    })

    it('hors connexion, désactive la recherche et la position et l’explique', async () => {
      definirEnLigne(false)
      const ecran = monter()
      expect(ecran.text()).toContain('Sans réseau, la recherche d’adresse et la position actuelle sont indisponibles')
      expect(ecran.find('#depart').attributes('disabled')).toBeDefined()
      expect(boutonNomme(ecran, 'Utiliser ma position actuelle').attributes('disabled')).toBeDefined()
      ecran.unmount()
    })
  })

  describe('Critère 4 : mes 5 derniers trajets restent proposés, même hors connexion', () => {
    it('demande l’accord avant de garder le trajet, puis le propose', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      expect(ecran.text()).toContain('Garder mes 5 derniers trajets sur ce téléphone ?')
      expect(document.activeElement?.id).toBe('titre-accord')
      await boutonNomme(ecran, 'Oui, garder mes trajets').trigger('click')
      await flushPromises()
      expect(boutonNomme(ecran, 'Reprendre le trajet de Lyon à Vienne')).toBeDefined()
      ecran.unmount()
    })

    it('ne garde rien si la personne refuse', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      await boutonNomme(ecran, 'Non, ne rien garder').trigger('click')
      await flushPromises()
      expect(ecran.text()).toContain('Vos trajets ne sont pas gardés sur ce téléphone.')
      expect(ecran.findAll('.trajet-recent')).toHaveLength(0)
      ecran.unmount()
    })

    it('reprend un trajet récent sans réseau', async () => {
      simulerLocalStorage({
        'leon:accord-historique': JSON.stringify('accepte'),
        'leon:trajets-recents': JSON.stringify([
          {
            depart: { libelle: 'Lyon', latitude: 45.75, longitude: 4.85 },
            arrivee: { libelle: 'Vienne', latitude: 45.52, longitude: 4.87 },
            valideLe: '2026-11-16T10:00:00Z',
          },
        ]),
      })
      definirEnLigne(false)
      const ecran = monter()
      await boutonNomme(ecran, 'Reprendre le trajet de Lyon à Vienne').trigger('click')
      expect((ecran.find('#depart').element as HTMLInputElement).value).toBe('Lyon')
      expect((ecran.find('#arrivee').element as HTMLInputElement).value).toBe('Vienne')
      await ecran.find('form').trigger('submit')
      await flushPromises()
      expect(statut(ecran).text()).toBe('Trajet prêt : de Lyon à Vienne.')
      expect(fetchSimule).not.toHaveBeenCalled()
      ecran.unmount()
    })

    it('efface les trajets récents après confirmation', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      await boutonNomme(ecran, 'Oui, garder mes trajets').trigger('click')
      await boutonNomme(ecran, 'Effacer mes trajets récents').trigger('click')
      await flushPromises()
      await boutonNomme(ecran, 'Annuler').trigger('click')
      expect(ecran.findAll('.trajet-recent')).toHaveLength(1)
      await boutonNomme(ecran, 'Effacer mes trajets récents').trigger('click')
      await boutonNomme(ecran, 'Oui, effacer mes trajets récents').trigger('click')
      await flushPromises()
      expect(ecran.findAll('.trajet-recent')).toHaveLength(0)
      expect(ecran.text()).toContain('Aucun trajet récent pour l’instant.')
      ecran.unmount()
    })
  })

  describe('Story #3 : calculer un itinéraire adapté à ma VSP', () => {
    const reponseIgn = (metres: number, departementaleMetres: number) =>
      new Response(
        JSON.stringify({
          distance: metres,
          portions: [
            {
              steps: [
                { distance: metres - departementaleMetres, attributes: { name: { cpx_numero: 'C3' } } },
                { distance: departementaleMetres, attributes: { name: { cpx_numero: 'D502' } } },
              ],
            },
          ],
        }),
      )

    async function calculer(ecran: Ecran, plusCourt: Response, evitantDepartementales: Response): Promise<void> {
      fetchSimule.mockResolvedValueOnce(plusCourt).mockResolvedValueOnce(evitantDepartementales)
      await boutonNomme(ecran, 'Calculer mon itinéraire').trigger('click')
      await flushPromises()
    }

    const resultat = (ecran: Ecran) => ecran.find('#resultat-itineraire')

    it('propose le calcul une fois le départ et l’arrivée choisis, sans autoroute ni voie rapide', async () => {
      const ecran = monter()
      expect(ecran.text()).not.toContain('Calculer mon itinéraire')
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      fetchSimule.mockClear()
      await calculer(ecran, reponseIgn(10000, 0), reponseIgn(10000, 0))
      expect(fetchSimule).toHaveBeenCalledTimes(2)
      for (const [adresse] of fetchSimule.mock.calls) {
        expect(new URL(adresse).searchParams.get('constraints')).toContain('"constraintType":"banned","key":"wayType"')
      }
      expect(resultat(ecran).attributes('role')).toBe('status')
      expect(resultat(ecran).text()).toContain('Distance totale10 km')
      expect(resultat(ecran).text()).toContain('Aucun kilomètre : trajet sans départementale')
      expect(resultat(ecran).text()).toContain('Itinéraire calculé : 10 km, sans autoroute ni voie rapide, sans départementale.')
      ecran.unmount()
    })

    it('Critère 2 : 30 % par défaut retient le détour de 12,5 km ; 20 % le refuse', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      expect((ecran.find('input[name="seuil-detour"][value="30"]').element as HTMLInputElement).checked).toBe(true)
      await calculer(ecran, reponseIgn(10000, 4000), reponseIgn(12500, 0))
      expect(resultat(ecran).text()).toContain('12,5 km')
      expect(resultat(ecran).text()).toContain('trajet sans départementale')

      await ecran.find('input[name="seuil-detour"][value="20"]').trigger('click')
      expect((ecran.find('input[name="seuil-detour"][value="20"]').element as HTMLInputElement).checked).toBe(true)
      await calculer(ecran, reponseIgn(10000, 4000), reponseIgn(12500, 0))
      expect(resultat(ecran).text()).toContain('son détour dépasse 20 %')
      expect(resultat(ecran).text()).toContain('Sur départementale4 km')
      ecran.unmount()
    })

    it('Critère 2 : le seuil choisi est retrouvé au retour dans l’appli', async () => {
      simulerLocalStorage({ 'leon:seuil-detour': '50' })
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      expect((ecran.find('input[name="seuil-detour"][value="50"]').element as HTMLInputElement).checked).toBe(true)
      ecran.unmount()
    })

    it('Critère 3 : affiche les kilomètres de départementale qui restent', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      await calculer(ecran, reponseIgn(10000, 5000), reponseIgn(11000, 3200))
      expect(resultat(ecran).text()).toContain('Sur départementale3,2 km')
      expect(resultat(ecran).text()).toContain('dont 3,2 km sur départementale')
      ecran.unmount()
    })

    it('Critère 4 : sans trajet sans départementale, le dit puis propose le trajet le plus sûr', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      await calculer(ecran, reponseIgn(10000, 5000), reponseIgn(11000, 3200))
      expect(resultat(ecran).text()).toContain('Aucun itinéraire sans départementale n’existe pour ce trajet.')
      expect(resultat(ecran).text()).toContain('Distance totale11 km')
      ecran.unmount()
    })

    it('hors connexion, désactive le calcul, l’explique et ne lance rien', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      fetchSimule.mockClear()
      definirEnLigne(false)
      window.dispatchEvent(new Event('offline'))
      await flushPromises()
      expect(ecran.text()).toContain('Le calcul d’itinéraire a besoin du réseau.')
      const bouton = boutonNomme(ecran, 'Calculer mon itinéraire')
      expect(bouton.attributes('disabled')).toBeDefined()
      await bouton.trigger('click')
      expect(fetchSimule).not.toHaveBeenCalled()
      ecran.unmount()
    })

    it('dit clairement quand le service de calcul ne répond pas', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      fetchSimule.mockRejectedValue(new TypeError('Failed to fetch'))
      await boutonNomme(ecran, 'Calculer mon itinéraire').trigger('click')
      await flushPromises()
      expect(resultat(ecran).text()).toContain('Le calcul d’itinéraire a besoin du réseau et le service ne répond pas.')
      ecran.unmount()
    })

    it('aucune violation d’accessibilité automatique (choix du détour, résultat et message)', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      await calculer(ecran, reponseIgn(10000, 5000), reponseIgn(11000, 3200))
      vi.useRealTimers()
      expect(await violationsAccessibilite(document.body)).toEqual([])
      ecran.unmount()
    })
  })

  it('aucune violation d’accessibilité automatique (propositions, question d’accord, trajets récents)', async () => {
    const ecran = monter()
    await preparerTrajet(ecran, 'Lyon', 'Vienne')
    fetchSimule.mockResolvedValueOnce(reponseBaseAdresse(['Lyon', 'Lyon 3e Arrondissement']))
    await taper(ecran, 'depart', 'Lyon 3')
    vi.useRealTimers()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await boutonNomme(ecran, 'Oui, garder mes trajets').trigger('click')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    ecran.unmount()
  })
})
