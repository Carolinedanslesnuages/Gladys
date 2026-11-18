import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import TrajetView from '../TrajetView.vue'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'
import { violationsAccessibilite } from '@/__tests__/accessibilite'
import { trajetSimule, trajetSimuleAncien } from '@/__tests__/trajet-simule'
import { useConduiteStore } from '@/stores/conduite'
import type { Favori } from '@/stores/favoris'
import type { ResultatItineraire } from '@/services/itineraire'

const routeur = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: TrajetView },
    { path: '/conduite', component: { template: '<p>Conduite</p>' } },
  ],
})

const favoriAvec = (resultat: ResultatItineraire): Favori => ({
  id: 'favori-1',
  nom: 'Maison → Marché',
  depart: { libelle: 'Maison', latitude: 45, longitude: 4 },
  arrivee: { libelle: 'Marché', latitude: 45.01, longitude: 4.01 },
  calculateur: 'ign',
  resultat,
  enregistreLe: '2026-11-18T08:00:00Z',
})

const stockageAvec = (resultat: ResultatItineraire) => ({
  'gladys:accord-favoris': JSON.stringify('accepte'),
  'gladys:favoris': JSON.stringify([favoriAvec(resultat)]),
})

async function ouvrirLeFavori() {
  await routeur.push('/')
  const ecran = mount(TrajetView, { attachTo: document.body, global: { plugins: [routeur] } })
  await ecran
    .findAll('button')
    .find((bouton) => bouton.attributes('aria-label') === 'Ouvrir le trajet favori Maison → Marché')!
    .trigger('click')
  await flushPromises()
  return ecran
}

describe('Story #37 : démarrer le trajet depuis la préparation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('fetch', vi.fn<(adresse: string) => Promise<Response>>())
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition: () => 1, clearWatch: () => {}, getCurrentPosition: () => {} },
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('propose « Démarrer le trajet » une fois l’itinéraire là, lance le suivi et ouvre l’écran de conduite', async () => {
    simulerLocalStorage(stockageAvec(trajetSimule()))
    const ecran = await ouvrirLeFavori()
    const bouton = ecran.find('#bouton-demarrer-trajet')
    expect(bouton.text()).toBe('Démarrer le trajet')
    await bouton.trigger('click')
    await flushPromises()
    expect(useConduiteStore().etat).toBe('attente')
    expect(routeur.currentRoute.value.path).toBe('/conduite')
    ecran.unmount()
  })

  it('ne propose pas de démarrer sans itinéraire', async () => {
    simulerLocalStorage()
    await routeur.push('/')
    const ecran = mount(TrajetView, { attachTo: document.body, global: { plugins: [routeur] } })
    expect(ecran.find('#bouton-demarrer-trajet').exists()).toBe(false)
    ecran.unmount()
  })

  it('un trajet enregistré avant les consignes ne démarre pas : il faudra le recalculer', async () => {
    simulerLocalStorage(stockageAvec(trajetSimuleAncien()))
    const ecran = await ouvrirLeFavori()
    await ecran.find('#bouton-demarrer-trajet').trigger('click')
    await flushPromises()
    expect(useConduiteStore().consignesAbsentes).toBe(true)
    expect(useConduiteStore().etat).toBe('arret')
    ecran.unmount()
  })

  it('aucune violation d’accessibilité automatique avec le bouton « Démarrer le trajet »', async () => {
    simulerLocalStorage(stockageAvec(trajetSimule()))
    const ecran = await ouvrirLeFavori()
    expect(ecran.find('#bouton-demarrer-trajet').exists()).toBe(true)
    expect(await violationsAccessibilite(document.body)).toEqual([])
    ecran.unmount()
  })
})
