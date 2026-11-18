<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import Alerte from '@/components/interface/Alerte.vue'

/** Prévient quand l'appareil n'a plus de réseau : l'application continue de fonctionner. */
const enLigne = ref(navigator.onLine)
const mettreAJour = () => (enLigne.value = navigator.onLine)
onMounted(() => {
  window.addEventListener('online', mettreAJour)
  window.addEventListener('offline', mettreAJour)
})
onUnmounted(() => {
  window.removeEventListener('online', mettreAJour)
  window.removeEventListener('offline', mettreAJour)
})
</script>

<template>
  <div role="status">
    <Alerte
      v-if="!enLigne"
      type="info"
      description="Hors connexion : l’application continue de fonctionner, vos saisies restent sur cet appareil."
    />
  </div>
</template>
