import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import VueDsfr from '@gouvminint/vue-dsfr'
import router from '@/router'
import MenuAPropos from '../MenuAPropos.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const monter = () => mount(MenuAPropos, { global: { plugins: [VueDsfr, router] }, attachTo: document.body })
type Ecran = ReturnType<typeof monter>

async function ouvrir(ecran: Ecran): Promise<void> {
  await ecran.find('#bouton-menu').trigger('click')
  await flushPromises()
}
const panneau = () => document.querySelector<HTMLDialogElement>('dialog.fr-modal')

describe('Demande #26 : bouton « Menu » et panneau « À propos »', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('le bouton « Menu » a un intitulé visible et annonce qu’il ouvre une fenêtre', () => {
    const ecran = monter()
    const bouton = ecran.find('#bouton-menu')
    expect(bouton.element.tagName).toBe('BUTTON')
    expect(bouton.text()).toBe('Menu')
    expect(bouton.attributes('aria-haspopup')).toBe('dialog')
    expect(panneau()).toBeNull()
    ecran.unmount()
  })

  it('ouvre le panneau « À propos », annoncé comme une fenêtre aux lecteurs d’écran', async () => {
    const ecran = monter()
    await ouvrir(ecran)
    const fenetre = panneau()!
    expect(fenetre.getAttribute('aria-modal')).toBe('true')
    const titre = document.getElementById(fenetre.getAttribute('aria-labelledby')!)!
    expect(titre.tagName).toBe('H2')
    expect(titre.textContent?.trim()).toBe('À propos de GLADYS')
    ecran.unmount()
  })

  it('contient le logo Gladys, le bloc marque, et les informations légales', async () => {
    const ecran = monter()
    await ouvrir(ecran)
    const fenetre = panneau()!
    expect(fenetre.querySelector('img.logo-gladys')?.getAttribute('alt')).toBe('Gladys')
    // Bloc marque DSFR : « République » et « Française » sur deux lignes.
    expect(fenetre.querySelector('.fr-logo')?.textContent?.trim()).toBe('RépubliqueFrançaise')
    expect(fenetre.querySelector('.fr-logo br')).not.toBeNull()
    const titres = Array.from(fenetre.querySelectorAll('h3')).map((titre) => titre.textContent?.trim())
    expect(titres).toEqual([
      'Aller à',
      'Déclaration d’accessibilité',
      'Mentions légales',
      'Données personnelles',
      'Gestion des cookies',
    ])
    expect(fenetre.textContent).toContain('Votre position')
    expect(fenetre.textContent).toContain('Elle n’est jamais enregistrée')
    expect(fenetre.textContent).toContain('ne dépose aucun cookie')
    expect(fenetre.querySelector('a[href="/releves"]')?.textContent?.trim()).toBe('Relevés')
    ecran.unmount()
  })

  it('se ferme avec « Fermer », et le focus revient sur « Menu »', async () => {
    const ecran = monter()
    await ouvrir(ecran)
    const fermer = Array.from(panneau()!.querySelectorAll('button')).find(
      (bouton) => bouton.textContent?.trim() === 'Fermer',
    )!
    fermer.click()
    await flushPromises()
    expect(panneau()).toBeNull()
    expect(document.activeElement?.id).toBe('bouton-menu')
    ecran.unmount()
  })

  it('se ferme avec la touche Échap', async () => {
    const ecran = monter()
    await ouvrir(ecran)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(panneau()).toBeNull()
    expect(document.activeElement?.id).toBe('bouton-menu')
    ecran.unmount()
  })

  it('aucune violation d’accessibilité automatique, fermé puis ouvert', async () => {
    const ecran = monter()
    expect(await violationsAccessibilite(document.body)).toEqual([])
    await ouvrir(ecran)
    expect(await violationsAccessibilite(document.body)).toEqual([])
    ecran.unmount()
  })
})
