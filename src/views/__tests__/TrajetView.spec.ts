import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import VueDsfr from '@gouvminint/vue-dsfr'
import TrajetView from '../TrajetView.vue'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'
import { violationsAccessibilite } from '@/__tests__/accessibilite'
import { EVITEMENT_FORT_TRAFIC } from '@/services/itineraire'
import { simulerOpenStreetMap } from '@/__tests__/openstreetmap-simule'

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
      expect(ecran.text()).toContain('Position refusée : autorisez la localisation pour GLADYS')
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
        'gladys:accord-historique': JSON.stringify('accepte'),
        'gladys:trajets-recents': JSON.stringify([
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
    const reponseIgn = (metres: number, departementaleFortTraficMetres: number) =>
      new Response(
        JSON.stringify({
          distance: metres,
          portions: [
            {
              steps: [
                { distance: metres - departementaleFortTraficMetres, attributes: { cpx_numero: 'C3' } },
                { distance: departementaleFortTraficMetres, attributes: { cpx_numero: 'D502' } },
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
      expect(resultat(ecran).text()).toContain('Aucun kilomètre : trajet sans départementale à fort trafic')
      expect(resultat(ecran).text()).toContain('Itinéraire calculé : 10 km, sans autoroute ni voie rapide, sans départementale à fort trafic.')
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
      expect(resultat(ecran).text()).toContain('Sur départementale à fort trafic4 km')
      ecran.unmount()
    })

    it('Critère 2 : le seuil choisi est retrouvé au retour dans l’appli', async () => {
      simulerLocalStorage({ 'gladys:seuil-detour': '50' })
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      expect((ecran.find('input[name="seuil-detour"][value="50"]').element as HTMLInputElement).checked).toBe(true)
      ecran.unmount()
    })

    it('Critère 3 : affiche les kilomètres de départementale qui restent', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      await calculer(ecran, reponseIgn(10000, 5000), reponseIgn(11000, 3200))
      expect(resultat(ecran).text()).toContain('Sur départementale à fort trafic3,2 km')
      expect(resultat(ecran).text()).toContain('dont 3,2 km sur départementale à fort trafic')
      ecran.unmount()
    })

    it('Critère 4 : sans trajet sans départementale, le dit puis propose le trajet le plus sûr', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      await calculer(ecran, reponseIgn(10000, 5000), reponseIgn(11000, 3200))
      expect(resultat(ecran).text()).toContain('Aucun itinéraire sans départementale à fort trafic n’existe pour ce trajet.')
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

  describe('Story #4 : connaître mon vrai temps de trajet', () => {
    /** 15 km sur une route où les voitures roulent à 80 km/h, et 6 km sur une route à 30 km/h. */
    const reponseAvecVitesses = () =>
      new Response(
        JSON.stringify({
          distance: 21000,
          portions: [
            {
              steps: [
                { distance: 15000, attributes: { cpx_numero: 'C3', vitesse_moyenne_vl: 80 } },
                { distance: 6000, attributes: { cpx_numero: 'C4', vitesse_moyenne_vl: 30 } },
              ],
            },
          ],
        }),
      )

    async function calculerPuisPartirA(ecran: Ecran, heure: string): Promise<void> {
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      fetchSimule.mockResolvedValueOnce(reponseAvecVitesses()).mockResolvedValueOnce(reponseAvecVitesses())
      await boutonNomme(ecran, 'Calculer mon itinéraire').trigger('click')
      await flushPromises()
      await ecran.find('#heure-depart').setValue(heure)
    }

    const duree = (ecran: Ecran) => ecran.find('#duree-trajet')

    it('Critères 1 et 2 : durée à 45 km/h au plus (30 sur la route lente), arrivée à côté', async () => {
      const ecran = monter()
      await calculerPuisPartirA(ecran, '08:00')
      // 15 km à 45 km/h = 20 min ; 6 km à 30 km/h = 12 min.
      expect(duree(ecran).text()).toContain('Durée estimée32 min')
      expect(duree(ecran).text()).toContain('Arrivée estiméevers 8 h 32')
      expect(ecran.find('#annonce-duree').text()).toBe('Durée estimée : 32 min, arrivée vers 8 h 32.')
      ecran.unmount()
    })

    it('part de maintenant par défaut', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      fetchSimule.mockResolvedValueOnce(reponseAvecVitesses()).mockResolvedValueOnce(reponseAvecVitesses())
      await boutonNomme(ecran, 'Calculer mon itinéraire').trigger('click')
      await flushPromises()
      const maintenant = new Date()
      const attendu = `${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`
      expect((ecran.find('#heure-depart').element as HTMLInputElement).value).toBe(attendu)
      ecran.unmount()
    })

    it('Critère 3 : à 40 km/h la durée est recalculée, même sans réseau, et la vitesse est gardée', async () => {
      const ecran = monter()
      await calculerPuisPartirA(ecran, '08:00')
      definirEnLigne(false)
      window.dispatchEvent(new Event('offline'))
      fetchSimule.mockClear()
      await ecran.find('#vitesse-habituelle').setValue('40')
      // 15 km à 40 km/h = 22 min 30 ; 6 km à 30 km/h = 12 min.
      expect(duree(ecran).text()).toContain('Durée estimée35 min')
      expect(duree(ecran).text()).toContain('vers 8 h 35')
      expect(fetchSimule).not.toHaveBeenCalled()
      expect(localStorage.getItem('gladys:vitesse-habituelle')).toBe('40')
      ecran.unmount()
    })

    it('refuse une vitesse hors de 10 à 45 km/h avec un message clair, sans changer la durée', async () => {
      const ecran = monter()
      await calculerPuisPartirA(ecran, '08:00')
      await ecran.find('#vitesse-habituelle').setValue('60')
      expect(ecran.text()).toContain('Indiquez une vitesse entre 10 et 45 km/h, par exemple 40.')
      const descriptions = ecran.find('#vitesse-habituelle').attributes('aria-describedby')!.split(' ')
      expect(descriptions.map((idDescription) => document.getElementById(idDescription)?.textContent).join(' ')).toContain(
        'Indiquez une vitesse entre 10 et 45 km/h',
      )
      expect(duree(ecran).text()).toContain('Durée estimée32 min')
      ecran.unmount()
    })

    it('aucune violation d’accessibilité automatique (durée, vitesse, heure et erreur)', async () => {
      const ecran = monter()
      await calculerPuisPartirA(ecran, '08:00')
      await ecran.find('#vitesse-habituelle').setValue('5')
      vi.useRealTimers()
      expect(await violationsAccessibilite(document.body)).toEqual([])
      ecran.unmount()
    })
  })

  describe('Story #5 : voir et comparer le trajet avant de partir', () => {
    const troncon = (metres: number, codeCommune: string, numero: string, nomDeRue = '', importance = '2') => ({
      distance: metres,
      attributes: {
        insee_commune_gauche: codeCommune,
        vitesse_moyenne_vl: 80,
        cpx_numero: numero, nom_1_gauche: nomDeRue,
        importance,
      },
    })
    const reponseIgn = (troncons: ReturnType<typeof troncon>[]) =>
      new Response(
        JSON.stringify({
          distance: troncons.reduce((total, tronconDuTrajet) => total + tronconDuTrajet.distance, 0),
          portions: [{ steps: troncons }],
        }),
      )
    /** Le plus court : 10 km dont 4 km sur la D502. */
    const plusCourt = () => reponseIgn([troncon(4000, '38544', 'D502'), troncon(6000, '38001', 'C3')])
    /** Par les villages : 12,5 km sans départementale ; deux tronçons de la C3 qui se suivent. */
    const parLesVillages = () =>
      reponseIgn([
        troncon(500, '38544', '', 'Rue de la Gare'),
        troncon(2000, '38544', 'C3'),
        troncon(1000, '38544', 'C3'),
        troncon(9000, '38001', 'C5'),
      ])
    const nomsDesCommunes: Record<string, string> = { '38544': 'Vienne', '38001': 'Les Abrets' }

    async function calculerAvecEtapes(ecran: Ecran): Promise<void> {
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      fetchSimule.mockImplementation((adresse) => {
        if (adresse.includes('/navigation/')) {
          return Promise.resolve(adresse.includes(encodeURIComponent(EVITEMENT_FORT_TRAFIC)) ? parLesVillages() : plusCourt())
        }
        const nom = nomsDesCommunes[new URL(adresse).pathname.split('/').pop() ?? '']
        return Promise.resolve(nom ? new Response(JSON.stringify({ nom })) : new Response('{}', { status: 404 }))
      })
      await boutonNomme(ecran, 'Calculer mon itinéraire').trigger('click')
      await flushPromises()
    }

    const etapes = (ecran: Ecran) => ecran.findAll('#etapes-trajet li').map((etape) => etape.text().replace(/\s+/g, ' '))
    const comparaison = (ecran: Ecran) => ecran.find('#comparaison-trajet')

    it('Critère 1 : liste écrite des étapes, dans l’ordre (village, route, distance)', async () => {
      const ecran = monter()
      await calculerAvecEtapes(ecran)
      expect(ecran.find('#etapes-trajet').element.tagName).toBe('OL')
      expect(etapes(ecran)).toEqual(['Vienne — Rue de la Gare — 0,5 km', 'Vienne — C3 — 3 km', 'Les Abrets — C5 — 9 km'])
      ecran.unmount()
    })

    it('Critère 2 : les passages sur départementale à fort trafic portent la mention écrite « Départementale à fort trafic »', async () => {
      // À 20 % de détour accepté, le trajet par les villages est refusé : on garde le plus court, avec la D502.
      simulerLocalStorage({ 'gladys:seuil-detour': '20' })
      const ecran = monter()
      await calculerAvecEtapes(ecran)
      expect(etapes(ecran)).toEqual(['Vienne — D502 — 4 km Départementale à fort trafic', 'Les Abrets — C3 — 6 km'])
      ecran.unmount()
    })

    it('Demande #18 : une départementale calme est permise et porte la mention « Départementale calme »', async () => {
      const ecran = monter()
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      // Le plus court passe par la D502, ici calme (importance 4) : il est retenu, sans fort trafic.
      const plusCourtCalme = () =>
        reponseIgn([troncon(4000, '38544', 'D502', '', '4'), troncon(6000, '38001', 'C3')])
      fetchSimule.mockImplementation((adresse) =>
        Promise.resolve(
          adresse.includes('/navigation/')
            ? plusCourtCalme()
            : new Response(JSON.stringify({ nom: nomsDesCommunes[new URL(adresse).pathname.split('/').pop() ?? ''] })),
        ),
      )
      await boutonNomme(ecran, 'Calculer mon itinéraire').trigger('click')
      await flushPromises()
      expect(etapes(ecran)).toEqual(['Vienne — D502 — 4 km Départementale calme', 'Les Abrets — C3 — 6 km'])
      expect(ecran.find('#resultat-itineraire').text()).toContain('Aucun kilomètre : trajet sans départementale à fort trafic')
      ecran.unmount()
    })

    it('Critère 3 : compare avec le trajet le plus court et donne la différence de temps à ma vitesse', async () => {
      const ecran = monter()
      await calculerAvecEtapes(ecran)
      // À 45 km/h : 12,5 km = 16 min 40 (17 min) ; 10 km = 13 min 20 (13 min).
      expect(comparaison(ecran).text()).toContain('Trajet le plus court sans autoroute10 km, 13 min')
      expect(comparaison(ecran).text()).toContain('4 min de plus, 2,5 km de plus')
      expect(ecran.find('#annonce-comparaison').attributes('role')).toBe('status')
      expect(ecran.find('#annonce-comparaison').text()).toBe(
        'Trajet le plus court : 10 km, 13 min. Votre trajet : 4 min de plus, 2,5 km de plus.',
      )
      // À 30 km/h : 25 min contre 20 min.
      await ecran.find('#vitesse-habituelle').setValue('30')
      expect(comparaison(ecran).text()).toContain('5 min de plus, 2,5 km de plus')
      ecran.unmount()
    })

    it('Critère 3 : dit simplement quand le trajet retenu est déjà le plus court', async () => {
      simulerLocalStorage({ 'gladys:seuil-detour': '20' })
      const ecran = monter()
      await calculerAvecEtapes(ecran)
      expect(comparaison(ecran).text()).toBe('Votre trajet est déjà le trajet le plus court sans autoroute.')
      ecran.unmount()
    })

    it('aucune violation d’accessibilité automatique (comparaison et étapes, avec départementale)', async () => {
      const ecran = monter()
      await calculerAvecEtapes(ecran)
      vi.useRealTimers()
      expect(await violationsAccessibilite(document.body)).toEqual([])
      ecran.unmount()
      setActivePinia(createPinia())
      simulerLocalStorage({ 'gladys:seuil-detour': '20' })
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const ecranAvecDepartementale = monter()
      await calculerAvecEtapes(ecranAvecDepartementale)
      vi.useRealTimers()
      expect(await violationsAccessibilite(document.body)).toEqual([])
      ecranAvecDepartementale.unmount()
    })
  })

  describe('Demande #18 : essayer OpenStreetMap pour le calcul du trajet', () => {
    const choixDuCalculateur = (ecran: Ecran) => ecran.find('input[name="calculateur"][value="openstreetmap"]')
    const etapes = (ecran: Ecran) => ecran.findAll('#etapes-trajet li').map((etape) => etape.text().replace(/\s+/g, ' '))

    async function calculerAvecOpenStreetMap(ecran: Ecran): Promise<void> {
      await preparerTrajet(ecran, 'Dijon', 'Beaune')
      await choixDuCalculateur(ecran).trigger('click')
      fetchSimule.mockImplementation(
        simulerOpenStreetMap(
          {
            plusCourt: [{ kilometres: 4, classe: 'primary', noms: ['D 974'], codeCommune: '21231' }],
            fuyantLesGrandsAxes: [{ kilometres: 5, classe: 'tertiary', noms: ['D 109'], codeCommune: '21049' }],
          },
          { '21231': 'Dijon', '21049': 'Barges' },
        ),
      )
      await boutonNomme(ecran, 'Calculer mon itinéraire').trigger('click')
      await flushPromises()
    }

    it('propose le choix du calculateur, IGN par défaut, et le garde sur le téléphone', async () => {
      const memoire = simulerLocalStorage()
      const ecran = monter()
      await preparerTrajet(ecran, 'Dijon', 'Beaune')
      expect(ecran.find('input[name="calculateur"][value="ign"]').element).toHaveProperty('checked', true)
      expect(ecran.text()).toContain('OpenStreetMap (en essai)')
      await choixDuCalculateur(ecran).trigger('click')
      expect(JSON.parse(memoire.get('gladys:calculateur')!)).toBe('openstreetmap')
      ecran.unmount()
    })

    it('calcule avec OpenStreetMap, évite la départementale à fort trafic et le dit', async () => {
      const ecran = monter()
      await calculerAvecOpenStreetMap(ecran)
      expect(fetchSimule.mock.calls.some(([adresse]) => adresse.includes('openstreetmap.de'))).toBe(true)
      expect(etapes(ecran)).toEqual(['Barges — D 109 — 5 km Départementale calme'])
      expect(ecran.find('#resultat-itineraire').text()).toContain(
        'Calculé avecOpenStreetMap (© les contributeurs d’OpenStreetMap)',
      )
      ecran.unmount()
    })

    it('aucune violation d’accessibilité automatique (choix du calculateur et résultat OpenStreetMap)', async () => {
      const ecran = monter()
      await calculerAvecOpenStreetMap(ecran)
      vi.useRealTimers()
      expect(await violationsAccessibilite(document.body)).toEqual([])
      ecran.unmount()
    })
  })

  describe('Demande #16 : voir l’itinéraire sur une carte', () => {
    const reponseAvecTrace = (coordonnees: number[][]) =>
      new Response(
        JSON.stringify({
          distance: 12500,
          geometry: { type: 'LineString', coordinates: coordonnees },
          portions: [{ steps: [{ distance: 12500, attributes: { cpx_numero: 'C3' } }] }],
        }),
      )
    const traceRetenu = [
      [4.85, 45.75],
      [4.95, 45.6],
      [4.87, 45.52],
    ]

    async function calculerAvecTrace(ecran: Ecran): Promise<void> {
      await preparerTrajet(ecran, 'Lyon', 'Vienne')
      fetchSimule.mockImplementation((adresse) => {
        if (!adresse.includes('/navigation/')) return Promise.resolve(reponseBaseAdresse([]))
        // Le trajet qui évite les départementales est retenu ; le plus court a un autre tracé.
        return Promise.resolve(
          adresse.includes(encodeURIComponent(EVITEMENT_FORT_TRAFIC))
            ? reponseAvecTrace(traceRetenu)
            : reponseAvecTrace([
                [4.85, 45.75],
                [4.87, 45.52],
              ]),
        )
      })
      await boutonNomme(ecran, 'Calculer mon itinéraire').trigger('click')
      await flushPromises()
    }

    it('affiche la carte du trajet retenu au-dessus de la liste des étapes', async () => {
      const ecran = monter()
      await calculerAvecTrace(ecran)
      const carte = ecran.find('#carte-trajet')
      expect(carte.attributes('aria-label')).toBe('Carte du trajet de Lyon à Vienne')
      expect(carte.findAll('path')).toHaveLength(1)
      expect(carte.text()).toContain('Départ')
      expect(carte.text()).toContain('Arrivée')
      const etapes = ecran.find('#etapes-trajet').element
      expect(carte.element.compareDocumentPosition(etapes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      ecran.unmount()
    })

    it('sans réseau, dit « Carte indisponible sans connexion » et garde les étapes lisibles', async () => {
      const ecran = monter()
      await calculerAvecTrace(ecran)
      definirEnLigne(false)
      window.dispatchEvent(new Event('offline'))
      await flushPromises()
      expect(ecran.find('#carte-trajet').exists()).toBe(false)
      expect(ecran.find('#etat-carte').text()).toContain('Carte indisponible sans connexion')
      expect(ecran.findAll('#etapes-trajet li')).toHaveLength(1)
      ecran.unmount()
    })

    it('aucune violation d’accessibilité automatique (carte, puis message sans réseau)', async () => {
      const ecran = monter()
      await calculerAvecTrace(ecran)
      vi.useRealTimers()
      expect(await violationsAccessibilite(document.body)).toEqual([])
      definirEnLigne(false)
      window.dispatchEvent(new Event('offline'))
      await flushPromises()
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
