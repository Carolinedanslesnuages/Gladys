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

const boutonNomme = (ecran: ReturnType<typeof monter>, intitule: string) =>
  ecran.findAll('button').find((bouton) => bouton.text() === intitule)!

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

  it('aucune violation d’accessibilité automatique, avec et sans réseau', async () => {
    const ecran = monter()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await ecran.setProps({ enLigne: false })
    expect(await violationsAccessibilite(document.body)).toEqual([])
    ecran.unmount()
  })
})
