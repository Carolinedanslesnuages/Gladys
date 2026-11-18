/**
 * Données enregistrées sur l'appareil (localStorage) : l'application fonctionne sans réseau.
 * Rien ne quitte l'appareil. Si le stockage est indisponible (navigation privée stricte), on le dit.
 */
const PREFIXE = 'gladys:'
/** Préfixe d'avant le changement de nom : ses données sont reprises puis effacées. */
const ANCIEN_PREFIXE = 'leon:'

/** Reprend sous le nouveau nom une donnée enregistrée sous l'ancien, sans rien perdre. */
function reprendreAncienneDonnee(cle: string): string | null {
  const ancienneValeur = window.localStorage.getItem(ANCIEN_PREFIXE + cle)
  if (ancienneValeur === null) return null
  try {
    window.localStorage.setItem(PREFIXE + cle, ancienneValeur)
    window.localStorage.removeItem(ANCIEN_PREFIXE + cle)
  } catch {
    // Appareil plein : l'ancienne donnée reste en place et sera reprise plus tard.
  }
  return ancienneValeur
}

export function lire<T>(cle: string, valeurParDefaut: T): T {
  try {
    const brut = window.localStorage.getItem(PREFIXE + cle) ?? reprendreAncienneDonnee(cle)
    return brut === null ? valeurParDefaut : (JSON.parse(brut) as T)
  } catch {
    return valeurParDefaut
  }
}

/** Faux si l'appareil refuse d'enregistrer (stockage plein ou désactivé). */
export function ecrire<T>(cle: string, valeur: T): boolean {
  try {
    window.localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur))
    return true
  } catch {
    return false
  }
}
