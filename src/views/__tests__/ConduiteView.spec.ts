import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ConduiteView from '../ConduiteView.vue'
import { useConduiteStore } from '@/stores/conduite'
import { useItineraireStore } from '@/stores/itineraire'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'
import { violationsAccessibilite } from '@/__tests__/accessibilite'
import { trajetSimule, trajetSimuleAncien } from '@/__tests__/trajet-simule'

type SurPosition = (position: { coords: { latitude: number; longitude: number } }) => void
type SurErreur = (erreur: { code: number }) => void
let surPosition: SurPosition
let surErreur: SurErreur

const routeur = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<p>Accueil</p>' } },
    { path: '/conduite', component: ConduiteView },
  ],
})

async function monterEnConduite() {
  await routeur.push('/conduite')
  const ecran = mount(ConduiteView, { attachTo: document.body, global: { plugins: [routeur] } })
  await flushPromises()
  return ecran
}

beforeEach(() => {
  setActivePinia(createPinia())
  simulerLocalStorage()
  vi.stubGlobal('navigator', {
    ...navigator,
    geolocation: {
      watchPosition: (succes: SurPosition, echec: SurErreur) => {
        surPosition = succes
        surErreur = echec
        return 3
      },
      clearWatch: () => {},
    },
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const demarrer = () => {
  useItineraireStore().restaurer(trajetSimule(), 'ign')
  useConduiteStore().demarrer()
}

describe('Écran de conduite', () => {
  it('affiche la consigne en grand avec la distance, puis la met à jour sans recharger', async () => {
    demarrer()
    const ecran = await monterEnConduite()
    expect(ecran.find('#recherche-position').text()).toContain('Recherche de votre position')
    surPosition({ coords: { latitude: 45, longitude: 4 } })
    await flushPromises()
    expect(ecran.find('#consigne-en-cours').text()).toBe('Tournez à droite vers Saint-Martin')
    const distanceAuDepart = ecran.find('#distance-consigne').text()
    surPosition({ coords: { latitude: 45.006, longitude: 4 } })
    await flushPromises()
    expect(ecran.find('#distance-consigne').text()).not.toBe(distanceAuDepart)
    expect(ecran.find('#annonce-consigne').text()).toContain('Tournez à droite vers Saint-Martin')
    surPosition({ coords: { latitude: 45.0095, longitude: 4 } })
    await flushPromises()
    expect(ecran.find('#consigne-en-cours').text()).toBe('Vous arrivez à destination')
    ecran.unmount()
  })

  it('met la consigne en gros caractères, avec un seul titre principal', async () => {
    demarrer()
    const ecran = await monterEnConduite()
    surPosition({ coords: { latitude: 45, longitude: 4 } })
    await flushPromises()
    // La taille se règle dans la feuille de style du composant (de 2 à 3,5 rem, retour à la ligne permis).
    expect(ecran.find('#consigne-en-cours').classes()).toContain('consigne')
    expect(ecran.findAll('h1')).toHaveLength(1)
    expect(ecran.find('h1').text()).toBe('Consigne de conduite')
    ecran.unmount()
  })

  it('dit clairement quand la position est refusée, avec un bouton pour réessayer', async () => {
    demarrer()
    const ecran = await monterEnConduite()
    surErreur({ code: 1 })
    await flushPromises()
    expect(ecran.find('#position-indisponible').text()).toContain('Position refusée')
    expect(ecran.find('#position-indisponible').attributes('role')).toBe('alert')
    await ecran.find('#bouton-reessayer').trigger('click')
    expect(ecran.find('#recherche-position').exists()).toBe(true)
    surPosition({ coords: { latitude: 45, longitude: 4 } })
    await flushPromises()
    expect(ecran.find('#consigne-en-cours').exists()).toBe(true)
    ecran.unmount()
  })

  it('dit clairement quand la position est indisponible', async () => {
    demarrer()
    const ecran = await monterEnConduite()
    surErreur({ code: 2 })
    await flushPromises()
    expect(ecran.find('#position-indisponible').text()).toContain('position est indisponible')
    ecran.unmount()
  })

  it('demande de recalculer un trajet enregistré avant les consignes', async () => {
    useItineraireStore().restaurer(trajetSimuleAncien(), 'ign')
    useConduiteStore().demarrer()
    const ecran = await monterEnConduite()
    expect(ecran.text()).toContain('Recalculez-le')
    ecran.unmount()
  })

  it('propose de revenir à la préparation quand il n’y a pas de trajet', async () => {
    const ecran = await monterEnConduite()
    expect(ecran.text()).toContain('Aucun trajet à suivre')
    expect(ecran.find('#bouton-arreter-trajet').text()).toBe('Retour à la préparation du trajet')
    ecran.unmount()
  })

  it('« Arrêter le trajet » coupe le suivi et revient à l’accueil', async () => {
    demarrer()
    const ecran = await monterEnConduite()
    await ecran.find('#bouton-arreter-trajet').trigger('click')
    await flushPromises()
    expect(useConduiteStore().etat).toBe('arret')
    expect(routeur.currentRoute.value.path).toBe('/')
    ecran.unmount()
  })

  it('sans voix française, un message annoncé le dit et la consigne reste affichée', async () => {
    demarrer()
    const ecran = await monterEnConduite()
    surPosition({ coords: { latitude: 45.0092, longitude: 4 } })
    await flushPromises()
    expect(ecran.find('#voix-absente').text()).toContain('Pas de voix française')
    expect(ecran.find('#voix-absente').element.parentElement?.getAttribute('role')).toBe('status')
    expect(ecran.find('#consigne-en-cours').text()).toBe('Tournez à droite vers Saint-Martin')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    ecran.unmount()
  })

  describe('Bouton de la voix', () => {
    const dire = vi.fn<(enonce: { text: string }) => void>()
    const annuler = vi.fn<() => void>()
    class EnonceSimule {
      voice: unknown = null
      lang = ''
      constructor(public text: string) {}
    }
    beforeEach(() => {
      dire.mockClear()
      annuler.mockClear()
      vi.stubGlobal('SpeechSynthesisUtterance', EnonceSimule)
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: { getVoices: () => [{ lang: 'fr-FR', localService: true }], speak: dire, cancel: annuler },
      })
    })
    afterEach(() => Reflect.deleteProperty(window, 'speechSynthesis'))

    it('un seul bouton coupe la voix, puis la remet, avec l’état écrit en texte', async () => {
      demarrer()
      const ecran = await monterEnConduite()
      surPosition({ coords: { latitude: 45, longitude: 4 } })
      await flushPromises()
      const bouton = ecran.find('#bouton-voix')
      // Composant Bouton : 44 px de haut au moins (contrôlé dans apparence.spec.ts).
      expect(bouton.classes()).toContain('bouton')
      expect(bouton.element.tagName).toBe('BUTTON')
      expect(bouton.text()).toBe('Couper la voix')
      expect(ecran.find('#etat-voix').text()).toBe('Voix active')
      expect(ecran.find('#etat-voix').attributes('role')).toBe('status')
      await bouton.trigger('click')
      expect(ecran.find('#bouton-voix').text()).toBe('Remettre la voix')
      expect(ecran.find('#etat-voix').text()).toBe('Voix coupée')
      expect(annuler).toHaveBeenCalled()
      await ecran.find('#bouton-voix').trigger('click')
      expect(ecran.find('#bouton-voix').text()).toBe('Couper la voix')
      expect(ecran.find('#etat-voix').text()).toBe('Voix active')
      ecran.unmount()
    })

    it('retrouve le choix « voix coupée » à la réouverture de l’écran', async () => {
      demarrer()
      const premierEcran = await monterEnConduite()
      surPosition({ coords: { latitude: 45, longitude: 4 } })
      await flushPromises()
      await premierEcran.find('#bouton-voix').trigger('click')
      premierEcran.unmount()
      setActivePinia(createPinia())
      demarrer()
      const secondEcran = await monterEnConduite()
      surPosition({ coords: { latitude: 45, longitude: 4 } })
      await flushPromises()
      expect(secondEcran.find('#etat-voix').text()).toBe('Voix coupée')
      expect(secondEcran.find('#bouton-voix').text()).toBe('Remettre la voix')
      secondEcran.unmount()
    })

    it('voix coupée, la consigne reste affichée en grand et rien n’est dit', async () => {
      demarrer()
      const ecran = await monterEnConduite()
      surPosition({ coords: { latitude: 45, longitude: 4 } })
      await flushPromises()
      await ecran.find('#bouton-voix').trigger('click')
      surPosition({ coords: { latitude: 45.0092, longitude: 4 } })
      await flushPromises()
      expect(dire).not.toHaveBeenCalled()
      expect(ecran.find('#consigne-en-cours').text()).toBe('Tournez à droite vers Saint-Martin')
      expect(ecran.find('#consigne-en-cours').classes()).toContain('consigne')
      expect(await violationsAccessibilite(document.body)).toEqual([])
      ecran.unmount()
    })

    it('remettre la voix : la consigne proche est dite', async () => {
      demarrer()
      const ecran = await monterEnConduite()
      surPosition({ coords: { latitude: 45, longitude: 4 } })
      await flushPromises()
      await ecran.find('#bouton-voix').trigger('click')
      surPosition({ coords: { latitude: 45.0092, longitude: 4 } })
      await flushPromises()
      await ecran.find('#bouton-voix').trigger('click')
      surPosition({ coords: { latitude: 45.0093, longitude: 4 } })
      await flushPromises()
      expect(dire).toHaveBeenCalledTimes(1)
      ecran.unmount()
    })
  })

  it('aucune violation d’accessibilité automatique, à chaque état', async () => {
    demarrer()
    const ecran = await monterEnConduite()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    surPosition({ coords: { latitude: 45, longitude: 4 } })
    await flushPromises()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    surErreur({ code: 1 })
    await flushPromises()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    ecran.unmount()
  })
})
