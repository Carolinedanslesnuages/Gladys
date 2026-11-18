<script setup lang="ts">
/**
 * Bouton « À propos, accessibilité et relevés », sous la carte (plus de menu posé sur la carte,
 * demande #30) : il ouvre le panneau « À propos » (fenêtre), qui remplace l'en-tête et le
 * pied de page d'un site. On y trouve le logo, la déclaration d'accessibilité, les
 * mentions légales, les données personnelles et les cookies.
 * Le panneau se ferme par « Fermer » ou Échap, et le focus revient sur le bouton.
 * Décision : docs/adr/0011-application-sans-en-tete-ni-pied-de-page.md.
 */
import { nextTick, ref } from 'vue'
import Bouton from '@/components/interface/Bouton.vue'
import FenetreModale from '@/components/interface/FenetreModale.vue'
import Icone from '@/components/interface/Icone.vue'

const panneauOuvert = ref(false)
const ID_BOUTON_A_PROPOS = 'bouton-a-propos'
const retourSurLeBouton = { focus: () => document.getElementById(ID_BOUTON_A_PROPOS)?.focus() }

const ouvrirLePanneau = () => (panneauOuvert.value = true)
/** Panneau fermé (« Fermer » ou Échap) : le focus revient sur le bouton, d'où l'on venait. */
async function fermerLePanneau(): Promise<void> {
  panneauOuvert.value = false
  await nextTick()
  retourSurLeBouton.focus()
}
</script>

<template>
  <Bouton
    :id="ID_BOUTON_A_PROPOS"
    type="button"
    variante="secondaire"
    icone="informations"
    label="À propos, accessibilité et relevés"
    aria-haspopup="dialog"
    @click="ouvrirLePanneau"
  />
  <FenetreModale v-if="panneauOuvert" id="panneau-a-propos" titre="À propos de GLADYS" @close="fermerLePanneau">
    <div class="marges-logo marge-bas-6">
      <img src="/logo-gladys.svg" alt="Gladys" class="logo-gladys" width="124" height="48" />
    </div>
    <p>
      Sans permis, en toute sécurité : aller d’un point A à un point B avec votre voiture sans
      permis.
    </p>

    <nav aria-labelledby="titre-navigation" class="marge-bas-6">
      <h3 id="titre-navigation" class="titre-6 marge-bas-2">Aller à</h3>
      <ul class="groupe-boutons">
        <li>
          <RouterLink to="/releves" class="lien-bouton">
            <Icone nom="document" />
            Relevés
          </RouterLink>
        </li>
      </ul>
    </nav>

    <section aria-labelledby="titre-accessibilite" class="marge-bas-6">
      <h3 id="titre-accessibilite" class="titre-6">Déclaration d’accessibilité</h3>
      <p>
        GLADYS s’engage à rendre son service accessible, conformément à l’article 47 de la loi n°
        2005-102 du 11 février 2005.
      </p>
      <p>
        <strong>État de conformité : non conforme.</strong> GLADYS n’a pas encore été auditée selon
        le RGAA 4.1. Elle se manie au clavier, ses textes sont contrastés au moins à 4,5:1, et
        chaque version passe des contrôles automatiques d’accessibilité.
      </p>
      <p class="marge-bas-0">
        Si vous n’arrivez pas à utiliser un service, signalez-le à l’équipe de GLADYS (adresse de
        contact à venir). Sans réponse, vous pouvez saisir le
        <a href="https://formulaire.defenseurdesdroits.fr/">Défenseur des droits</a>.
      </p>
    </section>

    <section aria-labelledby="titre-mentions" class="marge-bas-6">
      <h3 id="titre-mentions" class="titre-6">Mentions légales</h3>
      <ul>
        <li>
          Éditeur, directeur de la publication et hébergeur : à compléter avant l’ouverture au
          public.
        </li>
        <li>Fond de carte : © les contributeurs d’OpenStreetMap, sous licence ODbL.</li>
        <li>Adresses et calcul d’itinéraire : Géoplateforme de l’IGN.</li>
        <li>
          Calcul d’itinéraire en essai, si vous le choisissez : Valhalla, sur les données
          OpenStreetMap.
        </li>
      </ul>
    </section>

    <section aria-labelledby="titre-donnees" class="marge-bas-6">
      <h3 id="titre-donnees" class="titre-6">Données personnelles</h3>
      <p>GLADYS ne vous demande ni compte, ni nom, ni adresse électronique.</p>
      <h4 class="texte-gras marge-bas-1">Votre position</h4>
      <ul>
        <li>Elle n’est utilisée que si vous l’autorisez.</li>
        <li>Elle sert à centrer la carte sur vous et à partir de « Ma position ».</li>
        <li>Elle n’est jamais enregistrée, ni sur ce téléphone, ni ailleurs.</li>
        <li>
          Pour partir de « Ma position », GLADYS demande à l’IGN l’adresse la plus proche. Pour
          calculer le trajet, elle envoie le départ et l’arrivée au calculateur choisi.
        </li>
        <li>La carte demande à OpenStreetMap les images de la zone affichée.</li>
        <li>
          Vous pouvez retirer l’autorisation à tout moment, dans les réglages du navigateur ou du
          téléphone.
        </li>
      </ul>
      <h4 class="texte-gras marge-bas-1">Ce qui reste sur ce téléphone</h4>
      <p class="marge-bas-0">
        Vos trajets récents (si vous l’acceptez), votre vitesse habituelle, vos choix de calcul et
        vos relevés. Ils ne quittent pas ce téléphone. Vous pouvez effacer vos trajets récents sous
        la carte.
      </p>
    </section>

    <section aria-labelledby="titre-cookies">
      <h3 id="titre-cookies" class="titre-6">Gestion des cookies</h3>
      <p class="marge-bas-0">
        GLADYS ne dépose aucun cookie et ne mesure pas votre utilisation. Il n’y a donc rien à
        accepter ni à refuser.
      </p>
    </section>
  </FenetreModale>
</template>

<style scoped>
.lien-bouton {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--cible-minimale);
  padding: 0.5rem 1rem;
  font-weight: 600;
  color: var(--vert-route-fonce);
  text-decoration: none;
  border: 2px solid var(--vert-route);
  border-radius: 0.5rem;
}
.lien-bouton:hover {
  background: var(--vert-route-pale);
}
.marges-logo {
  display: flex;
  align-items: center;
}
.logo-gladys {
  width: 7.75rem;
  height: 3rem;
}
</style>
