import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Bouton from '../Bouton.vue'
import ChampSaisie from '../ChampSaisie.vue'
import Alerte from '../Alerte.vue'
import GroupeRadios from '../GroupeRadios.vue'
import { violationsAccessibilite } from '@/__tests__/accessibilite'

describe('Composants maison de GLADYS', () => {
  it('un bouton a toujours un intitulé visible, même avec une icône', () => {
    const bouton = mount(Bouton, { props: { label: 'Zoomer', icone: 'zoomPlus' } })
    expect(bouton.text()).toBe('Zoomer')
    expect(bouton.element.tagName).toBe('BUTTON')
    expect(bouton.find('svg').attributes('aria-hidden')).toBe('true')
  })

  it('un champ relie son étiquette, son aide et son erreur au champ', async () => {
    const champ = mount(ChampSaisie, {
      props: { id: 'nom', label: 'Nom', indication: 'Une aide', messageErreur: 'Obligatoire' },
      attachTo: document.body,
    })
    const saisie = champ.find('input')
    expect(champ.find('label').attributes('for')).toBe('nom')
    expect(saisie.attributes('aria-invalid')).toBe('true')
    expect(saisie.attributes('aria-describedby')).toBe('nom-indication nom-message')
    expect(champ.find('#nom-message').text()).toContain('Obligatoire')
    await saisie.setValue('Maison')
    expect(champ.emitted('update:modelValue')?.[0]).toEqual(['Maison'])
    expect(await violationsAccessibilite(document.body)).toEqual([])
    champ.unmount()
  })

  it('une alerte se lit par son icône et son texte, sans erreur d’accessibilité', async () => {
    const alerte = mount(Alerte, { props: { type: 'warning', description: 'Attention' }, attachTo: document.body })
    expect(alerte.text()).toBe('Attention')
    expect(alerte.find('svg').exists()).toBe(true)
    expect(await violationsAccessibilite(document.body)).toEqual([])
    alerte.unmount()
  })

  it('un groupe de choix a une légende, des étiquettes liées, et annonce le choix', async () => {
    const groupe = mount(GroupeRadios, {
      props: {
        name: 'choix',
        legend: 'Mon choix',
        modelValue: 'a',
        options: [
          { label: 'Un', value: 'a' },
          { label: 'Deux', value: 'b', hint: 'Plus lent' },
        ],
      },
      attachTo: document.body,
    })
    expect(groupe.find('legend').text()).toBe('Mon choix')
    expect(groupe.find<HTMLInputElement>('#choix-a').element.checked).toBe(true)
    await groupe.find('#choix-b').setValue(true)
    expect(groupe.emitted('update:modelValue')?.[0]).toEqual(['b'])
    expect(await violationsAccessibilite(document.body)).toEqual([])
    groupe.unmount()
  })
})
