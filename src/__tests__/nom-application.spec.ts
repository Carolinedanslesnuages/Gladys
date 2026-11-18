import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { flushPromises, mount } from '@vue/test-utils'
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
    const application = mount(App, {
      global: { plugins: [VueDsfr, router] },
      attachTo: document.body,
    })
    await application.vm.$nextTick()
    expect(document.title).toBe(titreAttendu)
    expect(application.html()).not.toMatch(ANCIEN_NOM)
    application.unmount()
  })

  it('Demande #26 : application mobile, sans en-tête ni pied de page ; l’accroche est dans « À propos »', async () => {
    await router.push('/')
    await router.isReady()
    const application = mount(App, {
      global: { plugins: [VueDsfr, router] },
      attachTo: document.body,
    })
    await application.vm.$nextTick()
    expect(application.find('header').exists()).toBe(false)
    expect(application.find('footer').exists()).toBe(false)
    expect(application.find('main#contenu').exists()).toBe(true)
    await application.find('#bouton-a-propos').trigger('click')
    await flushPromises()
    expect(document.querySelector('dialog')?.textContent).toContain('Sans permis, en toute sécurité')
    application.unmount()
  })

  it('Demande #26 : depuis « Relevés », un lien ramène à la carte', async () => {
    await router.push('/releves')
    await router.isReady()
    const application = mount(App, {
      global: { plugins: [VueDsfr, router] },
      attachTo: document.body,
    })
    await application.vm.$nextTick()
    expect(application.find('a[href="/"]').text()).toBe('Retour à la carte')
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
