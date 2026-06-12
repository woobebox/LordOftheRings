export const PROGRESSION_STORAGE_KEY = 'lotr-adventure-progression-v1';

const sceneNodeIds = ['entry', 'landmark', 'danger'];
export const EXPLORATION_QUEST_ID = 'ringbearer';
export const EXPLORATION_ROUTE = [
  'shire',
  'bree',
  'weathertop',
  'rivendell',
  'moria',
  'lothlorien',
  'fangorn',
  'edoras',
  'helms-deep',
  'minas-tirith',
  'osgiliath',
  'ithilien',
  'dead-marshes',
  'black-gate',
  'mount-doom',
];
const MAX_CAMPAIGN_LOG_ENTRIES = 50;

export const characterStages = [
  { key: 'scout', title: '偵察者', minXp: 0, unlock: '辨識地點基礎情報' },
  { key: 'ally', title: '盟友', minXp: 60, unlock: '隊伍協同加成' },
  { key: 'veteran', title: '老練者', minXp: 140, unlock: '區域危機判讀' },
  { key: 'hero', title: '英雄', minXp: 260, unlock: '關鍵戰役專精' },
  { key: 'legend', title: '傳奇', minXp: 420, unlock: '史詩結局影響力' },
];

export const locationMasteryStages = [
  { key: 'unknown', title: '未知', minIntel: 0, unlock: '尚未建立可靠地形判讀' },
  { key: 'scouted', title: '已偵察', minIntel: 40, unlock: '標記入口與撤退路線' },
  { key: 'familiar', title: '熟悉', minIntel: 90, unlock: '辨識主要威脅與支援點' },
  { key: 'controlled', title: '掌控', minIntel: 160, unlock: '建立區域戰術優勢' },
  { key: 'legendary', title: '傳說級', minIntel: 250, unlock: '解鎖完整地點傳說與戰略價值' },
];

const maxCharacterXp = characterStages.at(-1).minXp;
const maxLocationIntel = locationMasteryStages.at(-1).minIntel;
const defaultPartyResources = {
  hope: 72,
  fatigue: 18,
  corruption: 8,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function findStageByValue(stages, value, valueKey) {
  return stages.reduce((currentStage, stage) => (value >= stage[valueKey] ? stage : currentStage), stages[0]);
}

function getNextStage(stages, value, valueKey) {
  return stages.find((stage) => value < stage[valueKey]) ?? null;
}

export function getCharacterStage(xp) {
  return findStageByValue(characterStages, xp, 'minXp');
}

export function getNextCharacterStage(xp) {
  return getNextStage(characterStages, xp, 'minXp');
}

export function getLocationMastery(intel) {
  return findStageByValue(locationMasteryStages, intel, 'minIntel');
}

export function getNextLocationMastery(intel) {
  return getNextStage(locationMasteryStages, intel, 'minIntel');
}

export function createDefaultProgression(characters, locations, quests) {
  return {
    version: 1,
    characters: Object.fromEntries(
      characters.map((character) => [
        character.id,
        {
          xp: clamp(Math.max(0, character.level - 50) * 3, 0, 80),
          stage: getCharacterStage(clamp(Math.max(0, character.level - 50) * 3, 0, 80)).key,
          unlockedTraits: [character.trait],
        },
      ]),
    ),
    locations: Object.fromEntries(
      locations.map((location) => [
        location.id,
        {
          intel: 0,
          masteryLevel: 'unknown',
          visits: 0,
        },
      ]),
    ),
    quests: Object.fromEntries(
      quests.map((quest) => [
        quest.id,
        {
          completedLocationIds: [],
          milestone: 0,
        },
      ]),
    ),
    sceneNodes: Object.fromEntries(
      locations.map((location) => [
        location.id,
        Object.fromEntries(
          sceneNodeIds.map((nodeId) => [nodeId, { progress: 0, attempts: 0 }]),
        ),
      ]),
    ),
    sceneCharacters: Object.fromEntries(
      locations.map((location) => [location.id, {}]),
    ),
    exploration: {
      enabled: false,
      unlockedLocationIds: [EXPLORATION_ROUTE[0]],
      currentLocationId: EXPLORATION_ROUTE[0],
    },
    partyResources: { ...defaultPartyResources },
    campaignLog: [],
    lastReward: null,
  };
}

function normalizeProgression(rawState, characters, locations, quests) {
  const defaults = createDefaultProgression(characters, locations, quests);
  const source = rawState && typeof rawState === 'object' ? rawState : {};

  return {
    version: 1,
    characters: Object.fromEntries(
      characters.map((character) => {
        const current = source.characters?.[character.id] ?? defaults.characters[character.id];
        const xp = clamp(Number(current.xp) || 0, 0, maxCharacterXp);
        const stage = getCharacterStage(xp);

        return [
          character.id,
          {
            xp,
            stage: stage.key,
            unlockedTraits: Array.isArray(current.unlockedTraits) && current.unlockedTraits.length > 0
              ? current.unlockedTraits
              : defaults.characters[character.id].unlockedTraits,
          },
        ];
      }),
    ),
    locations: Object.fromEntries(
      locations.map((location) => {
        const current = source.locations?.[location.id] ?? defaults.locations[location.id];
        const intel = clamp(Number(current.intel) || 0, 0, maxLocationIntel);
        const mastery = getLocationMastery(intel);

        return [
          location.id,
          {
            intel,
            masteryLevel: mastery.key,
            visits: Math.max(0, Number(current.visits) || 0),
          },
        ];
      }),
    ),
    quests: Object.fromEntries(
      quests.map((quest) => {
        const current = source.quests?.[quest.id] ?? defaults.quests[quest.id];
        const completedLocationIds = Array.isArray(current.completedLocationIds)
          ? current.completedLocationIds.filter((locationId) => quest.locationIds.includes(locationId))
          : [];

        return [
          quest.id,
          {
            completedLocationIds: [...new Set(completedLocationIds)],
            milestone: clamp(Number(current.milestone) || 0, 0, 100),
          },
        ];
      }),
    ),
    sceneNodes: Object.fromEntries(
      locations.map((location) => {
        const sourceNodes = source.sceneNodes?.[location.id] ?? defaults.sceneNodes[location.id];

        return [
          location.id,
          Object.fromEntries(
            sceneNodeIds.map((nodeId) => {
              const node = sourceNodes?.[nodeId] ?? { progress: 0, attempts: 0 };

              return [
                nodeId,
                {
                  progress: clamp(Number(node.progress) || 0, 0, 5),
                  attempts: Math.max(0, Number(node.attempts) || 0),
                },
              ];
            }),
          ),
        ];
      }),
    ),
    sceneCharacters: Object.fromEntries(
      locations.map((location) => {
        const sourceCharacters = source.sceneCharacters?.[location.id] ?? defaults.sceneCharacters[location.id];

        return [
          location.id,
          Object.fromEntries(
            Object.entries(sourceCharacters ?? {})
              .filter(([, interaction]) => interaction && typeof interaction === 'object')
              .map(([characterId, interaction]) => [
                characterId,
                {
                  talks: Math.max(0, Number(interaction.talks) || 0),
                  helped: Boolean(interaction.helped),
                },
              ]),
          ),
        ];
      }),
    ),
    exploration: normalizeExploration(source.exploration, defaults.exploration, locations),
    partyResources: normalizePartyResources(source.partyResources),
    campaignLog: Array.isArray(source.campaignLog)
      ? source.campaignLog.filter((entry) => entry && typeof entry === 'object').slice(0, MAX_CAMPAIGN_LOG_ENTRIES)
      : [],
    lastReward: source.lastReward ?? null,
  };
}

function normalizePartyResources(rawResources) {
  const source = rawResources && typeof rawResources === 'object' ? rawResources : defaultPartyResources;

  return {
    hope: clamp(Number(source.hope) || defaultPartyResources.hope, 0, 100),
    fatigue: clamp(Number(source.fatigue) || 0, 0, 100),
    corruption: clamp(Number(source.corruption) || 0, 0, 100),
  };
}

function normalizeExploration(rawExploration, defaults, locations) {
  const validLocationIds = new Set(locations.map((location) => location.id));
  const rawUnlocked = Array.isArray(rawExploration?.unlockedLocationIds)
    ? rawExploration.unlockedLocationIds.filter((locationId) => validLocationIds.has(locationId))
    : defaults.unlockedLocationIds;
  const unlockedLocationIds = [...new Set(rawUnlocked.length > 0 ? rawUnlocked : defaults.unlockedLocationIds)];
  const currentLocationId = validLocationIds.has(rawExploration?.currentLocationId)
    ? rawExploration.currentLocationId
    : getNextExplorationLocationIdFromUnlocked(unlockedLocationIds);

  return {
    enabled: Boolean(rawExploration?.enabled),
    unlockedLocationIds,
    currentLocationId,
  };
}

function getNextExplorationLocationIdFromUnlocked(unlockedLocationIds) {
  return EXPLORATION_ROUTE.find((locationId) => !unlockedLocationIds.includes(locationId))
    ?? EXPLORATION_ROUTE.at(-1);
}

function deriveExplorationFromQuestProgress(state, existingExploration = {}) {
  const completed = new Set(getCompletedExplorationLocationIds(state));
  const unlockedLocationIds = [EXPLORATION_ROUTE[0]];

  for (let index = 0; index < EXPLORATION_ROUTE.length; index += 1) {
    const locationId = EXPLORATION_ROUTE[index];
    const nextLocationId = EXPLORATION_ROUTE[index + 1];

    if (!completed.has(locationId) || !nextLocationId) break;
    unlockedLocationIds.push(nextLocationId);
  }

  const currentLocationId = EXPLORATION_ROUTE.find((locationId) => !completed.has(locationId))
    ?? EXPLORATION_ROUTE.at(-1);

  return {
    enabled: Boolean(existingExploration.enabled),
    unlockedLocationIds: [...new Set(unlockedLocationIds)],
    currentLocationId,
  };
}

export function getCompletedExplorationLocationIds(state) {
  const questCompletedLocationIds = state.quests?.[EXPLORATION_QUEST_ID]?.completedLocationIds ?? [];
  const completed = new Set(questCompletedLocationIds.filter((locationId) => EXPLORATION_ROUTE.includes(locationId)));

  EXPLORATION_ROUTE.forEach((locationId) => {
    const sceneNodes = state.sceneNodes?.[locationId] ?? {};
    const nodeComplete = Object.values(sceneNodes).some((node) => Number(node?.progress) >= 5);
    if (nodeComplete) completed.add(locationId);
  });

  return [...completed];
}

export function syncExplorationProgress(state) {
  const nextState = structuredClone(state);
  nextState.exploration = deriveExplorationFromQuestProgress(nextState, nextState.exploration ?? {});
  return nextState;
}

export function loadProgression(characters, locations, quests) {
  if (typeof window === 'undefined') return createDefaultProgression(characters, locations, quests);

  try {
    const stored = window.localStorage.getItem(PROGRESSION_STORAGE_KEY);
    return normalizeProgression(stored ? JSON.parse(stored) : null, characters, locations, quests);
  } catch {
    return createDefaultProgression(characters, locations, quests);
  }
}

export function saveProgression(state) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(state));
}

export function resetProgressionStorage() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PROGRESSION_STORAGE_KEY);
}

export function getCharacterProgress(characterId, state) {
  const current = state.characters[characterId] ?? { xp: 0, stage: 'scout', unlockedTraits: [] };
  const stage = getCharacterStage(current.xp);
  const nextStage = getNextCharacterStage(current.xp);

  return {
    ...current,
    stage,
    nextStage,
    maxXp: maxCharacterXp,
    progressToNext: nextStage ? Math.round((current.xp / nextStage.minXp) * 100) : 100,
  };
}

export function getLocationProgress(locationId, state) {
  const current = state.locations[locationId] ?? { intel: 0, masteryLevel: 'unknown', visits: 0 };
  const mastery = getLocationMastery(current.intel);
  const nextMastery = getNextLocationMastery(current.intel);

  return {
    ...current,
    mastery,
    nextMastery,
    maxIntel: maxLocationIntel,
    progressToNext: nextMastery ? Math.round((current.intel / nextMastery.minIntel) * 100) : 100,
  };
}

export function getQuestProgress(questId, state, quests) {
  const quest = quests.find((entry) => entry.id === questId);
  const current = state.quests[questId] ?? { completedLocationIds: [], milestone: 0 };
  const total = quest?.locationIds.length ?? 0;
  const completed = current.completedLocationIds.length;
  const milestone = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    ...current,
    completed,
    total,
    milestone,
  };
}

export function getNextQuestLocation(activeQuest, state) {
  const questProgress = state.quests[activeQuest.id] ?? { completedLocationIds: [] };
  return activeQuest.locationIds.find((locationId) => !questProgress.completedLocationIds.includes(locationId))
    ?? activeQuest.locationIds.at(-1)
    ?? null;
}

export function getExplorationStatus(state, locationId) {
  const exploration = state.exploration ?? {
    enabled: false,
    unlockedLocationIds: [EXPLORATION_ROUTE[0]],
    currentLocationId: EXPLORATION_ROUTE[0],
  };
  const unlockedLocationIds = exploration.unlockedLocationIds ?? [EXPLORATION_ROUTE[0]];
  const unlocked = unlockedLocationIds.includes(locationId);
  const frontier = locationId === exploration.currentLocationId && unlocked;
  const routeIndex = EXPLORATION_ROUTE.indexOf(locationId);

  return {
    enabled: Boolean(exploration.enabled),
    unlocked,
    frontier,
    locked: Boolean(exploration.enabled && !unlocked),
    routeIndex,
    unlockedCount: unlockedLocationIds.length,
    total: EXPLORATION_ROUTE.length,
    currentLocationId: exploration.currentLocationId,
  };
}

export function toggleExplorationMode(state) {
  const nextState = structuredClone(state);
  const current = nextState.exploration ?? {
    enabled: false,
    unlockedLocationIds: [EXPLORATION_ROUTE[0]],
    currentLocationId: EXPLORATION_ROUTE[0],
  };

  nextState.exploration = deriveExplorationFromQuestProgress(nextState, {
    ...current,
    enabled: !current.enabled,
  });

  return nextState;
}

function syncExplorationWithQuestProgress(nextState, activeQuest, unlocks) {
  const exploration = nextState.exploration;
  if (!exploration?.enabled) return null;

  const beforeUnlocked = new Set(exploration.unlockedLocationIds ?? []);
  const nextExploration = deriveExplorationFromQuestProgress(nextState, exploration);
  nextState.exploration = nextExploration;
  const newlyUnlocked = nextExploration.unlockedLocationIds.find((locationId) => !beforeUnlocked.has(locationId)) ?? null;

  if (newlyUnlocked) {
    unlocks.push(`探索模式解鎖下一站：${newlyUnlocked}`);
  }

  return newlyUnlocked;
}

function appendCampaignLog(nextState, rewardSummary) {
  const entry = {
    id: rewardSummary.id,
    createdAt: new Date().toISOString(),
    locationId: rewardSummary.locationId,
    locationName: rewardSummary.locationName,
    questTitle: rewardSummary.questTitle,
    encounterTitle: rewardSummary.encounterTitle,
    characterInteractionTitle: rewardSummary.characterInteractionTitle,
    characterName: rewardSummary.characterName,
    choiceTitle: rewardSummary.choiceTitle,
    choiceAbility: rewardSummary.choiceAbility,
    choiceChance: rewardSummary.choiceChance,
    contributors: rewardSummary.choiceContributors ?? [],
    intelGained: rewardSummary.intelGained,
    hopeGained: rewardSummary.hopeGained,
    nodeProgressGained: rewardSummary.nodeProgressGained,
    resourceDelta: rewardSummary.resourceDelta,
    partyResources: rewardSummary.partyResources,
    questAdvanced: rewardSummary.questAdvanced,
    characterRewards: rewardSummary.characterRewards,
    unlocks: rewardSummary.unlocks,
    explorationUnlockedLocationId: rewardSummary.explorationUnlockedLocationId,
  };

  nextState.campaignLog = [entry, ...(nextState.campaignLog ?? [])].slice(0, MAX_CAMPAIGN_LOG_ENTRIES);
}

function applyPartyResourceDelta(nextState, delta) {
  const current = nextState.partyResources ?? { ...defaultPartyResources };
  nextState.partyResources = {
    hope: clamp(current.hope + delta.hope, 0, 100),
    fatigue: clamp(current.fatigue + delta.fatigue, 0, 100),
    corruption: clamp(current.corruption + delta.corruption, 0, 100),
  };
}

function getPartyResourceDelta({ choice, resolvedActionId, successTier, isRecommended, encounter, questAdvanced }) {
  const riskScore = encounter?.riskScore ?? 2;
  const rewardMode = choice?.rewardMode ?? (resolvedActionId === 'advance-quest' ? 'quest' : resolvedActionId === 'party-bond' ? 'party' : 'intel');
  const delta = {
    hope: questAdvanced ? 3 : 0,
    fatigue: Math.max(1, riskScore),
    corruption: riskScore >= 3 ? 1 : 0,
  };

  if (isRecommended) {
    delta.hope += 1;
    delta.fatigue -= 1;
  } else {
    delta.fatigue += 1;
  }

  if (successTier === 'strong') {
    delta.hope += 2;
    delta.fatigue -= 1;
  }

  if (successTier === 'risky') {
    delta.hope -= 2;
    delta.fatigue += 2;
    delta.corruption += rewardMode === 'party' || rewardMode === 'story' ? 2 : 1;
  }

  if (rewardMode === 'stability') {
    delta.fatigue -= 3;
  }

  if (rewardMode === 'party') {
    delta.hope += 1;
    delta.corruption -= successTier === 'risky' ? 0 : 1;
  }

  if (rewardMode === 'story') {
    delta.hope += 1;
    delta.corruption += riskScore >= 3 ? 1 : 0;
  }

  if (rewardMode === 'quest') {
    delta.hope += questAdvanced ? 2 : 0;
    delta.fatigue += 1;
  }

  return {
    hope: clamp(delta.hope, -8, 8),
    fatigue: clamp(delta.fatigue, -6, 10),
    corruption: clamp(delta.corruption, -4, 8),
  };
}

export function clearCampaignLog(state) {
  return {
    ...state,
    campaignLog: [],
  };
}

export function getSceneActions({ location, activeQuest, activeParty, progression, encounter }) {
  const questProgress = progression.quests[activeQuest.id] ?? { completedLocationIds: [] };
  const isQuestLocation = activeQuest.locationIds.includes(location.id);
  const isQuestComplete = questProgress.completedLocationIds.includes(location.id);
  const linkedParty = activeParty.filter(({ character }) => character.relatedLocations.includes(location.id));
  const recommendedActionId = encounter?.recommendedActionId;
  const successChance = encounter?.successChance ?? 60;

  const withTacticalContext = (action) => ({
    ...action,
    recommended: action.id === recommendedActionId,
    successChance: action.id === recommendedActionId ? successChance : clamp(successChance - 10, 25, 92),
  });

  return [
    {
      id: 'scout',
      title: '偵察地形',
      description: '標記入口、威脅與撤退路線，提升地點情報與在場隊伍少量 XP。',
      result: '+28 Intel / 在場角色 +8 XP',
      enabled: true,
      disabledReason: '',
    },
    {
      id: 'advance-quest',
      title: '推進任務',
      description: '完成目前任務在此地點的節點，更新任務進度與主要參與者 XP。',
      result: '任務節點完成 / 相關角色 +24 XP',
      enabled: isQuestLocation && !isQuestComplete,
      disabledReason: !isQuestLocation ? '此地點不屬於目前任務' : '此任務節點已完成',
    },
    {
      id: 'party-bond',
      title: '隊伍互動',
      description: '讓與此地點有關聯的在場角色觸發記憶、戰術或劇情成長。',
      result: '相關在場角色 +18 XP',
      enabled: linkedParty.length > 0,
      disabledReason: '目前在場隊伍沒有此地點的關聯角色',
    },
  ].map(withTacticalContext);
}

function applyCharacterXp(nextState, character, gainedXp, unlocks, characterRewards) {
  const current = nextState.characters[character.id];
  if (!current || gainedXp <= 0) return;

  const beforeStage = getCharacterStage(current.xp);
  const beforeXp = current.xp;
  current.xp = clamp(current.xp + gainedXp, 0, maxCharacterXp);
  const afterStage = getCharacterStage(current.xp);
  current.stage = afterStage.key;

  if (beforeStage.key !== afterStage.key) {
    current.unlockedTraits = [...new Set([...current.unlockedTraits, afterStage.unlock])];
    unlocks.push(`${character.zhName} 升階為 ${afterStage.title}`);
  }

  characterRewards.push({
    characterId: character.id,
    name: character.zhName,
    gainedXp,
    beforeXp,
    afterXp: current.xp,
    beforeStage: beforeStage.title,
    afterStage: afterStage.title,
  });
}

const choiceRewardModeAction = {
  intel: 'scout',
  stability: 'scout',
  quest: 'advance-quest',
  party: 'party-bond',
  story: 'scout',
};

function getCharacterInteractionDelta(character, interactionType) {
  const support = interactionType === 'support';
  const delta = {
    hope: support ? 3 : 2,
    fatigue: support ? -2 : -1,
    corruption: 0,
  };

  if (['Istari', 'Survivor', 'Guardian'].includes(character.archetype)) {
    delta.hope += 1;
    delta.corruption -= support ? 2 : 1;
  }

  if (['Ranger King', 'Warden', 'Marksman'].includes(character.archetype)) {
    delta.fatigue -= 1;
  }

  if (['Raid Boss', 'Stalker'].includes(character.archetype)) {
    delta.hope -= support ? 2 : 1;
    delta.fatigue += 1;
    delta.corruption += support ? 2 : 1;
  }

  if (character.faction === '魔多') {
    delta.corruption += 2;
  }

  return {
    hope: clamp(delta.hope, -5, 6),
    fatigue: clamp(delta.fatigue, -5, 5),
    corruption: clamp(delta.corruption, -4, 6),
  };
}

export function getSceneCharacterInteraction(locationId, characterId, state) {
  return state.sceneCharacters?.[locationId]?.[characterId] ?? { talks: 0, helped: false };
}

export function applySceneCharacterInteractionReward(state, interactionType, { location, character, activeQuest }) {
  const nextState = structuredClone(state);
  const characterRewards = [];
  const unlocks = [];
  const locationProgress = nextState.locations[location.id];
  const beforeMastery = getLocationMastery(locationProgress.intel);
  const locationCharacters = nextState.sceneCharacters[location.id] ?? {};
  const currentInteraction = locationCharacters[character.id] ?? { talks: 0, helped: false };
  const alreadyHelped = currentInteraction.helped && interactionType === 'support';
  const repeatedTalks = currentInteraction.talks;
  const related = character.relatedLocations.includes(location.id);
  const questRelevant = activeQuest.locationIds.includes(location.id);
  const interactionLabel = interactionType === 'support' ? '請求支援' : '交談情報';
  const baseIntel = interactionType === 'support' ? 10 : 14;
  const repeatPenalty = Math.min(8, repeatedTalks * 4 + (alreadyHelped ? 8 : 0));
  const intelGained = clamp(baseIntel + (related ? 6 : 0) + (questRelevant ? 3 : 0) - repeatPenalty, 2, 24);
  const gainedXp = clamp((interactionType === 'support' ? 16 : 10) + (related ? 6 : 0) - repeatedTalks * 2, 4, 28);

  locationProgress.intel = clamp(locationProgress.intel + intelGained, 0, maxLocationIntel);
  locationProgress.visits += 1;
  locationCharacters[character.id] = {
    talks: currentInteraction.talks + 1,
    helped: currentInteraction.helped || interactionType === 'support',
  };
  nextState.sceneCharacters[location.id] = locationCharacters;
  applyCharacterXp(nextState, character, gainedXp, unlocks, characterRewards);

  const afterMastery = getLocationMastery(locationProgress.intel);
  locationProgress.masteryLevel = afterMastery.key;
  if (beforeMastery.key !== afterMastery.key) {
    unlocks.push(`${location.zhName} 熟練度提升為 ${afterMastery.title}`);
  }

  const resourceDelta = getCharacterInteractionDelta(character, interactionType);
  applyPartyResourceDelta(nextState, resourceDelta);

  const rewardSummary = {
    id: `${Date.now()}-${location.id}-${character.id}`,
    actionId: `character-${interactionType}`,
    locationId: location.id,
    locationName: location.zhName,
    characterInteractionTitle: `${interactionLabel}：${character.zhName}`,
    characterName: character.zhName,
    intelGained,
    beforeLocationMastery: beforeMastery.title,
    locationMastery: afterMastery.title,
    locationVisits: locationProgress.visits,
    questTitle: activeQuest.title,
    questAdvanced: false,
    questMilestone: nextState.quests[activeQuest.id]?.milestone ?? 0,
    choiceTitle: null,
    choicePrompt: null,
    choiceAbility: null,
    choiceChance: null,
    choiceResultTier: null,
    choiceContributors: [],
    encounterTitle: null,
    encounterFocus: character.role,
    encounterRisk: null,
    successChance: null,
    recommendedAction: interactionType === 'support' ? '角色支援' : '交談情報',
    wasRecommended: true,
    nodeProgressGained: 0,
    nodeProgress: 0,
    resourceDelta,
    partyResources: nextState.partyResources,
    explorationUnlockedLocationId: null,
    characterRewards,
    unlocks,
  };

  nextState.lastReward = rewardSummary;
  appendCampaignLog(nextState, rewardSummary);
  return { nextState, rewardSummary };
}

export function applySceneActionReward(state, actionId, { location, activeQuest, activeParty, encounter, choice = null }) {
  const nextState = structuredClone(state);
  const characterRewards = [];
  const unlocks = [];
  const locationProgress = nextState.locations[location.id];
  const beforeMastery = getLocationMastery(locationProgress.intel);
  const questProgress = nextState.quests[activeQuest.id];
  const isQuestLocation = activeQuest.locationIds.includes(location.id);
  const questWasComplete = questProgress.completedLocationIds.includes(location.id);
  const linkedParty = activeParty.filter(({ character }) => character.relatedLocations.includes(location.id));
  const requestedActionId = choice ? choiceRewardModeAction[choice.rewardMode] ?? actionId : actionId;
  const resolvedActionId = requestedActionId === 'advance-quest'
    && (!activeQuest.locationIds.includes(location.id) || questProgress.completedLocationIds.includes(location.id))
    ? 'scout'
    : requestedActionId;
  const nodeId = encounter?.nodeId ?? 'entry';
  const sceneNode = nextState.sceneNodes?.[location.id]?.[nodeId];
  const isRecommended = choice ? choice.recommended : actionId === encounter?.recommendedActionId;
  const choiceChance = choice?.successChance ?? encounter?.successChance ?? 60;
  const successTier = choiceChance >= 72 ? 'strong' : choiceChance >= 48 ? 'partial' : 'risky';
  const choiceIntelBonus = choice?.rewardMode === 'intel' || choice?.rewardMode === 'story' ? 8 : choice?.rewardMode === 'stability' ? 4 : 0;
  const choiceXpBonus = choice?.rewardMode === 'party' ? 8 : choice?.rewardMode === 'quest' ? 4 : 0;
  const successProgressBonus = successTier === 'strong' ? 1 : successTier === 'risky' ? -1 : 0;
  const nodeProgressWeight = encounter?.progressWeight ?? 1;
  const nodeIntelBonus = encounter?.intelBonus ?? 0;
  const nodeXpBonus = encounter?.xpBonus ?? 0;
  let intelGained = 0;
  let questAdvanced = false;
  let nodeProgressGained = 0;

  if (sceneNode) {
    sceneNode.attempts += 1;
  }

  if (resolvedActionId === 'scout') {
    intelGained = 28 + choiceIntelBonus + (isRecommended ? nodeIntelBonus : Math.floor(nodeIntelBonus / 2));
    locationProgress.intel = clamp(locationProgress.intel + intelGained, 0, maxLocationIntel);
    locationProgress.visits += 1;
    nodeProgressGained = clamp((isRecommended ? nodeProgressWeight : 1) + successProgressBonus, 1, 4);
    activeParty.forEach(({ character }) => applyCharacterXp(nextState, character, 8 + choiceXpBonus + (isRecommended ? nodeXpBonus : 0), unlocks, characterRewards));
  }

  if (resolvedActionId === 'advance-quest') {
    if (!isQuestLocation || questWasComplete) {
      return { nextState: state, rewardSummary: null };
    }
    questProgress.completedLocationIds = [...questProgress.completedLocationIds, location.id];
    questAdvanced = true;
    intelGained = 16 + choiceIntelBonus + (isRecommended ? nodeIntelBonus : 0);
    locationProgress.intel = clamp(locationProgress.intel + intelGained, 0, maxLocationIntel);
    locationProgress.visits += 1;
    nodeProgressGained = clamp((isRecommended ? nodeProgressWeight + 1 : 1) + successProgressBonus, 1, 5);
    const rewardTargets = linkedParty.length > 0 ? linkedParty : activeParty.slice(0, 2);
    rewardTargets.forEach(({ character }) => applyCharacterXp(nextState, character, 24 + choiceXpBonus + (isRecommended ? nodeXpBonus : 0), unlocks, characterRewards));
  }

  if (resolvedActionId === 'party-bond') {
    if (linkedParty.length === 0) {
      return { nextState: state, rewardSummary: null };
    }
    nodeProgressGained = clamp((isRecommended ? nodeProgressWeight + 1 : 1) + successProgressBonus, 1, 5);
    intelGained = choiceIntelBonus + (isRecommended ? Math.max(4, Math.floor(nodeIntelBonus / 2)) : 0);
    locationProgress.intel = clamp(locationProgress.intel + intelGained, 0, maxLocationIntel);
    locationProgress.visits += 1;
    linkedParty.forEach(({ character }) => applyCharacterXp(nextState, character, 18 + choiceXpBonus + (isRecommended ? nodeXpBonus : 0), unlocks, characterRewards));
  }

  if (sceneNode && nodeProgressGained > 0) {
    const beforeNodeProgress = sceneNode.progress;
    sceneNode.progress = clamp(sceneNode.progress + nodeProgressGained, 0, 5);
    if (beforeNodeProgress < 5 && sceneNode.progress >= 5) {
      unlocks.push(`${location.zhName} 的${encounter?.focus ?? '場景節點'}已穩定`);
    }
  }

  const afterMastery = getLocationMastery(locationProgress.intel);
  locationProgress.masteryLevel = afterMastery.key;

  if (beforeMastery.key !== afterMastery.key) {
    unlocks.push(`${location.zhName} 熟練度提升為 ${afterMastery.title}`);
  }

  questProgress.milestone = Math.round((questProgress.completedLocationIds.length / activeQuest.locationIds.length) * 100);
  const resourceDelta = getPartyResourceDelta({ choice, resolvedActionId, successTier, isRecommended, encounter, questAdvanced });
  applyPartyResourceDelta(nextState, resourceDelta);
  const explorationUnlockedLocationId = syncExplorationWithQuestProgress(nextState, activeQuest, unlocks);

  const rewardSummary = {
    id: `${Date.now()}-${location.id}`,
    actionId,
    locationId: location.id,
    locationName: location.zhName,
    intelGained,
    beforeLocationMastery: beforeMastery.title,
    locationMastery: afterMastery.title,
    locationVisits: locationProgress.visits,
    questTitle: activeQuest.title,
    questAdvanced,
    questMilestone: questProgress.milestone,
    choiceTitle: choice?.title ?? null,
    choicePrompt: choice?.prompt ?? null,
    choiceAbility: choice?.abilityLabel ?? null,
    choiceChance: choice?.successChance ?? null,
    choiceResultTier: choice ? successTier : null,
    choiceContributors: choice?.contributors ?? [],
    encounterTitle: encounter?.title ?? null,
    encounterFocus: encounter?.focus ?? null,
    encounterRisk: encounter?.riskLabel ?? null,
    successChance: encounter?.successChance ?? null,
    recommendedAction: encounter?.recommendedLabel ?? null,
    wasRecommended: isRecommended,
    nodeProgressGained,
    nodeProgress: sceneNode?.progress ?? 0,
    resourceDelta,
    partyResources: nextState.partyResources,
    explorationUnlockedLocationId,
    characterRewards,
    unlocks,
  };

  nextState.lastReward = rewardSummary;
  appendCampaignLog(nextState, rewardSummary);
  return { nextState, rewardSummary };
}
