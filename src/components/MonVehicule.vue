<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import Bouton from '@/components/interface/Bouton.vue'
import ChampSaisie from '@/components/interface/ChampSaisie.vue'
import GroupeRadios from '@/components/interface/GroupeRadios.vue'
import {
  MESSAGE_AUTONOMIE_INVALIDE,
  autonomieValide,
  useVehiculeStore,
  type EnergieVehicule,
} from '@/stores/vehicule'

/**
 * « Mon véhicule » : motorisation (gardée sur ce téléphone) et autonomie restante (redemandée à
 * chaque ouverture). Avec `avecValidation`, un bouton referme la question posée à l'ouverture.
 */
defineProps<{ avecValidation?: boolean }>()
const emit = defineEmits<{ termine: [] }>()

const magasinVehicule = useVehiculeStore()
const { energie, autonomie, erreur } = storeToRefs(magasinVehicule)

const optionsEnergie = [
  { label: 'Thermique', value: 'thermique', hint: 'Essence ou diesel.' },
  { label: 'Électrique', value: 'electrique', hint: 'Par exemple une Ami ou une Topolino.' },
]
const autonomieSaisie = ref(autonomie.value === null ? '' : String(autonomie.value))
const erreurAutonomie = ref('')

function saisirAutonomie(valeur: string | number | undefined): void {
  autonomieSaisie.value = String(valeur ?? '')
  if (autonomieSaisie.value.trim() === '') {
    erreurAutonomie.value = ''
    return
  }
  const autonomieSaisieValide = autonomieValide(autonomieSaisie.value)
  if (autonomieSaisieValide === null) {
    erreurAutonomie.value = MESSAGE_AUTONOMIE_INVALIDE
    return
  }
  erreurAutonomie.value = ''
  magasinVehicule.choisirAutonomie(autonomieSaisieValide)
}
</script>

<template>
  <section id="mon-vehicule" class="marge-bas-8" aria-labelledby="titre-mon-vehicule">
    <h2 id="titre-mon-vehicule" class="titre-5">Mon véhicule</h2>
    <p class="texte-petit">Ces informations restent sur ce téléphone.</p>
    <GroupeRadios
      name="energie-vehicule"
      legend="Mon véhicule est…"
      :model-value="energie ?? ''"
      :options="optionsEnergie"
      @update:model-value="(valeur) => magasinVehicule.choisirEnergie(valeur as EnergieVehicule)"
    />
    <ChampSaisie
      id="autonomie-vehicule"
      :model-value="autonomieSaisie"
      label="Autonomie restante de mon véhicule, en km"
      indication="La distance que je peux encore faire avec la charge ou le plein actuel, par exemple 75. Elle est redemandée à chaque ouverture."
      :message-erreur="erreurAutonomie || erreur || undefined"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      @update:model-value="saisirAutonomie"
    />
    <p v-if="energie !== null && autonomie !== null" id="vehicule-enregistre" role="status">
      Véhicule noté : {{ energie === 'electrique' ? 'électrique' : 'thermique' }},
      {{ autonomie.toLocaleString('fr-FR') }} km d’autonomie restante.
    </p>
    <Bouton
      v-if="avecValidation"
      type="button"
      :label="autonomie === null ? 'Plus tard' : 'Valider et préparer mon trajet'"
      :variante="autonomie === null ? 'secondaire' : 'principal'"
      @click="emit('termine')"
    />
  </section>
</template>
