import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Demande #33 : GLADYS a sa propre apparence, sans le système de design de l'État (DSFR). */

const feuilleDeStyle = readFileSync('src/styles/gladys.css', 'utf8')

function valeurDeLaCouleur(nom: string): string {
  const correspondance = feuilleDeStyle.match(new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6})`))
  if (!correspondance) throw new Error(`Couleur --${nom} introuvable`)
  return correspondance[1]!
}

function luminance(couleur: string): number {
  const [rouge, vert, bleu] = [1, 3, 5].map((debut) => {
    const canal = parseInt(couleur.slice(debut, debut + 2), 16) / 255
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rouge! + 0.7152 * vert! + 0.0722 * bleu!
}

function contraste(premiere: string, seconde: string): number {
  const [claire, foncee] = [luminance(premiere), luminance(seconde)].sort((gauche, droite) => droite - gauche)
  return (claire! + 0.05) / (foncee! + 0.05)
}

function fichiersDuProjet(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) return fichiersDuProjet(chemin)
    return /\.(vue|ts|css)$/.test(entree.name) ? [chemin] : []
  })
}

describe('Demande #33 : apparence propre à GLADYS, sans DSFR', () => {
  it('la couleur principale est le vert route #1F7A4D', () => {
    expect(valeurDeLaCouleur('vert-route').toLowerCase()).toBe('#1f7a4d')
  })

  it('le DSFR n’est plus une dépendance ; projet d’ADA studio, sans apparence imposée', () => {
    const dependances = JSON.parse(readFileSync('package.json', 'utf8')).dependencies as Record<string, string>
    expect(Object.keys(dependances).filter((nom) => /dsfr/i.test(nom))).toEqual([])
    const ada = JSON.parse(readFileSync('ada.json', 'utf8'))
    expect(ada.edition).toBe('studio')
    expect(ada.dsfr).toBeUndefined()
  })

  it('aucun fichier du code n’utilise un composant, une classe fr-… ou la police du DSFR', () => {
    const interdits = /[Dd]sfr|@gouvfr|@gouvminint|[Mm]arianne|\bfr-[a-z]|--background-default-grey/
    const fichiersFautifs = [...fichiersDuProjet('src'), 'index.html', 'vite.config.ts']
      .filter((chemin) => !chemin.endsWith('apparence.spec.ts'))
      .filter((chemin) => interdits.test(readFileSync(chemin, 'utf8')))
    expect(fichiersFautifs).toEqual([])
  })

  it('la police est celle du système', () => {
    expect(feuilleDeStyle).toMatch(/--police:\s*system-ui/)
  })

  it.each([
    ['texte', 'fond'],
    ['texte-discret', 'fond'],
    ['vert-route', 'fond'],
    ['vert-route-fonce', 'vert-route-pale'],
    ['vert-route-fonce', 'fond'],
    ['erreur', 'fond'],
    ['attention-texte', 'attention-pale'],
    ['bordure', 'fond'],
  ])('contraste de %s sur %s : au moins 4,5:1', (texte, fond) => {
    expect(contraste(valeurDeLaCouleur(texte), valeurDeLaCouleur(fond))).toBeGreaterThanOrEqual(4.5)
  })

  it('le texte blanc sur le vert route (boutons principaux) est contrasté au moins 4,5:1', () => {
    expect(contraste('#ffffff', valeurDeLaCouleur('vert-route'))).toBeGreaterThanOrEqual(4.5)
  })

  it('les boutons et les champs font au moins 44 px de haut', () => {
    expect(feuilleDeStyle).toContain('--cible-minimale: 2.75rem')
    for (const composant of ['Bouton', 'ChampSaisie']) {
      expect(readFileSync(`src/components/interface/${composant}.vue`, 'utf8')).toContain('min-height: var(--cible-minimale)')
    }
  })
})
