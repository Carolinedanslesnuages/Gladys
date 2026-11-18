<script setup lang="ts">
import { onMounted, onUnmounted, ref, useId } from 'vue'
import Bouton from './Bouton.vue'

/**
 * Fenêtre par-dessus la page (balise <dialog> native : le focus y reste enfermé). Se ferme par
 * « Fermer » ou Échap ; la page qui l'ouvre rend ensuite le focus au bouton d'origine.
 */
defineProps<{ titre: string }>()
const emit = defineEmits<{ close: [] }>()

const idTitre = useId()
const fenetre = ref<HTMLDialogElement | null>(null)

function surEchap(evenement: KeyboardEvent): void {
  if (evenement.key === 'Escape') emit('close')
}
onMounted(() => {
  const dialogue = fenetre.value
  if (dialogue && typeof dialogue.showModal === 'function') dialogue.showModal()
  else dialogue?.setAttribute('open', '')
  document.addEventListener('keydown', surEchap)
})
onUnmounted(() => document.removeEventListener('keydown', surEchap))
</script>

<template>
  <dialog
    ref="fenetre"
    class="fenetre-modale"
    aria-modal="true"
    :aria-labelledby="idTitre"
    @cancel.prevent="emit('close')"
  >
    <div class="fenetre-modale__contenu">
      <h2 :id="idTitre">{{ titre }}</h2>
      <slot />
      <div class="marge-haut-6">
        <Bouton label="Fermer" variante="secondaire" @click="emit('close')" />
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.fenetre-modale {
  width: min(100% - 1rem, 40rem);
  max-height: calc(100% - 1rem);
  padding: 0;
  color: var(--texte);
  background: var(--fond);
  border: 2px solid var(--bordure);
  border-radius: 0.5rem;
}
.fenetre-modale::backdrop {
  background: rgb(0 0 0 / 60%);
}
.fenetre-modale__contenu {
  padding: 1rem 1.25rem 1.5rem;
}
</style>
