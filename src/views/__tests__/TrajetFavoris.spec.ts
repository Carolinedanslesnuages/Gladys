import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TrajetView from '../TrajetView.vue'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'
import { violationsAccessibilite } from '@/__tests__/accessibilite'
import { useFavorisStore, type Favori } from '@/stores/favoris'
import type { Itineraire, ResultatItineraire } from '@/services/itineraire'

const definirEnLigne = (valeur: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value: valeur, configurable: true })

const monter = () => mount(TrajetView, { attachTo: document.body })
type Ecran = ReturnType<typeof monter>

const boutonNomme = (ecran: Ecran, intitule: string) =>
  ecran
    .findAll('button')
    .find((bouton) => bouton.text() === intitule || bouton.attributes('aria-label') === intitule)!

const itineraire: Itineraire = {
  distanceMetres: 12500,
  departementaleFortTraficMetres: 0,
  troncons: [],
  etapes: [
    { codeCommune: '69123', commune: 'Lyon', route: 'D 306', departementale: true, fortTrafic: false, distanceMetres: 12500 },
  ],
  trace: [
    { latitude: 45.75, longitude: 4.85 },
    { latitude: 45.6, longitude: 4.95 },
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
const favoriMaisonMarche: Favori = {
  id: 'favori-1',
  nom: 'Maison → Marché',
  depart: { libelle: 'Maison', latitude: 45.75, longitude: 4.85 },
  arrivee: { libelle: 'Marché', latitude: 45.52, longitude: 4.87 },
  calculateur: 'ign',
  resultat,
  enregistreLe: '2026-11-18T08:00:00Z',
}
/** Les favoris ne se chargent qu'avec l'accord : pour tester la demande d'accord, on le retire après coup. */
const retirerLAccord = () => useFavorisStore().$patch({ accord: null })

const stockageAvecFavori = {
  'gladys:accord-favoris': JSON.stringify('accepte'),
  'gladys:favoris': JSON.stringify([favoriMaisonMarche]),
}

let fetchSimule: ReturnType<typeof vi.fn<(adresse: string) => Promise<Response>>>

describe('Story #6 : garder mon trajet hors connexion', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    definirEnLigne(true)
    fetchSimule = vi.fn<(adresse: string) => Promise<Response>>()
    vi.stubGlobal('fetch', fetchSimule)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    definirEnLigne(true)
    document.body.innerHTML = ''
  })

  describe('Critère : un trajet enregistré s’ouvre sans réseau', () => {
    it('rouvre un favori réseau coupé : tracé, étapes, message pour la carte non vue, sans aucun appel réseau', async () => {
      simulerLocalStorage(stockageAvecFavori)
      definirEnLigne(false)
      const ecran = monter()
      await boutonNomme(ecran, 'Ouvrir le trajet favori Maison → Marché').trigger('click')
      await flushPromises()
      expect(fetchSimule).not.toHaveBeenCalled()
      const carte = ecran.find('#carte-trajet')
      expect(carte.exists()).toBe(true)
      expect(carte.attributes('aria-label')).toBe('Carte du trajet de Maison à Marché')
      expect(carte.findAll('.leaflet-overlay-pane path')).toHaveLength(1)
      expect(ecran.find('#etat-carte').text()).toContain('seuls les morceaux de carte déjà vus s’affichent')
      expect(ecran.find('#etat-carte').text()).toContain('Les zones jamais regardées restent vides')
      expect(ecran.findAll('#etapes-trajet li')).toHaveLength(1)
      expect(ecran.find('#etapes-trajet').text()).toContain('Lyon')
      expect(ecran.find('#annonce-trajet').text()).toContain('Trajet favori ouvert : Maison → Marché')
      expect(ecran.find('#resume-trajet').text()).toContain('12,5 km')
      ecran.unmount()
    })

    it('ne recalcule pas l’itinéraire en ligne : le favori garde son tracé enregistré', async () => {
      simulerLocalStorage(stockageAvecFavori)
      const ecran = monter()
      await boutonNomme(ecran, 'Ouvrir le trajet favori Maison → Marché').trigger('click')
      await flushPromises()
      expect(fetchSimule).not.toHaveBeenCalled()
      expect(ecran.findAll('#etapes-trajet li')).toHaveLength(1)
      ecran.unmount()
    })
  })

  describe('Critère : enregistrer et nommer mes trajets favoris', () => {
    const ouvrirLeFormulaire = async (ecran: Ecran) => {
      await boutonNomme(ecran, 'Enregistrer ce trajet').trigger('click')
      await flushPromises()
    }

    /** Un favori ouvert donne un itinéraire affiché, donc le bouton « Enregistrer ce trajet ». */
    const avecUnTrajetAffiche = async (ecran: Ecran) => {
      await boutonNomme(ecran, 'Ouvrir le trajet favori Maison → Marché').trigger('click')
      await flushPromises()
    }

    it('demande l’accord au premier favori ; sans accord, rien n’est enregistré', async () => {
      const memoire = simulerLocalStorage(stockageAvecFavori)
      const ecran = monter()
      await avecUnTrajetAffiche(ecran)
      retirerLAccord()
      await ouvrirLeFormulaire(ecran)
      expect(ecran.text()).toContain('Garder mes trajets favoris sur ce téléphone ?')
      expect(ecran.find('#nom-du-favori').exists()).toBe(false)
      await boutonNomme(ecran, 'Non, ne rien enregistrer').trigger('click')
      await flushPromises()
      expect(ecran.find('#nom-du-favori').exists()).toBe(false)
      expect(JSON.parse(memoire.get('gladys:accord-favoris')!)).toBe('refuse')
      expect(ecran.find('#annonce-trajet').text()).toContain('Aucun trajet ne sera enregistré')
      ecran.unmount()
    })

    it('enregistre sous un nom, l’annonce, l’affiche dans la liste et le garde après rechargement', async () => {
      const memoire = simulerLocalStorage({ 'gladys:accord-favoris': JSON.stringify('accepte'), 'gladys:favoris': JSON.stringify([favoriMaisonMarche]) })
      const ecran = monter()
      await avecUnTrajetAffiche(ecran)
      await ouvrirLeFormulaire(ecran)
      expect(ecran.find('label[for="nom-du-favori"]').text()).toContain('Nom du trajet')
      await ecran.find('#nom-du-favori').setValue('Chez le docteur')
      await ecran.find('#formulaire-favori').trigger('submit')
      await flushPromises()
      expect(ecran.find('#annonce-trajet').text()).toContain('Trajet « Chez le docteur » enregistré')
      const liste = ecran.find('#mes-trajets-favoris')
      expect(liste.text()).toContain('Chez le docteur')
      expect(liste.text()).toContain('Maison → Marché')
      ecran.unmount()

      setActivePinia(createPinia())
      simulerLocalStorage(Object.fromEntries(memoire))
      const apresRechargement = monter()
      expect(apresRechargement.find('#mes-trajets-favoris').text()).toContain('Chez le docteur')
      apresRechargement.unmount()
    })

    it('demande l’accord au premier favori, puis ouvre le formulaire, et ne le redemande plus', async () => {
      simulerLocalStorage(stockageAvecFavori)
      const ecran = monter()
      await avecUnTrajetAffiche(ecran)
      retirerLAccord()
      await ouvrirLeFormulaire(ecran)
      await boutonNomme(ecran, 'Oui, garder mes favoris').trigger('click')
      await flushPromises()
      expect(ecran.find('#nom-du-favori').exists()).toBe(true)
      await ecran.find('#nom-du-favori').setValue('Premier')
      await ecran.find('#formulaire-favori').trigger('submit')
      await flushPromises()
      await ouvrirLeFormulaire(ecran)
      expect(ecran.text()).not.toContain('Garder mes trajets favoris sur ce téléphone ?')
      expect(ecran.find('#nom-du-favori').exists()).toBe(true)
      ecran.unmount()
    })

    it('refuse un nom vide avec une erreur claire, reliée au champ', async () => {
      const memoire = simulerLocalStorage(stockageAvecFavori)
      const ecran = monter()
      await avecUnTrajetAffiche(ecran)
      await ouvrirLeFormulaire(ecran)
      await ecran.find('#formulaire-favori').trigger('submit')
      await flushPromises()
      const champ = ecran.find('#nom-du-favori')
      expect(ecran.find('#formulaire-favori').text()).toContain('Donnez un nom à ce trajet')
      expect(champ.attributes('aria-describedby')).toBeTruthy()
      expect(JSON.parse(memoire.get('gladys:favoris')!)).toHaveLength(1)
      expect(document.activeElement?.id).toBe('nom-du-favori')
      ecran.unmount()
    })
  })

  describe('Critère : supprimer un trajet enregistré', () => {
    it('supprime après confirmation, pour de bon', async () => {
      const memoire = simulerLocalStorage(stockageAvecFavori)
      const ecran = monter()
      await boutonNomme(ecran, 'Afficher le détail et mes trajets récents').trigger('click')
      await boutonNomme(ecran, 'Supprimer le trajet Maison → Marché').trigger('click')
      await flushPromises()
      expect(document.activeElement?.id).toBe('question-suppression')
      await boutonNomme(ecran, 'Oui, supprimer le trajet Maison → Marché').trigger('click')
      await flushPromises()
      expect(ecran.find('#mes-trajets-favoris').text()).toContain('Aucun trajet favori pour l’instant')
      expect(ecran.find('#annonce-trajet').text()).toContain('Trajet « Maison → Marché » supprimé')
      expect(JSON.parse(memoire.get('gladys:favoris')!)).toEqual([])
      ecran.unmount()
    })

    it('« Annuler » conserve le favori', async () => {
      const memoire = simulerLocalStorage(stockageAvecFavori)
      const ecran = monter()
      await boutonNomme(ecran, 'Supprimer le trajet Maison → Marché').trigger('click')
      await boutonNomme(ecran, 'Annuler : garder le trajet Maison → Marché').trigger('click')
      await flushPromises()
      expect(ecran.find('#mes-trajets-favoris').text()).toContain('Maison → Marché')
      expect(JSON.parse(memoire.get('gladys:favoris')!)).toHaveLength(1)
      ecran.unmount()
    })
  })

  it('aucune violation d’accessibilité automatique (liste, formulaire, erreur, confirmation, hors connexion)', async () => {
    simulerLocalStorage(stockageAvecFavori)
    const ecran = monter()
    await boutonNomme(ecran, 'Ouvrir le trajet favori Maison → Marché').trigger('click')
    await flushPromises()
    await boutonNomme(ecran, 'Enregistrer ce trajet').trigger('click')
    await ecran.find('#formulaire-favori').trigger('submit')
    await flushPromises()
    await boutonNomme(ecran, 'Supprimer le trajet Maison → Marché').trigger('click')
    await flushPromises()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    definirEnLigne(false)
    window.dispatchEvent(new Event('offline'))
    await flushPromises()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    ecran.unmount()
  })
})
