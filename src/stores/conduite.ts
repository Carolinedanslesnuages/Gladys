import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { consigneALaPosition, consignesDisponibles, phraseAnnoncee } from '@/services/consignes'
import { DISTANCE_D_ANNONCE_METRES, direALaVoix } from '@/services/voix'
import { PositionRefusee, suivrePosition, type Coordonnees } from '@/services/position'
import { useItineraireStore } from '@/stores/itineraire'
import { useVoixStore } from '@/stores/voix'

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
  /** Vrai : l'appareil n'a pas de voix française ; les consignes restent à l'écran, sans voix. */
  const voixAbsente = ref(false)
  /** Seule mémoire de la voix : la dernière consigne dite (étape et texte), pour ne pas la répéter. */
  let derniereConsigneDite: string | null = null
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
    derniereConsigneDite = null
    voixAbsente.value = false
  }

  /** Dit la consigne une seule fois, quand le virage est à 200 m ou moins. */
  function annoncerLaConsigne(): void {
    const consigneCourante = consigne.value
    if (!consigneCourante || consigneCourante.distanceMetres > DISTANCE_D_ANNONCE_METRES) return
    // Voix coupée : rien n'est dit ; la consigne sera dite si la voix est remise avant le virage.
    if (!useVoixStore().active) {
      voixAbsente.value = false
      return
    }
    const identifiant = `${consigneCourante.rangEtape}|${consigneCourante.texte}`
    if (identifiant === derniereConsigneDite) return
    derniereConsigneDite = identifiant
    voixAbsente.value = direALaVoix(phraseAnnoncee(consigneCourante)) === 'voix-absente'
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
        annoncerLaConsigne()
      },
      (erreur) => {
        arreterLeSuivi?.()
        arreterLeSuivi = null
        etat.value = erreur instanceof PositionRefusee ? 'refuse' : 'indisponible'
      },
    )
  }

  return { etat, position, consigne, consignesAbsentes, voixAbsente, demarrer, reessayer: demarrer, arreter }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useConduiteStore, import.meta.hot))
