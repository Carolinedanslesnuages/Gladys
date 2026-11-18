<script setup lang="ts">
/** Choix unique : un groupe (légende visible) de boutons radio, chacun avec son étiquette et son aide. */
defineProps<{
  name: string
  legend: string
  hint?: string
  modelValue: string | number
  options: { label: string; value: string | number; hint?: string }[]
}>()
const emit = defineEmits<{ 'update:modelValue': [valeur: string | number] }>()
</script>

<template>
  <fieldset class="groupe-radios">
    <legend class="groupe-radios__legende">{{ legend }}</legend>
    <p v-if="hint" class="groupe-radios__indication">{{ hint }}</p>
    <div v-for="option in options" :key="option.value" class="groupe-radios__option">
      <input
        :id="`${name}-${option.value}`"
        type="radio"
        :name="name"
        :value="option.value"
        :checked="option.value === modelValue"
        @change="emit('update:modelValue', option.value)"
      />
      <label :for="`${name}-${option.value}`">
        {{ option.label }}
        <span v-if="option.hint" class="groupe-radios__indication">{{ option.hint }}</span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.groupe-radios {
  margin: 0 0 1rem;
  padding: 0;
  border: 0;
}
.groupe-radios__legende {
  padding: 0;
  font-weight: 600;
}
.groupe-radios__indication {
  display: block;
  margin: 0.125rem 0 0;
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--texte-discret);
}
.groupe-radios__option {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  min-height: var(--cible-minimale);
  padding: 0.5rem 0;
}
.groupe-radios__option input {
  flex: none;
  width: 1.5rem;
  height: 1.5rem;
  margin: 0.25rem 0 0;
  accent-color: var(--vert-route);
}
.groupe-radios__option label {
  flex: 1;
  padding-top: 0.125rem;
}
</style>
