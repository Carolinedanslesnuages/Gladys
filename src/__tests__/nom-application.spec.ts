import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import VueDsfr from '@gouvminint/vue-dsfr'
import App from '@/App.vue'
import router from '@/router'
import { simulerLocalStorage } from './stockage-simule'

const ANCIEN_NOM = /l[ée]on/i

describe('Nom de l’application : GLADYS', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    simulerLocalStorage()
    vi.stubGlobal('fetch', vi.fn<() => Promise<Response>>())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it.each([
    ['/', 'Préparer mon trajet — GLADYS'],
    ['/releves', 'Relevés — GLADYS'],
  ])('l’écran %s s’appelle GLADYS et jamais l’ancien nom', async (chemin, titreAttendu) => {
    await router.push(chemin)
    await router.isReady()
    const application = mount(App, { global: { plugins: [VueDsfr, router] }, attachTo: document.body })
    await application.vm.$nextTick()
    expect(document.title).toBe(titreAttendu)
    expect(application.find('header img').attributes('alt')).toBe('Gladys')
    expect(application.html()).not.toMatch(ANCIEN_NOM)
    application.unmount()
  })

  it('l’en-tête montre le logo et la phrase d’accroche, sans le nom écrit en toutes lettres', async () => {
    await router.push('/')
    await router.isReady()
    const application = mount(App, { global: { plugins: [VueDsfr, router] }, attachTo: document.body })
    await application.vm.$nextTick()
    const enTete = application.find('header')
    expect(enTete.text()).toContain('Sans permis, en toute sécurité')
    expect(enTete.text()).not.toMatch(/gladys/i)
    application.unmount()
  })

  it('le titre de départ et l’application installée s’appellent GLADYS', () => {
    const pageDeDepart = readFileSync('index.html', 'utf8')
    const configuration = readFileSync('vite.config.ts', 'utf8')
    expect(pageDeDepart).toContain('<title>GLADYS</title>')
    expect(configuration).toContain("name: 'GLADYS'")
    expect(configuration).toContain("short_name: 'GLADYS'")
    expect(pageDeDepart + configuration).not.toMatch(ANCIEN_NOM)
  })
})
