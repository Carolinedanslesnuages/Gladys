import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { autonomieValide, useVehiculeStore } from '../vehicule'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'

describe('magasin du véhicule', () => {
  beforeEach(() => {
    simulerLocalStorage()
    setActivePinia(createPinia())
  })

  it('ne sait rien du véhicule tant que la personne ne l’a pas dit', () => {
    const magasin = useVehiculeStore()
    expect(magasin.energie).toBeNull()
    expect(magasin.autonomie).toBeNull()
  })

  it('garde la motorisation et l’autonomie sur l’appareil, et les retrouve', () => {
    const magasin = useVehiculeStore()
    magasin.choisirEnergie('electrique')
    magasin.choisirAutonomie(75)
    expect(localStorage.getItem('gladys:vehicule-energie')).toBe('"electrique"')
    setActivePinia(createPinia())
    const retrouve = useVehiculeStore()
    expect(retrouve.energie).toBe('electrique')
    expect(retrouve.autonomie).toBe(75)
  })

  it('accepte une autonomie de 1 à 999 km et refuse le reste', () => {
    expect(autonomieValide('75')).toBe(75)
    expect(autonomieValide(' 7 5 ')).toBe(75)
    expect(autonomieValide('0')).toBeNull()
    expect(autonomieValide('-5')).toBeNull()
    expect(autonomieValide('12,5')).toBeNull()
    expect(autonomieValide('abc')).toBeNull()
    expect(autonomieValide('1000')).toBeNull()
  })
})
