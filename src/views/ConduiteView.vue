<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import Alerte from '@/components/interface/Alerte.vue'
import Bouton from '@/components/interface/Bouton.vue'
import CarteTrajet from '@/components/CarteTrajet.vue'
import Icone, { type NomIcone } from '@/components/interface/Icone.vue'
import { distanceLisible, distanceRestanteSurLeTrace, type Consigne } from '@/services/consignes'
import { formaterDuree, formaterHeure, heureDArrivee } from '@/services/duree'
import { useConduiteStore } from '@/stores/conduite'
import { useDureeStore } from '@/stores/duree'
import { useItineraireStore } from '@/stores/itineraire'
import { useVoixStore } from '@/stores/voix'

const routeur = useRouter()
const magasinConduite = useConduiteStore()
const { etat, consigne, consignesAbsentes, voixAbsente } = storeToRefs(magasinConduite)
const { resultat } = storeToRefs(useItineraireStore())
const magasinVoix = useVoixStore()
const { active: voixActive, erreur: erreurVoix } = storeToRefs(magasinVoix)

/** Pictogramme décoratif : le texte de la consigne dit déjà le sens du virage. */
const pictogrammeDuVirage: Record<Consigne['virage'], NomIcone> = {
  droite: 'virageDroite',
  gauche: 'virageGauche',
  'tout-droit': 'toutDroit',
  'demi-tour': 'demiTour',
  arrivee: 'arrivee',
}

const trajetAbsent = computed(() => !resultat.value)

/** La carte du trajet reste visible pendant le guidage ; départ et arrivée sont les deux bouts du tracé. */
const traceDuTrajet = computed(() => resultat.value?.itineraire.trace ?? [])
const lieuDuPoint = (libelle: string, indexDuPoint: number) => {
  const trace = traceDuTrajet.value
  const point = trace[indexDuPoint < 0 ? trace.length + indexDuPoint : indexDuPoint]
  return point ? { libelle, latitude: point.latitude, longitude: point.longitude } : null
}
const departDuTrajet = computed(() => lieuDuPoint('Départ', 0))
const arriveeDuTrajet = computed(() => lieuDuPoint('Arrivée', -1))
const enLigne = ref(navigator.onLine)
const suivreLeReseau = () => (enLigne.value = navigator.onLine)
window.addEventListener('online', suivreLeReseau)
window.addEventListener('offline', suivreLeReseau)
onUnmounted(() => {
  window.removeEventListener('online', suivreLeReseau)
  window.removeEventListener('offline', suivreLeReseau)
})

/**
 * Ce qu'il reste : distance sur le tracé, durée (même vitesse que la préparation, au prorata de la
 * distance restante) et heure d'arrivée. L'heure se remet à jour chaque minute, sans réseau.
 */
const { dureeMinutes } = storeToRefs(useDureeStore())
const maintenant = ref(new Date())
const minuteurHorloge = window.setInterval(() => (maintenant.value = new Date()), 30_000)
onUnmounted(() => window.clearInterval(minuteurHorloge))
const resteDuTrajet = computed(() => {
  const position = magasinConduite.position
  const itineraire = resultat.value?.itineraire
  if (!position || !itineraire || dureeMinutes.value === null || itineraire.distanceMetres <= 0) return null
  const distanceRestante = Math.min(distanceRestanteSurLeTrace(position, itineraire.trace), itineraire.distanceMetres)
  const minutesRestantes = dureeMinutes.value * (distanceRestante / itineraire.distanceMetres)
  return {
    heure: formaterHeure(heureDArrivee(maintenant.value, minutesRestantes), maintenant.value),
    duree: formaterDuree(minutesRestantes),
    distance: distanceLisible(distanceRestante),
  }
})

/** Voix active : le son suffit. Le texte reste lu par les lecteurs d'écran mais libère la place de la carte. */
const texteMasque = computed(() => voixActive.value)

/**
 * Annonce aux lecteurs d'écran : seulement quand la consigne change, ou quand la distance change
 * de palier (pas à chaque mètre).
 */
const annonce = ref('')
const palierDeDistance = (metres: number) => (metres < 200 ? Math.round(metres / 50) * 50 : Math.round(metres / 500) * 500)
watch(
  () => (consigne.value ? `${consigne.value.texte} — ${palierDeDistance(consigne.value.distanceMetres)}` : ''),
  () => {
    if (!consigne.value) return
    annonce.value = consigne.value.estLArrivee
      ? `${consigne.value.texte}, dans ${distanceLisible(consigne.value.distanceMetres)}.`
      : `Dans ${distanceLisible(consigne.value.distanceMetres)} : ${consigne.value.texte}.`
  },
)

function arreterLeTrajet(): void {
  magasinConduite.arreter()
  void routeur.push('/')
}
onUnmounted(() => magasinConduite.arreter())
</script>

<template>
  <div class="conduite conteneur">
    <h1 class="titre-5">Consigne de conduite</h1>

    <Alerte
      v-if="trajetAbsent"
      type="info"
      description="Aucun trajet à suivre pour l’instant. Préparez un trajet, puis choisissez « Démarrer le trajet »."
    />
    <Alerte
      v-else-if="consignesAbsentes"
      type="warning"
      description="Ce trajet a été enregistré avant les consignes de conduite. Recalculez-le (avec du réseau) pour les avoir."
    />
    <div
      v-else-if="etat === 'refuse' || etat === 'indisponible'"
      id="position-indisponible"
      role="alert"
      class="remplissage-6 position-indisponible"
    >
      <p class="texte-gras marge-bas-2">
        {{
          etat === 'refuse'
            ? 'Position refusée : autorisez la localisation pour GLADYS dans les réglages du téléphone.'
            : 'Votre position est indisponible pour le moment. Vérifiez que la localisation est activée.'
        }}
      </p>
      <Bouton
        id="bouton-reessayer"
        type="button"
        icone="position"
        label="Réessayer"
        @click="magasinConduite.reessayer()"
      />
    </div>
    <template v-else>
      <p v-if="!consigne" id="recherche-position" role="status" class="texte-grand">
        Recherche de votre position…
      </p>
      <section
        v-else
        aria-labelledby="titre-consigne"
        :class="['bandeau-consigne', { 'bandeau-consigne--replie': texteMasque }]"
      >
        <h2 id="titre-consigne" class="visuellement-cache">Prochaine consigne</h2>
        <Icone id="pictogramme-direction" :nom="pictogrammeDuVirage[consigne.virage]" class="pictogramme-direction" />
        <p id="consigne-en-cours" :class="['consigne', { 'visuellement-cache': texteMasque }]">{{ consigne.texte }}</p>
        <p id="distance-consigne" :class="['distance-consigne', { 'visuellement-cache': texteMasque }]">
          <span class="visuellement-cache">Distance : </span>{{ distanceLisible(consigne.distanceMetres) }}
        </p>
      </section>
      <p id="annonce-consigne" role="status" class="visuellement-cache">{{ annonce }}</p>
      <div class="commande-voix">
        <Bouton
          id="bouton-voix"
          type="button"
          variante="secondaire"
          :label="voixActive ? 'Couper la voix' : 'Remettre la voix'"
          @click="magasinVoix.basculer()"
        />
        <p id="etat-voix" role="status" class="texte-gras">{{ voixActive ? 'Voix active' : 'Voix coupée' }}</p>
      </div>
      <p v-if="erreurVoix" id="erreur-voix" role="status">{{ erreurVoix }}</p>
      <div role="status">
        <Alerte
          v-if="voixAbsente"
          id="voix-absente"
          type="warning"
          description="Pas de voix française sur cet appareil : les consignes ne sont pas dites à voix haute. Elles restent affichées à l’écran."
        />
      </div>
    </template>

    <div v-if="!trajetAbsent" class="carte-conduite">
      <CarteTrajet
        :trace="traceDuTrajet"
        :depart="departDuTrajet"
        :arrivee="arriveeDuTrajet"
        :en-ligne="enLigne"
        suivre-des-l-ouverture
      />
    </div>

    <p v-if="resteDuTrajet" id="reste-du-trajet" class="reste-du-trajet">
      <span class="texte-gras">Arrivée à {{ resteDuTrajet.heure }}</span>
      <span>{{ resteDuTrajet.duree }} restantes</span>
      <span>{{ resteDuTrajet.distance }}</span>
    </p>

    <Bouton
      id="bouton-arreter-trajet"
      type="button"
      variante="secondaire"
      icone="arreter"
      class="bouton-arret"
      :label="trajetAbsent ? 'Retour à la préparation du trajet' : 'Arrêter le trajet'"
      @click="arreterLeTrajet"
    />
  </div>
</template>

<style scoped>
/* Écran de conduite façon GPS : bandeau de consigne en haut, carte qui occupe le reste,
   commandes (voix, arrêt) en bas, à portée de pouce. */
.conduite {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 100dvh;
  padding-block: 0.5rem;
}
.conduite h1 {
  margin: 0;
  font-size: 1rem;
  color: var(--texte-discret);
}
.bandeau-consigne {
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  background: var(--vert-route-fonce);
  color: #ffffff;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.3);
}
/* Voix active : le bandeau se réduit à une fine barre, la carte gagne la place. */
.bandeau-consigne--replie {
  padding: 0;
  height: 0.5rem;
  overflow: hidden;
}
.bandeau-consigne {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 1rem;
  align-items: center;
}
.bandeau-consigne > h2,
.bandeau-consigne > .consigne,
.bandeau-consigne > .distance-consigne {
  grid-column: 2;
}
.pictogramme-direction {
  grid-column: 1;
  grid-row: 1 / span 3;
  width: clamp(3.5rem, 18vw, 6rem);
  height: clamp(3.5rem, 18vw, 6rem);
}
/* Lisible d'un coup d'œil, même à 320 px de large : le texte revient à la ligne. */
.consigne {
  margin: 0 0 0.25rem;
  font-size: clamp(2rem, 9vw, 3.5rem);
  font-weight: 800;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.distance-consigne {
  margin: 0;
  font-size: clamp(1.75rem, 8vw, 3rem);
  font-weight: 700;
  color: #ffffff;
}
.commande-voix {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
}
.commande-voix p {
  margin: 0;
}
.carte-conduite {
  position: relative;
  flex: 1;
  min-height: 18rem;
  border-radius: 1rem;
  overflow: hidden;
}
.reste-du-trajet {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  margin: 0;
  font-size: 1.25rem;
}
.bouton-arret {
  width: 100%;
}
.position-indisponible {
  border: 2px solid var(--erreur);
  border-radius: 0.5rem;
  background: var(--erreur-pale);
}
</style>
