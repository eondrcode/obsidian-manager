<div align="center">

# Better Plugins Manager

**Un gestionnaire de plugins plus complet pour Obsidian.**

Gardez les vaults Obsidian riches en plugins rapides et maîtrisables grâce au démarrage différé, aux actions groupées, aux groupes et tags, à l'installation depuis GitHub et au diagnostic guidé des conflits.

<p>
  <a href="../README.md">English</a>
  ·
  <a href="README_CN.md">简体中文</a>
  ·
  <a href="README_JA.md">日本語</a>
  ·
  <a href="README_KO.md">한국어</a>
  ·
  <a href="README_ES.md">Español</a>
  ·
  <a href="README_RU.md">Русский</a>
  ·
  <a href="https://github.com/eondrcode/obsidian-manager/releases">Releases</a>
  ·
  <a href="https://ifdian.net/a/eondr">Support</a>
</p>

<p>
  <a href="https://github.com/eondrcode/obsidian-manager/releases">
    <img alt="Latest Release" src="https://img.shields.io/github/v/release/eondrcode/obsidian-manager?style=flat-square&label=release">
  </a>
  <img alt="GitHub Downloads" src="https://img.shields.io/github/downloads/eondrcode/obsidian-manager/total?style=flat-square&label=downloads">
  <img alt="Last Commit" src="https://img.shields.io/github/last-commit/eondrcode/obsidian-manager?style=flat-square&label=last%20commit">
  <img alt="Issues" src="https://img.shields.io/github/issues/eondrcode/obsidian-manager?style=flat-square&label=issues">
  <img alt="Stars" src="https://img.shields.io/github/stars/eondrcode/obsidian-manager?style=flat-square&label=stars">
  <img alt="License" src="https://img.shields.io/github/license/eondrcode/obsidian-manager?style=flat-square&label=license">
</p>

<p>
  <img alt="Obsidian Plugin" src="https://img.shields.io/badge/Obsidian-plugin-7C3AED?style=flat-square&logo=obsidian&logoColor=white">
  <img alt="Minimum Obsidian Version" src="https://img.shields.io/badge/Obsidian-%E2%89%A5%201.5.8-7C3AED?style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-ready-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Platform" src="https://img.shields.io/badge/platform-desktop%20%7C%20mobile-4B5563?style=flat-square">
  <img alt="i18n" src="https://img.shields.io/badge/i18n-7%20languages-0F766E?style=flat-square">
  <img alt="GitHub Source Tracking" src="https://img.shields.io/badge/GitHub-source%20tracking-181717?style=flat-square&logo=github&logoColor=white">
  <a href="https://ifdian.net/a/eondr">
    <img alt="Sponsor on Afdian" src="https://img.shields.io/badge/Afdian-sponsor-946ce6?style=flat-square">
  </a>
</p>

</div>

![Screenshot](img/index.png)

---

## 🎯 Qu'est-ce que BPM ?

**Better Plugins Manager (BPM)** est un centre de contrôle pour les plugins communautaires Obsidian, conçu pour les vaults qui reposent sur de nombreux plugins et demandent plus que de simples boutons activer/désactiver.

Il aide à garder un démarrage réactif, organiser les plugins par flux de travail, installer depuis les GitHub Releases et isoler les conflits quand quelque chose casse.

| 🚀 Démarrage | 📦 Gestion | 🏷️ Organisation | 📥 Installation | 🔍 Diagnostic |
|-------------|------------|------------------|----------------|---------------|
| Démarrage différé et auto-vérifications | Activation/désactivation en lot, recherche rapide et filtres d'état | Groupes, tags, notes, descriptions et noms personnalisés | Installation depuis dépôts et versions GitHub | Diagnostic guidé des conflits avec rapport |

---

## ✨ Fonctionnalités principales

BPM est organisé autour de cinq onglets ciblés. Chaque onglet couvre un flux de travail, ce qui garde les contrôles liés au même endroit et rend le gestionnaire facile à parcourir sur bureau comme sur mobile.

| Onglet | Flux de travail |
|--------|-----------------|
| 🧩 Plugin View | Gérer les plugins installés, métadonnées, filtres, comportement au démarrage et actions par plugin |
| 📥 Install Hub | Installer des plugins ou thèmes depuis GitHub et gérer les sources suivies |
| 📦 Transfer Pack | Exporter, importer et restaurer des packs de plugins/thèmes entre vaults |
| 🎛️ Ribbon Order | Contrôler l'ordre et la visibilité des icônes du ribbon Obsidian |
| 🔍 Conflict Diagnosis | Localiser les problèmes de plugins et générer des rapports |

### 🧩 Plugin View

L'onglet principal pour la gestion quotidienne des plugins.

![Plugin View](img/PluginView.png)

| Zone | Rôle |
|------|------|
| **Liste des plugins** | Parcourir les plugins communautaires installés dans une vue compacte et recherchable |
| **Actions groupées** | Activer ou désactiver des plugins en masse, y compris par groupes |
| **Filtres** | Filtrer par état, groupe, tag, réglage de délai ou mot-clé |
| **Organisation** | Ajouter noms personnalisés, descriptions, notes, groupes et tags |
| **Contrôle du démarrage** | Assigner des profils de démarrage différé et afficher leur état dans la liste |
| **Actions plugin** | Vérifier les mises à jour, télécharger les mises à jour, redémarrer, démarrer temporairement, ouvrir les réglages, ouvrir les dossiers, copier les IDs, ouvrir les dépôts, vider la config, masquer ou supprimer |
| **Tags BPM** | Marque automatiquement les plugins installés via BPM avec `bpm-install` et prend en charge l'exclusion via `bpm-ignore` |

### 📥 Install Hub

Install Hub gère l'installation depuis GitHub et les sources que BPM peut suivre après installation.

![Install Hub](img/installHub.png)

| Zone | Rôle |
|------|------|
| **Type d'installation** | Basculer entre installation de plugin et de thème |
| **Saisie du dépôt** | Accepte `user/repo` ou une URL GitHub complète |
| **Choix de release** | Récupère les releases GitHub et installe la dernière ou une version choisie |
| **Notes de release** | Affiche les informations de release avant installation quand elles existent |
| **Installations récentes** | Garde les dépôts récents pour réinstaller plus vite |
| **Suivi des sources** | Suit les dépôts installés pour les vérifications, mises à jour et réinstallations futures |
| **Gestion des sources** | Examiner les sources plugin/thème suivies, cibles de mise à jour, réinstallations et métadonnées |

### 📦 Transfer Pack

Transfer Pack déplace des configurations de plugins entre vaults sans transformer le processus en checklist manuelle.

![Transfer Pack](img/transferPack.png)

| Zone | Rôle |
|------|------|
| **Liste d'export** | Sélectionner plugins et thèmes locaux à inclure dans un pack JSON |
| **Configs plugin** | Exporter les fichiers de configuration sélectionnés si nécessaire |
| **Taxonomie** | Exporter groupes, tags et profils de délai BPM |
| **Données de layout** | Exporter ordre du gestionnaire, éléments masqués et layout du ribbon |
| **Sources** | Exporter mappings de dépôts GitHub, abonnements source et historique d'installation |
| **Préférences** | Exporter style, mode de délai, affichage des tags et vérifications au démarrage |
| **Aperçu d'import** | Charger un pack et vérifier plugins, thèmes, sources, configs et layout avant application |
| **Options de restauration** | Installer les plugins/thèmes manquants, fusionner les configs, restaurer l'état activé, appliquer le layout, fusionner les sources et importer les thèmes |

### 🎛️ Ribbon Order

Ribbon Order garde le ribbon gauche d'Obsidian prévisible, surtout quand les plugins à démarrage différé enregistrent leurs icônes après le démarrage.

![Ribbon Order](img/ribbonOrder.png)

| Zone | Rôle |
|------|------|
| **Ordre des icônes** | Glisser les éléments du ribbon dans un ordre stable |
| **Visibilité** | Afficher ou masquer chaque icône du ribbon |
| **Native sync mode** | Gérer le layout du ribbon dans les données BPM sans dépendre de la config workspace Obsidian |
| **Réinitialisation** | Afficher tous les éléments et les trier par nom |
| **Indication de rechargement** | Signale quand Obsidian doit être rechargé pour afficher des icônes cachées au démarrage |

### 🔍 Conflict Diagnosis

Conflict Diagnosis guide les tests de conflit étape par étape et garde l'état testé et le résultat au même endroit.

![Conflict Diagnosis](img/conflictScan.png)

| Zone | Rôle |
|------|------|
| **Pré-vérification** | Confirme si le problème existe encore lorsque d'autres plugins sont désactivés |
| **Réduction binaire** | Utilise des tests par division pour réduire l'ensemble suspect |
| **Recherche de paire** | Aide à trouver les conflits entre deux plugins, y compris entre groupes |
| **Retour manuel** | Vous demande de tester chaque étape et d'indiquer si le problème persiste |
| **Contrôles d'état** | Annuler l'étape précédente, redémarrer Obsidian, quitter, restaurer l'état initial ou garder l'état actuel |
| **Rapport** | Génère un rapport Markdown avec les plugins détectés et les actions suggérées |

---

## 📦 Installation

### Community Plugins

Recommandé pour la plupart des utilisateurs.

1. Ouvrez **Obsidian Settings → Community Plugins**.
2. Recherchez **Better Plugins Manager**.
3. Installez et activez le plugin.

### Installation manuelle

À utiliser pour installer directement une release GitHub.

1. Téléchargez la [latest release](https://github.com/eondrcode/obsidian-manager/releases).
2. Copiez `main.js`, `manifest.json` et `styles.css` dans `.obsidian/plugins/better-plugins-manager/`.
3. Redémarrez Obsidian.
4. Activez **Better Plugins Manager** depuis **Settings → Community Plugins**.

---

## 🚦 Démarrage rapide

### Ouvrir BPM

Après activation du plugin, ouvrez BPM de l'une des deux façons :

- Cliquez sur l'icône BPM dans le ribbon gauche.
- Lancez **Open the plugin manager** depuis la palette de commandes.

### Premiers pas

1. Commencez dans **Plugin View** pour vérifier les plugins installés, filtres, groupes, tags et délais.
2. Utilisez **Install Hub** pour installer des plugins ou thèmes depuis GitHub.
3. Utilisez **Transfer Pack** pour déplacer une configuration entre vaults.
4. Utilisez **Conflict Diagnosis** lorsqu'un problème de plugin doit être isolé.

### Conseils d'interaction

- **Clic gauche** sur les contrôles principaux pour basculer, modifier, installer, importer ou lancer une action.
- **Clic droit** sur un plugin pour ouvrir son menu contextuel.
- **Survolez** les boutons de la barre d'outils pour voir les tooltips ; sur tactile, utilisez l'appui long quand disponible.

---

## 🔍 Tutoriel Conflict Diagnosis

Utilisez **Conflict Diagnosis** quand un problème apparaît après activation de plugins communautaires et que vous devez réduire la cause de façon structurée.

### Flux

1. Ouvrez l'onglet **Conflict Diagnosis**, ou lancez **Troubleshoot plugin conflicts** depuis la palette de commandes.
2. Démarrez une session. BPM enregistre l'état actuel des plugins avant toute modification.
3. Testez votre vault après chaque étape, puis choisissez **Problem Still Exists** ou **Problem Gone**.
4. Continuez les tests guidés jusqu'à ce que BPM réduise le résultat à un plugin ou une paire de plugins.
5. Examinez le résultat, restaurez l'état initial ou gardez l'état actuel, puis générez un rapport Markdown si nécessaire.

### Notes

- Le diagnostic dépend de votre retour à chaque étape ; utilisez toujours la même action de test.
- Les bugs intermittents, problèmes d'ordre de chargement, bugs liés à la configuration ou conflits impliquant trois plugins ou plus peuvent nécessiter une vérification manuelle.
- Vous pouvez annuler l'étape précédente, redémarrer Obsidian pendant le test, quitter, restaurer l'état initial ou garder l'état actuel.

---

## 🛡️ Prise de contrôle au démarrage

Quand **Delayed Startup** est activé, BPM vérifie `.obsidian/community-plugins.json` pour éviter qu'Obsidian et BPM contrôlent les mêmes plugins au démarrage.

| Cas | Comportement de BPM |
|-----|---------------------|
| Aucun plugin non géré | Démarrage normal |
| Plugins non gérés détectés | Affiche une invite de prise de contrôle |
| Auto Takeover activé | Déplace automatiquement les plugins détectés sous gestion BPM |
| Plugin marqué `bpm-ignore` | Le laisse dans la liste de démarrage native d'Obsidian |

La prise de contrôle garde cohérents le démarrage différé, l'état activé et les enregistrements BPM. Après succès, redémarrez Obsidian pour appliquer proprement la liste de démarrage.

---

## 📦 Transfer et export legacy

Dans les versions actuelles, utilisez **Transfer Pack** pour déplacer des configurations entre vaults. Il exporte et importe listes de plugins, thèmes, configs sélectionnées, groupes, tags, profils de délai, layout, ordre du ribbon, abonnements source, historique d'installation et préférences workspace.

L'ancien export Markdown/frontmatter pour Obsidian Base est conservé uniquement pour la compatibilité avec les données legacy. Les nouvelles configurations devraient utiliser **Transfer Pack** plutôt qu'un dossier d'export Base.

---

## ⚙️ Réglages

Les réglages BPM sont divisés en pages ciblées :

| Page | Ce que vous pouvez configurer |
|------|-------------------------------|
| **Basic** | Langue, persistance des filtres, démarrage différé, auto takeover, vérifications au démarrage, vérifications de sources, auto-update des sources, visibilité des tags BPM, ordre du ribbon, commandes, mode debug et token GitHub |
| **Main Page Actions** | Choisir quelles actions apparaissent sur les cartes plugin et lesquelles restent dans le menu clic droit |
| **Style** | Layout de liste, style des éléments, styles groupe/tag et atténuation des plugins désactivés |
| **Groups** | Créer, renommer, recolorer et supprimer des groupes |
| **Tags** | Créer, renommer, recolorer et supprimer des tags |
| **Delay** | Créer et gérer les profils de démarrage différé ; visible seulement si le démarrage différé est activé |

---

## ⌨️ Commandes

| Commande | Disponibilité | Description |
|----------|---------------|-------------|
| **Open the plugin manager** | Toujours disponible | Ouvre l'interface principale de BPM |
| **Troubleshoot plugin conflicts** | Toujours disponible | Démarre le flux de diagnostic des conflits |
| **Enable/Disable [Plugin Name]** | Réglage optionnel | Enregistre une commande par plugin pour le basculer directement |
| **One-click Enable/Disable [Group Name]** | Réglage optionnel | Enregistre des commandes de groupe pour basculer en lot |

---

## 📱 Compatibilité

| Plateforme | Support |
|------------|---------|
| Windows / macOS / Linux | ✅ |
| Android | ✅ |
| iOS / iPadOS | ✅ |

Le plugin bascule automatiquement entre layouts bureau et mobile selon la plateforme.

---

## 🤝 Contribuer

Les issues et PR sont les bienvenus.

- **Rapports de bugs** : incluez les logs et les étapes de reproduction.
- **Demandes de fonctionnalités** : ouvrez de préférence une discussion ou issue d'abord.

## 🙏 Remerciements

- La fonction de tri du ribbon est inspirée de [Obsidian-ribbon-sort](https://github.com/yunrr/Obsidian-app-ribbon-sorting).

---

## 📄 License

[MIT](../LICENSE)
