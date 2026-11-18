<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import ChampLieu from '@/components/ChampLieu.vue'
import { ErreurReseau, lieuLePlusProche, type Lieu } from '@/services/adresses'
import { PositionRefusee, positionActuelle } from '@/services/position'
import { NOMBRE_DE_TRAJETS_GARDES, useTrajetsStore, type Trajet } from '@/stores/trajets'

const magasinTrajets = useTrajetsStore()
const { accord, trajetsRecents, erreur: erreurEnregistrement } = storeToRefs(magasinTrajets)

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
        'Position refusée : autorisez la localisation pour LÉON dans les réglages du téléphone, ou saisissez votre départ.'
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
