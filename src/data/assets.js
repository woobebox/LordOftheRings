export const locationScenes = {
  shire: {
    image: '/assets/locations/shire-scene.svg',
    focalPoint: '48% 54%',
    entryTitle: '袋底洞外的遠征起點',
    entryObjective: '確認補給、避開黑騎士耳目，從田園路線秘密離開夏爾。',
    landmarks: ['圓門丘陵', '派對樹', '田園小徑'],
    mood: '平靜但被追蹤',
    weather: '清晨薄霧',
    timeOfDay: 'Morning',
    colorGrade: 'meadow-gold',
    prompt:
      'Original fantasy game environment concept art of a peaceful green hill village with round doors, vegetable gardens, and soft morning mist; no film stills, no logos, no text.',
  },
  rivendell: {
    image: '/assets/locations/rivendell-scene.svg',
    focalPoint: '58% 44%',
    entryTitle: '愛隆會議前的山谷庇護所',
    entryObjective: '穿越瀑布露台，集結盟友並確認至尊魔戒的處置方案。',
    landmarks: ['瀑布露台', '精靈山谷橋', '秋葉殿堂'],
    mood: '安全、古老、決策壓力',
    weather: '山谷水霧',
    timeOfDay: 'Dusk',
    colorGrade: 'elven-teal',
    prompt:
      'Original fantasy game environment concept art of an elven valley refuge with cascading waterfalls, terraces, autumn trees, and luminous bridges; no actor likeness, no film stills, no text.',
  },
  moria: {
    image: '/assets/locations/moria-scene.svg',
    focalPoint: '51% 58%',
    entryTitle: '卡札督姆深處的失落大廳',
    entryObjective: '在巨柱與窄橋間維持隊形，穿越地下王國並避免驚動深處威脅。',
    landmarks: ['巨柱大廳', '卡札督姆橋', '冷色火炬'],
    mood: '壓迫、迴音、伏擊風險',
    weather: '地底冷霧',
    timeOfDay: 'Underground',
    colorGrade: 'cold-stone',
    prompt:
      'Original dark fantasy game environment concept art of an abandoned underground dwarf hall, immense pillars, a narrow bridge, cold blue torchlight, and deep shadow; no film stills, no text.',
  },
  lothlorien: {
    image: '/assets/locations/lothlorien-scene.svg',
    focalPoint: '50% 48%',
    entryTitle: '黃金森林的試煉之夜',
    entryObjective: '進入樹上平台接受庇護與試煉，取得後續潛行所需支援。',
    landmarks: ['金色巨樹', '樹上平台', '月光葉片'],
    mood: '寧靜、神秘、精神試煉',
    weather: '無風月夜',
    timeOfDay: 'Moonlight',
    colorGrade: 'gold-silver',
    prompt:
      'Original fantasy game environment concept art of a golden forest sanctuary with high platforms, glowing leaves, silver trunks, and quiet moonlit atmosphere; no film stills, no text.',
  },
  'helms-deep': {
    image: '/assets/locations/helms-deep-scene.svg',
    focalPoint: '50% 58%',
    entryTitle: '暴雨中的深牆防線',
    entryObjective: '部署守軍、守住號角堡與深牆，撐到援軍抵達。',
    landmarks: ['深牆', '號角堡', '山谷要塞'],
    mood: '圍城、緊張、守勢決戰',
    weather: '暴雨與火把煙',
    timeOfDay: 'Night Siege',
    colorGrade: 'storm-iron',
    prompt:
      'Original cinematic fantasy game environment concept art of a stone fortress set into a mountain gorge under storm clouds, defensive walls and torch lines; no film stills, no text.',
  },
  'minas-tirith': {
    image: '/assets/locations/minas-tirith-scene.svg',
    focalPoint: '54% 52%',
    entryTitle: '白城七層防線啟動',
    entryObjective: '巡視城牆、點燃烽火，為帕蘭諾平原之戰爭取時間。',
    landmarks: ['七層白城', '山體王座', '戰場地平線'],
    mood: '壯闊、戒備、正面戰線',
    weather: '戰前晴光',
    timeOfDay: 'Late Afternoon',
    colorGrade: 'white-gold',
    prompt:
      'Original epic fantasy game environment concept art of a white tiered city built into a mountain, sunlit battlements, banners, and a wide battlefield horizon; no film stills, no text.',
  },
  'dead-marshes': {
    image: '/assets/locations/dead-marshes-scene.svg',
    focalPoint: '48% 62%',
    entryTitle: '亡者倒影之間的潛行路線',
    entryObjective: '跟隨嚮導穿越淺水與綠霧，避開戒靈巡弋視線。',
    landmarks: ['綠霧沼澤', '亡者倒影', '蘆葦水道'],
    mood: '迷失、恐懼、低聲潛行',
    weather: '濕冷綠霧',
    timeOfDay: 'Night Fog',
    colorGrade: 'ghost-green',
    prompt:
      'Original dark fantasy game environment concept art of haunted marshland with shallow water, ghostly reflections, reeds, green fog, and distant watchfires; no film stills, no text.',
  },
  'mount-doom': {
    image: '/assets/locations/mount-doom-scene.svg',
    focalPoint: '54% 50%',
    entryTitle: '火山裂隙前的終局判定',
    entryObjective: '抵達熔岩裂隙，在索倫視線下完成摧毀魔戒的最後步驟。',
    landmarks: ['火山錐', '熔岩裂隙', '灰燼天空'],
    mood: '終局、窒息、誘惑壓力',
    weather: '火山灰與熱浪',
    timeOfDay: 'Eruption',
    colorGrade: 'lava-black',
    prompt:
      'Original dark fantasy game environment concept art of a volcanic mountain and fiery crack of doom, ash clouds, black rock, orange lava light; no film stills, no text.',
  },
};

export const characterPortraits = {
  frodo: {
    image: '/assets/characters/frodo-portrait.svg',
    prompt:
      'Original fantasy game portrait of a young halfling ringbearer with worried eyes, travel cloak, soft village colors; no actor likeness, no film stills, no text.',
  },
  sam: {
    image: '/assets/characters/sam-portrait.svg',
    prompt:
      'Original fantasy game portrait of a loyal halfling guardian with pack straps, practical cloak, warm expression, garden-earth palette; no actor likeness, no film stills, no text.',
  },
  aragorn: {
    image: '/assets/characters/aragorn-portrait.svg',
    prompt:
      'Original fantasy game portrait of a weathered ranger king, dark travel cloak, worn leather, noble but tired expression; no actor likeness, no film stills, no text.',
  },
  gandalf: {
    image: '/assets/characters/gandalf-portrait.svg',
    prompt:
      'Original fantasy game portrait of an ancient white wizard with long beard, staff glow, storm-gray eyes, high wisdom; no actor likeness, no film stills, no text.',
  },
  legolas: {
    image: '/assets/characters/legolas-portrait.svg',
    prompt:
      'Original fantasy game portrait of an elven archer with pale hair, forest armor, calm focused gaze, teal and silver palette; no actor likeness, no film stills, no text.',
  },
  gimli: {
    image: '/assets/characters/gimli-portrait.svg',
    prompt:
      'Original fantasy game portrait of a dwarf warrior with braided beard, bronze armor, axe silhouette, forge-warm light; no actor likeness, no film stills, no text.',
  },
  boromir: {
    image: '/assets/characters/boromir-portrait.svg',
    prompt:
      'Original fantasy game portrait of a proud human captain in silver and dark leather armor, horn motif, conflicted expression; no actor likeness, no film stills, no text.',
  },
  faramir: {
    image: '/assets/characters/faramir-portrait.svg',
    prompt:
      'Original fantasy game portrait of a thoughtful forest ranger captain, hooded green cloak, bow strap, restrained noble bearing; no actor likeness, no film stills, no text.',
  },
  theoden: {
    image: '/assets/characters/theoden-portrait.svg',
    prompt:
      'Original fantasy game portrait of an aged horse-lord king in gold and green armor, wind-worn face, renewed resolve; no actor likeness, no film stills, no text.',
  },
  eowyn: {
    image: '/assets/characters/eowyn-portrait.svg',
    prompt:
      'Original fantasy game portrait of a shieldmaiden in pale armor and braided hair, determined gaze, cold morning battlefield light; no actor likeness, no film stills, no text.',
  },
  gollum: {
    image: '/assets/characters/gollum-portrait.svg',
    prompt:
      'Original fantasy game portrait of a gaunt corrupted cave stalker with large reflective eyes, wet stone light, tragic menace; no film stills, no text.',
  },
  sauron: {
    image: '/assets/characters/sauron-portrait.svg',
    prompt:
      'Original dark fantasy game portrait of an armored shadow lord represented by a burning eye-shaped visor, black iron crown silhouette, red fire glow; no film stills, no text.',
  },
};

export const fallbackScene = {
  image: null,
  focalPoint: '50% 50%',
  entryTitle: '未標記區域',
  entryObjective: '偵察地形、確認威脅與可用路線。',
  landmarks: ['區域地形', '勢力邊界', '未知威脅'],
  mood: '偵察中',
  weather: '變動',
  timeOfDay: 'Unknown',
  colorGrade: 'neutral',
};
