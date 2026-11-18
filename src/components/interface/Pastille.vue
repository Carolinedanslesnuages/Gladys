<script setup lang="ts">
/** Petite étiquette (ex. : « Départementale calme »). Le sens est dans le texte, pas dans la couleur. */
defineProps<{ label: string; type: 'info' | 'warning' }>()
</script>

<template>
  <span class="pastille" :class="`pastille--${type}`">{{ label }}</span>
</template>

<style scoped>
.pastille {
  display: inline-block;
  padding: 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.5rem;
  border-radius: 0.75rem;
}
.pastille--info {
  color: var(--vert-route-fonce);
  background: var(--vert-route-pale);
}
.pastille--warning {
  color: var(--attention-texte);
  background: var(--attention-pale);
  border: 1px solid var(--attention-bordure);
}
</style>
