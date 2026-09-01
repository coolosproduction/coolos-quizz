// Catalogue des badges du jeu. Les badges sont attribués côté serveur par la fonction SQL
// check_and_award_badges (appelée après chaque partie/révision/ami accepté) et
// check_classement_badges (cron quotidien pour les badges de classement) — jamais côté client.
// Un badge une fois débloqué reste acquis pour toujours (pas de perte possible).
//
// Système de niveaux : plusieurs anciens badges à seuils fixes (ex. streak_7/30/100/365) sont
// désormais regroupés en une seule "famille" affichée comme UN badge qui monte de niveau.
// Chaque niveau reste un badge_key distinct côté base de données (aucun changement du schéma
// d'attribution — check_and_award_badges continue d'insérer streak_7, streak_30, etc. comme
// avant) ; c'est uniquement l'affichage qui regroupe ces lignes et montre le niveau le plus
// élevé obtenu. Le niveau atteint = nombre de badge_key de la famille présents chez le joueur.
//
// Rareté : calculée automatiquement à partir de la position du niveau dans sa famille (premier
// niveau = Commun, dernier niveau = Légendaire). Les badges secrets sont toujours Légendaire et
// restent masqués (icône/nom/description cachés) tant qu'ils ne sont pas débloqués.

export type Rarity = 'commun' | 'rare' | 'epique' | 'legendaire'

export const RARITY_STYLES: Record<Rarity, { label: string, color: string, bg: string, border: string }> = {
  commun: { label: 'Commun', color: '#9b96b8', bg: '#1a1828', border: '#3a3650' },
  rare: { label: 'Rare', color: '#4ecdc4', bg: '#132422', border: '#245652' },
  epique: { label: 'Épique', color: '#a78bfa', bg: '#241c38', border: '#3a2d5a' },
  legendaire: { label: 'Légendaire', color: '#ffd93d', bg: '#241f10', border: '#4a3a10' },
}

export type BadgeLevelDef = {
  key: string
  label: string
  description: string
  icon: string
}

export type BadgeFamily = {
  familyKey: string
  secret: boolean
  levels: BadgeLevelDef[]
}

export type EarnedBadge = { badge_key: string, earned_at: string }

const FIXED_FAMILIES: BadgeFamily[] = [
  {
    familyKey: 'streak',
    secret: false,
    levels: [
      { key: 'streak_7', label: 'Une semaine active', description: 'Jouer ou réviser 7 jours de suite', icon: '🔥' },
      { key: 'streak_30', label: 'Un mois de feu', description: 'Jouer ou réviser 30 jours de suite', icon: '🔥' },
      { key: 'streak_100', label: 'Cent jours', description: 'Jouer ou réviser 100 jours de suite', icon: '🔥' },
      { key: 'streak_365', label: 'Une année entière', description: 'Jouer ou réviser 365 jours de suite', icon: '🔥' },
    ],
  },
  {
    familyKey: 'streak_correct',
    secret: false,
    levels: [
      { key: 'streak_correct_50', label: 'Série de 50', description: '50 bonnes réponses d’affilée', icon: '⚡' },
      { key: 'streak_correct_100', label: 'Série de 100', description: '100 bonnes réponses d’affilée', icon: '⚡' },
      { key: 'streak_correct_500', label: 'Série de 500', description: '500 bonnes réponses d’affilée', icon: '⚡' },
    ],
  },
  {
    familyKey: 'correct_total',
    secret: false,
    levels: [
      { key: 'correct_500', label: '500 bonnes réponses', description: 'Cumuler 500 bonnes réponses', icon: '✅' },
      { key: 'correct_1000', label: '1 000 bonnes réponses', description: 'Cumuler 1 000 bonnes réponses', icon: '✅' },
      { key: 'correct_5000', label: '5 000 bonnes réponses', description: 'Cumuler 5 000 bonnes réponses', icon: '✅' },
      { key: 'correct_10000', label: '10 000 bonnes réponses', description: 'Cumuler 10 000 bonnes réponses', icon: '✅' },
    ],
  },
  {
    familyKey: 'correct_difficulte',
    secret: false,
    levels: [
      { key: 'correct_difficile_1000', label: 'Expert difficile', description: '1 000 bonnes réponses en difficulté "difficile"', icon: '🔶' },
      { key: 'correct_hardcore_1000', label: 'Maître hardcore', description: '1 000 bonnes réponses en difficulté "hardcore"', icon: '🔴' },
    ],
  },
  {
    familyKey: 'perfect_first',
    secret: false,
    levels: [{ key: 'perfect_first', label: 'Sans faute', description: 'Terminer une partie solo avec le score parfait', icon: '💯' }],
  },
  {
    familyKey: 'multi_first_win',
    secret: false,
    levels: [{ key: 'multi_first_win', label: 'Première victoire', description: 'Gagner une partie multijoueur', icon: '🏆' }],
  },
  {
    familyKey: 'friends_10',
    secret: true,
    levels: [{ key: 'friends_10', label: 'Sociable', description: 'Avoir 10 amis sur Coolos Quiz', icon: '🤝' }],
  },
  {
    familyKey: 'revision_assidu_10',
    secret: true,
    levels: [{ key: 'revision_assidu_10', label: 'Élève assidu', description: 'Réviser 10 jours de suite', icon: '📚' }],
  },
  {
    familyKey: 'premium',
    secret: true,
    levels: [{ key: 'premium', label: 'Membre premium', description: 'Être abonné premium', icon: '⭐' }],
  },
  {
    familyKey: 'all_questions_seen',
    secret: true,
    levels: [{ key: 'all_questions_seen', label: 'Tour complet', description: 'Avoir vu toutes les questions du jeu', icon: '🌍' }],
  },
  {
    familyKey: 'classement_top50',
    secret: true,
    levels: [{ key: 'classement_top50', label: 'Top 50', description: 'Faire partie du top 50 du classement général', icon: '🥈' }],
  },
  {
    familyKey: 'classement_top10',
    secret: true,
    levels: [{ key: 'classement_top10', label: 'Top 10', description: 'Faire partie du top 10 du classement général', icon: '🥇' }],
  },
  {
    familyKey: 'collectionneur',
    secret: true,
    levels: [{ key: 'collectionneur', label: 'Collectionneur', description: 'Débloquer tous les autres badges du jeu', icon: '👑' }],
  },
]

export type CategoryLike = { id: string, name: string }
export type SubcategoryLike = { id: string, name: string, category_id: string }

// Construit le catalogue complet (familles statiques + une famille par catégorie active, dont
// les niveaux sont : un niveau par sous-catégorie maîtrisée, puis un niveau final pour la
// maîtrise complète de la catégorie). Les catégories sans sous-catégorie n'ont qu'un seul niveau.
export function getFullBadgeFamilies(categories: CategoryLike[], subcategories: SubcategoryLike[]): BadgeFamily[] {
  const categoryFamilies: BadgeFamily[] = categories.map(c => {
    const subs = subcategories.filter(sc => sc.category_id === c.id)
    const levels: BadgeLevelDef[] = subs.map(sc => ({
      key: `souscategorie_maitrise_${sc.id}`,
      label: `Maître : ${c.name}`,
      description: `Réussir toutes les questions de la sous-catégorie "${sc.name}"`,
      icon: '📖',
    }))
    levels.push({
      key: `categorie_maitrise_${c.id}`,
      label: `Maître : ${c.name}`,
      description: subs.length > 0
        ? `Réussir absolument toutes les questions de la catégorie "${c.name}" (niveau maximum)`
        : `Réussir absolument toutes les questions de la catégorie "${c.name}"`,
      icon: '📖',
    })
    return { familyKey: `categorie_maitrise_${c.id}`, secret: false, levels }
  })
  return [...FIXED_FAMILIES, ...categoryFamilies]
}

// Rareté d'un niveau donné dans sa famille : premier niveau = Commun, dernier = Légendaire,
// les niveaux intermédiaires se répartissent entre Rare et Épique. Un badge secret est toujours
// Légendaire. Une famille à un seul niveau (badge "unique") est Épique par défaut.
export function rarityForLevel(levelIndex: number, totalLevels: number, secret: boolean): Rarity {
  if (secret) return 'legendaire'
  if (totalLevels <= 1) return 'epique'
  if (totalLevels === 2) return levelIndex >= 2 ? 'legendaire' : 'epique'
  if (levelIndex >= totalLevels) return 'legendaire'
  if (levelIndex <= 1) return 'commun'
  const remaining = totalLevels - 2
  const midIndex = levelIndex - 1
  const half = Math.ceil(remaining / 2)
  return midIndex <= half ? 'rare' : 'epique'
}

export type FamilyDisplay = {
  family: BadgeFamily
  level: number          // 0 si jamais obtenu
  total: number
  unlocked: boolean
  def: BadgeLevelDef     // niveau actuel si obtenu, sinon niveau 1 (aperçu)
  rarity: Rarity
  earnedAt: string | null
  nextDef: BadgeLevelDef | null // niveau suivant à débloquer, si non maximum
}

export function getFamilyDisplay(family: BadgeFamily, earned: EarnedBadge[]): FamilyDisplay {
  const earnedMap = new Map(earned.map(e => [e.badge_key, e.earned_at]))
  let level = 0
  family.levels.forEach((lvl, idx) => {
    if (earnedMap.has(lvl.key)) level = idx + 1
  })
  const total = family.levels.length
  const unlocked = level > 0
  const displayIdx = unlocked ? level : 1
  const def = family.levels[displayIdx - 1]
  const rarity = rarityForLevel(displayIdx, total, family.secret)
  const earnedAt = unlocked ? (earnedMap.get(family.levels[level - 1].key) ?? null) : null
  const nextDef = level < total ? family.levels[level] : null
  return { family, level, total, unlocked, def, rarity, earnedAt, nextDef }
}

export function getAllFamilyDisplays(families: BadgeFamily[], earned: EarnedBadge[]): FamilyDisplay[] {
  return families.map(f => getFamilyDisplay(f, earned))
}

export function findFamilyByKey(families: BadgeFamily[], familyKey: string): BadgeFamily | undefined {
  return families.find(f => f.familyKey === familyKey)
}

// Un badge secret non débloqué doit être affiché masqué : icône/nom/description cachés.
export function isHidden(fd: FamilyDisplay): boolean {
  return fd.family.secret && !fd.unlocked
}
