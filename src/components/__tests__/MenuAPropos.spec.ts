import { describe, it, expect, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import router from '@/router'
import MenuAPropos from '../MenuAPropos.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

const monter = () =>
  mount(MenuAPropos, { global: { plugins: [router] }, attachTo: document.body })
type Ecran = ReturnType<typeof monter>

async function ouvrir(ecran: Ecran): Promise<void> {
  await ecran.find('#bouton-a-propos').trigger('click')
  await flushPromises()
}
const panneau = () => document.querySelector<HTMLDialogElement>('dialog.fenetre-modale')

describe('Demandes #26 et #30 : bouton « À propos » et son panneau', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('le bouton « À propos » a un intitulé visible et annonce qu’il ouvre une fenêtre', () => {
    const ecran = monter()
    const bouton = ecran.find('#bouton-a-propos')
    expect(bouton.element.tagName).toBe('BUTTON')
    expect(bouton.text()).toBe('À propos, accessibilité et relevés')
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

  it('contient le logo Gladys, sans aucun élément du système de design de l’État, et les informations légales', async () => {
    const ecran = monter()
    await ouvrir(ecran)
    const fenetre = panneau()!
    expect(fenetre.querySelector('img.logo-gladys')?.getAttribute('alt')).toBe('Gladys')
    expect(fenetre.textContent).not.toContain('République Française')
    expect(fenetre.querySelector('[class*="fr-"]')).toBeNull()
    const titres = Array.from(fenetre.querySelectorAll('h3')).map((titre) =>
      titre.textContent?.trim(),
    )
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

  it('se ferme avec « Fermer », et le focus revient sur le bouton « À propos »', async () => {
    const ecran = monter()
    await ouvrir(ecran)
    const fermer = Array.from(panneau()!.querySelectorAll('button')).find(
      (bouton) => bouton.textContent?.trim() === 'Fermer',
    )!
    fermer.click()
    await flushPromises()
    expect(panneau()).toBeNull()
    expect(document.activeElement?.id).toBe('bouton-a-propos')
    ecran.unmount()
  })

  it('se ferme avec la touche Échap', async () => {
    const ecran = monter()
    await ouvrir(ecran)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(panneau()).toBeNull()
    expect(document.activeElement?.id).toBe('bouton-a-propos')
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
