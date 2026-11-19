import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ConduiteView from '../ConduiteView.vue'
import { useConduiteStore } from '@/stores/conduite'
import { useItineraireStore } from '@/stores/itineraire'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'
import { violationsAccessibilite } from '@/__tests__/accessibilite'
import { trajetSimule } from '@/__tests__/trajet-simule'
import type { Etape, Itineraire, ResultatItineraire } from '@/services/itineraire'

type SurPosition = (position: { coords: { latitude: number; longitude: number } }) => void
let surPosition: SurPosition

const routeur = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<p>Accueil</p>' } },
    { path: '/conduite', component: ConduiteView },
  ],
})

function simulerAppareil(enLigne: boolean): void {
  vi.stubGlobal('navigator', {
    onLine: enLigne,
    geolocation: {
      watchPosition: (succes: SurPosition) => {
        surPosition = succes
        return 3
      },
      clearWatch: () => {},
    },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  simulerLocalStorage()
  simulerAppareil(true)
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const cheminVersSaintMartin = (sansDepartementalePossible: boolean): ResultatItineraire => {
  const etapeNouvelle: Etape = {
    codeCommune: null,
    commune: 'Saint-Martin',
    route: 'Rue des Tilleuls',
    departementale: false,
    fortTrafic: !sansDepartementalePossible,
    distanceMetres: 800,
  }
  const itineraire: Itineraire = {
    distanceMetres: 800,
    departementaleFortTraficMetres: sansDepartementalePossible ? 0 : 300,
    troncons: [],
    etapes: [etapeNouvelle],
    trace: [
      { latitude: 45.003, longitude: 4.002 },
      { latitude: 45.01, longitude: 4 },
    ],
  }
  return {
    itineraire,
    plusCourt: itineraire,
    retenuEstLePlusCourt: true,
    sansDepartementalePossible,
    detourTropLong: false,
  }
}

async function monterEnConduite() {
  useItineraireStore().restaurer(trajetSimule(), 'ign')
  useConduiteStore().demarrer()
  await routeur.push('/conduite')
  const ecran = mount(ConduiteView, {
    attachTo: document.body,
    global: { plugins: [routeur], stubs: { CarteTrajet: { template: '<div class="carte-simulee"></div>' } } },
  })
  await flushPromises()
  return ecran
}

const sortirDuTrajet = async () => {
  for (let rang = 0; rang < 3; rang += 1) surPosition({ coords: { latitude: 45.003, longitude: 4.002 } })
  await flushPromises()
}

describe('Écran de conduite : sortie du trajet', () => {
  it('annonce le recalcul en cours dans une zone de statut, puis le nouveau chemin', async () => {
    const ecran = await monterEnConduite()
    vi.spyOn(useItineraireStore(), 'calculerUnChemin').mockResolvedValue(cheminVersSaintMartin(true))
    await sortirDuTrajet()
    expect(ecran.find('#recalcul').attributes('role')).toBe('status')
    expect(ecran.find('#recalcul-fait').text()).toContain('Nouveau chemin calculé vers Saint-Martin')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    ecran.unmount()
  })

  it('dit « quitté le trajet » pendant le calcul', async () => {
    const ecran = await monterEnConduite()
    vi.spyOn(useItineraireStore(), 'calculerUnChemin').mockReturnValue(new Promise(() => {}))
    await sortirDuTrajet()
    expect(ecran.find('#recalcul-en-cours').text()).toContain('Vous avez quitté le trajet')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    ecran.unmount()
  })

  it('sans chemin sûr, le dit et propose un vrai bouton pour suivre le plus sûr', async () => {
    const ecran = await monterEnConduite()
    vi.spyOn(useItineraireStore(), 'calculerUnChemin').mockResolvedValue(cheminVersSaintMartin(false))
    await sortirDuTrajet()
    expect(ecran.find('#recalcul-plus-sur').text()).toContain('n’évite les départementales à fort trafic')
    const bouton = ecran.find('#bouton-suivre-chemin-plus-sur')
    expect(bouton.element.tagName).toBe('BUTTON')
    expect(bouton.text()).toBe('Suivre le chemin le plus sûr')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await bouton.trigger('click')
    expect(ecran.find('#recalcul-fait').exists()).toBe(true)
    expect(ecran.find('#bouton-suivre-chemin-plus-sur').exists()).toBe(false)
    ecran.unmount()
  })

  it('sans réseau, un message clair dit que le recalcul est impossible', async () => {
    simulerAppareil(false)
    const ecran = await monterEnConduite()
    await sortirDuTrajet()
    expect(ecran.find('#recalcul-sans-reseau').text()).toContain('pas de réseau')
    expect(ecran.find('#recalcul-sans-reseau').text()).toContain('recalculer le chemin')
    expect(ecran.find('#bouton-reessayer-recalcul').text()).toBe('Réessayer le recalcul')
    expect(ecran.find('#consigne-en-cours').exists()).toBe(true)
    expect(await violationsAccessibilite(document.body)).toEqual([])
    ecran.unmount()
  })
})
