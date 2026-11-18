import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { kilometrageValide, useVehiculeStore } from '../vehicule'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'

describe('magasin du véhicule', () => {
  beforeEach(() => {
    simulerLocalStorage()
    setActivePinia(createPinia())
  })

  it('ne sait rien du véhicule tant que la personne ne l’a pas dit', () => {
    const magasin = useVehiculeStore()
    expect(magasin.energie).toBeNull()
    expect(magasin.kilometrage).toBeNull()
  })

  it('garde la motorisation et le kilométrage sur l’appareil, et les retrouve', () => {
    const magasin = useVehiculeStore()
    magasin.choisirEnergie('electrique')
    magasin.choisirKilometrage(12500)
    expect(localStorage.getItem('gladys:vehicule-energie')).toBe('"electrique"')
    setActivePinia(createPinia())
    const retrouve = useVehiculeStore()
    expect(retrouve.energie).toBe('electrique')
    expect(retrouve.kilometrage).toBe(12500)
  })

  it('accepte les espaces dans le kilométrage et refuse le reste', () => {
    expect(kilometrageValide('12 500')).toBe(12500)
    expect(kilometrageValide('0')).toBe(0)
    expect(kilometrageValide('-5')).toBeNull()
    expect(kilometrageValide('12,5')).toBeNull()
    expect(kilometrageValide('abc')).toBeNull()
    expect(kilometrageValide('1000000')).toBeNull()
  })
})
