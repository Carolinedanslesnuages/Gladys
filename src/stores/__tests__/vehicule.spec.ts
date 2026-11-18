import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { autonomieValide, avertissementDAutonomie, useVehiculeStore } from '../vehicule'
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

  it('garde la motorisation mais redemande l’autonomie à chaque ouverture', () => {
    const magasin = useVehiculeStore()
    magasin.choisirEnergie('electrique')
    magasin.choisirAutonomie(75)
    expect(localStorage.getItem('gladys:vehicule-energie')).toBe('"electrique"')
    setActivePinia(createPinia())
    const reouvert = useVehiculeStore()
    expect(reouvert.energie).toBe('electrique')
    expect(reouvert.autonomie).toBeNull()
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

describe('avertissement d’autonomie', () => {
  it('ne dit rien tant que l’autonomie n’est pas donnée', () => {
    expect(avertissementDAutonomie(20000, null, 'electrique')).toBeNull()
  })

  it('ne dit rien si l’aller-retour est possible', () => {
    expect(avertissementDAutonomie(30000, 75, 'electrique')).toBeNull()
  })

  it('prévient que l’aller-retour est impossible sans recharge', () => {
    expect(avertissementDAutonomie(40000, 75, 'electrique')).toBe(
      'Attention : vous pourrez faire l’aller (40 km), mais pas l’aller-retour sans recharge : il vous reste 75 km d’autonomie.',
    )
  })

  it('prévient que le trajet lui-même est impossible', () => {
    expect(avertissementDAutonomie(90000, 75, 'electrique')).toBe(
      'Attention : ce trajet fait 90 km et il vous reste 75 km d’autonomie. Vous ne pourrez pas le faire sans recharge.',
    )
  })

  it('parle de plein pour un véhicule thermique', () => {
    expect(avertissementDAutonomie(40000, 75, 'thermique')).toContain('sans refaire le plein')
  })
})
