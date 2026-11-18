/**
 * Voix de l'appareil (synthèse vocale du navigateur) pour dire les consignes. Seules les voix
 * françaises installées sur l'appareil sont utilisées : elles marchent sans réseau, et rien n'est
 * envoyé en ligne. Décision : docs/adr/0015-consignes-de-conduite.md.
 */

/** À cette distance du virage (en mètres), la consigne est dite à voix haute. */
export const DISTANCE_D_ANNONCE_METRES = 200

export type ResultatDeLAnnonce = 'dite' | 'voix-absente'

const estFrancaise = (voix: SpeechSynthesisVoice): boolean => voix.lang.toLowerCase().startsWith('fr')

/** Arrête aussitôt la consigne en train d'être dite, s'il y en a une. */
export function taireLaVoix(): void {
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
}

/**
 * Dit la phrase avec une voix française de l'appareil. `voix-absente` si le téléphone n'en a pas
 * (ou pas de synthèse vocale du tout) : à l'appelant d'en informer l'utilisateur.
 */
export function direALaVoix(phrase: string): ResultatDeLAnnonce {
  const synthese = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  if (!synthese || typeof SpeechSynthesisUtterance === 'undefined') return 'voix-absente'
  const voixInstallees = synthese.getVoices()
  const voixLocale = voixInstallees.filter(estFrancaise).find((voix) => voix.localService)
  // Liste vide : certains navigateurs ne l'ont pas encore chargée ; on laisse l'appareil choisir en fr-FR.
  if (voixInstallees.length > 0 && !voixLocale) return 'voix-absente'
  const enonce = new SpeechSynthesisUtterance(phrase)
  enonce.lang = 'fr-FR'
  if (voixLocale) enonce.voice = voixLocale
  synthese.cancel()
  synthese.speak(enonce)
  return 'dite'
}
