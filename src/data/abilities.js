export const abilityLabels = {
  scout: '偵察',
  guard: '守護',
  diplomacy: '外交',
  combat: '戰鬥',
  will: '意志',
  lore: '知識',
};

const archetypeAbilityMap = {
  Survivor: { scout: 3, guard: 2, diplomacy: 2, combat: 1, will: 5, lore: 2 },
  Guardian: { scout: 2, guard: 5, diplomacy: 2, combat: 2, will: 4, lore: 1 },
  'Ranger King': { scout: 5, guard: 3, diplomacy: 4, combat: 4, will: 4, lore: 3 },
  Istari: { scout: 3, guard: 3, diplomacy: 5, combat: 3, will: 5, lore: 5 },
  Marksman: { scout: 5, guard: 2, diplomacy: 2, combat: 4, will: 3, lore: 3 },
  Berserker: { scout: 2, guard: 4, diplomacy: 1, combat: 5, will: 3, lore: 3 },
  Captain: { scout: 2, guard: 4, diplomacy: 3, combat: 4, will: 3, lore: 2 },
  Warden: { scout: 4, guard: 3, diplomacy: 3, combat: 3, will: 4, lore: 3 },
  'War Leader': { scout: 2, guard: 4, diplomacy: 4, combat: 4, will: 4, lore: 2 },
  Shieldmaiden: { scout: 2, guard: 4, diplomacy: 2, combat: 5, will: 5, lore: 1 },
  Stalker: { scout: 5, guard: 1, diplomacy: 1, combat: 2, will: 2, lore: 2 },
  'Raid Boss': { scout: 4, guard: 5, diplomacy: 1, combat: 5, will: 5, lore: 4 },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function getCharacterAbilities(character) {
  return archetypeAbilityMap[character.archetype] ?? { scout: 2, guard: 2, diplomacy: 2, combat: 2, will: 2, lore: 2 };
}

export function getPartyAbilityScore(activeParty, abilityId, location) {
  return activeParty.reduce((total, { character, status }) => {
    const abilities = getCharacterAbilities(character);
    const base = abilities[abilityId] ?? 0;
    const levelBonus = Math.floor(Math.max(0, character.level - 50) / 10);
    const locationBonus = character.relatedLocations.includes(location.id) ? 2 : 0;
    const statusBonus = status === 'active' || status === 'scouting' ? 1 : 0;

    return total + base + levelBonus + locationBonus + statusBonus;
  }, 0);
}

export function getTopContributors(activeParty, abilityId, location, limit = 2) {
  return activeParty
    .map(({ character, status }) => {
      const abilities = getCharacterAbilities(character);
      const locationBonus = character.relatedLocations.includes(location.id) ? 2 : 0;
      const statusBonus = status === 'active' || status === 'scouting' ? 1 : 0;
      const score = (abilities[abilityId] ?? 0) + Math.floor(Math.max(0, character.level - 50) / 10) + locationBonus + statusBonus;

      return { character, score };
    })
    .sort((a, b) => b.score - a.score || b.character.level - a.character.level)
    .slice(0, limit);
}

export function calculateChoiceChance({ choice, encounter, activeParty, location }) {
  const primaryScore = getPartyAbilityScore(activeParty, choice.ability, location);
  const supportScore = choice.supportAbility ? getPartyAbilityScore(activeParty, choice.supportAbility, location) : 0;
  const dangerPenalty = (encounter.riskScore ?? 2) * 7;
  const nodeBonus = Math.floor((encounter.nodeProgress?.progress ?? 0) * 4);
  const recommendedBonus = choice.id === encounter.recommendedChoiceId ? 8 : 0;
  const rawChance = choice.baseChance + primaryScore * 3 + supportScore * 1.5 + nodeBonus + recommendedBonus - dangerPenalty;

  return clamp(Math.round(rawChance), 18, 96);
}
