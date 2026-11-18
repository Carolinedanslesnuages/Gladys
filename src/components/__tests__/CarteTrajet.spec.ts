import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VueDsfr from '@gouvminint/vue-dsfr'
import Leaflet from 'leaflet'
import CarteTrajet from '../CarteTrajet.vue'
import type { Lieu } from '@/services/adresses'
import type { PointDuTrace } from '@/services/itineraire'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

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
  ecran.findAll('button').find((bouton) => bouton.text() === intitule || bouton.attributes('aria-label') === intitule)!

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
      carteAffichee = espionCadrage.mock.contexts[espionCadrage.mock.contexts.length - 1] as Leaflet.Map
      cadrages.push(limites as Leaflet.LatLngBounds)
      return cadrerOriginal.call(this, limites, options)
    })
    const ajouterLigneOriginal = Leaflet.Polyline.prototype.onAdd
    vi.spyOn(Leaflet.Polyline.prototype, 'onAdd').mockImplementation(function (this: Leaflet.Polyline, carte) {
      lignesTracees.push(this.getLatLngs() as Leaflet.LatLng[])
      return ajouterLigneOriginal.call(this, carte)
    })
    const ajouterRepereOriginal = Leaflet.Marker.prototype.onAdd
    vi.spyOn(Leaflet.Marker.prototype, 'onAdd').mockImplementation(function (this: Leaflet.Marker, carte) {
      const resultat = ajouterRepereOriginal.call(this, carte)
      reperesPlaces.push({ libelle: this.getElement()?.textContent ?? '', position: this.getLatLng() })
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

  it('place un repère écrit « Départ » au début du tracé et « Arrivée » à la fin', () => {
    const ecran = monter()
    expect(reperesPlaces.map((repere) => [repere.libelle, repere.position.lat, repere.position.lng])).toEqual([
      ['Départ', 45.75, 4.85],
      ['Arrivée', 45.52, 4.87],
    ])
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
    for (const tuile of tuiles) expect(tuile.src).toMatch(/^https:\/\/tile\.openstreetmap\.org\/10\/\d+\/\d+\.png$/)
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

    const recevoirPosition = async (ecran: ReturnType<typeof monter>, latitude: number, longitude: number) => {
      surSucces!({ coords: { latitude, longitude } })
      await ecran.vm.$nextTick()
    }

    it('place un repère « Vous », centre la carte sur la personne et dit la distance restante', async () => {
      const ecran = monter()
      await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
      expect(ecran.find('#annonce-suivi').text()).toBe('Recherche de votre position…')
      await recevoirPosition(ecran, 45.6, 4.95)
      expect(reperesPlaces.map((repere) => repere.libelle)).toEqual(['Départ', 'Arrivée', 'Vous'])
      expect(carteAffichee!.getCenter().lat).toBeCloseTo(45.6, 3)
      expect(carteAffichee!.getZoom()).toBe(16)
      expect(ecran.find('#annonce-suivi').text()).toBe('Position trouvée : la carte vous suit.')
      // Du point du milieu jusqu'à Vienne : environ 10,9 km.
      expect(ecran.find('#avancement-trajet').text()).toContain('Il vous reste 10,9 km jusqu’à l’arrivée.')
      expect(ecran.find('#avancement-trajet').text()).not.toContain('du trajet prévu')
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
      expect(reperesPlaces.filter((repere) => repere.libelle === 'Vous')).toHaveLength(1)
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
      expect(ecran.find('#carte-trajet').text()).not.toContain('Vous')
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
      ;(surSucces as unknown as (position: { coords: object }) => void)({ coords: { latitude, longitude, heading } })
      await ecran.vm.$nextTick()
    }
    const repereVous = () => document.querySelector<HTMLElement>('.repere-vous')!

    it('« Vous » est un véhicule, même sans direction connue, puis tourné dans le sens de la marche', async () => {
      const ecran = monter()
      await boutonNomme(ecran, 'Suivre ma position sur la carte').trigger('click')
      await recevoirPosition(ecran, 45.6, 4.95)
      expect(repereVous().querySelector('svg.vehicule-vous')).not.toBeNull()
      expect(repereVous().classList.contains('repere-vous--sans-direction')).toBe(true)
      expect(repereVous().textContent).toBe('Vous')
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

      it('Demande #26 : la personne reste au centre quand la carte change de taille (distance restante qui apparaît)', async () => {
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
        vi.spyOn(Leaflet.Map.prototype, 'getSize').mockImplementation(() => Leaflet.point(1280, 520))
        surChangementDeTaille!()
        expect(carteAffichee!.getCenter().lat).toBeCloseTo(45.6, 4)
        expect(carteAffichee!.getCenter().lng).toBeCloseTo(4.95, 4)
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
        expect(document.activeElement?.getAttribute('aria-label')).toBe('Afficher la carte en plein écran')
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
          props: { trace: [], depart: null, arrivee: null, enLigne: true, suivreDesLOuverture: true },
          global: { plugins: [VueDsfr] },
          attachTo: document.body,
        })

      it('sans trajet, s’ouvre sur la France, cherche la personne et se centre sur elle', async () => {
        const ecran = monterAlAccueil()
        await ecran.vm.$nextTick()
        expect(lignesTracees).toHaveLength(0)
        expect(ecran.find('#carte-trajet').attributes('aria-label')).toBe('Carte autour de ma position')
        expect(ecran.find('#annonce-suivi').text()).toBe('Recherche de votre position…')
        await recevoirPosition(ecran, 45.75, 4.85)
        expect(reperesPlaces.map((repere) => repere.libelle)).toEqual(['Vous'])
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

      it('un trajet calculé ensuite est tracé et montré en entier', async () => {
        const ecran = monterAlAccueil()
        await recevoirPosition(ecran, 45.75, 4.85)
        await ecran.setProps({ trace, depart: lyon, arrivee: vienne })
        expect(lignesTracees).toHaveLength(1)
        expect(cadrages).toHaveLength(1)
        expect(ecran.find('#carte-trajet').attributes('aria-label')).toBe('Carte du trajet de Lyon à Vienne')
        expect(boutonNomme(ecran, 'Me recentrer sur ma position')).toBeTruthy()
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
