import { describe, it, expect, afterEach, vi } from 'vitest'
import { ecrire, lire } from '../stockage'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'

describe('Données enregistrées sur l’appareil', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('enregistre sous le nom GLADYS', () => {
    const memoire = simulerLocalStorage()
    expect(ecrire('vitesse-habituelle', 40)).toBe(true)
    expect(memoire.get('gladys:vitesse-habituelle')).toBe('40')
  })

  it('reprend les réglages enregistrés sous l’ancien nom, puis efface l’ancienne copie', () => {
    const memoire = simulerLocalStorage({ 'leon:seuil-detour': '20', 'leon:trajets-recents': '[]' })
    expect(lire('seuil-detour', 10)).toBe(20)
    expect(memoire.get('gladys:seuil-detour')).toBe('20')
    expect(memoire.has('leon:seuil-detour')).toBe(false)
    expect(lire('trajets-recents', null)).toEqual([])
  })

  it('préfère la donnée déjà enregistrée sous le nouveau nom', () => {
    simulerLocalStorage({ 'leon:seuil-detour': '20', 'gladys:seuil-detour': '30' })
    expect(lire('seuil-detour', 10)).toBe(30)
  })

  it('garde l’ancienne donnée si l’appareil est plein', () => {
    const memoire = simulerLocalStorage({ 'leon:seuil-detour': '20' }, true)
    expect(lire('seuil-detour', 10)).toBe(20)
    expect(memoire.get('leon:seuil-detour')).toBe('20')
  })
})
