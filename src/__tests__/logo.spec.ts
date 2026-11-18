import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import VueDsfr from '@gouvminint/vue-dsfr'
import App from '@/App.vue'
import router from '@/router'
import { simulerLocalStorage } from './stockage-simule'
import { violationsAccessibilite } from './accessibilite'

const BLEU_FRANCE = '#000091'
const ROUGE_MARIANNE = '#E1000F'
const TRACE_ETOILE = 'M203 8 Q206 25 223 28 Q206 31 203 48 Q200 31 183 28 Q200 25 203 8 Z'

describe('Logo de Gladys', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    simulerLocalStorage()
    vi.stubGlobal('fetch', vi.fn<() => Promise<Response>>())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('Demande #26 : le panneau « À propos » affiche le logo avec le texte alternatif « Gladys », sans erreur d’accessibilité', async () => {
    await router.push('/')
    await router.isReady()
    const application = mount(App, {
      global: { plugins: [VueDsfr, router] },
      attachTo: document.body,
    })
    await application.vm.$nextTick()
    await application.find('#bouton-a-propos').trigger('click')
    await flushPromises()
    const imageLogo = document.querySelector('dialog img.logo-gladys')
    expect(imageLogo?.getAttribute('alt')).toBe('Gladys')
    expect(await violationsAccessibilite(document.body)).toEqual([])
    application.unmount()
  })

  it.each([['public/logo-gladys.svg'], ['public/favicon.svg']])(
    '%s est en bleu France, avec l’étoile rouge à quatre branches, sur fond transparent',
    (chemin) => {
      const dessin = readFileSync(chemin, 'utf8')
      expect(dessin).toContain(`stroke="${BLEU_FRANCE}"`)
      expect(dessin).toContain(`fill="${ROUGE_MARIANNE}"`)
      expect(dessin).toContain(TRACE_ETOILE)
      expect(dessin).not.toContain('<rect')
      expect(dessin).toContain('<title>Gladys</title>')
    },
  )

  it('l’onglet du navigateur utilise l’icône « g » étoilée', () => {
    const pageDeDepart = readFileSync('index.html', 'utf8')
    expect(pageDeDepart).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">')
  })
})
