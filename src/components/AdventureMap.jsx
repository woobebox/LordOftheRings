import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Castle,
  ChevronRight,
  CircleDot,
  Crown,
  DoorOpen,
  Eye,
  EyeOff,
  Flame,
  Gem,
  Landmark,
  LibraryBig,
  MapPin,
  Mountain,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Route,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
  Trees,
  UserRound,
  X,
} from 'lucide-react';
import { characterPortraits, fallbackScene, locationScenes } from '../data/assets.js';
import { characters } from '../data/characters.js';
import { getSceneEncounter, getSceneNodeCompletion } from '../data/encounters.js';
import { factions, journeyRoute, locations } from '../data/locations.js';
import {
  applySceneActionReward,
  clearCampaignLog,
  createDefaultProgression,
  EXPLORATION_ROUTE,
  getCharacterProgress,
  getCompletedExplorationLocationIds,
  getExplorationStatus,
  getLocationProgress,
  getNextQuestLocation,
  getQuestProgress,
  getSceneActions,
  loadProgression,
  resetProgressionStorage,
  saveProgression,
  syncExplorationProgress,
  toggleExplorationMode,
} from '../data/progression.js';
import { quests } from '../data/quests.js';

const allFactions = ['全部勢力', ...factions];

const factionClass = {
  自由人民: 'adv-freefolk',
  精靈: 'adv-elves',
  矮人: 'adv-dwarves',
  洛汗: 'adv-rohan',
  剛鐸: 'adv-gondor',
  魔多: 'adv-mordor',
  荒野: 'adv-wilds',
};

const dangerClass = {
  低: 'safe',
  中: 'watched',
  高: 'hostile',
  極高: 'lethal',
};

const sceneToneClass = {
  低: 'scene-calm',
  中: 'scene-watch',
  高: 'scene-war',
  極高: 'scene-doom',
};

const MAP_MIN_ZOOM = 0.85;
const MAP_MAX_ZOOM = 2.3;
const MAP_ZOOM_STEP = 0.18;
const FOCUS_ZOOM = 1.42;
let threePreloadPromise = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

function getDirectionLabel(angle) {
  const absAngle = Math.abs(angle);
  if (absAngle < 0.42) return '正前方';
  if (absAngle > 2.68) return '後方';
  return angle > 0 ? '右前方' : '左前方';
}

function preloadThree() {
  if (!threePreloadPromise) threePreloadPromise = import('three');
  return threePreloadPromise;
}

function getCharacterPortrait(characterId) {
  return characterPortraits[characterId]?.image ?? null;
}

function getLocationScene(locationId) {
  return locationScenes[locationId] ?? fallbackScene;
}

function getSceneNodes(location) {
  const scene = getLocationScene(location.id);
  const landmarks = scene.landmarks?.length ? scene.landmarks : ['入口路線', '核心地標', '危險點'];

  return [
    {
      id: 'entry',
      title: '入口',
      label: landmarks[0] ?? '入口路線',
      description: scene.entryObjective,
      actionHint: '適合偵察地形',
      x: 22,
      y: 68,
    },
    {
      id: 'landmark',
      title: '核心地標',
      label: landmarks[1] ?? location.zhName,
      description: location.importance,
      actionHint: '適合推進任務',
      x: 52,
      y: 42,
    },
    {
      id: 'danger',
      title: '危險點',
      label: landmarks[2] ?? location.events[0] ?? '未知威脅',
      description: location.events[0] ?? location.history,
      actionHint: '適合隊伍互動',
      x: 78,
      y: 58,
    },
  ];
}

function sceneNodeToWorldPosition(node) {
  return {
    x: ((node.x - 50) / 50) * 11,
    z: ((node.y - 50) / 50) * 12,
  };
}

function getActivePartyPower(activeParty, location) {
  return activeParty.reduce((total, { character, status }) => {
    const locationBonus = character.relatedLocations.includes(location.id) ? 12 : 0;
    const statusBonus = status === 'active' || status === 'scouting' ? 6 : 2;
    return total + Math.round(character.level / 10) + locationBonus + statusBonus;
  }, 0);
}

function getPartyStatus(character, selectedLocation, activeQuest) {
  const listedAtLocation = selectedLocation.people.includes(character.zhName);
  const linkedToLocation = character.relatedLocations.includes(selectedLocation.id);
  const questLinked = activeQuest.locationIds.some((locationId) => character.relatedLocations.includes(locationId));

  if (listedAtLocation || linkedToLocation) return 'active';
  if (questLinked) return 'quest-linked';
  if (character.relatedLocations.some((locationId) => locationId !== selectedLocation.id)) return 'nearby';
  return 'other';
}

function buildPartyRoster(selectedLocation, selectedCharacter, activeQuest) {
  const roster = characters
    .map((character) => ({
      character,
      status: getPartyStatus(character, selectedLocation, activeQuest),
      questMatches: activeQuest.locationIds.filter((locationId) => character.relatedLocations.includes(locationId)).length,
    }))
    .sort((a, b) => {
      const statusRank = { active: 4, 'quest-linked': 3, nearby: 2, other: 1 };
      return statusRank[b.status] - statusRank[a.status]
        || b.questMatches - a.questMatches
        || b.character.level - a.character.level;
    });

  let activeParty = roster.filter((entry) => entry.status === 'active').slice(0, 4);
  if (activeParty.length === 0) {
    activeParty = [{ character: selectedCharacter, status: 'scouting', questMatches: 0 }];
  }

  const activeIds = new Set(activeParty.map((entry) => entry.character.id));
  const reserveParty = roster.filter((entry) => !activeIds.has(entry.character.id));
  const rosterGroups = {
    '任務關聯': reserveParty.filter((entry) => entry.status === 'quest-linked'),
    '鄰近支援': reserveParty.filter((entry) => entry.status === 'nearby'),
    '其他角色': reserveParty.filter((entry) => entry.status === 'other'),
  };

  return { activeParty, reserveParty, rosterGroups };
}

const markerIcons = {
  shire: Trees,
  bree: Landmark,
  weathertop: Mountain,
  rivendell: Sparkles,
  'misty-mountains': Mountain,
  moria: Gem,
  lothlorien: Sparkles,
  fangorn: Trees,
  isengard: Castle,
  edoras: Crown,
  'helms-deep': Shield,
  'minas-tirith': Castle,
  osgiliath: Landmark,
  ithilien: Trees,
  'dead-marshes': CircleDot,
  'black-gate': ShieldAlert,
  'mount-doom': Flame,
  'barad-dur': Flame,
  gondor: Crown,
  rohan: Shield,
  mirkwood: Trees,
  erebor: Gem,
  dale: Landmark,
  'grey-havens': Sparkles,
};

function AdventureTerrain() {
  return (
    <svg className="adventure-terrain" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="routeGlow" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#f4d884" />
          <stop offset="50%" stopColor="#d96a38" />
          <stop offset="100%" stopColor="#f2c35a" />
        </linearGradient>
      </defs>
      <path className="adv-coast" d="M2 14 C9 20 8 31 13 39 C17 47 12 61 21 71 C27 79 25 89 34 98" />
      <path className="adv-river" d="M60 6 C63 18 58 28 62 39 C66 50 64 60 69 70 C73 78 71 88 77 97" />
      <path className="adv-river thin" d="M50 50 C55 57 59 64 60 72 C61 80 65 86 67 94" />
      <path className="adv-road" d="M12 38 C24 36 33 31 42 31 C50 38 45 47 54 52 C60 56 57 67 68 70 C76 72 82 64 88 70" />
      <g className="adv-mountain-range">
        {Array.from({ length: 16 }).map((_, index) => {
          const y = 13 + index * 4.7;
          const x = 44 + (index % 4) * 1.1;
          return <path key={index} d={`M${x - 4} ${y + 7} L${x} ${y} L${x + 4} ${y + 7}`} />;
        })}
      </g>
      <g className="adv-forest">
        {Array.from({ length: 30 }).map((_, index) => (
          <circle
            key={index}
            cx={62 + (index % 8) * 2.2}
            cy={23 + Math.floor(index / 8) * 4.7}
            r={1.15 + (index % 3) * 0.24}
          />
        ))}
      </g>
      <g className="adv-mordor-smoke">
        <path d="M82 54 C86 48 88 43 92 52" />
        <path d="M86 66 C90 58 93 56 96 64" />
        <path d="M79 78 C84 70 88 70 91 80" />
      </g>
    </svg>
  );
}

function ExplorationFog({ progression }) {
  if (!progression.exploration?.enabled) return null;

  const unlockedIds = new Set(progression.exploration.unlockedLocationIds ?? []);
  const currentId = progression.exploration.currentLocationId;
  const visibleLocations = locations.filter((location) => unlockedIds.has(location.id) || location.id === currentId);

  return (
    <svg className="exploration-fog" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <mask id="explorationFogMask">
          <rect width="100" height="100" fill="white" />
          {visibleLocations.map((location) => (
            <circle
              key={location.id}
              cx={location.x}
              cy={location.y}
              r={location.id === currentId ? 15 : 11}
              fill="black"
            />
          ))}
        </mask>
      </defs>
      <rect width="100" height="100" mask="url(#explorationFogMask)" />
      {visibleLocations.map((location) => (
        <circle
          className={location.id === currentId ? 'fog-reveal current' : 'fog-reveal'}
          key={location.id}
          cx={location.x}
          cy={location.y}
          r={location.id === currentId ? 15 : 11}
        />
      ))}
    </svg>
  );
}

function ChapterCompleteOverlay({ summary, onContinue }) {
  if (!summary) return null;

  return (
    <aside className="chapter-complete-overlay" aria-label="章節結算">
      <div className="chapter-complete-card hud-panel">
        <p>Chapter Complete</p>
        <h2>{summary.locationName} 已完成</h2>
        <span>{summary.encounterTitle ?? '區域事件已穩定'} / 節點掌控 {summary.nodeProgress * 20}%</span>
        <div className="chapter-stat-grid">
          <strong>
            <small>Intel</small>
            +{summary.intelGained}
          </strong>
          <strong>
            <small>任務</small>
            {summary.questAdvanced ? '推進' : '記錄'}
          </strong>
          <strong>
            <small>隊伍 XP</small>
            +{summary.characterRewards.reduce((total, reward) => total + reward.gainedXp, 0)}
          </strong>
        </div>
        <ResourceDeltaList delta={summary.resourceDelta} resources={summary.partyResources} compact />
        {summary.characterRewards.length > 0 && (
          <div className="chapter-party-rewards">
            {summary.characterRewards.slice(0, 4).map((reward) => (
              <span key={reward.characterId}>{reward.name} +{reward.gainedXp} XP</span>
            ))}
          </div>
        )}
        {summary.explorationUnlockedLocationId && (
          <div className="chapter-next-route">
            <Sparkles size={17} />
            <span>下一站解鎖：{locations.find((location) => location.id === summary.explorationUnlockedLocationId)?.zhName ?? summary.explorationUnlockedLocationId}</span>
          </div>
        )}
        <button type="button" onClick={onContinue}>返回地圖</button>
      </div>
    </aside>
  );
}

function formatDelta(value) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function ResourceDeltaList({ delta, resources, compact = false }) {
  if (!delta || !resources) return null;

  return (
    <div className={compact ? 'resource-delta-list compact' : 'resource-delta-list'} aria-label="隊伍資源變化">
      <span className={delta.hope >= 0 ? 'positive' : 'negative'}>希望 {formatDelta(delta.hope)} / {resources.hope}</span>
      <span className={delta.fatigue <= 0 ? 'positive' : 'negative'}>疲勞 {formatDelta(delta.fatigue)} / {resources.fatigue}</span>
      <span className={delta.corruption <= 0 ? 'positive' : 'negative'}>腐化 {formatDelta(delta.corruption)} / {resources.corruption}</span>
    </div>
  );
}

function PartyResourceHud({ resources }) {
  const safeResources = resources ?? { hope: 0, fatigue: 0, corruption: 0 };

  return (
    <section className="party-resource-hud hud-panel" aria-label="隊伍資源">
      <span className="resource-pill hope">
        <small>Hope</small>
        <strong>{safeResources.hope}</strong>
      </span>
      <span className="resource-pill fatigue">
        <small>Fatigue</small>
        <strong>{safeResources.fatigue}</strong>
      </span>
      <span className="resource-pill corruption">
        <small>Corruption</small>
        <strong>{safeResources.corruption}</strong>
      </span>
    </section>
  );
}

function QuestPanel({ activeQuest, setActiveQuest, highlightedCount, progression, focusedLocationId, explorationStatus, onSelectQuestLocation, onEnterQuestLocation, onResetProgression }) {
  const activeProgress = getQuestProgress(activeQuest.id, progression, quests);
  const nextLocationId = getNextQuestLocation(activeQuest, progression);
  const targetLocationId = explorationStatus.enabled ? explorationStatus.currentLocationId : nextLocationId;
  const nextLocation = locations.find((location) => location.id === targetLocationId);
  const focusedLocation = locations.find((location) => location.id === focusedLocationId);
  const currentExplorationLocation = locations.find((location) => location.id === explorationStatus.currentLocationId);
  const explorationCompletedIds = useMemo(() => new Set(getCompletedExplorationLocationIds(progression)), [progression]);
  const routeLocationIds = explorationStatus.enabled ? EXPLORATION_ROUTE : activeQuest.locationIds;
  const routeTitle = explorationStatus.enabled ? '探索路線' : '目前任務路線';

  const handleQuestSelect = (quest) => {
    setActiveQuest(quest);
    const nextQuestLocationId = getNextQuestLocation(quest, progression);
    if (nextQuestLocationId) onSelectQuestLocation(nextQuestLocationId);
  };

  return (
    <aside className="quest-panel hud-panel">
      <div className="hud-heading">
        <Swords size={18} />
        <div>
          <p>Quest Tracker</p>
          <h2>遠征任務</h2>
        </div>
      </div>
      {explorationStatus.enabled && (
        <section className="exploration-status-card" aria-label="探索模式狀態">
          <span>探索模式</span>
          <strong>目前目標：{currentExplorationLocation?.zhName ?? explorationStatus.currentLocationId}</strong>
          <small>{explorationStatus.unlockedCount}/{explorationStatus.total} 地點已解鎖</small>
        </section>
      )}
      <div className="quest-list">
        {quests.map((quest) => (
          (() => {
            const questProgress = getQuestProgress(quest.id, progression, quests);

            return (
          <button
            type="button"
            key={quest.id}
            className={`quest-card ${activeQuest.id === quest.id ? 'active' : ''}`}
            onClick={() => handleQuestSelect(quest)}
          >
            <span className="quest-title">{quest.title}</span>
            <span className="quest-objective">{quest.objective}</span>
            <span className="quest-progress" aria-label={`進度 ${questProgress.milestone}%`}>
              <i style={{ width: `${questProgress.milestone}%` }} />
            </span>
            <span className="quest-meta">
              <MapPin size={14} />
              {questProgress.completed}/{questProgress.total} 路線節點
            </span>
          </button>
            );
          })()
        ))}
      </div>
      <section className="quest-route-list" aria-label="目前任務節點">
        <div className="quest-route-heading">
        <h3>{routeTitle}</h3>
          {targetLocationId && (
            <div className="quest-route-actions">
              <button type="button" onClick={() => onSelectQuestLocation(targetLocationId)}>
                鎖定：{nextLocation?.zhName ?? targetLocationId}
              </button>
              <button type="button" disabled={explorationStatus.enabled && !getExplorationStatus(progression, targetLocationId).unlocked} onClick={() => onEnterQuestLocation(targetLocationId)}>
                進入
              </button>
            </div>
          )}
        </div>
        <p className="quest-action-note">
          {focusedLocation
            ? `已鎖定 ${focusedLocation.zhName}。進入地點並完成事件抉擇才會取得 XP、Intel 與任務進度。`
            : '點選路線會鎖定地圖位置；進入地點後完成事件才會獲得成長。'}
        </p>
        {routeLocationIds.map((locationId, index) => {
          const location = locations.find((entry) => entry.id === locationId);
          const complete = explorationStatus.enabled
            ? explorationCompletedIds.has(locationId)
            : activeProgress.completedLocationIds.includes(locationId);
          const next = explorationStatus.enabled
            ? locationId === explorationStatus.currentLocationId && !complete
            : locationId === nextLocationId && !complete;
          const focused = locationId === focusedLocationId;
          const locationExplorationStatus = getExplorationStatus(progression, locationId);
          const locked = explorationStatus.enabled && !locationExplorationStatus.unlocked;

          return (
            <button
              type="button"
              key={locationId}
              className={`quest-route-node ${complete ? 'complete' : ''} ${next ? 'next' : ''} ${focused ? 'focused' : ''} ${locked ? 'locked' : ''}`}
              onClick={() => onSelectQuestLocation(locationId)}
            >
              <span>{index + 1}</span>
              <strong>{location?.zhName ?? locationId}</strong>
              <small>{locked ? '未解鎖' : complete ? '完成' : next ? '下一步' : '待探索'}</small>
            </button>
          );
        })}
      </section>
      <div className="hud-stat-row">
        <span>高亮節點</span>
        <strong>{highlightedCount}</strong>
      </div>
      <button className="reset-progress-wide" type="button" onClick={onResetProgression}>重置進度</button>
    </aside>
  );
}

function LocationPanel({ location, relatedCharacters, progression }) {
  const locationProgress = getLocationProgress(location.id, progression);
  const visibleLevel = locationProgress.mastery.key;
  const showLandmarks = ['scouted', 'familiar', 'controlled', 'legendary'].includes(visibleLevel);
  const showEvents = ['familiar', 'controlled', 'legendary'].includes(visibleLevel);
  const showStrategy = ['controlled', 'legendary'].includes(visibleLevel);

  return (
    <aside className="location-panel hud-panel">
      <div className="hud-heading">
        <ShieldAlert size={18} />
        <div>
          <p>Zone Intel</p>
          <h2>{location.zhName}</h2>
        </div>
      </div>
      <p className="zone-en">{location.enName}</p>
      <div className="zone-tags">
        <span className={factionClass[location.faction]}>{location.faction}</span>
        <span>{location.region}</span>
        <span className={`danger-pill ${dangerClass[location.danger]}`}>危險 {location.danger}</span>
        <span>{locationProgress.mastery.title}</span>
      </div>
      <ProgressMeter
        label="Zone Intel"
        value={locationProgress.intel}
        maxValue={locationProgress.maxIntel}
        detail={`探索 ${locationProgress.visits} 次 / ${locationProgress.nextMastery ? `下一階段：${locationProgress.nextMastery.title}` : '情報完整'}`}
      />
      <section>
        <h3>Zone Lore</h3>
        <p>{location.history}</p>
      </section>
      {showStrategy && <section>
        <h3>Strategic Value</h3>
        <p>{location.importance}</p>
      </section>}
      {showEvents && <section>
        <h3>Encounter Log</h3>
        <div className="event-stack">
          {location.events.map((event) => (
            <span key={event}>
              <ChevronRight size={14} />
              {event}
            </span>
          ))}
        </div>
      </section>}
      {showLandmarks && <section>
        <h3>Linked Heroes</h3>
        <div className="mini-party">
          {relatedCharacters.length > 0 ? (
            relatedCharacters.map((character) => (
              <span key={character.id}>{character.zhName}</span>
            ))
          ) : (
            <span>尚無核心人物資料</span>
          )}
        </div>
      </section>}
    </aside>
  );
}

function CharacterPanel({ character, selectedLocationName, partyStatus, progression, onClose }) {
  const portrait = getCharacterPortrait(character.id);
  const characterProgress = getCharacterProgress(character.id, progression);
  const nextDetail = characterProgress.nextStage
    ? `下一階段：${characterProgress.nextStage.title}`
    : '已達傳奇階段';

  return (
    <aside className="character-panel hud-panel" aria-label="角色詳情">
      <button className="character-drawer-close" type="button" onClick={onClose} aria-label="關閉角色詳情">
        <X size={18} />
      </button>
      <div className="portrait-orb character-image-frame">
        {portrait ? <img src={portrait} alt={`${character.zhName} 角色頭像`} /> : <UserRound size={34} />}
      </div>
      <div className="character-copy">
        <p>{character.archetype} / Lv. {character.level}</p>
        <h2>{character.zhName}</h2>
        <span>{character.enName}</span>
      </div>
      <div className="character-trait">{character.trait}</div>
      <p className="character-bio">{character.bio}</p>
      <div className="character-growth-card">
        <span>{characterProgress.stage.title}</span>
        <ProgressMeter
          label="Character XP"
          value={characterProgress.xp}
          maxValue={characterProgress.maxXp}
          detail={nextDetail}
        />
      </div>
      <div className="hud-stat-row compact">
        <span>目前地點</span>
        <strong>{selectedLocationName}</strong>
      </div>
      <div className="hud-stat-row compact">
        <span>隊伍狀態</span>
        <strong>{partyStatus}</strong>
      </div>
    </aside>
  );
}

function ProgressMeter({ label, value, maxValue, detail }) {
  const percent = maxValue > 0 ? clamp(Math.round((value / maxValue) * 100), 0, 100) : 0;

  return (
    <div className="progress-meter">
      <div className="progress-meter-top">
        <span>{label}</span>
        <strong>{value}/{maxValue}</strong>
      </div>
      <span className="progress-meter-track" aria-label={`${label} ${percent}%`}>
        <i style={{ width: `${percent}%` }} />
      </span>
      {detail && <p>{detail}</p>}
    </div>
  );
}

function SceneWalkthrough3D({ location, scene, sceneNodes, activeSceneNodeId, progression, onSelectSceneNode, onPlayerPoseChange, onNearbyNodeChange }) {
  const mountRef = useRef(null);
  const keysRef = useRef(new Set());
  const playerRef = useRef({ x: 0, z: 7, yaw: 0 });
  const pointerLookRef = useRef(null);
  const nearNodeRef = useRef(null);
  const activeNodeRef = useRef(null);
  const nodeObjectsRef = useRef([]);
  const lastHudRef = useRef({ activeDistance: null, targetAngle: 0, targetLabel: '正前方' });
  const onSelectSceneNodeRef = useRef(onSelectSceneNode);
  const onPlayerPoseChangeRef = useRef(onPlayerPoseChange);
  const onNearbyNodeChangeRef = useRef(onNearbyNodeChange);
  const [nearNodeId, setNearNodeId] = useState(null);
  const [activeDistance, setActiveDistance] = useState(null);
  const [targetDirection, setTargetDirection] = useState({ angle: 0, label: '正前方' });
  const activeNode = sceneNodes.find((node) => node.id === activeSceneNodeId) ?? sceneNodes[0];

  useEffect(() => {
    onSelectSceneNodeRef.current = onSelectSceneNode;
    onPlayerPoseChangeRef.current = onPlayerPoseChange;
    onNearbyNodeChangeRef.current = onNearbyNodeChange;
  }, [onNearbyNodeChange, onPlayerPoseChange, onSelectSceneNode]);

  useEffect(() => {
    activeNodeRef.current = activeNode;
    nodeObjectsRef.current.forEach(({ node, pillar, ring }) => {
      const completion = getSceneNodeCompletion(location.id, node.id, progression);
      const active = node.id === activeNode.id;
      pillar.material.color.setHex(completion.complete ? 0x78be7a : active ? 0xf0c15f : 0x60736a);
      pillar.material.emissive.setHex(completion.complete ? 0x244d22 : active ? 0x6a4310 : 0x10201c);
      pillar.material.emissiveIntensity = active ? 0.58 : 0.28;
      ring.scale.setScalar(active ? 1.18 : 1);
    });
  }, [activeNode, location.id, progression]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let disposed = false;
    let cleanupScene = () => {};

    preloadThree().then((THREE) => {
      if (disposed || !mountRef.current) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    threeScene.fog = new THREE.FogExp2(location.danger === '極高' ? 0x24100c : 0x0b1211, 0.032);

    const camera = new THREE.PerspectiveCamera(62, mount.clientWidth / Math.max(1, mount.clientHeight), 0.1, 120);
    const ambient = new THREE.HemisphereLight(0xf6dfad, 0x152018, 1.8);
    const keyLight = new THREE.DirectionalLight(location.danger === '極高' ? 0xff7b45 : 0xffdf9a, 2.2);
    keyLight.position.set(-5, 8, 6);
    threeScene.add(ambient, keyLight);

    const groundMaterial = new THREE.MeshStandardMaterial({ color: location.danger === '低' ? 0x314c2c : location.danger === '極高' ? 0x3a1d17 : 0x2b3830, roughness: 0.95 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(42, 42, 18, 18), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    threeScene.add(ground);

    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0xd0a85c, emissive: 0x5a3a12, emissiveIntensity: 0.24, roughness: 0.58 });
    const nodeObjects = sceneNodes.map((node, index) => {
      const completion = getSceneNodeCompletion(location.id, node.id, progression);
      const worldPosition = sceneNodeToWorldPosition(node);
      const group = new THREE.Group();
      group.position.set(worldPosition.x, 0, worldPosition.z);

      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.42, 1.65, 14),
        new THREE.MeshStandardMaterial({
          color: completion.complete ? 0x78be7a : node.id === activeSceneNodeId ? 0xf0c15f : 0x60736a,
          emissive: completion.complete ? 0x244d22 : node.id === activeSceneNodeId ? 0x6a4310 : 0x10201c,
          emissiveIntensity: node.id === activeSceneNodeId ? 0.52 : 0.28,
          roughness: 0.65,
        }),
      );
      pillar.position.y = 0.82;
      group.add(pillar);

      if (node.id === 'entry') {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.06, 8, 22, Math.PI), ringMaterial);
        arch.position.y = 1.48;
        arch.rotation.z = Math.PI;
        group.add(arch);
      }

      if (node.id === 'landmark') {
        const obelisk = new THREE.Mesh(
          new THREE.ConeGeometry(0.34, 1.25, 4),
          new THREE.MeshStandardMaterial({ color: 0xd8c17a, emissive: 0x4f3a10, emissiveIntensity: 0.32, roughness: 0.54 }),
        );
        obelisk.position.y = 2.05;
        obelisk.rotation.y = Math.PI / 4;
        group.add(obelisk);
      }

      if (node.id === 'danger') {
        const spikeMaterial = new THREE.MeshStandardMaterial({ color: 0x8f2f25, emissive: 0x3f0806, emissiveIntensity: 0.5, roughness: 0.62 });
        [-0.48, 0.48].forEach((offset) => {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 8), spikeMaterial);
          spike.position.set(offset, 1.25, 0.2);
          spike.rotation.z = offset > 0 ? -0.28 : 0.28;
          group.add(spike);
        });
      }

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 8, 26), ringMaterial);
      ring.position.y = 1.78;
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      threeScene.add(group);
      return { node, group, pillar, ring };
    });
    nodeObjectsRef.current = nodeObjects;

    const landmarkMaterial = new THREE.MeshStandardMaterial({ color: 0x76664b, roughness: 0.88 });
    for (let index = 0; index < 14; index += 1) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + (index % 3) * 0.16), landmarkMaterial);
      const angle = index * 1.92;
      const radius = 9 + (index % 4) * 1.6;
      rock.position.set(Math.cos(angle) * radius, 0.28, Math.sin(angle) * radius);
      rock.rotation.set(index * 0.2, index * 0.45, 0);
      threeScene.add(rock);
    }

    const trunkMaterial = new THREE.MeshStandardMaterial({ color: location.danger === '極高' ? 0x251714 : 0x4a3325, roughness: 0.9 });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: location.danger === '低' ? 0x4f7c3d : 0x2f5645, roughness: 0.86 });
    const ruinMaterial = new THREE.MeshStandardMaterial({ color: location.danger === '極高' ? 0x4c2a21 : 0x6a6253, roughness: 0.82 });
    const fireMaterial = new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0xff5a1f, emissiveIntensity: 1.2, roughness: 0.42 });
    const propGroup = new THREE.Group();

    const treeCount = location.danger === '極高' ? 5 : 12;
    for (let index = 0; index < treeCount; index += 1) {
      const angle = index * 2.37 + 0.4;
      const radius = 6.5 + (index % 5) * 2.2;
      const tree = new THREE.Group();
      tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.5 + (index % 3) * 0.26, 8), trunkMaterial);
      trunk.position.y = 0.75;
      tree.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.62 + (index % 2) * 0.18, 1.55, 9), leafMaterial);
      crown.position.y = 1.95;
      tree.add(crown);
      propGroup.add(tree);
    }

    for (let index = 0; index < 10; index += 1) {
      const angle = index * 1.31 + 0.8;
      const radius = 4.8 + (index % 4) * 1.4;
      const columnHeight = 0.85 + (index % 3) * 0.38;
      const column = new THREE.Mesh(new THREE.BoxGeometry(0.34, columnHeight, 0.34), ruinMaterial);
      column.position.set(Math.cos(angle) * radius, columnHeight / 2, Math.sin(angle) * radius - 0.5);
      column.rotation.y = angle;
      propGroup.add(column);
    }

    for (let index = 0; index < 9; index += 1) {
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.34), landmarkMaterial);
      stone.position.set(-3.5 + index * 0.86, 0.04, 3.1 - index * 0.7);
      stone.rotation.y = index * 0.34;
      propGroup.add(stone);
    }

    sceneNodes.forEach((node, index) => {
      const worldPosition = sceneNodeToWorldPosition(node);
      const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.92, 8), trunkMaterial);
      torch.position.set(worldPosition.x + 0.72, 0.46, worldPosition.z + 0.52);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), fireMaterial);
      flame.position.set(torch.position.x, 1.06, torch.position.z);
      propGroup.add(torch, flame);
    });

    threeScene.add(propGroup);

    const player = playerRef.current;
    let frameId = 0;
    let lastTime = performance.now();
    let walkTime = 0;
    let lastPosePublish = 0;

    const handleKeyDown = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE'].includes(event.code)) {
        event.preventDefault();
      }
      if (event.code === 'KeyE') {
        const currentNear = nodeObjectsRef.current.find(({ node }) => node.id === nearNodeRef.current)?.node;
        if (currentNear) onSelectSceneNodeRef.current(currentNear.id);
      }
      keysRef.current.add(event.code);
    };

    const handleKeyUp = (event) => {
      keysRef.current.delete(event.code);
    };

    const handlePointerDown = (event) => {
      pointerLookRef.current = { pointerId: event.pointerId, x: event.clientX, yaw: player.yaw };
      renderer.domElement.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event) => {
      const pointerLook = pointerLookRef.current;
      if (!pointerLook || pointerLook.pointerId !== event.pointerId) return;
      player.yaw = pointerLook.yaw - (event.clientX - pointerLook.x) * 0.006;
    };

    const handlePointerUp = (event) => {
      if (pointerLookRef.current?.pointerId === event.pointerId) pointerLookRef.current = null;
    };

    const resize = () => {
      const width = mount.clientWidth;
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', resize);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerUp);

    const animate = (time) => {
      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;
      const keys = keysRef.current;
      const speed = 4.4 * delta;

      const forward = Number(keys.has('ArrowUp') || keys.has('KeyW')) - Number(keys.has('ArrowDown') || keys.has('KeyS'));
      const strafe = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
      const moving = forward !== 0 || strafe !== 0;
      const forwardX = Math.sin(player.yaw);
      const forwardZ = -Math.cos(player.yaw);
      const rightX = Math.cos(player.yaw);
      const rightZ = Math.sin(player.yaw);
      player.x += (forwardX * forward + rightX * strafe) * speed;
      player.z += (forwardZ * forward + rightZ * strafe) * speed;
      walkTime += moving ? delta * 8 : 0;
      player.x = clamp(player.x, -12, 12);
      player.z = clamp(player.z, -13, 13);

      let closest = null;
      let closestDistance = Infinity;
      nodeObjects.forEach(({ node, group }, index) => {
        group.rotation.y += delta * (0.42 + index * 0.08);
        const distance = Math.hypot(group.position.x - player.x, group.position.z - player.z);
        if (distance < closestDistance) {
          closest = node.id;
          closestDistance = distance;
        }
      });
      const nextNearNodeId = closestDistance <= 2.4 ? closest : null;
      if (nearNodeRef.current !== nextNearNodeId) {
        nearNodeRef.current = nextNearNodeId;
        setNearNodeId(nextNearNodeId);
      }

      const bob = moving ? Math.sin(walkTime) * 0.035 : 0;
      camera.position.set(player.x, 1.65 + bob, player.z);
      camera.lookAt(player.x + Math.sin(player.yaw) * 8, 1.45 + bob, player.z - Math.cos(player.yaw) * 8);
      if (time - lastPosePublish > 120) {
        lastPosePublish = time;
        const currentActiveNode = activeNodeRef.current ?? sceneNodes[0];
        const activeWorldPosition = sceneNodeToWorldPosition(currentActiveNode);
        const nextActiveDistance = Math.hypot(activeWorldPosition.x - player.x, activeWorldPosition.z - player.z);
        const targetBearing = Math.atan2(activeWorldPosition.x - player.x, -(activeWorldPosition.z - player.z));
        const targetAngle = normalizeAngle(targetBearing - player.yaw);
        const targetLabel = getDirectionLabel(targetAngle);
        const lastHud = lastHudRef.current;
        if (
          lastHud.activeDistance === null
          || Math.abs(lastHud.activeDistance - nextActiveDistance) > 0.12
          || Math.abs(normalizeAngle(lastHud.targetAngle - targetAngle)) > 0.12
          || lastHud.targetLabel !== targetLabel
        ) {
          lastHudRef.current = { activeDistance: nextActiveDistance, targetAngle, targetLabel };
          setActiveDistance(nextActiveDistance);
          setTargetDirection({ angle: targetAngle, label: targetLabel });
        }
        onPlayerPoseChangeRef.current({ x: player.x, z: player.z, yaw: player.yaw, activeDistance: nextActiveDistance });
        onNearbyNodeChangeRef.current({ nodeId: nextNearNodeId, distance: closestDistance });
      }
      renderer.render(threeScene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    resize();
    frameId = window.requestAnimationFrame(animate);

    cleanupScene = () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp);
      renderer.dispose();
      nodeObjectsRef.current = [];
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
    });

    return () => {
      disposed = true;
      cleanupScene();
    };
  }, [location, sceneNodes]);

  const nearNode = sceneNodes.find((node) => node.id === nearNodeId);

  return (
    <div className="scene-3d-shell">
      {scene.image && <img className="scene-3d-backdrop" src={scene.image} alt="" style={{ objectPosition: scene.focalPoint }} />}
      <div className="scene-portal-transition" aria-hidden="true">
        <span />
      </div>
      <div ref={mountRef} className="scene-3d-canvas" aria-label={`${location.zhName} 3D 探索場景`} />
      <span className="scene-3d-reticle" aria-hidden="true" />
      <div className="scene-3d-hud">
        <strong>3D Explore</strong>
        <span>目標：{activeNode?.title ?? '未標記'}{activeDistance !== null ? ` / ${activeDistance.toFixed(1)}m` : ''}</span>
        <span className="scene-3d-direction"><i style={{ transform: `rotate(${targetDirection.angle}rad)` }} />{targetDirection.label}</span>
        <span>WASD / 方向鍵移動，拖曳畫面轉向</span>
        <span>靠近信標按 E 選取事件點</span>
      </div>
      {nearNode && (
        <button className="scene-3d-prompt" type="button" onClick={() => onSelectSceneNode(nearNode.id)}>
          進入：{nearNode.title}
        </button>
      )}
    </div>
  );
}

function SceneOverlay({ location, relatedCharacters, activeParty, activeQuest, progression, rewardSummary, transitionState, activeSceneNodeId, actionPulse, onSelectSceneNode, onApplyAction, onResolveChoice, onClose }) {
  const toneClass = sceneToneClass[location.danger] ?? 'scene-watch';
  const scene = getLocationScene(location.id);
  const sceneNodes = useMemo(() => getSceneNodes(location), [location]);
  const [scenePlayerPose, setScenePlayerPose] = useState({ x: 0, z: 7, yaw: 0 });
  const [nearbySceneNode, setNearbySceneNode] = useState({ nodeId: null, distance: Infinity });
  const handlePlayerPoseChange = useCallback((pose) => {
    setScenePlayerPose((current) => {
      const moved = Math.abs(current.x - pose.x) > 0.18 || Math.abs(current.z - pose.z) > 0.18;
      const turned = Math.abs(normalizeAngle(current.yaw - pose.yaw)) > 0.08;
      return moved || turned ? pose : current;
    });
  }, []);
  const handleNearbyNodeChange = useCallback((next) => {
    setNearbySceneNode((current) => {
      const nodeChanged = current.nodeId !== next.nodeId;
      const distanceChanged = Math.abs((current.distance ?? Infinity) - next.distance) > 0.18;
      return nodeChanged || distanceChanged ? next : current;
    });
  }, []);
  const activeSceneNode = sceneNodes.find((node) => node.id === activeSceneNodeId) ?? sceneNodes[0];
  const activeNodeReachable = nearbySceneNode.nodeId === activeSceneNode.id;
  const nearestNode = sceneNodes.find((node) => node.id === nearbySceneNode.nodeId);
  const encounter = getSceneEncounter({ location, sceneNode: activeSceneNode, activeQuest, activeParty, progression });
  const actions = getSceneActions({ location, activeQuest, activeParty, progression, encounter });
  const partyPower = getActivePartyPower(activeParty, location);

  useEffect(() => {
    if (nearbySceneNode.nodeId && nearbySceneNode.nodeId !== activeSceneNodeId) {
      onSelectSceneNode(nearbySceneNode.nodeId);
    }
  }, [activeSceneNodeId, nearbySceneNode.nodeId, onSelectSceneNode]);

  return (
    <div className={`scene-overlay ${toneClass} ${transitionState}`} role="dialog" aria-modal="true" aria-labelledby="scene-title">
      <div className="scene-backdrop" />
      <section className="scene-panel hud-panel">
        <button className="scene-close" type="button" onClick={onClose} aria-label="離開場景">
          <X size={20} />
          <span>返回地圖</span>
        </button>
        <div className={`scene-stage ${scene.image ? 'has-scene-art' : ''}`}>
          <SceneWalkthrough3D
            location={location}
            scene={scene}
            sceneNodes={sceneNodes}
            activeSceneNodeId={activeSceneNodeId}
            progression={progression}
            onSelectSceneNode={onSelectSceneNode}
            onPlayerPoseChange={handlePlayerPoseChange}
            onNearbyNodeChange={handleNearbyNodeChange}
          />
          <div className="scene-party-strip">
            {activeParty.slice(0, 4).map(({ character, status }) => {
              const portrait = getCharacterPortrait(character.id);

              return (
                <span key={character.id} className={`scene-party-token ${status}`}>
                  {portrait ? <img src={portrait} alt="" /> : <UserRound size={18} />}
                  <strong>{character.zhName}</strong>
                </span>
              );
            })}
          </div>
          <div className="scene-node-map" aria-label="場景小地圖">
            <span
              className="scene-player-marker"
              style={{
                left: `${clamp(((scenePlayerPose.x + 12) / 24) * 100, 8, 92)}%`,
                top: `${clamp(((scenePlayerPose.z + 13) / 26) * 100, 8, 92)}%`,
                transform: `translate(-50%, -50%) rotate(${scenePlayerPose.yaw}rad)`,
              }}
              aria-hidden="true"
            />
            {sceneNodes.map((node) => (
              (() => {
                const completion = getSceneNodeCompletion(location.id, node.id, progression);

                return (
                  <button
                    type="button"
                    key={node.id}
                    className={`${node.id === activeSceneNode.id ? 'active' : ''} ${completion.complete ? 'complete' : ''}`}
                    style={{ left: `${node.x}%`, top: `${node.y}%`, '--node-progress': `${completion.percent}%` }}
                    onClick={() => onSelectSceneNode(node.id)}
                  >
                    <span>{node.title}</span>
                  </button>
                );
              })()
            ))}
          </div>
        </div>
        <div className="scene-copy">
          <p className="scene-kicker">Entering Zone</p>
          <h2 id="scene-title">{location.zhName}</h2>
          <span>{location.enName}</span>
          <div className="scene-entry-title">{scene.entryTitle}</div>
          <div className="scene-meta">
            <strong>{location.region}</strong>
            <strong className={`danger-pill ${dangerClass[location.danger]}`}>危險 {location.danger}</strong>
            <strong>{location.faction}</strong>
          </div>
          <div className="scene-atmosphere">
            <span>{scene.timeOfDay}</span>
            <span>{scene.weather}</span>
            <span>{scene.mood}</span>
          </div>
          <p>{location.importance}</p>
          <section className="scene-briefing">
            <h3>{activeSceneNode.title}</h3>
            <strong>{activeSceneNode.label}</strong>
            <p>{encounter.briefing}</p>
            <small>{activeNodeReachable ? activeSceneNode.actionHint : nearestNode ? `靠近「${nearestNode.title}」後可調查，目前距離 ${nearbySceneNode.distance.toFixed(1)}` : '先在 3D 場景中靠近任一信標。'}</small>
          </section>
          <section className="encounter-card" aria-label="目前場景事件">
            <div className="encounter-heading">
              <div>
                <p>Current Encounter</p>
                <h3>{encounter.title}</h3>
              </div>
              <strong className={`risk-badge risk-${encounter.riskScore}`}>{encounter.riskLabel}</strong>
            </div>
            <div className="encounter-meter-grid">
              <span>
                <small>成功率</small>
                <strong>{encounter.successChance}%</strong>
              </span>
              <span>
                <small>隊伍戰力</small>
                <strong>{partyPower}</strong>
              </span>
              <span>
                <small>節點掌控</small>
                <strong>{encounter.nodeProgress.percent}%</strong>
              </span>
            </div>
            <span className="encounter-progress" aria-label={`節點掌控 ${encounter.nodeProgress.percent}%`}>
              <i style={{ width: `${encounter.nodeProgress.percent}%` }} />
            </span>
            <div className="encounter-modifiers">
              {encounter.modifiers.map((modifier) => <span key={modifier}>{modifier}</span>)}
            </div>
            <div className="recommended-action">
              <Sparkles size={15} />
              <span>推薦：{encounter.recommendedLabel}</span>
            </div>
          </section>
          <div className="scene-landmarks" aria-label="可辨識地標">
            {scene.landmarks.map((landmark) => (
              <span key={landmark}>{landmark}</span>
            ))}
          </div>
          <div className="scene-objectives">
            {location.events.slice(0, 3).map((event) => (
              <span key={event}>
                <ChevronRight size={15} />
                {event}
              </span>
            ))}
          </div>
          <div className="scene-party-list" aria-label="場景相關人物">
            {(relatedCharacters.length > 0 ? relatedCharacters.slice(0, 4) : []).map((character) => (
              <span key={character.id}>{character.zhName}</span>
            ))}
          </div>
          <section className="scene-action-board">
            <h3>事件抉擇</h3>
            {!activeNodeReachable && (
              <p className="scene-proximity-note">請先走到「{activeSceneNode.title}」信標旁，才能執行此節點事件。</p>
            )}
            <div className="choice-grid">
              {encounter.choices.map((choice) => (
                <button
                  type="button"
                  key={choice.id}
                  className={`encounter-choice-card ${choice.recommended ? 'recommended' : ''} ${actionPulse?.choiceId === choice.id ? 'resolved' : ''}`}
                  disabled={!activeNodeReachable}
                  onClick={() => onResolveChoice(choice)}
                >
                  <strong>
                    {choice.title}
                    {choice.recommended && <em>最佳</em>}
                  </strong>
                  <span>{choice.prompt}</span>
                  <div className="choice-meta-row">
                    <small>{choice.abilityLabel}{choice.supportAbilityLabel ? ` + ${choice.supportAbilityLabel}` : ''}</small>
                    <b>{choice.successChance}%</b>
                  </div>
                  {choice.contributors.length > 0 && (
                    <div className="choice-contributors">
                      {choice.contributors.map((entry) => (
                        <span key={entry.id}>{entry.name} +{entry.score}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
          <section className="scene-action-board compact-actions">
            <h3>快速行動</h3>
            {actions.map((action) => (
              <button
                type="button"
                key={action.id}
                className={`scene-action-card ${actionPulse?.actionId === action.id ? 'resolved' : ''}`}
                disabled={!activeNodeReachable || !action.enabled}
                onClick={() => onApplyAction(action.id)}
              >
                <strong>
                  {action.title}
                  {action.recommended && <em>推薦</em>}
                </strong>
                <span>{action.description}</span>
                <small>{!activeNodeReachable ? '尚未靠近目前節點' : action.enabled ? `${action.result} / 成功率 ${action.successChance}%` : action.disabledReason}</small>
              </button>
            ))}
          </section>
          {rewardSummary && (
            <section className="scene-reward-summary reward-pop" key={rewardSummary.id}>
              <div className="reward-heading">
                <Sparkles size={16} />
                <div>
                  <p>Exploration Reward</p>
                  <h3>探索結算</h3>
                </div>
              </div>
              {rewardSummary.encounterTitle && (
                <div className="reward-context">
                  <strong>{rewardSummary.encounterTitle}</strong>
                  <span>{rewardSummary.choiceTitle ? `選擇：${rewardSummary.choiceTitle}` : rewardSummary.wasRecommended ? '採用推薦策略' : `非推薦策略，建議行動為 ${rewardSummary.recommendedAction}`}</span>
                  <small>{rewardSummary.choiceAbility ? `${rewardSummary.choiceAbility} 檢定 ${rewardSummary.choiceChance}% / ` : ''}節點掌控 +{rewardSummary.nodeProgressGained}，目前 {rewardSummary.nodeProgress * 20}%</small>
                  {rewardSummary.choiceContributors?.length > 0 && (
                    <div className="reward-contributors">
                      {rewardSummary.choiceContributors.map((entry) => (
                        <span key={entry.id}>{entry.name} +{entry.score}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="reward-stat-grid">
                <span>
                  <small>地點情報</small>
                  <strong>+{rewardSummary.intelGained}</strong>
                </span>
                <span>
                  <small>熟練度</small>
                  <strong>{rewardSummary.beforeLocationMastery} → {rewardSummary.locationMastery}</strong>
                </span>
                <span>
                  <small>任務</small>
                  <strong>{rewardSummary.questAdvanced ? '已推進' : '已記錄'}</strong>
                </span>
              </div>
              <ResourceDeltaList delta={rewardSummary.resourceDelta} resources={rewardSummary.partyResources} />
              <div className="reward-character-list">
                {rewardSummary.characterRewards.map((reward) => (
                  <span key={reward.characterId}>
                    <strong>{reward.name}</strong>
                    <small>+{reward.gainedXp} XP</small>
                  </span>
                ))}
              </div>
              {rewardSummary.unlocks.length > 0 && (
                <div className="reward-unlocks">
                  {rewardSummary.unlocks.map((unlock) => (
                    <span key={unlock}>{unlock}</span>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function PartyBar({ activeParty, selectedCharacterId, onSelectCharacter, onOpenRoster, reserveCount }) {
  return (
    <nav className="party-bar hud-panel" aria-label="目前任務隊伍列">
      <div className="party-bar-heading">
        <div>
          <p>On Site</p>
          <h2>在場隊伍</h2>
        </div>
        <span>{activeParty.length}</span>
      </div>
      <div className="party-token-grid">
        {activeParty.map(({ character, status }) => {
          const portrait = getCharacterPortrait(character.id);

          return (
            <button
              type="button"
              key={character.id}
              className={`party-token ${character.id === selectedCharacterId ? 'active' : ''} ${factionClass[character.faction]} ${status}`}
              onClick={() => onSelectCharacter(character.id)}
            >
              <span className="party-avatar character-image-frame">
                {portrait ? <img src={portrait} alt="" /> : <UserRound size={18} />}
              </span>
              <span>
                <strong>{character.zhName}</strong>
                <small>{status === 'scouting' ? '偵察中' : character.role}</small>
              </span>
            </button>
          );
        })}
      </div>
      <button className="roster-open-button" type="button" onClick={onOpenRoster}>
        <LibraryBig size={18} />
        <span>角色名冊</span>
        <strong>{reserveCount}</strong>
      </button>
    </nav>
  );
}

function CharacterRosterDrawer({ open, rosterGroups, selectedCharacterId, onSelectCharacter, onClose }) {
  if (!open) return null;

  return (
    <aside className="roster-drawer hud-panel" aria-label="角色名冊">
      <div className="roster-heading">
        <div>
          <p>Roster</p>
          <h2>角色名冊</h2>
        </div>
        <button className="scene-close roster-close" type="button" onClick={onClose} aria-label="關閉角色名冊">
          <X size={18} />
        </button>
      </div>
      {Object.entries(rosterGroups).map(([groupName, entries]) => (
        <section className="roster-group" key={groupName}>
          <h3>{groupName}</h3>
          {entries.length > 0 ? (
            entries.map(({ character, status }) => {
              const portrait = getCharacterPortrait(character.id);

              return (
                <button
                  type="button"
                  key={character.id}
                  className={`roster-card ${character.id === selectedCharacterId ? 'active' : ''} ${status}`}
                  onClick={() => onSelectCharacter(character.id)}
                >
                  <span className="roster-avatar character-image-frame">
                    {portrait ? <img src={portrait} alt="" /> : <UserRound size={18} />}
                  </span>
                  <span>
                    <strong>{character.zhName}</strong>
                    <small>{character.role}</small>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="roster-empty">暫無角色</p>
          )}
        </section>
      ))}
    </aside>
  );
}

function CampaignLogDrawer({ open, logEntries, onClear, onClose }) {
  if (!open) return null;

  const getLocationName = (locationId, fallback) => locations.find((location) => location.id === locationId)?.zhName ?? fallback ?? locationId;

  return (
    <aside className="campaign-log-drawer hud-panel" aria-label="戰役日誌">
      <div className="roster-heading">
        <div>
          <p>Campaign Log</p>
          <h2>戰役日誌</h2>
        </div>
        <button className="scene-close roster-close" type="button" onClick={onClose} aria-label="關閉戰役日誌">
          <X size={18} />
        </button>
      </div>
      <div className="campaign-log-actions">
        <span>{logEntries.length} 筆紀錄</span>
        <button type="button" onClick={onClear} disabled={logEntries.length === 0}>清空日誌</button>
      </div>
      <div className="campaign-log-list">
        {logEntries.length > 0 ? logEntries.map((entry) => (
          <article className="campaign-log-entry" key={entry.id}>
            <div className="campaign-log-entry-head">
              <span>{getLocationName(entry.locationId, entry.locationName)}</span>
              <small>{new Date(entry.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</small>
            </div>
            <strong>{entry.choiceTitle ?? entry.encounterTitle ?? '快速行動'}</strong>
            <p>{entry.choiceAbility ? `${entry.choiceAbility} 檢定 ${entry.choiceChance}%` : entry.encounterTitle}</p>
            <div className="campaign-log-stats">
              <span>Intel +{entry.intelGained}</span>
              <span>掌控 +{entry.nodeProgressGained}</span>
              <span>{entry.questAdvanced ? '任務推進' : '任務記錄'}</span>
            </div>
            <ResourceDeltaList delta={entry.resourceDelta} resources={entry.partyResources} compact />
            {entry.contributors?.length > 0 && (
              <div className="campaign-log-tags">
                {entry.contributors.map((contributor) => (
                  <span key={contributor.id}>{contributor.name} +{contributor.score}</span>
                ))}
              </div>
            )}
            {entry.explorationUnlockedLocationId && (
              <div className="campaign-log-unlock">
                解鎖：{getLocationName(entry.explorationUnlockedLocationId)}
              </div>
            )}
          </article>
        )) : (
          <p className="roster-empty">尚無戰役紀錄。進入地點並完成事件抉擇後會自動記錄。</p>
        )}
      </div>
    </aside>
  );
}

function AdventureMap({ onSwitchView }) {
  const [selectedLocationId, setSelectedLocationId] = useState('rivendell');
  const [selectedCharacterId, setSelectedCharacterId] = useState('aragorn');
  const [activeQuest, setActiveQuest] = useState(quests[0]);
  const [showRoute, setShowRoute] = useState(true);
  const [factionFilter, setFactionFilter] = useState('全部勢力');
  const [mapView, setMapView] = useState({ x: 0, y: 0, zoom: 1 });
  const [dragState, setDragState] = useState(null);
  const [hudVisibility, setHudVisibility] = useState({ quests: true, intel: true, character: false, party: true });
  const [sceneLocationId, setSceneLocationId] = useState(null);
  const [sceneRewardSummary, setSceneRewardSummary] = useState(null);
  const [sceneTransition, setSceneTransition] = useState('entering');
  const [activeSceneNodeId, setActiveSceneNodeId] = useState('entry');
  const [actionPulse, setActionPulse] = useState(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [characterDrawerOpen, setCharacterDrawerOpen] = useState(false);
  const [campaignLogOpen, setCampaignLogOpen] = useState(false);
  const [focusedQuestLocationId, setFocusedQuestLocationId] = useState(null);
  const [unlockAnimation, setUnlockAnimation] = useState(null);
  const [chapterCompleteSummary, setChapterCompleteSummary] = useState(null);
  const [progression, setProgression] = useState(() => loadProgression(characters, locations, quests));
  const mapRef = useRef(null);
  const chapterTimerRef = useRef(null);

  useEffect(() => {
    saveProgression(progression);
  }, [progression]);

  useEffect(() => () => {
    if (chapterTimerRef.current) window.clearTimeout(chapterTimerRef.current);
  }, []);

  useEffect(() => {
    if (!progression.exploration?.enabled || activeQuest.id === 'ringbearer') return;
    setActiveQuest(quests.find((quest) => quest.id === 'ringbearer') ?? quests[0]);
  }, [activeQuest.id, progression.exploration?.enabled]);

  useEffect(() => {
    if (!progression.exploration?.enabled) return;
    const synced = syncExplorationProgress(progression);
    const before = JSON.stringify(progression.exploration);
    const after = JSON.stringify(synced.exploration);
    if (before !== after) setProgression(synced);
  }, [progression.exploration?.enabled, progression.quests?.ringbearer?.completedLocationIds?.join('|')]);

  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? locations[0];
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) ?? characters[0];
  const questIds = useMemo(() => new Set(activeQuest.locationIds), [activeQuest]);
  const characterLocationIds = useMemo(
    () => new Set(selectedCharacter.relatedLocations),
    [selectedCharacter],
  );
  const routeIds = useMemo(() => new Set(journeyRoute), []);
  const selectedExplorationStatus = getExplorationStatus(progression, selectedLocation.id);
  const explorationStatus = getExplorationStatus(progression, progression.exploration?.currentLocationId ?? 'shire');
  const relatedCharacters = characters.filter((character) =>
    character.relatedLocations.includes(selectedLocation.id),
  );
  const sceneLocation = sceneLocationId
    ? locations.find((location) => location.id === sceneLocationId)
    : null;
  const sceneRelatedCharacters = sceneLocation
    ? characters.filter((character) => character.relatedLocations.includes(sceneLocation.id))
    : [];
  const { activeParty, reserveParty, rosterGroups } = useMemo(
    () => buildPartyRoster(selectedLocation, selectedCharacter, activeQuest),
    [activeQuest, selectedCharacter, selectedLocation],
  );
  const selectedPartyStatus = activeParty.find((entry) => entry.character.id === selectedCharacter.id)?.status
    ?? reserveParty.find((entry) => entry.character.id === selectedCharacter.id)?.status
    ?? 'other';
  const highlightedCount = locations.filter(
    (location) => questIds.has(location.id) || characterLocationIds.has(location.id),
  ).length;
  const routePoints = journeyRoute
    .map((id) => locations.find((location) => location.id === id))
    .filter(Boolean)
    .map((location) => `${location.x},${location.y}`)
    .join(' ');

  const updateZoom = (delta, origin) => {
    setMapView((current) => {
      const nextZoom = clamp(current.zoom + delta, MAP_MIN_ZOOM, MAP_MAX_ZOOM);
      if (nextZoom === current.zoom) return current;

      if (!origin) return { ...current, zoom: nextZoom };

      const ratio = nextZoom / current.zoom;
      return {
        zoom: nextZoom,
        x: origin.x - (origin.x - current.x) * ratio,
        y: origin.y - (origin.y - current.y) * ratio,
      };
    });
  };

  const resetMapView = () => {
    setMapView({ x: 0, y: 0, zoom: 1 });
  };

  const focusLocationOnMap = (locationId) => {
    const location = locations.find((entry) => entry.id === locationId);
    const rect = mapRef.current?.getBoundingClientRect();
    setFocusedQuestLocationId(locationId);
    if (!location || !rect) {
      setSelectedLocationId(locationId);
      return;
    }

    const nextZoom = clamp(FOCUS_ZOOM, MAP_MIN_ZOOM, MAP_MAX_ZOOM);
    setSelectedLocationId(locationId);
    setMapView({
      zoom: nextZoom,
      x: rect.width / 2 - (location.x / 100) * rect.width * nextZoom,
      y: rect.height / 2 - (location.y / 100) * rect.height * nextZoom,
    });
  };

  const toggleHud = (key) => {
    if (key === 'character') {
      setCharacterDrawerOpen((current) => {
        const nextOpen = !current;
        setHudVisibility((visibility) => ({ ...visibility, character: nextOpen }));
        return nextOpen;
      });
      return;
    }

    setHudVisibility((current) => ({ ...current, [key]: !current[key] }));
  };

  const openCharacterDrawer = (characterId) => {
    setSelectedCharacterId(characterId);
    setHudVisibility((current) => ({ ...current, character: true }));
    setCharacterDrawerOpen(true);
  };

  const closeCharacterDrawer = () => {
    setCharacterDrawerOpen(false);
    setHudVisibility((current) => ({ ...current, character: false }));
  };

  const handleRosterCharacterSelect = (characterId) => {
    openCharacterDrawer(characterId);
    setRosterOpen(false);
  };

  const handleEnterLocation = () => {
    if (selectedExplorationStatus.locked) return;
    preloadThree();
    setSceneTransition('entering');
    setSceneLocationId(selectedLocation.id);
    setSceneRewardSummary(null);
    setActiveSceneNodeId('entry');
    setActionPulse(null);
  };

  const handleEnterQuestLocation = (locationId) => {
    if (getExplorationStatus(progression, locationId).locked) return;
    preloadThree();
    focusLocationOnMap(locationId);
    setSceneTransition('entering');
    setSceneLocationId(locationId);
    setSceneRewardSummary(null);
    setActiveSceneNodeId('entry');
    setActionPulse(null);
  };

  const handleSceneAction = (actionId) => {
    if (!sceneLocation) return;
    const sceneNodes = getSceneNodes(sceneLocation);
    const activeSceneNode = sceneNodes.find((node) => node.id === activeSceneNodeId) ?? sceneNodes[0];
    const encounter = getSceneEncounter({ location: sceneLocation, sceneNode: activeSceneNode, activeQuest, activeParty, progression });
    const { nextState, rewardSummary } = applySceneActionReward(progression, actionId, {
      location: sceneLocation,
      activeQuest,
      activeParty,
      encounter,
    });
    if (!rewardSummary) return;
    setProgression(nextState);
    setSceneRewardSummary(rewardSummary);
    setActionPulse({ id: rewardSummary.id, actionId });
    if (rewardSummary.explorationUnlockedLocationId) {
      triggerChapterComplete(rewardSummary);
    }
    window.setTimeout(() => setActionPulse(null), 820);
  };

  const handleResolveSceneChoice = (choice) => {
    if (!sceneLocation) return;
    const sceneNodes = getSceneNodes(sceneLocation);
    const activeSceneNode = sceneNodes.find((node) => node.id === activeSceneNodeId) ?? sceneNodes[0];
    const encounter = getSceneEncounter({ location: sceneLocation, sceneNode: activeSceneNode, activeQuest, activeParty, progression });
    const resolvedChoice = encounter.choices.find((entry) => entry.id === choice.id) ?? choice;
    const { nextState, rewardSummary } = applySceneActionReward(progression, resolvedChoice.rewardMode, {
      location: sceneLocation,
      activeQuest,
      activeParty,
      encounter,
      choice: resolvedChoice,
    });
    if (!rewardSummary) return;
    setProgression(nextState);
    setSceneRewardSummary(rewardSummary);
    setActionPulse({ id: rewardSummary.id, choiceId: resolvedChoice.id });
    if (rewardSummary.explorationUnlockedLocationId) {
      triggerChapterComplete(rewardSummary);
    }
    window.setTimeout(() => setActionPulse(null), 820);
  };

  const triggerChapterComplete = (rewardSummary) => {
    if (chapterTimerRef.current) window.clearTimeout(chapterTimerRef.current);
    setChapterCompleteSummary(rewardSummary);
    chapterTimerRef.current = window.setTimeout(() => {
      setChapterCompleteSummary(null);
      setSceneRewardSummary(null);
      handleExplorationUnlock(rewardSummary.explorationUnlockedLocationId);
      chapterTimerRef.current = null;
    }, 3200);
  };

  const handleExplorationUnlock = (locationId) => {
    const unlockedLocation = locations.find((location) => location.id === locationId);
    setSceneTransition('leaving');
    window.setTimeout(() => {
      setSceneLocationId(null);
      setSceneTransition('entering');
      setActiveSceneNodeId('entry');
      setActionPulse(null);
      setUnlockAnimation({ id: `${Date.now()}-${locationId}`, locationId, locationName: unlockedLocation?.zhName ?? locationId });
      focusLocationOnMap(locationId);
      window.setTimeout(() => setUnlockAnimation(null), 2600);
    }, 520);
  };

  const handleContinueChapterComplete = () => {
    const nextLocationId = chapterCompleteSummary?.explorationUnlockedLocationId;
    if (chapterTimerRef.current) {
      window.clearTimeout(chapterTimerRef.current);
      chapterTimerRef.current = null;
    }
    setChapterCompleteSummary(null);
    setSceneRewardSummary(null);
    if (nextLocationId) handleExplorationUnlock(nextLocationId);
  };

  const handleSelectSceneNode = (nodeId) => {
    setActiveSceneNodeId(nodeId);
    setSceneRewardSummary(null);
    setActionPulse(null);
  };

  const handleCloseScene = () => {
    if (chapterTimerRef.current) {
      window.clearTimeout(chapterTimerRef.current);
      chapterTimerRef.current = null;
    }
    setChapterCompleteSummary(null);
    setSceneTransition('leaving');
    window.setTimeout(() => {
      setSceneLocationId(null);
      setSceneRewardSummary(null);
      setSceneTransition('entering');
      setActiveSceneNodeId('entry');
      setActionPulse(null);
    }, 420);
  };

  const handleResetProgression = () => {
    if (!window.confirm('確定要重置所有角色 XP、地點情報與任務進度嗎？')) return;
    if (chapterTimerRef.current) {
      window.clearTimeout(chapterTimerRef.current);
      chapterTimerRef.current = null;
    }
    resetProgressionStorage();
    setProgression(createDefaultProgression(characters, locations, quests));
    setSceneRewardSummary(null);
    setChapterCompleteSummary(null);
  };

  const handleToggleExplorationMode = () => {
    setProgression((current) => toggleExplorationMode(current));
  };

  const handleClearCampaignLog = () => {
    setProgression((current) => clearCampaignLog(current));
  };

  const handleMapPointerDown = (event) => {
    if (event.target.closest('button, select, input, a')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewX: mapView.x, viewY: mapView.y });
  };

  const handleMapPointerMove = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    setMapView((current) => ({
      ...current,
      x: dragState.viewX + event.clientX - dragState.startX,
      y: dragState.viewY + event.clientY - dragState.startY,
    }));
  };

  const handleMapPointerUp = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    setDragState(null);
  };

  const handleMapWheel = (event) => {
    event.preventDefault();
    const rect = mapRef.current?.getBoundingClientRect();
    const origin = rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null;
    updateZoom(event.deltaY < 0 ? MAP_ZOOM_STEP : -MAP_ZOOM_STEP, origin);
  };

  return (
    <main className="adventure-shell">
      <div
        ref={mapRef}
        className={`adventure-map ${progression.exploration?.enabled ? 'exploration-active' : ''} ${dragState ? 'dragging' : ''}`}
        role="application"
        aria-label="沉浸式中土 MMORPG 地圖，可拖曳與縮放"
        onPointerDown={handleMapPointerDown}
        onPointerMove={handleMapPointerMove}
        onPointerUp={handleMapPointerUp}
        onPointerCancel={handleMapPointerUp}
        onWheel={handleMapWheel}
      >
        <div
          className="adventure-map-stage"
          style={{ transform: `translate3d(${mapView.x}px, ${mapView.y}px, 0) scale(${mapView.zoom})` }}
        >
          <AdventureTerrain />
          {showRoute && (
            <svg className="adventure-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={routePoints} />
            </svg>
          )}
          <ExplorationFog progression={progression} />

          <span className="world-label west">Eriador</span>
          <span className="world-label north">Rhovanion</span>
          <span className="world-label south">Gondor</span>
          <span className="world-label east">Mordor</span>

          {locations.map((location) => {
            const Icon = markerIcons[location.id] ?? MapPin;
            const isSelected = selectedLocation.id === location.id;
            const isQuest = questIds.has(location.id);
            const isCharacter = characterLocationIds.has(location.id);
            const isRoute = routeIds.has(location.id);
            const isFactionVisible = factionFilter === '全部勢力' || factionFilter === location.faction;
            const markerExplorationStatus = getExplorationStatus(progression, location.id);
            const locked = markerExplorationStatus.locked;
            const frontier = markerExplorationStatus.frontier;
            const unlocking = unlockAnimation?.locationId === location.id;

            return (
              <button
                className={`adventure-marker ${factionClass[location.faction]} ${isSelected ? 'selected' : ''} ${isQuest ? 'quest' : ''} ${isCharacter ? 'character-linked' : ''} ${isRoute ? 'route-node' : ''} ${frontier ? 'frontier' : ''} ${unlocking ? 'unlocking' : ''} ${locked ? 'locked' : ''} ${!isFactionVisible ? 'dimmed' : ''}`}
                type="button"
                key={location.id}
                style={{ left: `${location.x}%`, top: `${location.y}%` }}
                disabled={locked}
                onClick={() => {
                  setSelectedLocationId(location.id);
                  setFocusedQuestLocationId(location.id);
                }}
                aria-label={locked ? `${location.zhName} 尚未掌握路線` : `${location.zhName} ${location.enName}`}
              >
                <span className="marker-core">
                  <Icon size={18} />
                </span>
                <span className="marker-name">{location.zhName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {unlockAnimation && (
        <div className="unlock-toast hud-panel" key={unlockAnimation.id}>
          <Sparkles size={18} />
          <div>
            <p>Route Unlocked</p>
            <strong>{unlockAnimation.locationName}</strong>
          </div>
        </div>
      )}

      <PartyResourceHud resources={progression.partyResources} />

      <header className="adventure-topbar hud-panel">
        <div>
          <p>Middle-earth MMORPG Atlas</p>
          <h1>中土遠征地圖</h1>
        </div>
        <div className="top-actions">
          <label className="adventure-select">
            <Shield size={16} />
            <select value={factionFilter} onChange={(event) => setFactionFilter(event.target.value)}>
              {allFactions.map((faction) => (
                <option key={faction} value={faction}>
                  {faction}
                </option>
              ))}
            </select>
          </label>
          <button className={showRoute ? 'hud-button active' : 'hud-button'} type="button" onClick={() => setShowRoute((current) => !current)}>
            <Route size={16} />
            <span>遠征路線</span>
          </button>
          <button className={progression.exploration?.enabled ? 'hud-button active' : 'hud-button'} type="button" onClick={handleToggleExplorationMode}>
            <MapPin size={16} />
            <span>探索模式</span>
          </button>
          <button className="hud-button" type="button" onClick={() => setCampaignLogOpen(true)}>
            <LibraryBig size={16} />
            <span>戰役日誌</span>
          </button>
          <button className="hud-button" type="button" onPointerEnter={preloadThree} onFocus={preloadThree} onClick={handleEnterLocation}>
            <DoorOpen size={16} />
            <span>{selectedExplorationStatus.locked ? '尚未解鎖' : '進入地點'}</span>
          </button>
          <button className="hud-button" type="button" onClick={onSwitchView}>
            <Landmark size={16} />
            <span>白皮書版</span>
          </button>
        </div>
      </header>

      <div className="map-control-panel hud-panel" aria-label="地圖控制列">
        <button className="map-icon-button" type="button" onClick={() => updateZoom(MAP_ZOOM_STEP)} aria-label="放大地圖">
          <Plus size={18} />
        </button>
        <button className="map-icon-button" type="button" onClick={() => updateZoom(-MAP_ZOOM_STEP)} aria-label="縮小地圖">
          <Minus size={18} />
        </button>
        <button className="map-icon-button" type="button" onClick={resetMapView} aria-label="重置地圖視角">
          <RotateCcw size={18} />
        </button>
        <span className="zoom-readout">{Math.round(mapView.zoom * 100)}%</span>
        <span className="drag-hint">
          <Move size={15} />
          拖曳
        </span>
      </div>

      <div className="hud-toggle-panel hud-panel" aria-label="HUD 開關">
        {[
          ['quests', '任務'],
          ['intel', '情報'],
          ['character', '角色'],
          ['party', '隊伍'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`hud-toggle ${hudVisibility[key] ? 'active' : ''}`}
            onClick={() => toggleHud(key)}
          >
            {hudVisibility[key] ? <Eye size={15} /> : <EyeOff size={15} />}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {hudVisibility.quests && (
        <QuestPanel
          activeQuest={activeQuest}
          setActiveQuest={setActiveQuest}
          highlightedCount={highlightedCount}
          progression={progression}
          explorationStatus={explorationStatus}
          focusedLocationId={focusedQuestLocationId ?? selectedLocation.id}
          onSelectQuestLocation={focusLocationOnMap}
          onEnterQuestLocation={handleEnterQuestLocation}
          onResetProgression={handleResetProgression}
        />
      )}
      {hudVisibility.intel && <LocationPanel location={selectedLocation} relatedCharacters={relatedCharacters} progression={progression} />}
      {characterDrawerOpen && (
        <CharacterPanel
          character={selectedCharacter}
          selectedLocationName={selectedLocation.zhName}
          partyStatus={selectedPartyStatus === 'active' ? '在場' : selectedPartyStatus === 'scouting' ? '偵察中' : selectedPartyStatus === 'quest-linked' ? '任務關聯' : selectedPartyStatus === 'nearby' ? '鄰近支援' : '名冊角色'}
          progression={progression}
          onClose={closeCharacterDrawer}
        />
      )}

      {hudVisibility.party && (
        <PartyBar
          activeParty={activeParty}
          selectedCharacterId={selectedCharacter.id}
          onSelectCharacter={openCharacterDrawer}
          onOpenRoster={() => setRosterOpen(true)}
          reserveCount={reserveParty.length}
        />
      )}

      <CharacterRosterDrawer
        open={rosterOpen}
        rosterGroups={rosterGroups}
        selectedCharacterId={selectedCharacter.id}
        onSelectCharacter={handleRosterCharacterSelect}
        onClose={() => setRosterOpen(false)}
      />

      <CampaignLogDrawer
        open={campaignLogOpen}
        logEntries={progression.campaignLog ?? []}
        onClear={handleClearCampaignLog}
        onClose={() => setCampaignLogOpen(false)}
      />

      {sceneLocation && (
        <SceneOverlay
          location={sceneLocation}
          relatedCharacters={sceneRelatedCharacters}
          activeParty={activeParty}
          activeQuest={activeQuest}
          progression={progression}
          rewardSummary={sceneRewardSummary}
          transitionState={sceneTransition}
          activeSceneNodeId={activeSceneNodeId}
          actionPulse={actionPulse}
          onSelectSceneNode={handleSelectSceneNode}
          onApplyAction={handleSceneAction}
          onResolveChoice={handleResolveSceneChoice}
          onClose={handleCloseScene}
        />
      )}
      <ChapterCompleteOverlay summary={chapterCompleteSummary} onContinue={handleContinueChapterComplete} />
    </main>
  );
}

export default AdventureMap;
