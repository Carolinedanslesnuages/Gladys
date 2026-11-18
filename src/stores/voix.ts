import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { ecrire, lire } from '@/services/stockage'
import { taireLaVoix } from '@/services/voix'

export const MESSAGE_STOCKAGE_VOIX_PLEIN =
  'L’appareil n’a pas pu enregistrer votre choix pour la voix : la voix reste ainsi pour ce trajet seulement.'

/**
 * Voix des consignes active ou coupée. Le choix est gardé sur l'appareil pour le prochain trajet ;
 * par défaut, la voix est active. Partagé entre l'écran de conduite (bouton) et l'annonce des consignes.
 */
export const useVoixStore = defineStore('voix', () => {
  const active = ref<boolean>(lire<boolean>('voix-active', true) !== false)
  const erreur = ref<string | null>(null)

  /** Coupe la voix si elle est active (et arrête la consigne en cours), la remet sinon. */
  function basculer(): void {
    active.value = !active.value
    if (!active.value) taireLaVoix()
    erreur.value = ecrire('voix-active', active.value) ? null : MESSAGE_STOCKAGE_VOIX_PLEIN
  }

  return { active, erreur, basculer }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useVoixStore, import.meta.hot))
