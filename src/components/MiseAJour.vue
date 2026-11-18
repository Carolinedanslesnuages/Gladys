<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'
import Bouton from '@/components/interface/Bouton.vue'

/** Une nouvelle version est prête : on le propose, sans recharger d'office (une saisie peut être en cours). */
const { needRefresh, updateServiceWorker } = useRegisterSW()
</script>

<template>
  <div role="status" class="conteneur">
    <section v-if="needRefresh" class="nouvelle-version marge-verticale-4">
      <h2 class="titre-6">Une nouvelle version est disponible</h2>
      <p>Vos relevés sont conservés.</p>
      <ul class="groupe-boutons">
        <li><Bouton label="Mettre à jour" @click="updateServiceWorker(true)" /></li>
        <li><Bouton variante="secondaire" label="Plus tard" @click="needRefresh = false" /></li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.nouvelle-version {
  padding: 0.75rem 1rem;
  background: var(--vert-route-pale);
  border: 2px solid var(--vert-route);
  border-left-width: 6px;
  border-radius: 0.25rem;
}
</style>
