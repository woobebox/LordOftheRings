import { abilityLabels, calculateChoiceChance, getTopContributors } from './abilities.js';

const dangerScore = {
  '低': 1,
  '中': 2,
  '高': 3,
  '極高': 4,
};

const nodeChoiceProfiles = {
  entry: [
    {
      id: 'quiet-route',
      title: '沿陰影路線潛入',
      ability: 'scout',
      supportAbility: 'will',
      baseChance: 48,
      rewardMode: 'intel',
      prompt: '避開主路與明顯哨點，先建立可撤退的低暴露路線。',
    },
    {
      id: 'secure-camp',
      title: '建立臨時補給點',
      ability: 'guard',
      supportAbility: 'lore',
      baseChance: 45,
      rewardMode: 'stability',
      prompt: '整理入口附近的可守位置，讓隊伍之後行動更穩定。',
    },
    {
      id: 'ask-locals',
      title: '向當地人套取消息',
      ability: 'diplomacy',
      supportAbility: 'scout',
      baseChance: 42,
      rewardMode: 'story',
      prompt: '用低調接觸換取路線情報，但會留下被注意到的可能。',
    },
  ],
  landmark: [
    {
      id: 'decode-signs',
      title: '解讀古老標記',
      ability: 'lore',
      supportAbility: 'will',
      baseChance: 45,
      rewardMode: 'quest',
      prompt: '把地標、傳說與任務目標對齊，找出真正需要推進的節點。',
    },
    {
      id: 'direct-approach',
      title: '直接接觸核心目標',
      ability: 'will',
      supportAbility: 'guard',
      baseChance: 43,
      rewardMode: 'quest',
      prompt: '承受壓力直接處理核心事件，成功時任務推進最快。',
    },
    {
      id: 'coordinate-allies',
      title: '協調盟友支援',
      ability: 'diplomacy',
      supportAbility: 'lore',
      baseChance: 44,
      rewardMode: 'party',
      prompt: '讓地點相關角色與目前任務形成支援鏈，增加隊伍成長。',
    },
  ],
  danger: [
    {
      id: 'ambush-watch',
      title: '設置反伏擊警戒',
      ability: 'scout',
      supportAbility: 'combat',
      baseChance: 40,
      rewardMode: 'intel',
      prompt: '先找出危險來源與視線交會點，降低下一次行動的不確定性。',
    },
    {
      id: 'hold-line',
      title: '正面穩住防線',
      ability: 'combat',
      supportAbility: 'guard',
      baseChance: 38,
      rewardMode: 'stability',
      prompt: '用戰鬥與防守能力承接壓力，避免隊伍在危險點失序。',
    },
    {
      id: 'resist-shadow',
      title: '抵抗黑暗低語',
      ability: 'will',
      supportAbility: 'lore',
      baseChance: 39,
      rewardMode: 'party',
      prompt: '處理心理壓力與誘惑，讓相關角色取得更明顯的成長。',
    },
  ],
};

const nodeProfiles = {
  entry: {
    title: '入口路線判讀',
    focus: '撤退線與補給點',
    recommendedActionId: 'scout',
    riskOffset: -1,
    intelBonus: 8,
    xpBonus: 0,
    progressWeight: 1,
    briefing: '先確認入口、視線死角與撤退路線，能讓後續行動少掉不必要的損耗。',
  },
  landmark: {
    title: '核心目標接觸',
    focus: '任務節點與地標',
    recommendedActionId: 'advance-quest',
    riskOffset: 0,
    intelBonus: 4,
    xpBonus: 4,
    progressWeight: 2,
    briefing: '這裡是任務真正推進的節點，適合把地點情報轉化成可完成的路線成果。',
  },
  danger: {
    title: '高風險威脅處置',
    focus: '伏擊點與心理壓力',
    recommendedActionId: 'party-bond',
    riskOffset: 1,
    intelBonus: 2,
    xpBonus: 8,
    progressWeight: 2,
    briefing: '危險點需要有關聯的角色介入，單純推進容易累積風險，隊伍協同會更有效。',
  },
};

const riskLabels = ['穩定', '可控', '緊張', '高壓', '致命'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const sceneNodeIds = Object.keys(nodeProfiles);

export function getNodeProfile(nodeId) {
  return nodeProfiles[nodeId] ?? nodeProfiles.entry;
}

export function getSceneNodeCompletion(locationId, nodeId, progression) {
  const node = progression.sceneNodes?.[locationId]?.[nodeId] ?? { progress: 0, attempts: 0 };
  const progress = clamp(Number(node.progress) || 0, 0, 5);

  return {
    ...node,
    progress,
    percent: progress * 20,
    complete: progress >= 5,
  };
}

export function getSceneEncounter({ location, sceneNode, activeQuest, activeParty, progression }) {
  const profile = getNodeProfile(sceneNode.id);
  const nodeProgress = getSceneNodeCompletion(location.id, sceneNode.id, progression);
  const linkedParty = activeParty.filter(({ character }) => character.relatedLocations.includes(location.id));
  const questRelevant = activeQuest.locationIds.includes(location.id);
  const baseDanger = dangerScore[location.danger] ?? 2;
  const riskScore = clamp(baseDanger + profile.riskOffset - (nodeProgress.complete ? 1 : 0), 0, 4);
  const masteryIntel = progression.locations?.[location.id]?.intel ?? 0;
  const masteryBonus = Math.floor(clamp(masteryIntel, 0, 160) / 40) * 5;
  const partyBonus = Math.min(18, linkedParty.length * 6);
  const questBonus = questRelevant ? 6 : 0;
  const repeatedPenalty = Math.min(12, nodeProgress.attempts * 3);
  const successChance = clamp(58 - baseDanger * 7 + masteryBonus + partyBonus + questBonus - repeatedPenalty, 35, 94);
  const eventSeed = location.events?.[sceneNode.id === 'danger' ? 0 : sceneNode.id === 'landmark' ? 1 : 2]
    ?? location.events?.[0]
    ?? location.importance;
  const rawChoices = nodeChoiceProfiles[sceneNode.id] ?? nodeChoiceProfiles.entry;
  const recommendedChoiceId = rawChoices.reduce((bestChoice, choice) => {
    const bestChance = calculateChoiceChance({ choice: bestChoice, encounter: { riskScore, nodeProgress }, activeParty, location });
    const nextChance = calculateChoiceChance({ choice, encounter: { riskScore, nodeProgress }, activeParty, location });

    return nextChance > bestChance ? choice : bestChoice;
  }, rawChoices[0]).id;
  const choices = rawChoices.map((choice) => {
    const chance = calculateChoiceChance({ choice, encounter: { riskScore, nodeProgress, recommendedChoiceId }, activeParty, location });
    const contributors = getTopContributors(activeParty, choice.ability, location);

    return {
      ...choice,
      abilityLabel: abilityLabels[choice.ability] ?? choice.ability,
      supportAbilityLabel: choice.supportAbility ? abilityLabels[choice.supportAbility] ?? choice.supportAbility : null,
      successChance: chance,
      recommended: choice.id === recommendedChoiceId,
      contributors: contributors.map(({ character, score }) => ({ id: character.id, name: character.zhName, score })),
    };
  });

  return {
    id: `${location.id}-${sceneNode.id}`,
    nodeId: sceneNode.id,
    title: `${profile.title}：${sceneNode.label}`,
    focus: profile.focus,
    recommendedActionId: profile.recommendedActionId,
    recommendedChoiceId,
    recommendedLabel: profile.recommendedActionId === 'scout'
      ? '偵察地形'
      : profile.recommendedActionId === 'advance-quest'
        ? '推進任務'
        : '隊伍互動',
    briefing: `${profile.briefing} 目前事件：${eventSeed}`,
    riskLabel: riskLabels[riskScore],
    riskScore,
    successChance,
    intelBonus: profile.intelBonus + (questRelevant ? 2 : 0),
    xpBonus: profile.xpBonus + linkedParty.length * 2,
    progressWeight: profile.progressWeight,
    nodeProgress,
    linkedPartyNames: linkedParty.map(({ character }) => character.zhName),
    choices,
    modifiers: [
      `${location.danger}危險區`,
      questRelevant ? '任務路線吻合' : '非目前任務路線',
      linkedParty.length > 0 ? `${linkedParty.length} 名關聯角色在場` : '缺少地點關聯角色',
      nodeProgress.complete ? '節點已穩定' : `節點掌控 ${nodeProgress.percent}%`,
    ],
  };
}
