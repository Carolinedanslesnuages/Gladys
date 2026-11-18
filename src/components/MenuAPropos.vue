<script setup lang="ts">
/**
 * Bouton « À propos, accessibilité et relevés », sous la carte (plus de menu posé sur la carte,
 * demande #30) : il ouvre le panneau « À propos » (fenêtre DSFR), qui remplace l'en-tête et le
 * pied de page d'un site. On y trouve la marque de l'État, la déclaration d'accessibilité, les
 * mentions légales, les données personnelles et les cookies.
 * Le panneau se ferme par « Fermer » ou Échap, et le focus revient sur le bouton.
 * Décision : docs/adr/0011-application-sans-en-tete-ni-pied-de-page.md.
 */
import { nextTick, ref } from 'vue'

const logoText = ['République', 'Française']
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
  <DsfrButton
    :id="ID_BOUTON_A_PROPOS"
    type="button"
    secondary
    size="lg"
    icon="fr-icon-information-line"
    label="À propos, accessibilité et relevés"
    aria-haspopup="dialog"
    @click="ouvrirLePanneau"
  />
  <DsfrModal
    modal-id="panneau-a-propos"
    :opened="panneauOuvert"
    title="À propos de GLADYS"
    title-tag="h2"
    size="lg"
    :origin="retourSurLeBouton"
    @close="fermerLePanneau"
  >
    <div class="marques fr-mb-3w">
      <DsfrLogo :logo-text="logoText" />
      <img src="/logo-gladys.svg" alt="Gladys" class="logo-gladys" width="124" height="48" />
    </div>
    <p>
      Sans permis, en toute sécurité : aller d’un point A à un point B avec votre voiture sans
      permis.
    </p>

    <nav aria-labelledby="titre-navigation" class="fr-mb-3w">
      <h3 id="titre-navigation" class="fr-h6 fr-mb-1w">Aller à</h3>
      <ul class="fr-btns-group fr-btns-group--inline-sm">
        <li>
          <RouterLink
            to="/releves"
            class="fr-btn fr-btn--secondary fr-icon-file-text-line fr-btn--icon-left"
          >
            Relevés
          </RouterLink>
        </li>
      </ul>
    </nav>

    <section aria-labelledby="titre-accessibilite" class="fr-mb-3w">
      <h3 id="titre-accessibilite" class="fr-h6">Déclaration d’accessibilité</h3>
      <p>
        GLADYS s’engage à rendre son service accessible, conformément à l’article 47 de la loi n°
        2005-102 du 11 février 2005.
      </p>
      <p>
        <strong>État de conformité : non conforme.</strong> GLADYS n’a pas encore été auditée selon
        le RGAA 4.1. Elle utilise les composants du système de design de l’État, se manie au
        clavier, et chaque version passe des contrôles automatiques d’accessibilité.
      </p>
      <p class="fr-mb-0">
        Si vous n’arrivez pas à utiliser un service, signalez-le à l’équipe de GLADYS (adresse de
        contact à venir). Sans réponse, vous pouvez saisir le
        <a href="https://formulaire.defenseurdesdroits.fr/">Défenseur des droits</a>.
      </p>
    </section>

    <section aria-labelledby="titre-mentions" class="fr-mb-3w">
      <h3 id="titre-mentions" class="fr-h6">Mentions légales</h3>
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

    <section aria-labelledby="titre-donnees" class="fr-mb-3w">
      <h3 id="titre-donnees" class="fr-h6">Données personnelles</h3>
      <p>GLADYS ne vous demande ni compte, ni nom, ni adresse électronique.</p>
      <h4 class="fr-text--md fr-text--bold fr-mb-1w">Votre position</h4>
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
      <h4 class="fr-text--md fr-text--bold fr-mb-1w">Ce qui reste sur ce téléphone</h4>
      <p class="fr-mb-0">
        Vos trajets récents (si vous l’acceptez), votre vitesse habituelle, vos choix de calcul et
        vos relevés. Ils ne quittent pas ce téléphone. Vous pouvez effacer vos trajets récents sous
        la carte.
      </p>
    </section>

    <section aria-labelledby="titre-cookies">
      <h3 id="titre-cookies" class="fr-h6">Gestion des cookies</h3>
      <p class="fr-mb-0">
        GLADYS ne dépose aucun cookie et ne mesure pas votre utilisation. Il n’y a donc rien à
        accepter ni à refuser.
      </p>
    </section>
  </DsfrModal>
</template>

<style scoped>
.marques {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.5rem;
}
.logo-gladys {
  width: 7.75rem;
  height: 3rem;
}
</style>
