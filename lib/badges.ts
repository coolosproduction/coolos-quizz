// Catalogue des badges du jeu. Les badges sont attribués côté serveur par la fonction SQL
// check_and_award_badges (appelée après chaque partie/révision/ami accepté) et
// check_classement_badges (cron quotidien pour les badges de classement) — jamais côté client.
// Un badge une fois débloqué reste acquis pour toujours (pas de perte possible).
//
// Ce fichier ne fait qu'afficher : le catalogue statique ci-dessous, plus les badges dynamiques
// de maîtrise par catégorie/sous-catégorie construits à partir de la liste des catégories/
// sous-catégories actives (voir getFullBadgeCatalog).

export type BadgeDef = {
  key: string
  label: string
  description: string
  icon: string
}

export const BADGES_CATALOG: BadgeDef[] = [
  // Assiduité
  { key: 'streak_7', label: 'Une semaine active', description: 'Jouer ou réviser 7 jours de suite', icon: '🔥' },
  { key: 'streak_30', label: 'Un mois de feu', description: 'Jouer ou réviser 30 jours de suite', icon: '🔥' },
  { key: 'streak_100', label: 'Cent jours', description: 'Jouer ou réviser 100 jours de suite', icon: '🔥' },
  { key: 'streak_365', label: 'Une année entière', description: 'Jouer ou réviser 365 jours de suite', icon: '🔥' },
  { key: 'revision_assidu_10', label: 'Élève assidu', description: 'Réviser 10 jours de suite', icon: '📚' },

  // Performance en partie
  { key: 'perfect_first', label: 'Sans faute', description: 'Terminer une partie solo avec le score parfait', icon: '💯' },
  { key: 'streak_correct_50', label: 'Série de 50', description: '50 bonnes réponses d’affilée', icon: '⚡' },
  { key: 'streak_correct_100', label: 'Série de 100', description: '100 bonnes réponses d’affilée', icon: '⚡' },
  { key: 'streak_correct_500', label: 'Série de 500', description: '500 bonnes réponses d’affilée', icon: '⚡' },

  // Multijoueur & social
  { key: 'multi_first_win', label: 'Première victoire', description: 'Gagner une partie multijoueur', icon: '🏆' },
  { key: 'friends_10', label: 'Sociable', description: 'Avoir 10 amis sur Coolos Quiz', icon: '🤝' },

  // Statut
  { key: 'premium', label: 'Membre premium', description: 'Être abonné premium', icon: '⭐' },

  // Totaux de bonnes réponses (carrière)
  { key: 'correct_500', label: '500 bonnes réponses', description: 'Cumuler 500 bonnes réponses', icon: '✅' },
  { key: 'correct_1000', label: '1 000 bonnes réponses', description: 'Cumuler 1 000 bonnes réponses', icon: '✅' },
  { key: 'correct_5000', label: '5 000 bonnes réponses', description: 'Cumuler 5 000 bonnes réponses', icon: '✅' },
  { key: 'correct_10000', label: '10 000 bonnes réponses', description: 'Cumuler 10 000 bonnes réponses', icon: '✅' },

  // Difficulté
  { key: 'correct_difficile_1000', label: 'Expert difficile', description: '1 000 bonnes réponses en difficulté "difficile"', icon: '🔶' },
  { key: 'correct_hardcore_1000', label: 'Maître hardcore', description: '1 000 bonnes réponses en difficulté "hardcore"', icon: '🔴' },

  // Global
  { key: 'all_questions_seen', label: 'Tour complet', description: 'Avoir vu toutes les questions du jeu', icon: '🌍' },

  // Classement (calculés chaque nuit)
  { key: 'classement_top50', label: 'Top 50', description: 'Faire partie du top 50 du classement général', icon: '🥈' },
  { key: 'classement_top10', label: 'Top 10', description: 'Faire partie du top 10 du classement général', icon: '🥇' },
]

export type CategoryLike = { id: string, name: string }

// Construit le catalogue complet (statique + badges de maîtrise dynamiques par catégorie
// et sous-catégorie) à partir des listes de catégories/sous-catégories actives.
export function getFullBadgeCatalog(categories: CategoryLike[], subcategories: CategoryLike[]): BadgeDef[] {
  const categorieBadges: BadgeDef[] = categories.map(c => ({
    key: `categorie_maitrise_${c.id}`,
    label: `Maître : ${c.name}`,
    description: `Répondre juste à toutes les questions de la catégorie "${c.name}"`,
    icon: '📖',
  }))
  const sousCategorieBadges: BadgeDef[] = subcategories.map(sc => ({
    key: `souscategorie_maitrise_${sc.id}`,
    label: `Expert : ${sc.name}`,
    description: `Répondre juste à toutes les questions de la sous-catégorie "${sc.name}"`,
    icon: '📗',
  }))
  return [...BADGES_CATALOG, ...categorieBadges, ...sousCategorieBadges]
}

export function findBadgeDef(catalog: BadgeDef[], key: string): BadgeDef | undefined {
  return catalog.find(b => b.key === key)
}
