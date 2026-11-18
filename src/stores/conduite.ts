import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { consigneALaPosition, consignesDisponibles } from '@/services/consignes'
import { PositionRefusee, suivrePosition, type Coordonnees } from '@/services/position'
import { useItineraireStore } from '@/stores/itineraire'

/** Où en est le suivi : pas lancé, en attente de la première position, en cours, ou en échec. */
export type EtatDuSuivi = 'arret' | 'attente' | 'en-cours' | 'refuse' | 'indisponible'

/**
 * Le trajet en cours de conduite : le suivi de la position et la consigne à afficher. La position
 * reste en mémoire sur l'appareil : elle n'est ni enregistrée ni envoyée. Partagé entre
 * l'écran de préparation (bouton « Démarrer le trajet ») et l'écran de conduite.
 */
export const useConduiteStore = defineStore('conduite', () => {
  const etat = ref<EtatDuSuivi>('arret')
  const position = ref<Coordonnees | null>(null)
  /** Vrai : le trajet n'a pas ses consignes (enregistré avant leur arrivée) ; il faut le recalculer. */
  const consignesAbsentes = ref(false)
  let arreterLeSuivi: (() => void) | null = null

  const consigne = computed(() => {
    const resultat = useItineraireStore().resultat
    if (!resultat || !position.value) return null
    return consigneALaPosition(position.value, resultat.itineraire.etapes, resultat.itineraire.trace)
  })

  function arreter(): void {
    arreterLeSuivi?.()
    arreterLeSuivi = null
    etat.value = 'arret'
    position.value = null
  }

  /** Lance le suivi de la position pour le trajet affiché. Sans trajet ou sans consignes, rien ne démarre. */
  function demarrer(): void {
    arreter()
    const resultat = useItineraireStore().resultat
    consignesAbsentes.value = Boolean(resultat) && !consignesDisponibles(resultat!.itineraire.etapes)
    if (!resultat || consignesAbsentes.value) return
    etat.value = 'attente'
    arreterLeSuivi = suivrePosition(
      (nouvellePosition) => {
        position.value = nouvellePosition
        etat.value = 'en-cours'
      },
      (erreur) => {
        arreterLeSuivi?.()
        arreterLeSuivi = null
        etat.value = erreur instanceof PositionRefusee ? 'refuse' : 'indisponible'
      },
    )
  }

  return { etat, position, consigne, consignesAbsentes, demarrer, reessayer: demarrer, arreter }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useConduiteStore, import.meta.hot))
