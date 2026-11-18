import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MonVehicule from '../MonVehicule.vue'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

describe('Mon véhicule', () => {
  beforeEach(() => {
    simulerLocalStorage()
    setActivePinia(createPinia())
  })

  it('demande si le véhicule est thermique ou électrique, et son autonomie', () => {
    const ecran = mount(MonVehicule)
    expect(ecran.text()).toContain('Thermique')
    expect(ecran.text()).toContain('Électrique')
    expect(ecran.find('label[for="autonomie-vehicule"]').exists()).toBe(true)
  })

  it('enregistre le choix et annonce le véhicule enregistré', async () => {
    const ecran = mount(MonVehicule)
    await ecran.find('#energie-vehicule-electrique').setValue(true)
    await ecran.find('#autonomie-vehicule').setValue('75')
    expect(localStorage.getItem('gladys:vehicule-energie')).toBe('"electrique"')
    expect(localStorage.getItem('gladys:vehicule-autonomie')).toBe('75')
    expect(ecran.find('#vehicule-enregistre').text()).toContain('électrique')
    expect(ecran.find('#vehicule-enregistre').text()).toContain('75 km d’autonomie')
  })

  it('refuse une autonomie invalide avec un message clair, sans l’enregistrer', async () => {
    const ecran = mount(MonVehicule)
    await ecran.find('#autonomie-vehicule').setValue('beaucoup')
    expect(ecran.text()).toContain('Indiquez un nombre entier de kilomètres')
    expect(localStorage.getItem('gladys:vehicule-autonomie')).toBeNull()
  })

  it('n’a aucune violation d’accessibilité', async () => {
    const ecran = mount(MonVehicule, { attachTo: document.body })
    expect(await violationsAccessibilite(document.body)).toEqual([])
    ecran.unmount()
  })
})
