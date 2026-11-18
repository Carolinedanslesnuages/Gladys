<script setup lang="ts">
import Icone from './Icone.vue'

/** Message encadré. Le type se lit aussi par son icône (jamais la couleur seule). */
defineProps<{
  type: 'info' | 'warning' | 'error'
  description: string
}>()

const ICONES = { info: 'informations', warning: 'attention', error: 'erreur' } as const
</script>

<template>
  <div class="alerte" :class="`alerte--${type}`">
    <Icone :nom="ICONES[type]" />
    <p class="alerte__texte">{{ description }}</p>
  </div>
</template>

<style scoped>
.alerte {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.75rem;
  color: var(--texte);
  background: var(--fond);
  border: 2px solid var(--bordure);
  border-left-width: 6px;
  border-radius: 0.25rem;
}
.alerte__texte {
  margin: 0;
}
.alerte--info {
  background: var(--vert-route-pale);
  border-color: var(--vert-route);
}
.alerte--warning {
  color: var(--attention-texte);
  background: var(--attention-pale);
  border-color: var(--attention-bordure);
}
.alerte--error {
  color: #7a1a12;
  background: var(--erreur-pale);
  border-color: var(--erreur);
}
</style>
