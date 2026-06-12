export const characterVisuals = {
  frodo: {
    tint: '#40533b',
    accent: '#e0c469',
    prop: 'ring',
    silhouette: 'halfling cloak and ring token',
    fallbackLine: '「魔戒越靠近黑暗，我越需要記住自己為何出發。」',
    locationLines: {
      shire: '「夏爾看起來很安靜，但黑騎士已經讓回家的路變得不一樣了。」',
      'mount-doom': '「如果我停下來，就提醒我還有一步。」',
    },
  },
  sam: {
    tint: '#6a6f3d',
    accent: '#d4a256',
    prop: 'pack',
    silhouette: 'round pack, pan, sturdy cloak',
    fallbackLine: '「只要還有人能站起來，就還不算完。」',
    locationLines: {
      shire: '「先把補給理好，再離開熟悉的路。這樣心裡會穩些。」',
      'mount-doom': '「我背不動它，但我能背你。」',
    },
  },
  aragorn: {
    tint: '#24312f',
    accent: '#d6c482',
    prop: 'sword',
    silhouette: 'dark ranger cloak and long sword',
    fallbackLine: '「蹤跡會說話。先看清它，再決定要不要拔劍。」',
    locationLines: {
      bree: '「布理的牆不高，但每張桌子後面都可能藏著消息。」',
      weathertop: '「風雲頂太開闊。火能拖住戒靈，但不能浪費時間。」',
      rivendell: '「在這裡做出的決定，會把我們帶到很遠的黑暗裡。」',
    },
  },
  gandalf: {
    tint: '#d6d7cf',
    accent: '#fff1a8',
    prop: 'staff',
    silhouette: 'pointed hat, long white beard, glowing staff',
    fallbackLine: '「不要急著把黑暗當成牆。有時它只是逼你看清方向。」',
    locationLines: {
      shire: '「最小的地方，常常藏著最大的轉折。」',
      rivendell: '「會議能決定路線，但不能替任何人承擔路上的重量。」',
      moria: '「摩瑞亞的黑暗不是石頭造成的，是深處仍有東西在聽。」',
    },
  },
  legolas: {
    tint: '#2d6f67',
    accent: '#c9d9c0',
    prop: 'bow',
    silhouette: 'pale hair, elven ears, long bow',
    fallbackLine: '「遠方的風有異樣。敵人還沒出現，但路已經變重了。」',
    locationLines: {
      lothlorien: '「這片森林在聽。若你低聲走，它會替你藏住腳步。」',
      'helms-deep': '「牆外的隊形正在改變。他們會從薄弱處試探。」',
    },
  },
  gimli: {
    tint: '#8a5634',
    accent: '#d09a52',
    prop: 'axe',
    silhouette: 'short warrior, heavy beard, broad axe',
    fallbackLine: '「讓石頭說話，我就知道哪裡能守、哪裡會塌。」',
    locationLines: {
      moria: '「這裡曾是王國，不只是墳墓。走路小心，也保持敬意。」',
      'helms-deep': '「好牆要有好斧頭守著。讓他們靠近一點。」',
    },
  },
  boromir: {
    tint: '#5f6670',
    accent: '#d7d4c8',
    prop: 'horn',
    silhouette: 'captain armor, horn, broad shoulders',
    fallbackLine: '「防線不是地圖上的線，是有人願意站住的位置。」',
    locationLines: {
      rivendell: '「剛鐸在流血。任何決定都不該忘記白城還在抵抗。」',
    },
  },
  faramir: {
    tint: '#365340',
    accent: '#b9caa0',
    prop: 'bow',
    silhouette: 'green hood, ranger bow, calm posture',
    fallbackLine: '「有些勝利太昂貴。先判斷代價，再談勇敢。」',
    locationLines: {
      ithilien: '「伊西力安仍有活著的樹與水聲，別讓戰爭把它全吞掉。」',
      osgiliath: '「撤退不是失敗，是讓下一道防線還有人能守。」',
    },
  },
  theoden: {
    tint: '#607037',
    accent: '#d7b15b',
    prop: 'horse-banner',
    silhouette: 'aged king, horse crest, gold green armor',
    fallbackLine: '「士氣一旦回來，人就能比恐懼站得更久。」',
    locationLines: {
      edoras: '「金殿不只是王座，它是人民知道我們仍未倒下的地方。」',
      'helms-deep': '「今晚我們守住的不是石牆，是洛汗還能有明天。」',
    },
  },
  eowyn: {
    tint: '#b9b8aa',
    accent: '#e5d9a8',
    prop: 'shield',
    silhouette: 'shieldmaiden, pale armor, braided hair',
    fallbackLine: '「不要把恐懼當成命令。它只是另一個需要跨過的門檻。」',
    locationLines: {
      edoras: '「每個人都說要我等待，但等待也會消耗一個人的心。」',
      'minas-tirith': '「若黑影以為我會退，那它看錯了。」',
    },
  },
  gollum: {
    tint: '#4a5a4f',
    accent: '#9bd0a4',
    prop: 'glowing-eyes',
    silhouette: 'thin crouched body, large reflective eyes',
    fallbackLine: '「好路、壞路，我都知道。只是代價不一定由我付。」',
    locationLines: {
      'dead-marshes': '「不要看水裡的臉。它們會讓你忘記腳下的路。」',
      'mount-doom': '「近了，近了。寶貝在叫我們。」',
    },
  },
  sauron: {
    tint: '#1b1010',
    accent: '#ef4b35',
    prop: 'eye',
    silhouette: 'black iron crown and burning eye visor',
    fallbackLine: '「有一道目光穿過此地。你能走近，但未必能完整離開。」',
    locationLines: {
      'black-gate': '「門不是為你打開的，是為恐懼關上的。」',
      'mount-doom': '「火焰記得它的主人。」',
    },
  },
};

export function getCharacterVisual(characterId) {
  return characterVisuals[characterId] ?? {
    tint: '#5c533f',
    accent: '#c9a56a',
    prop: 'marker',
    silhouette: 'traveler cloak',
    fallbackLine: '「先看清這裡，再決定下一步。」',
    locationLines: {},
  };
}
