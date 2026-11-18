<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ChampLieu from '@/components/ChampLieu.vue'
import { ErreurReseau, lieuLePlusProche, type Lieu } from '@/services/adresses'
import { PositionRefusee, positionActuelle } from '@/services/position'
import { NOMBRE_DE_TRAJETS_GARDES, useTrajetsStore, type Trajet } from '@/stores/trajets'
import { SEUILS_DE_DETOUR, useItineraireStore } from '@/stores/itineraire'
import { useDureeStore } from '@/stores/duree'
import {
  VITESSE_MAXIMALE_KMH,
  VITESSE_MINIMALE_KMH,
  formaterDuree,
  formaterEcartDeDuree,
  formaterHeure,
  vitesseValide,
} from '@/services/duree'

const magasinTrajets = useTrajetsStore()
const { accord, trajetsRecents, erreur: erreurEnregistrement } = storeToRefs(magasinTrajets)

const magasinItineraire = useItineraireStore()
const { seuilDetour, resultat, calculEnCours, erreur: erreurItineraire } = storeToRefs(magasinItineraire)
const optionsDeDetour = SEUILS_DE_DETOUR.map((seuil) => ({
  label: `${seuil} % de distance en plus au maximum`,
  value: seuil,
}))

const depart = ref<Lieu | null>(null)
const arrivee = ref<Lieu | null>(null)
const erreurDepart = ref('')
const erreurArrivee = ref('')
const positionEnCours = ref(false)
const annonce = ref('')
const trajetEnAttenteDAccord = ref<{ depart: Lieu; arrivee: Lieu } | null>(null)
const confirmationEffacement = ref(false)
const titreQuestionAccord = ref<HTMLElement | null>(null)
const questionEffacement = ref<HTMLElement | null>(null)
const titreTrajetsRecents = ref<HTMLElement | null>(null)

// Réseau : la recherche d'adresse et la position en ont besoin, pas les trajets récents.
const enLigne = ref(navigator.onLine)
const suivreLeReseau = () => (enLigne.value = navigator.onLine)
onMounted(() => {
  window.addEventListener('online', suivreLeReseau)
  window.addEventListener('offline', suivreLeReseau)
})
onUnmounted(() => {
  window.removeEventListener('online', suivreLeReseau)
  window.removeEventListener('offline', suivreLeReseau)
})

// Un itinéraire calculé ne vaut que pour le départ et l'arrivée qui l'ont produit.
watch([depart, arrivee], () => magasinItineraire.oublier())

const enKilometres = (metres: number) => `${(metres / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`

const annonceItineraire = computed(() => {
  if (calculEnCours.value) return 'Calcul de votre itinéraire…'
  if (!resultat.value) return ''
  const { itineraire } = resultat.value
  const departementale =
    itineraire.departementaleMetres > 0
      ? `dont ${enKilometres(itineraire.departementaleMetres)} sur départementale`
      : 'sans départementale'
  return `Itinéraire calculé : ${enKilometres(itineraire.distanceMetres)}, sans autoroute ni voie rapide, ${departementale}.`
})

// Durée et heure d'arrivée : recalculées sur l'appareil, même sans réseau.
const magasinDuree = useDureeStore()
const { vitesseHabituelle, heureDepart, dureeMinutes, dureePlusCourtMinutes, erreur: erreurDuree } = storeToRefs(magasinDuree)
const vitesseSaisie = ref(String(vitesseHabituelle.value))
const erreurVitesse = ref('')
const heureMaintenant = () => {
  const maintenant = new Date()
  return `${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`
}

// Un nouvel itinéraire part « maintenant » par défaut.
watch(resultat, (nouveauResultat) => {
  if (nouveauResultat) magasinDuree.choisirHeureDepart(heureMaintenant())
})

function saisirVitesse(valeur: string | number | undefined): void {
  vitesseSaisie.value = String(valeur ?? '')
  const vitesse = vitesseValide(vitesseSaisie.value)
  if (vitesse === null) {
    erreurVitesse.value = `Indiquez une vitesse entre ${VITESSE_MINIMALE_KMH} et ${VITESSE_MAXIMALE_KMH} km/h, par exemple 40.`
    return
  }
  erreurVitesse.value = ''
  magasinDuree.choisirVitesse(vitesse)
}

const horairesEstimes = computed(() => {
  const horaires = magasinDuree.horaires(new Date())
  if (!horaires || dureeMinutes.value === null) return null
  return {
    duree: formaterDuree(dureeMinutes.value),
    arrivee: formaterHeure(horaires.arrivee, horaires.depart),
  }
})

const annonceDuree = computed(() =>
  horairesEstimes.value
    ? `Durée estimée : ${horairesEstimes.value.duree}, arrivée vers ${horairesEstimes.value.arrivee}.`
    : '',
)

// Comparaison avec le trajet le plus court, à la même vitesse de VSP.
const ecartDeDistance = (metresRetenu: number, metresPlusCourt: number) => {
  const ecartMetres = metresRetenu - metresPlusCourt
  if (Math.abs(ecartMetres) < 50) return 'même distance'
  return `${enKilometres(Math.abs(ecartMetres))} de ${ecartMetres > 0 ? 'plus' : 'moins'}`
}

const comparaison = computed(() => {
  if (!resultat.value || dureeMinutes.value === null || dureePlusCourtMinutes.value === null) return null
  if (resultat.value.retenuEstLePlusCourt) {
    return { dejaLePlusCourt: true, annonce: 'Votre trajet est déjà le trajet le plus court sans autoroute.' }
  }
  const plusCourt = {
    distance: enKilometres(resultat.value.plusCourt.distanceMetres),
    duree: formaterDuree(dureePlusCourtMinutes.value),
  }
  const ecart = `${formaterEcartDeDuree(dureeMinutes.value, dureePlusCourtMinutes.value)}, ${ecartDeDistance(
    resultat.value.itineraire.distanceMetres,
    resultat.value.plusCourt.distanceMetres,
  )}`
  return {
    dejaLePlusCourt: false,
    plusCourt,
    ecart,
    annonce: `Trajet le plus court : ${plusCourt.distance}, ${plusCourt.duree}. Votre trajet : ${ecart}.`,
  }
})

async function calculerMonItineraire(): Promise<void> {
  if (!depart.value || !arrivee.value || !enLigne.value) return
  await magasinItineraire.calculer(depart.value, arrivee.value)
}

const descriptionTrajet = (lieuDepart: Lieu, lieuArrivee: Lieu) => `de ${lieuDepart.libelle} à ${lieuArrivee.libelle}`

async function utiliserMaPosition(): Promise<void> {
  erreurDepart.value = ''
  positionEnCours.value = true
  annonce.value = 'Recherche de votre position…'
  try {
    const coordonnees = await positionActuelle()
    const lieuProche = await lieuLePlusProche(coordonnees.latitude, coordonnees.longitude)
    if (lieuProche) {
      depart.value = lieuProche
      annonce.value = `Départ rempli avec votre position actuelle : ${lieuProche.libelle}.`
    } else {
      annonce.value = ''
      erreurDepart.value = 'Aucune adresse connue près de votre position. Saisissez votre départ.'
    }
  } catch (erreur) {
    annonce.value = ''
    if (erreur instanceof PositionRefusee) {
      erreurDepart.value =
        'Position refusée : autorisez la localisation pour GLADYS dans les réglages du téléphone, ou saisissez votre départ.'
    } else if (erreur instanceof ErreurReseau) {
      erreurDepart.value = 'Trouver l’adresse de votre position a besoin du réseau. Saisissez votre départ plus tard.'
    } else {
      erreurDepart.value = 'Votre position est introuvable pour le moment. Réessayez, ou saisissez votre départ.'
    }
  } finally {
    positionEnCours.value = false
  }
}

async function validerTrajet(): Promise<void> {
  erreurDepart.value = depart.value ? '' : 'Choisissez votre départ dans la liste des propositions.'
  erreurArrivee.value = arrivee.value ? '' : 'Choisissez votre arrivée dans la liste des propositions.'
  if (!depart.value || !arrivee.value) {
    document.getElementById(depart.value ? 'arrivee' : 'depart')?.focus()
    return
  }
  annonce.value = `Trajet prêt : ${descriptionTrajet(depart.value, arrivee.value)}.`
  if (accord.value === null) {
    trajetEnAttenteDAccord.value = { depart: depart.value, arrivee: arrivee.value }
    await nextTick()
    titreQuestionAccord.value?.focus()
    return
  }
  magasinTrajets.retenirTrajet(depart.value, arrivee.value)
}

async function repondreAccord(choix: 'accepte' | 'refuse'): Promise<void> {
  magasinTrajets.choisirAccord(choix)
  if (choix === 'accepte' && trajetEnAttenteDAccord.value) {
    magasinTrajets.retenirTrajet(trajetEnAttenteDAccord.value.depart, trajetEnAttenteDAccord.value.arrivee)
  }
  trajetEnAttenteDAccord.value = null
  annonce.value =
    choix === 'accepte'
      ? 'Vos 5 derniers trajets seront gardés sur ce téléphone.'
      : 'Vos trajets ne seront pas gardés sur ce téléphone.'
  await nextTick()
  titreTrajetsRecents.value?.focus()
}

function reprendre(trajet: Trajet): void {
  depart.value = trajet.depart
  arrivee.value = trajet.arrivee
  erreurDepart.value = ''
  erreurArrivee.value = ''
  annonce.value = `Trajet repris : ${descriptionTrajet(trajet.depart, trajet.arrivee)}.`
}

async function demanderEffacement(): Promise<void> {
  confirmationEffacement.value = true
  await nextTick()
  questionEffacement.value?.focus()
}

async function effacer(confirme: boolean): Promise<void> {
  if (confirme) {
    magasinTrajets.effacerTrajets()
    annonce.value = 'Vos trajets récents sont effacés de ce téléphone.'
  }
  confirmationEffacement.value = false
  await nextTick()
  titreTrajetsRecents.value?.focus()
}
</script>

<template>
  <h1>Préparer mon trajet</h1>
  <p>Indiquez d’où vous partez et où vous allez. Les champs marqués d’un astérisque (*) sont obligatoires.</p>

  <DsfrAlert
    v-if="!enLigne"
    type="info"
    small
    class="fr-mb-3w"
    description="Sans réseau, la recherche d’adresse et la position actuelle sont indisponibles. Vos trajets récents restent utilisables."
  />

  <form novalidate class="fr-mb-4w" @submit.prevent="validerTrajet">
    <ChampLieu id="depart" v-model="depart" label="Départ" :en-ligne="enLigne" :erreur-externe="erreurDepart" />
    <DsfrButton
      type="button"
      secondary
      size="lg"
      icon="fr-icon-map-pin-2-line"
      class="fr-mb-4w"
      :label="positionEnCours ? 'Recherche de votre position…' : 'Utiliser ma position actuelle'"
      :disabled="!enLigne || positionEnCours"
      @click="utiliserMaPosition"
    />
    <ChampLieu id="arrivee" v-model="arrivee" label="Arrivée" :en-ligne="enLigne" :erreur-externe="erreurArrivee" />
    <DsfrButton type="submit" size="lg" label="Valider mon trajet" icon="fr-icon-check-line" />
  </form>

  <p id="annonce-trajet" role="status" class="fr-sr-only">{{ annonce }}</p>

  <section v-if="depart && arrivee" class="fr-mb-4w" aria-labelledby="titre-itineraire">
    <h2 id="titre-itineraire" class="fr-h5">Mon itinéraire</h2>
    <p>Il ne passe jamais par une autoroute ni une voie rapide.</p>
    <DsfrRadioButtonSet
      name="seuil-detour"
      legend="Détour accepté pour éviter les départementales"
      hint="Votre choix reste gardé sur ce téléphone."
      :model-value="seuilDetour"
      :options="optionsDeDetour"
      @update:model-value="(nouveauSeuil: string | number | boolean | undefined) => magasinItineraire.choisirSeuil(Number(nouveauSeuil))"
    />
    <p v-if="!enLigne" class="fr-mb-2w">Le calcul d’itinéraire a besoin du réseau. Il sera possible dès son retour.</p>
    <DsfrButton
      type="button"
      size="lg"
      icon="fr-icon-road-map-line"
      :label="calculEnCours ? 'Calcul de votre itinéraire…' : 'Calculer mon itinéraire'"
      :disabled="!enLigne || calculEnCours"
      @click="calculerMonItineraire"
    />

    <div id="resultat-itineraire" role="status" class="fr-mt-3w">
      <DsfrAlert v-if="erreurItineraire" type="error" small :description="erreurItineraire" />
      <template v-if="resultat">
        <DsfrAlert
          v-if="!resultat.sansDepartementalePossible"
          type="warning"
          small
          class="fr-mb-2w"
          description="Aucun itinéraire sans départementale n’existe pour ce trajet. Voici le trajet le plus sûr, avec le moins de départementale possible."
        />
        <DsfrAlert
          v-else-if="resultat.detourTropLong"
          type="info"
          small
          class="fr-mb-2w"
          :description="`Un trajet sans départementale existe, mais son détour dépasse ${seuilDetour} %. Voici le trajet le plus court sans autoroute.`"
        />
        <dl class="fr-mb-0">
          <dt>Distance totale</dt>
          <dd>{{ enKilometres(resultat.itineraire.distanceMetres) }}</dd>
          <dt>Sur départementale</dt>
          <dd v-if="resultat.itineraire.departementaleMetres > 0">
            {{ enKilometres(resultat.itineraire.departementaleMetres) }}
          </dd>
          <dd v-else>Aucun kilomètre : trajet sans départementale</dd>
        </dl>
      </template>
      <p class="fr-sr-only">{{ annonceItineraire }}</p>
    </div>

    <template v-if="horairesEstimes">
      <h3 class="fr-h6 fr-mt-3w">Mon temps de trajet</h3>
      <dl id="duree-trajet" class="fr-mb-2w duree-et-arrivee">
        <div>
          <dt>Durée estimée</dt>
          <dd>{{ horairesEstimes.duree }}</dd>
        </div>
        <div>
          <dt>Arrivée estimée</dt>
          <dd>vers {{ horairesEstimes.arrivee }}</dd>
        </div>
      </dl>
      <p id="annonce-duree" role="status" class="fr-sr-only">{{ annonceDuree }}</p>
      <p class="fr-text--sm">
        Calculée à {{ vitesseHabituelle.toLocaleString('fr-FR') }} km/h au plus, et moins vite si la route est plus lente.
      </p>
      <DsfrInputGroup
        id="vitesse-habituelle"
        :model-value="vitesseSaisie"
        label="Ma vitesse moyenne habituelle, en km/h"
        label-visible
        :hint="`Entre ${VITESSE_MINIMALE_KMH} et ${VITESSE_MAXIMALE_KMH} km/h. Elle reste gardée sur ce téléphone.`"
        :error-message="erreurVitesse || erreurDuree || undefined"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        @update:model-value="saisirVitesse"
      />
      <DsfrInputGroup
        id="heure-depart"
        :model-value="heureDepart"
        label="Mon heure de départ"
        label-visible
        hint="Par défaut : maintenant. Vide : départ maintenant."
        type="time"
        @update:model-value="(heureSaisie: string | number | undefined) => magasinDuree.choisirHeureDepart(String(heureSaisie ?? ''))"
      />
    </template>

    <template v-if="comparaison">
      <h3 class="fr-h6 fr-mt-3w">Comparer avec le trajet le plus court</h3>
      <div id="comparaison-trajet" class="fr-mb-2w">
        <p v-if="comparaison.dejaLePlusCourt">{{ comparaison.annonce }}</p>
        <dl v-else class="fr-mb-0">
          <dt>Trajet le plus court sans autoroute</dt>
          <dd>{{ comparaison.plusCourt?.distance }}, {{ comparaison.plusCourt?.duree }}</dd>
          <dt>Votre trajet par rapport à lui</dt>
          <dd>{{ comparaison.ecart }}</dd>
        </dl>
      </div>
      <p id="annonce-comparaison" role="status" class="fr-sr-only">{{ comparaison.annonce }}</p>
    </template>

    <template v-if="resultat && resultat.itineraire.etapes.length > 0">
      <h3 id="titre-etapes" class="fr-h6 fr-mt-3w">Les étapes de mon trajet</h3>
      <ol id="etapes-trajet" class="etapes" aria-labelledby="titre-etapes">
        <li v-for="(etape, rang) in resultat.itineraire.etapes" :key="rang" class="fr-mb-1w">
          <strong>{{ etape.commune ?? 'Commune non précisée' }}</strong> — {{ etape.route }} —
          {{ enKilometres(etape.distanceMetres) }}
          <DsfrBadge v-if="etape.departementale" label="Départementale" type="warning" small class="fr-ml-1w" />
        </li>
      </ol>
    </template>
  </section>
  <DsfrAlert v-if="erreurEnregistrement" type="error" small :description="erreurEnregistrement" class="fr-mb-2w" />

  <section v-if="trajetEnAttenteDAccord" class="fr-mb-4w fr-p-3w question-accord" aria-labelledby="titre-accord">
    <h2 id="titre-accord" ref="titreQuestionAccord" tabindex="-1" class="fr-h5">
      Garder mes {{ NOMBRE_DE_TRAJETS_GARDES }} derniers trajets sur ce téléphone ?
    </h2>
    <p>
      Vous pourrez les reprendre d’un geste, même sans réseau. Ils restent sur ce téléphone et vous pouvez les effacer à
      tout moment.
    </p>
    <div class="fr-btns-group fr-btns-group--inline-sm">
      <DsfrButton type="button" size="lg" label="Oui, garder mes trajets" @click="repondreAccord('accepte')" />
      <DsfrButton type="button" size="lg" secondary label="Non, ne rien garder" @click="repondreAccord('refuse')" />
    </div>
  </section>

  <h2 id="titre-trajets-recents" ref="titreTrajetsRecents" tabindex="-1" class="fr-h5">Mes trajets récents</h2>
  <template v-if="accord === 'accepte'">
    <p v-if="trajetsRecents.length === 0">Aucun trajet récent pour l’instant.</p>
    <template v-else>
      <ul class="fr-p-0 trajets-recents" aria-labelledby="titre-trajets-recents">
        <li v-for="trajet in trajetsRecents" :key="trajet.valideLe" class="fr-mb-1w">
          <DsfrButton
            type="button"
            tertiary
            size="lg"
            class="trajet-recent"
            :label="`De ${trajet.depart.libelle} à ${trajet.arrivee.libelle}`"
            :aria-label="`Reprendre le trajet ${descriptionTrajet(trajet.depart, trajet.arrivee)}`"
            @click="reprendre(trajet)"
          />
        </li>
      </ul>
      <div v-if="confirmationEffacement">
        <p ref="questionEffacement" tabindex="-1">Effacer tous vos trajets récents de ce téléphone ?</p>
        <div class="fr-btns-group fr-btns-group--inline-sm">
          <DsfrButton type="button" size="lg" label="Oui, effacer mes trajets récents" @click="effacer(true)" />
          <DsfrButton type="button" size="lg" secondary label="Annuler" @click="effacer(false)" />
        </div>
      </div>
      <DsfrButton
        v-else
        type="button"
        secondary
        size="lg"
        icon="fr-icon-delete-line"
        label="Effacer mes trajets récents"
        @click="demanderEffacement"
      />
    </template>
  </template>
  <template v-else-if="accord === 'refuse'">
    <p>Vos trajets ne sont pas gardés sur ce téléphone.</p>
    <DsfrButton type="button" secondary size="lg" label="Garder désormais mes trajets récents" @click="repondreAccord('accepte')" />
  </template>
  <p v-else>Après votre premier trajet, nous vous demanderons si vous voulez garder vos trajets récents sur ce téléphone.</p>
</template>

<style scoped>
dt {
  font-weight: 700;
}
dd {
  margin: 0 0 1rem;
}
.duree-et-arrivee {
  display: flex;
  flex-wrap: wrap;
  gap: 0 2rem;
}
.etapes {
  overflow-wrap: anywhere;
}
.question-accord {
  border: 1px solid var(--border-default-grey);
}
.trajets-recents {
  list-style: none;
}
.trajet-recent {
  width: 100%;
  text-align: left;
}
</style>
