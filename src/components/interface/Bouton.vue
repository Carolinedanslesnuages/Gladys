<script setup lang="ts">
import Icone, { type NomIcone } from './Icone.vue'

/**
 * Bouton de GLADYS : toujours un intitulé visible (jamais une icône seule), 44 px de haut au moins.
 * Si l'intitulé visible est court, passer le nom complet dans `aria-label` : il doit le contenir.
 */
withDefaults(
  defineProps<{
    label: string
    icone?: NomIcone
    variante?: 'principal' | 'secondaire' | 'discret'
    /** Bouton compact (ex. : commandes de la carte) : l'intitulé n'est plus affiché, mais reste lu et visible au survol. */
    iconeSeule?: boolean
  }>(),
  { icone: undefined, variante: 'principal', iconeSeule: false },
)
</script>

<template>
  <button
    class="bouton"
    :class="[`bouton--${variante}`, { 'bouton--icone-seule': iconeSeule && icone }]"
    type="button"
    :title="iconeSeule && icone ? label : undefined"
  >
    <Icone v-if="icone" :nom="icone" />
    <span :class="{ 'visuellement-cache': iconeSeule && icone }">{{ label }}</span>
  </button>
</template>

<style scoped>
.bouton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: var(--cible-minimale);
  min-width: var(--cible-minimale);
  padding: 0.5rem 1rem;
  font: inherit;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
  cursor: pointer;
  border: 2px solid var(--vert-route);
  border-radius: 0.5rem;
}
.bouton--principal {
  color: #ffffff;
  background: var(--vert-route);
}
.bouton--principal:hover:not(:disabled) {
  background: var(--vert-route-fonce);
  border-color: var(--vert-route-fonce);
}
.bouton--secondaire {
  color: var(--vert-route-fonce);
  background: var(--fond);
}
.bouton--secondaire:hover:not(:disabled) {
  background: var(--vert-route-pale);
}
.bouton--discret {
  color: var(--vert-route-fonce);
  background: transparent;
  border-color: transparent;
}
.bouton--discret:hover:not(:disabled) {
  background: var(--vert-route-pale);
}
.bouton--icone-seule {
  padding: 0.5rem;
}
.bouton:disabled {
  cursor: not-allowed;
  color: #595959;
  background: #ebebeb;
  border-color: #949494;
}
</style>
