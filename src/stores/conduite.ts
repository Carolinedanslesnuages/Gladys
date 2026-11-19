import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { consigneALaPosition, consignesDisponibles, phraseAnnoncee } from '@/services/consignes'
import { DISTANCE_D_ANNONCE_METRES, direALaVoix } from '@/services/voix'
import { PositionRefusee, suivrePosition, type Coordonnees } from '@/services/position'
import { avancementSurLeTrace } from '@/services/guidage'
import { remplacerLeDebutDuTrajet, villageSuivant, type VillageSuivant } from '@/services/recalcul'
import type { ResultatItineraire } from '@/services/itineraire'
import { useItineraireStore } from '@/stores/itineraire'
import { useVoixStore } from '@/stores/voix'

/** Où en est le suivi : pas lancé, en attente de la première position, en cours, ou en échec. */
export type EtatDuSuivi = 'arret' | 'attente' | 'en-cours' | 'refuse' | 'indisponible'

/**
 * Où en est le recalcul du chemin après une sortie du trajet : rien, calcul en cours, nouveau chemin
 * pris, chemin le plus sûr à accepter (aucun n'évite les départementales), ou réseau absent.
 */
export type EtatDuRecalcul = 'aucun' | 'en-cours' | 'refait' | 'a-accepter' | 'sans-reseau'

/** Positions de suite hors du trajet avant de le dire : évite les fausses alertes d'un GPS imprécis. */
export const POSITIONS_HORS_TRAJET_AVANT_ALERTE = 3

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
  /** Le recalcul : son état, le village visé, et le chemin le plus sûr proposé en attendant l'accord. */
  const recalcul = ref<EtatDuRecalcul>('aucun')
  const villageVise = ref<string | null>(null)
  const cheminPropose = ref<{ resultat: ResultatItineraire; village: VillageSuivant } | null>(null)
  let positionsDeSuiteHorsDuTrajet = 0
  /** Change à chaque arrêt : un calcul qui répond après l'arrêt est ignoré. */
  let numeroDeSuivi = 0

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
    numeroDeSuivi += 1
    recalcul.value = 'aucun'
    villageVise.value = null
    cheminPropose.value = null
    positionsDeSuiteHorsDuTrajet = 0
  }

  const dire = (phrase: string) => {
    if (useVoixStore().active) direALaVoix(phrase)
  }

  const nomDeLaDestination = (village: VillageSuivant) => village.nom ?? 'l’arrivée'

  function prendreLeChemin(nouveauChemin: ResultatItineraire, village: VillageSuivant): void {
    const magasinItineraire = useItineraireStore()
    magasinItineraire.remplacerLeTrajetSuivi(
      remplacerLeDebutDuTrajet(magasinItineraire.resultat!, nouveauChemin, village),
    )
    cheminPropose.value = null
    derniereConsigneDite = null
    positionsDeSuiteHorsDuTrajet = 0
    recalcul.value = 'refait'
    dire(`Nouveau chemin calculé vers ${nomDeLaDestination(village)}.`)
  }

  /** La personne accepte le chemin le plus sûr proposé quand aucun n'évite les départementales à fort trafic. */
  function accepterLeCheminPropose(): void {
    if (!cheminPropose.value) return
    prendreLeChemin(cheminPropose.value.resultat, cheminPropose.value.village)
  }

  /** Calcule un nouveau chemin depuis la position vers le village suivant du trajet. */
  async function recalculer(): Promise<void> {
    const magasinItineraire = useItineraireStore()
    const trajet = magasinItineraire.resultat
    const positionActuelle = position.value
    if (!trajet || !positionActuelle) return
    const village = villageSuivant(positionActuelle, trajet.itineraire.etapes, trajet.itineraire.trace)
    if (!village) return
    const suiviDuCalcul = numeroDeSuivi
    villageVise.value = village.nom
    cheminPropose.value = null
    if (!navigator.onLine) {
      recalcul.value = 'sans-reseau'
      dire('Pas de réseau : je ne peux pas recalculer votre chemin.')
      return
    }
    recalcul.value = 'en-cours'
    dire(`Vous avez quitté le trajet. Je cherche un nouveau chemin vers ${nomDeLaDestination(village)}.`)
    const pointVise = trajet.itineraire.trace[village.rangDansLeTrace]!
    try {
      const nouveauChemin = await magasinItineraire.calculerUnChemin(
        { libelle: 'Ma position', latitude: positionActuelle.latitude, longitude: positionActuelle.longitude },
        { libelle: village.nom ?? 'Arrivée', latitude: pointVise.latitude, longitude: pointVise.longitude },
      )
      if (suiviDuCalcul !== numeroDeSuivi) return
      if (nouveauChemin.sansDepartementalePossible) {
        prendreLeChemin(nouveauChemin, village)
        return
      }
      cheminPropose.value = { resultat: nouveauChemin, village }
      recalcul.value = 'a-accepter'
      dire('Aucun chemin n’évite les départementales à fort trafic. Je vous propose le plus sûr.')
    } catch {
      if (suiviDuCalcul !== numeroDeSuivi) return
      recalcul.value = 'sans-reseau'
      dire('Pas de réseau : je ne peux pas recalculer votre chemin.')
    }
  }

  /** Après plusieurs positions de suite hors du trajet, on le dit et on recalcule ; de retour sur le trajet, on s'arrête. */
  function surveillerLEcartAuTrajet(): void {
    const trajet = useItineraireStore().resultat
    const avancement = trajet && position.value ? avancementSurLeTrace(position.value, trajet.itineraire.trace) : null
    if (!avancement) return
    if (!avancement.horsDuTrajet) {
      positionsDeSuiteHorsDuTrajet = 0
      if (recalcul.value === 'a-accepter' || recalcul.value === 'sans-reseau') {
        recalcul.value = 'aucun'
        cheminPropose.value = null
      }
      return
    }
    positionsDeSuiteHorsDuTrajet += 1
    const calculPossible = recalcul.value === 'aucun' || recalcul.value === 'refait'
    if (positionsDeSuiteHorsDuTrajet >= POSITIONS_HORS_TRAJET_AVANT_ALERTE && calculPossible) void recalculer()
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
        surveillerLEcartAuTrajet()
        annoncerLaConsigne()
      },
      (erreur) => {
        arreterLeSuivi?.()
        arreterLeSuivi = null
        etat.value = erreur instanceof PositionRefusee ? 'refuse' : 'indisponible'
      },
    )
  }

  return {
    etat,
    position,
    consigne,
    consignesAbsentes,
    voixAbsente,
    recalcul,
    villageVise,
    demarrer,
    reessayer: demarrer,
    arreter,
    recalculer,
    accepterLeCheminPropose,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useConduiteStore, import.meta.hot))
