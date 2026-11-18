<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import Alerte from '@/components/interface/Alerte.vue'
import Bouton from '@/components/interface/Bouton.vue'
import { distanceLisible } from '@/services/consignes'
import { useConduiteStore } from '@/stores/conduite'
import { useItineraireStore } from '@/stores/itineraire'

const routeur = useRouter()
const magasinConduite = useConduiteStore()
const { etat, consigne, consignesAbsentes, voixAbsente } = storeToRefs(magasinConduite)
const { resultat } = storeToRefs(useItineraireStore())

const trajetAbsent = computed(() => !resultat.value)

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
      <section v-else aria-labelledby="titre-consigne">
        <h2 id="titre-consigne" class="visuellement-cache">Prochaine consigne</h2>
        <p id="consigne-en-cours" class="consigne">{{ consigne.texte }}</p>
        <p id="distance-consigne" class="distance-consigne">
          <span class="visuellement-cache">Distance : </span>{{ distanceLisible(consigne.distanceMetres) }}
        </p>
      </section>
      <p id="annonce-consigne" role="status" class="visuellement-cache">{{ annonce }}</p>
      <div role="status">
        <Alerte
          v-if="voixAbsente"
          id="voix-absente"
          type="warning"
          description="Pas de voix française sur cet appareil : les consignes ne sont pas dites à voix haute. Elles restent affichées à l’écran."
        />
      </div>
    </template>

    <Bouton
      id="bouton-arreter-trajet"
      type="button"
      variante="secondaire"
      icone="arreter"
      class="marge-haut-6"
      :label="trajetAbsent ? 'Retour à la préparation du trajet' : 'Arrêter le trajet'"
      @click="arreterLeTrajet"
    />
  </div>
</template>

<style scoped>
.conduite {
  padding-block: 1rem;
}
/* Lisible d'un coup d'œil, même à 320 px de large : le texte revient à la ligne. */
.consigne {
  margin: 1rem 0 0.5rem;
  font-size: clamp(2rem, 9vw, 3.5rem);
  font-weight: 800;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.distance-consigne {
  margin: 0;
  font-size: clamp(1.75rem, 8vw, 3rem);
  font-weight: 700;
  color: var(--vert-route-fonce);
}
.position-indisponible {
  border: 2px solid var(--erreur);
  border-radius: 0.5rem;
  background: var(--erreur-pale);
}
</style>
