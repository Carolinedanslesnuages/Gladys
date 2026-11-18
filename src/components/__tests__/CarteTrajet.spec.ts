import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VueDsfr from '@gouvminint/vue-dsfr'
import Leaflet from 'leaflet'
import CarteTrajet from '../CarteTrajet.vue'
import type { Lieu } from '@/services/adresses'
import type { PointDuTrace } from '@/services/itineraire'
import { violationsAccessibilite } from '@/__tests__/accessibilite'
import { capEntre, distanceEntre } from '@/services/guidage'

const lyon: Lieu = { libelle: 'Lyon', latitude: 45.75, longitude: 4.85 }
const vienne: Lieu = { libelle: 'Vienne', latitude: 45.52, longitude: 4.87 }
const trace: PointDuTrace[] = [
  { latitude: 45.75, longitude: 4.85 },
  { latitude: 45.6, longitude: 4.95 },
  { latitude: 45.52, longitude: 4.87 },
]

const monter = (enLigne = true) =>
  mount(CarteTrajet, {
    props: { trace, depart: lyon, arrivee: vienne, enLigne },
    global: { plugins: [VueDsfr] },
    attachTo: document.body,
  })

/** Les boutons posés sur la carte n'ont qu'une icône : leur nom est dans `aria-label`. */
const boutonNomme = (ecran: ReturnType<typeof monter>, intitule: string) =>
  ecran
    .findAll('button')
    .find((bouton) => bouton.text() === intitule || bouton.attributes('aria-label') === intitule)!

describe('Carte du trajet', () => {
  let cadrages: Leaflet.LatLngBounds[]
  let lignesTracees: Leaflet.LatLng[][]
  let reperesPlaces: { libelle: string; position: Leaflet.LatLng }[]
  let carteAffichee: Leaflet.Map | null

  beforeEach(() => {
    cadrages = []
    lignesTracees = []
    reperesPlaces = []
    carteAffichee = null
    // jsdom ne mesure pas les éléments : on donne à la carte une taille de téléphone.
    vi.spyOn(Leaflet.Map.prototype, 'getSize').mockReturnValue(Leaflet.point(320, 288))
    const cadrerOriginal = Leaflet.Map.prototype.fitBounds
    const espionCadrage = vi.spyOn(Leaflet.Map.prototype, 'fitBounds')
    espionCadrage.mockImplementation(function (this: Leaflet.Map, limites, options) {
      carteAffichee = espionCadrage.mock.contexts[
        espionCadrage.mock.contexts.length - 1
      ] as Leaflet.Map
      cadrages.push(limites as Leaflet.LatLngBounds)
      return cadrerOriginal.call(this, limites, options)
    })
    const ajouterLigneOriginal = Leaflet.Polyline.prototype.onAdd
    vi.spyOn(Leaflet.Polyline.prototype, 'onAdd').mockImplementation(function (
      this: Leaflet.Polyline,
      carte,
    ) {
      lignesTracees.push(this.getLatLngs() as Leaflet.LatLng[])
      return ajouterLigneOriginal.call(this, carte)
    })
    const ajouterRepereOriginal = Leaflet.Marker.prototype.onAdd
    vi.spyOn(Leaflet.Marker.prototype, 'onAdd').mockImplementation(function (
      this: Leaflet.Marker,
      carte,
    ) {
      const resultat = ajouterRepereOriginal.call(this, carte)
      reperesPlaces.push({
        libelle: this.getElement()?.textContent ?? '',
        position: this.getLatLng(),
      })
      return resultat
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('montre le tracé du trajet retenu, et lui seul', () => {
    const ecran = monter()
    expect(lignesTracees).toHaveLength(1)
    expect(lignesTracees[0]!.map((point) => [point.lat, point.lng])).toEqual([
      [45.75, 4.85],
      [45.6, 4.95],
      [45.52, 4.87],
    ])
    expect(ecran.find('#carte-trajet path').exists()).toBe(true)
    ecran.unmount()
  })

  it('Demande #28 : place une épingle « Départ » au début du tracé et « Arrivée » à la fin', () => {
    const ecran = monter()
    expect(
      reperesPlaces.map((repere) => [repere.libelle, repere.position.lat, repere.position.lng]),
    ).toEqual([
      ['Départ', 45.75, 4.85],
      ['Arrivée', 45.52, 4.87],
    ])
    // Des épingles, plus des étiquettes écrites ; différentes par leur dessin, pas seulement leur couleur.
    expect(document.querySelector('.etiquette-repere')).toBeNull()
    expect(document.querySelector('.epingle--depart circle.dessin-epingle')).not.toBeNull()
    expect(document.querySelector('.epingle--arrivee path.dessin-epingle')).not.toBeNull()
    // Leur nom reste lu par les lecteurs d'écran.
    expect(document.querySelector('.epingle--depart .fr-sr-only')!.textContent).toBe('Départ')
    expect(document.querySelector('.epingle--arrivee .fr-sr-only')!.textContent).toBe('Arrivée')
    ecran.unmount()
  })

  it('s’ouvre cadrée sur tout le trajet', () => {
    const ecran = monter()
    expect(cadrages).toHaveLength(1)
    for (const point of trace) {
      expect(cadrages[0]!.contains(Leaflet.latLng(point.latitude, point.longitude))).toBe(true)
    }
    // Centrée sur le trajet, au zoom le plus fort où il tient en entier : ses 25 km du nord au sud
    // font environ 235 px au zoom 10 (moins que les 240 px utiles), 470 px au zoom 11.
    const centreDuTrajet = cadrages[0]!.getCenter()
    expect(carteAffichee!.getCenter().lat).toBeCloseTo(centreDuTrajet.lat, 2)
    expect(carteAffichee!.getCenter().lng).toBeCloseTo(centreDuTrajet.lng, 2)
    expect(carteAffichee!.getZoom()).toBe(10)
    ecran.unmount()
  })

  it('Demande #26 : affiche le fond OpenStreetMap, avec la mention de ses contributeurs', () => {
    const ecran = monter()
    const tuiles = Array.from(document.querySelectorAll<HTMLImageElement>('img.leaflet-tile'))
    expect(tuiles.length).toBeGreaterThan(0)
    for (const tuile of tuiles)
      expect(tuile.src).toMatch(/^https:\/\/tile\.openstreetmap\.org\/10\/\d+\/\d+\.png$/)
    const mention = ecran.find('.leaflet-control-attribution')
    expect(mention.text()).toContain('© les contributeurs d’OpenStreetMap')
    expect(mention.find('a').attributes('href')).toBe('https://www.openstreetmap.org/copyright')
    expect(mention.find('a').attributes('target')).toBeUndefined()
    ecran.unmount()
  })

  it('les boutons « Zoomer » et « Dézoomer » changent le niveau de zoom', async () => {
    const ecran = monter()
    const zoomDeDepart = carteAffichee!.getZoom()
    await boutonNomme(ecran, 'Zoomer sur la carte').trigger('click')
    expect(carteAffichee!.getZoom()).toBe(zoomDeDepart + 1)
    await boutonNomme(ecran, 'Dézoomer la carte').trigger('click')
    await boutonNomme(ecran, 'Dézoomer la carte').trigger('click')
    expect(carteAffichee!.getZoom()).toBe(zoomDeDepart - 1)
    ecran.unmount()
  })

  it('se déplace et zoome au clavier, sans piège (la carte reçoit le focus)', () => {
    const ecran = monter()
    const conteneur = ecran.find('#carte-trajet').element as HTMLElement
    expect(conteneur.tabIndex).toBe(0)
    expect(carteAffichee!.keyboard.enabled()).toBe(true)
    expect(carteAffichee!.dragging.enabled()).toBe(true)
    expect(carteAffichee!.touchZoom.enabled()).toBe(true)
    ecran.unmount()
  })

  it('porte un nom clair pour les lecteurs d’écran', () => {
    const ecran = monter()
    const conteneur = ecran.find('#carte-trajet')
    expect(conteneur.attributes('role')).toBe('region')
    expect(conteneur.attributes('aria-label')).toBe('Carte du trajet de Lyon à Vienne')
    ecran.unmount()
  })

  it('sans réseau, annonce « Carte indisponible sans connexion » et ne demande aucun fond de carte', () => {
    const ecran = monter(false)
    expect(ecran.find('#etat-carte').attributes('role')).toBe('status')
    expect(ecran.find('#etat-carte').text()).toContain('Carte indisponible sans connexion')
    expect(ecran.find('#carte-trajet').exists()).toBe(false)
    expect(document.querySelector('img.leaflet-tile')).toBeNull()
    ecran.unmount()
  })

  it('affiche la carte au retour du réseau', async () => {
    const ecran = monter(false)
    await ecran.setProps({ enLigne: true })
    expect(ecran.find('#carte-trajet path').exists()).toBe(true)
    expect(ecran.find('#etat-carte').text()).toBe('')
    ecran.unmount()
  })

  describe('Demande #20 : suivre ma position sur la carte, comme un GPS', () => {
    type SurSucces = (position: { coords: { latitude: number; longitude: number } }) => void
    type SurEchec = (erreur: { code: number }) => void
    let surSucces: SurSucces | null
    let surEchec: SurEchec | null
    let arretsDuSuivi: number

    beforeEach(() => {
      surSucces = null
      surEchec = null
      arretsDuSuivi = 0
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          watchPosition: (succes: SurSucces, echec: SurEchec) => {
            surSucces = succes
            surEchec = echec
            return 1
          },
          clearWatch: () => (arretsDuSuivi += 1),
        },
      })
    })
    afterEach(() => {
      Reflect.deleteProperty(navigator, 'geolocation')
      vi.unstubAllGlobals()
    })

    const recevoirPosition = async (
      ecran: ReturnType<typeof monter>,
      latitude: number,
      longitude: number,
    ) => {
      surSucces!({ coords: { latitude, longitude } })
      await ecran.vm.$nextTick()
    }

    it('place le véhicule de la personne, centre la carte sur la personne et dit la distance restante', async () => {
      const ecran = monter()
      await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
      expect(ecran.find('#annonce-suivi').text()).toBe('Recherche de votre position…')
      await recevoirPosition(ecran, 45.6, 4.95)
      expect(reperesPlaces.map((repere) => repere.libelle)).toEqual([
        'Départ',
        'Arrivée',
        'Votre position',
      ])
      expect(carteAffichee!.getCenter().lat).toBeCloseTo(45.6, 3)
      expect(carteAffichee!.getZoom()).toBe(16)
      expect(ecran.find('#annonce-suivi').text()).toBe('Position trouvée : la carte vous suit.')
      // Du point du milieu jusqu'à Vienne : environ 10,9 km.
      expect(ecran.find('#avancement-trajet').text()).toContain(
        'Il vous reste 10,9 km jusqu’à l’arrivée.',
      )
      expect(ecran.find('#avancement-trajet').text()).not.toContain('du trajet prévu')
      // Demande #30 : seul « 10,9 km » se voit ; la phrase entière reste lue par les lecteurs d'écran.
      expect(ecran.find('#avancement-trajet strong').text()).toBe('10,9 km')
      expect(
        ecran.findAll('#avancement-trajet .fr-sr-only').map((morceau) => morceau.text()),
      ).toEqual(['Il vous reste', 'jusqu’à l’arrivée.'])
      ecran.unmount()
    })

    it('suit la personne quand elle avance (sans animation si elle les a réduites)', async () => {
      // jsdom ne joue pas les animations : on simule « réduire les animations ».
      vi.stubGlobal('matchMedia', (requete: string) => ({ matches: requete.includes('reduce') }))
      const ecran = monter()
      await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
      await recevoirPosition(ecran, 45.6, 4.95)
      await recevoirPosition(ecran, 45.52, 4.87)
      expect(carteAffichee!.getCenter().lat).toBeCloseTo(45.52, 3)
      expect(reperesPlaces.filter((repere) => repere.libelle === 'Votre position')).toHaveLength(1)
      expect(ecran.find('#avancement-trajet').text()).toContain('Il vous reste 0 m')
      ecran.unmount()
    })

    it('prévient, par écrit, quand la personne quitte le trajet', async () => {
      const ecran = monter()
      await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
      await recevoirPosition(ecran, 45.6, 5.0)
      expect(ecran.find('#avancement-trajet').text()).toContain('du trajet prévu')
      ecran.unmount()
    })

    it('« Arrêter de suivre ma position » retire le repère et coupe la localisation', async () => {
      const ecran = monter()
      await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
      await recevoirPosition(ecran, 45.6, 4.95)
      await boutonNomme(ecran, 'Arrêter de suivre ma position').trigger('click')
      expect(arretsDuSuivi).toBe(1)
      expect(ecran.find('#carte-trajet').text()).not.toContain('Votre position')
      expect(ecran.find('#avancement-trajet').exists()).toBe(false)
      expect(ecran.find('#annonce-suivi').text()).toBe('La carte ne suit plus votre position.')
      ecran.unmount()
    })

    it('position refusée : explique comment l’autoriser', async () => {
      const ecran = monter()
      await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
      surEchec!({ code: 1 })
      await ecran.vm.$nextTick()
      expect(ecran.text()).toContain('Position refusée : autorisez la localisation pour GLADYS')
      expect(boutonNomme(ecran, 'Suivre ma position sur la carte')).toBeTruthy()
      ecran.unmount()
    })

    it('coupe la localisation quand le réseau tombe (la carte disparaît)', async () => {
      const ecran = monter()
      await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
      await ecran.setProps({ enLigne: false })
      expect(arretsDuSuivi).toBe(1)
      ecran.unmount()
    })

    const recevoirPositionEtCap = async (
      ecran: ReturnType<typeof monter>,
      latitude: number,
      longitude: number,
      heading?: number,
    ) => {
      ;(surSucces as unknown as (position: { coords: object }) => void)({
        coords: { latitude, longitude, heading },
      })
      await ecran.vm.$nextTick()
    }
    const repereVous = () => document.querySelector<HTMLElement>('.repere-vous')!

    it('Demande #28 : la personne est un véhicule sans étiquette « Vous », même sans direction connue, puis tourné dans le sens de la marche', async () => {
      const ecran = monter()
      await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
      await recevoirPosition(ecran, 45.6, 4.95)
      expect(repereVous().querySelector('svg.vehicule-vous')).not.toBeNull()
      // Une toute petite voiture : une voiture sans permis.
      expect(repereVous().querySelector('svg.vehicule-vous')!.getAttribute('width')).toBe('24')
      // À l'arrêt sur le trajet, sans direction du GPS : la voiture regarde la route devant elle.
      expect(repereVous().classList.contains('repere-vous--sans-direction')).toBe(false)
      const versLaSuiteDuTrajet = capEntre(trace[1]!, trace[2]!)
      expect(repereVous().style.getPropertyValue('--direction-vous')).toBe(
        `${versLaSuiteDuTrajet}deg`,
      )
      expect(repereVous().querySelector('.etiquette-repere')).toBeNull()
      expect(repereVous().textContent).toBe('Votre position')
      expect(repereVous().querySelector('.fr-sr-only')).not.toBeNull()
      // Sans direction donnée par le GPS : celle du déplacement (ici, plein sud).
      await recevoirPosition(ecran, 45.59, 4.95)
      expect(repereVous().classList.contains('repere-vous--sans-direction')).toBe(false)
      expect(repereVous().style.getPropertyValue('--direction-vous')).toBe('180deg')
      // Direction donnée par le GPS : elle prime.
      await recevoirPositionEtCap(ecran, 45.59, 4.95, 90)
      expect(repereVous().style.getPropertyValue('--direction-vous')).toBe('90deg')
      ecran.unmount()
    })

    it('déplacer la carte la détache ; « Me recentrer sur ma position » la ramène sur la personne', async () => {
      vi.stubGlobal('matchMedia', (requete: string) => ({ matches: requete.includes('reduce') }))
      const ecran = monter()
      await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
      await recevoirPosition(ecran, 45.6, 4.95)
      expect(boutonNomme(ecran, 'Me recentrer sur ma position')).toBeUndefined()
      await ecran.find('#carte-trajet').trigger('keydown', { key: 'ArrowLeft' })
      expect(ecran.find('#annonce-suivi').text()).toContain('La carte ne vous suit plus')
      carteAffichee!.setView(Leaflet.latLng(45.7, 4.8), 12, { animate: false })
      await recevoirPosition(ecran, 45.59, 4.95)
      expect(carteAffichee!.getCenter().lat).toBeCloseTo(45.7, 3)
      await boutonNomme(ecran, 'Me recentrer sur ma position').trigger('click')
      expect(carteAffichee!.getCenter().lat).toBeCloseTo(45.59, 3)
      expect(carteAffichee!.getZoom()).toBe(16)
      expect(ecran.find('#annonce-suivi').text()).toBe('Carte recentrée : la carte vous suit.')
      ecran.unmount()
    })

    describe('Demande #26 : véhicule plus bas, carte tournée dans le sens de la marche', () => {
      // jsdom ne sait pas faire tourner : on lui prête les transformations 3D d'un vrai navigateur.
      const navigateur = Leaflet.Browser as { any3d: boolean }
      let transformations3dReelles: boolean
      beforeEach(() => {
        transformations3dReelles = navigateur.any3d
        navigateur.any3d = true
        vi.stubGlobal('matchMedia', (requete: string) => ({ matches: requete.includes('reduce') }))
      })
      afterEach(() => {
        navigateur.any3d = transformations3dReelles
      })
      /**
       * Du véhicule au centre demandé à la carte, en pixels de carte non tournée (x vers l'est, y vers
       * le sud). jsdom ne mesure pas une carte tournée : on lit le centre demandé à Leaflet.
       */
      const duVehiculeAuCentre = () => {
        const centresDemandes = vi.mocked(Leaflet.Map.prototype.setView).mock.calls
        const [centreDemande, zoom] = centresDemandes[centresDemandes.length - 1]!
        return carteAffichee!
          .project(centreDemande, zoom)
          .subtract(carteAffichee!.project(Leaflet.latLng(45.6, 4.95), zoom))
      }
      beforeEach(() => {
        // Une taille neuve à chaque appel : le module de rotation divise le point reçu.
        vi.spyOn(Leaflet.Map.prototype, 'getSize').mockImplementation(() => Leaflet.point(320, 288))
        const centrerOriginal = Leaflet.Map.prototype.setView
        vi.spyOn(Leaflet.Map.prototype, 'setView').mockImplementation(function (
          this: Leaflet.Map,
          ...arguments_
        ) {
          return centrerOriginal.apply(this, arguments_)
        })
      })

      it('place le véhicule au milieu en largeur, 20 % sous le centre : on voit la route devant', async () => {
        const ecran = monter()
        await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
        await recevoirPositionEtCap(ecran, 45.6, 4.95, 0)
        // Carte de 288 px de haut, nord en haut : le centre est 57,6 px (20 %) au nord du véhicule.
        expect(duVehiculeAuCentre().x).toBeCloseTo(0, 1)
        expect(duVehiculeAuCentre().y).toBeCloseTo(-57.6, 1)
        ecran.unmount()
      })

      it('tourne la carte pour que la direction de marche soit en haut, véhicule pointé vers le haut', async () => {
        const ecran = monter()
        await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
        await recevoirPositionEtCap(ecran, 45.6, 4.95, 90)
        // Cap à l'est : la carte tourne d'un quart de tour vers la gauche.
        expect(carteAffichee!.getBearing()).toBeCloseTo(270, 5)
        expect(repereVous().style.getPropertyValue('--direction-vous')).toBe('0deg')
        // Le haut de l'écran est l'est : le centre est 57,6 px à l'est du véhicule, la route devant.
        expect(duVehiculeAuCentre().x).toBeCloseTo(57.6, 1)
        expect(duVehiculeAuCentre().y).toBeCloseTo(0, 1)
        ecran.unmount()
      })

      it('« Garder le nord en haut » arrête de tourner ; le véhicule montre alors sa direction', async () => {
        const ecran = monter()
        await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
        await recevoirPositionEtCap(ecran, 45.6, 4.95, 90)
        await boutonNomme(ecran, 'Garder le nord en haut de la carte').trigger('click')
        expect(carteAffichee!.getBearing()).toBe(0)
        expect(repereVous().style.getPropertyValue('--direction-vous')).toBe('90deg')
        expect(ecran.find('#annonce-suivi').text()).toBe('Nord en haut : la carte ne tourne plus.')
        await recevoirPositionEtCap(ecran, 45.6, 4.95, 180)
        expect(carteAffichee!.getBearing()).toBe(0)
        await boutonNomme(ecran, 'Tourner la carte dans le sens de la marche').trigger('click')
        expect(carteAffichee!.getBearing()).toBeCloseTo(180, 5)
        expect(ecran.find('#annonce-suivi').text()).toBe(
          'La carte tourne dans le sens de la marche.',
        )
        ecran.unmount()
      })

      it('Demande #28 : à l’arrêt sur le trajet, sans direction du GPS, la route est droit devant', async () => {
        const ecran = monter()
        await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
        await recevoirPosition(ecran, 45.6, 4.95)
        const versLaSuiteDuTrajet = capEntre(trace[1]!, trace[2]!)
        expect(carteAffichee!.getBearing()).toBeCloseTo(360 - versLaSuiteDuTrajet, 5)
        ecran.unmount()
      })

      it('Demande #28 : trajet calculé depuis ma position, la voiture est recentrée, la route droit devant', async () => {
        const ecran = mount(CarteTrajet, {
          props: {
            trace: [],
            depart: null,
            arrivee: null,
            enLigne: true,
            suivreDesLOuverture: true,
          },
          global: { plugins: [VueDsfr] },
          attachTo: document.body,
        })
        await recevoirPosition(ecran, 45.75, 4.85)
        await ecran.setProps({ trace, depart: lyon, arrivee: vienne })
        const [centreDemande, zoom] = vi.mocked(Leaflet.Map.prototype.setView).mock.lastCall!
        // Au zoom du suivi, centré un peu devant la voiture (à moins de 200 m) : pas le trajet entier.
        expect(zoom).toBe(16)
        const centre = Leaflet.latLng(centreDemande)
        expect(
          distanceEntre(
            { latitude: centre.lat, longitude: centre.lng },
            { latitude: 45.75, longitude: 4.85 },
          ),
        ).toBeLessThan(200)
        expect(carteAffichee!.getBearing()).toBeCloseTo(360 - capEntre(trace[0]!, trace[1]!), 5)
        expect(repereVous().classList.contains('repere-vous--sans-direction')).toBe(false)
        expect(boutonNomme(ecran, 'Me recentrer sur ma position')).toBeUndefined()
        expect(ecran.find('#annonce-suivi').text()).toBe(
          'Trajet calculé : la carte vous suit, la route droit devant vous.',
        )
        ecran.unmount()
      })

      it('arrêter le suivi remet le nord en haut', async () => {
        const ecran = monter()
        await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
        await recevoirPositionEtCap(ecran, 45.6, 4.95, 90)
        await boutonNomme(ecran, 'Arrêter de suivre ma position').trigger('click')
        expect(carteAffichee!.getBearing()).toBe(0)
        expect(boutonNomme(ecran, 'Garder le nord en haut de la carte')).toBeUndefined()
        ecran.unmount()
      })
    })

    describe('plein écran', () => {
      const monterDansUnePage = () => {
        const autreContenu = document.createElement('p')
        autreContenu.id = 'reste-de-la-page'
        autreContenu.textContent = 'Étapes du trajet'
        document.body.appendChild(autreContenu)
        return monter()
      }

      it('occupe tout l’écran, suit la personne, met le reste de la page de côté et donne le focus à « Quitter »', async () => {
        const ecran = monterDansUnePage()
        await boutonNomme(ecran, 'Afficher la carte en plein écran').trigger('click')
        await ecran.vm.$nextTick()
        const zone = ecran.find('#zone-carte')
        expect(zone.classes()).toContain('zone-carte--plein-ecran')
        expect(zone.attributes('role')).toBe('dialog')
        expect(zone.attributes('aria-label')).toBe('Carte en plein écran')
        expect(ecran.find('#annonce-suivi').text()).toBe('Recherche de votre position…')
        expect(document.getElementById('reste-de-la-page')!.hasAttribute('inert')).toBe(true)
        expect(document.activeElement?.getAttribute('aria-label')).toBe('Quitter le plein écran')
        expect(boutonNomme(ecran, 'Me recentrer sur ma position')).toBeTruthy()
        await recevoirPosition(ecran, 45.6, 4.95)
        expect(ecran.find('#avancement-trajet').text()).toContain('Il vous reste 10,9 km')
        ecran.unmount()
      })

      it('Demande #26 : la personne reste à sa place quand la carte change de taille (distance restante qui apparaît)', async () => {
        let surChangementDeTaille: (() => void) | null = null
        // jsdom ne joue pas les animations : on simule « réduire les animations ».
        vi.stubGlobal('matchMedia', (requete: string) => ({ matches: requete.includes('reduce') }))
        vi.stubGlobal(
          'ResizeObserver',
          class {
            rappel: () => void
            constructor(rappel: () => void) {
              this.rappel = rappel
            }
            observe(element: Element) {
              if (element.id === 'carte-trajet') surChangementDeTaille = this.rappel
            }
            unobserve() {}
            disconnect() {}
          },
        )
        const ecran = monterDansUnePage()
        await boutonNomme(ecran, 'Afficher la carte en plein écran').trigger('click')
        await ecran.vm.$nextTick()
        await recevoirPosition(ecran, 45.6, 4.95)
        // La distance restante s'affiche au-dessus : la carte perd de la hauteur.
        // (une taille neuve à chaque appel : Leaflet modifie parfois le point reçu)
        vi.spyOn(Leaflet.Map.prototype, 'getSize').mockImplementation(() =>
          Leaflet.point(1280, 520),
        )
        surChangementDeTaille!()
        // Au milieu en largeur, et 20 % de la hauteur sous le centre : 260 + 104 px.
        const placeDeLaPersonne = carteAffichee!.latLngToContainerPoint(Leaflet.latLng(45.6, 4.95))
        expect(placeDeLaPersonne.x).toBeCloseTo(640, 0)
        expect(placeDeLaPersonne.y).toBeCloseTo(364, 0)
        ecran.unmount()
      })

      it('« Quitter le plein écran » (ou Échap) rend la page, sans couper le suivi', async () => {
        const ecran = monterDansUnePage()
        await boutonNomme(ecran, 'Afficher la carte en plein écran').trigger('click')
        await ecran.vm.$nextTick()
        await boutonNomme(ecran, 'Quitter le plein écran').trigger('click')
        await ecran.vm.$nextTick()
        expect(ecran.find('#zone-carte').classes()).not.toContain('zone-carte--plein-ecran')
        expect(document.getElementById('reste-de-la-page')!.hasAttribute('inert')).toBe(false)
        expect(document.activeElement?.getAttribute('aria-label')).toBe(
          'Afficher la carte en plein écran',
        )
        expect(boutonNomme(ecran, 'Arrêter de suivre ma position')).toBeTruthy()
        await boutonNomme(ecran, 'Afficher la carte en plein écran').trigger('click')
        await ecran.vm.$nextTick()
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        await ecran.vm.$nextTick()
        expect(ecran.find('#zone-carte').classes()).not.toContain('zone-carte--plein-ecran')
        ecran.unmount()
      })

      it('aucune violation d’accessibilité automatique en plein écran', async () => {
        const ecran = monter()
        await boutonNomme(ecran, 'Afficher la carte en plein écran').trigger('click')
        await ecran.vm.$nextTick()
        await recevoirPosition(ecran, 45.6, 5.0)
        expect(await violationsAccessibilite(document.body)).toEqual([])
        ecran.unmount()
      })
    })

    describe('Demande #26 : carte d’accueil, comme une application de navigation', () => {
      const monterAlAccueil = () =>
        mount(CarteTrajet, {
          props: {
            trace: [],
            depart: null,
            arrivee: null,
            enLigne: true,
            suivreDesLOuverture: true,
          },
          global: { plugins: [VueDsfr] },
          attachTo: document.body,
        })

      it('sans trajet, s’ouvre sur la France, cherche la personne et se centre sur elle', async () => {
        const ecran = monterAlAccueil()
        await ecran.vm.$nextTick()
        expect(lignesTracees).toHaveLength(0)
        expect(ecran.find('#carte-trajet').attributes('aria-label')).toBe(
          'Carte autour de ma position',
        )
        expect(ecran.find('#annonce-suivi').text()).toBe('Recherche de votre position…')
        await recevoirPosition(ecran, 45.75, 4.85)
        expect(reperesPlaces.map((repere) => repere.libelle)).toEqual(['Votre position'])
        // Sans trajet ni direction du GPS : la voiture n'a pas encore de direction.
        expect(
          document.querySelector('.repere-vous')!.classList.contains('repere-vous--sans-direction'),
        ).toBe(true)
        expect(ecran.find('#avancement-trajet').exists()).toBe(false)
        ecran.unmount()
      })

      it('position refusée à l’ouverture : la France reste affichée, sans alerte', async () => {
        const ecran = monterAlAccueil()
        surEchec!({ code: 1 })
        await ecran.vm.$nextTick()
        expect(ecran.find('.fr-alert--error').exists()).toBe(false)
        expect(ecran.find('#annonce-suivi').text()).toContain('la carte montre la France')
        expect(boutonNomme(ecran, 'Suivre ma position sur la carte')).toBeTruthy()
        ecran.unmount()
      })

      it('Demande #28 : un trajet calculé ensuite est tracé, la carte reste sur la personne', async () => {
        const ecran = monterAlAccueil()
        await recevoirPosition(ecran, 45.75, 4.85)
        await ecran.setProps({ trace, depart: lyon, arrivee: vienne })
        expect(lignesTracees).toHaveLength(1)
        expect(ecran.find('#carte-trajet').attributes('aria-label')).toBe(
          'Carte du trajet de Lyon à Vienne',
        )
        expect(carteAffichee!.getZoom()).toBe(16)
        expect(boutonNomme(ecran, 'Me recentrer sur ma position')).toBeUndefined()
        ecran.unmount()
      })

      it('position refusée : un trajet calculé ensuite est montré en entier', async () => {
        const ecran = monterAlAccueil()
        surEchec!({ code: 1 })
        await ecran.setProps({ trace, depart: lyon, arrivee: vienne })
        expect(cadrages).toHaveLength(1)
        // La carte ne suit personne : elle n'est pas recentrée au zoom du suivi.
        expect(carteAffichee!.getZoom()).not.toBe(16)
        expect(ecran.find('#annonce-suivi').text()).toContain('la carte montre la France')
        ecran.unmount()
      })

      it('aucune violation d’accessibilité automatique sur la carte d’accueil', async () => {
        const ecran = monterAlAccueil()
        await recevoirPosition(ecran, 45.75, 4.85)
        expect(await violationsAccessibilite(document.body)).toEqual([])
        ecran.unmount()
      })
    })

    it('aucune violation d’accessibilité automatique pendant le suivi, même hors du trajet', async () => {
      const ecran = monter()
      await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
      await recevoirPosition(ecran, 45.6, 5.0)
      expect(await violationsAccessibilite(document.body)).toEqual([])
      ecran.unmount()
    })
  })

  it('aucune violation d’accessibilité automatique, avec et sans réseau', async () => {
    const ecran = monter()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await ecran.setProps({ enLigne: false })
    expect(await violationsAccessibilite(document.body)).toEqual([])
    ecran.unmount()
  })
})
