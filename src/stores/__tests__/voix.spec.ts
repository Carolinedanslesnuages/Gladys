import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useVoixStore } from '../voix'
import { simulerLocalStorage } from '@/__tests__/stockage-simule'

const annuler = vi.fn<() => void>()

beforeEach(() => {
  annuler.mockClear()
  setActivePinia(createPinia())
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { getVoices: () => [], speak: () => {}, cancel: annuler },
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window, 'speechSynthesis')
})

describe('Store de la voix', () => {
  it('la voix est active par défaut', () => {
    simulerLocalStorage()
    expect(useVoixStore().active).toBe(true)
  })

  it('un même geste coupe la voix, puis la remet', () => {
    simulerLocalStorage()
    const voix = useVoixStore()
    voix.basculer()
    expect(voix.active).toBe(false)
    voix.basculer()
    expect(voix.active).toBe(true)
  })

  it('couper arrête aussitôt la consigne en train d’être dite', () => {
    simulerLocalStorage()
    const voix = useVoixStore()
    voix.basculer()
    expect(annuler).toHaveBeenCalledTimes(1)
    voix.basculer()
    expect(annuler).toHaveBeenCalledTimes(1)
  })

  it('garde le choix sur l’appareil pour le prochain trajet', () => {
    const memoire = simulerLocalStorage()
    useVoixStore().basculer()
    expect(memoire.get('gladys:voix-active')).toBe('false')
    setActivePinia(createPinia())
    expect(useVoixStore().active).toBe(false)
    useVoixStore().basculer()
    setActivePinia(createPinia())
    expect(useVoixStore().active).toBe(true)
  })

  it('si l’appareil refuse d’enregistrer, le choix vaut pour ce trajet et rien ne bloque', () => {
    simulerLocalStorage({}, true)
    const voix = useVoixStore()
    voix.basculer()
    expect(voix.active).toBe(false)
    expect(voix.erreur).toContain('n’a pas pu enregistrer')
  })
})
