import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { direALaVoix } from '../voix'

interface VoixSimulee {
  lang: string
  localService: boolean
  name: string
}

const dire = vi.fn<(enonce: { text: string; lang: string; voice: VoixSimulee | null }) => void>()
const annuler = vi.fn<() => void>()
const fetchSimule = vi.fn<() => Promise<never>>()

class EnonceSimule {
  voice: VoixSimulee | null = null
  lang = ''
  constructor(public text: string) {}
}

const installerLaSynthese = (voix: VoixSimulee[]) => {
  vi.stubGlobal('SpeechSynthesisUtterance', EnonceSimule)
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { getVoices: () => voix, speak: dire, cancel: annuler },
  })
}

beforeEach(() => {
  dire.mockClear()
  annuler.mockClear()
  vi.stubGlobal('fetch', fetchSimule)
})
afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window, 'speechSynthesis')
})

describe('Voix des consignes', () => {
  it('dit la phrase en français avec la voix française de l’appareil', () => {
    const voixFrancaise = { lang: 'fr-FR', localService: true, name: 'Voix de l’appareil' }
    installerLaSynthese([{ lang: 'en-US', localService: true, name: 'Anglais' }, voixFrancaise])
    expect(direALaVoix('Dans 200 m, tournez à droite vers Saint-Martin')).toBe('dite')
    expect(dire).toHaveBeenCalledTimes(1)
    const enonce = dire.mock.calls[0]![0]
    expect(enonce.text).toBe('Dans 200 m, tournez à droite vers Saint-Martin')
    expect(enonce.lang).toBe('fr-FR')
    expect(enonce.voice).toBe(voixFrancaise)
  })

  it('marche hors connexion : voix de l’appareil seulement, aucun appel au réseau', () => {
    installerLaSynthese([{ lang: 'fr-FR', localService: true, name: 'Locale' }])
    direALaVoix('Dans 200 m, tournez à gauche sur la D12')
    expect(dire.mock.calls[0]![0].voice?.localService).toBe(true)
    expect(fetchSimule).not.toHaveBeenCalled()
  })

  it('refuse une voix française qui passerait par le réseau', () => {
    installerLaSynthese([{ lang: 'fr-FR', localService: false, name: 'En ligne' }])
    expect(direALaVoix('Dans 200 m, tournez à droite')).toBe('voix-absente')
    expect(dire).not.toHaveBeenCalled()
  })

  it('signale l’absence de voix française', () => {
    installerLaSynthese([{ lang: 'en-US', localService: true, name: 'Anglais' }])
    expect(direALaVoix('Dans 200 m, tournez à droite')).toBe('voix-absente')
    expect(dire).not.toHaveBeenCalled()
  })

  it('signale l’absence de synthèse vocale sur l’appareil', () => {
    expect(direALaVoix('Dans 200 m, tournez à droite')).toBe('voix-absente')
  })
})
