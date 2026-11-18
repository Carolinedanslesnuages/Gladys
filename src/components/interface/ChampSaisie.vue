<script setup lang="ts">
import { computed } from 'vue'

/**
 * Champ de saisie : étiquette visible reliée au champ, aide, erreur (reliée au champ et annoncée)
 * et message de réussite. 44 px de haut au moins.
 */
const props = defineProps<{
  id: string
  label: string
  modelValue?: string | number
  /** Aide affichée sous l'étiquette. */
  indication?: string
  messageErreur?: string
  messageReussite?: string
  type?: string
  inputmode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'search'
  autocomplete?: string
  required?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [valeur: string] }>()

const idIndication = computed(() => `${props.id}-indication`)
const idMessage = computed(() => `${props.id}-message`)
const descriptions = computed(
  () =>
    [
      props.indication ? idIndication.value : '',
      props.messageErreur || props.messageReussite ? idMessage.value : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined,
)
</script>

<template>
  <div class="champ" :class="{ 'champ--erreur': messageErreur }">
    <label :for="id" class="champ__etiquette">{{ label }}</label>
    <p v-if="indication" :id="idIndication" class="champ__indication">{{ indication }}</p>
    <input
      :id="id"
      class="champ__saisie"
      :value="modelValue"
      :type="type ?? 'text'"
      :inputmode="inputmode"
      :autocomplete="autocomplete"
      :required="required"
      :disabled="disabled"
      :aria-invalid="messageErreur ? 'true' : undefined"
      :aria-describedby="descriptions"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <div :id="idMessage" role="status">
      <p v-if="messageErreur" class="champ__message champ__message--erreur">
        <span aria-hidden="true">⚠ </span>{{ messageErreur }}
      </p>
      <p v-else-if="messageReussite" class="champ__message champ__message--reussite">
        <span aria-hidden="true">✓ </span>{{ messageReussite }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.champ {
  margin-bottom: 1rem;
}
.champ__etiquette {
  display: block;
  font-weight: 600;
}
.champ__indication {
  margin: 0.125rem 0 0;
  font-size: 0.875rem;
  color: var(--texte-discret);
}
.champ__saisie {
  display: block;
  width: 100%;
  min-height: var(--cible-minimale);
  margin-top: 0.25rem;
  padding: 0.5rem 0.75rem;
  font: inherit;
  color: var(--texte);
  background: var(--fond);
  border: 2px solid var(--bordure);
  border-radius: 0.5rem;
}
.champ--erreur .champ__saisie {
  border-color: var(--erreur);
}
.champ__saisie:disabled {
  color: #595959;
  background: #ebebeb;
}
.champ__message {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
}
.champ__message--erreur {
  color: var(--erreur);
}
.champ__message--reussite {
  color: var(--vert-route-fonce);
}
</style>
