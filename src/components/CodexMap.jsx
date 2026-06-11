import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Compass,
  Filter,
  Landmark,
  MapPin,
  Route,
  Search,
  Shield,
  Swords,
  Users,
  X,
} from 'lucide-react';
import { factions, journeyRoute, locations, regions } from '../data/locations.js';

const allRegions = ['全部區域', ...regions];
const allFactions = ['全部勢力', ...factions];

const factionClass = {
  自由人民: 'freefolk',
  精靈: 'elves',
  矮人: 'dwarves',
  洛汗: 'rohan',
  剛鐸: 'gondor',
  魔多: 'mordor',
  荒野: 'wilds',
};

const dangerClass = {
  低: 'low',
  中: 'medium',
  高: 'high',
  極高: 'severe',
};

function normalizeText(value) {
  return value.toLowerCase().trim();
}

function locationMatches(location, query) {
  if (!query) return true;

  const haystack = [
    location.zhName,
    location.enName,
    location.region,
    location.faction,
    location.danger,
    location.era,
    location.history,
    location.importance,
    ...location.events,
    ...location.people,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

function DetailPanel({ location, onClear }) {
  return (
    <aside className="detail-panel" aria-live="polite">
      <div className="detail-header">
        <div>
          <p className="eyebrow">中土白皮書條目</p>
          <h2>{location.zhName}</h2>
          <p className="subtitle">{location.enName}</p>
        </div>
        <button className="icon-button" type="button" onClick={onClear} aria-label="清除選取">
          <X size={18} />
        </button>
      </div>

      <div className="meta-grid">
        <div>
          <Landmark size={17} />
          <span>{location.region}</span>
        </div>
        <div>
          <Shield size={17} />
          <span>{location.faction}</span>
        </div>
        <div className={`danger ${dangerClass[location.danger]}`}>
          <AlertTriangle size={17} />
          <span>危險等級：{location.danger}</span>
        </div>
      </div>

      <section>
        <h3>
          <BookOpen size={18} />
          時代背景
        </h3>
        <p>{location.era}</p>
      </section>

      <section>
        <h3>
          <Compass size={18} />
          歷史細節
        </h3>
        <p>{location.history}</p>
      </section>

      <section>
        <h3>
          <Swords size={18} />
          戰略與劇情重要性
        </h3>
        <p>{location.importance}</p>
      </section>

      <section>
        <h3>
          <Route size={18} />
          代表事件
        </h3>
        <div className="chip-list">
          {location.events.map((event) => (
            <span className="chip parchment-chip" key={event}>
              {event}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h3>
          <Users size={18} />
          相關人物
        </h3>
        <div className="chip-list">
          {location.people.map((person) => (
            <span className="chip seal-chip" key={person}>
              {person}
            </span>
          ))}
        </div>
      </section>
    </aside>
  );
}

function MapTexture() {
  return (
    <svg className="map-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path className="sea-line" d="M2 20 C8 16 12 20 18 17 C25 14 31 16 36 13" />
      <path className="river" d="M60 8 C62 19 57 25 61 35 C65 45 64 55 69 65 C72 72 70 82 76 94" />
      <path className="river narrow" d="M50 50 C56 55 59 62 60 70 C61 77 65 83 67 92" />
      <path className="road" d="M12 38 C22 36 30 33 42 31 C47 35 48 42 48 48 C49 54 54 56 58 64 C63 67 68 69 73 69" />
      <path className="road dashed" d="M74 57 C77 62 82 63 88 70" />
      <g className="mountains">
        {Array.from({ length: 13 }).map((_, index) => {
          const y = 18 + index * 4.3;
          const height = index % 2 === 0 ? 5.8 : 4.6;
          return <path key={index} d={`M${44 + (index % 3)} ${y + height} L48 ${y} L52 ${y + height}`} />;
        })}
      </g>
      <g className="mordor-ridges">
        <path d="M80 52 L84 45 L88 52" />
        <path d="M86 57 L90 48 L94 57" />
        <path d="M81 77 L86 66 L91 77" />
      </g>
      <g className="forest-strokes">
        {Array.from({ length: 18 }).map((_, index) => (
          <path
            key={index}
            d={`M${64 + (index % 6) * 1.6} ${27 + Math.floor(index / 6) * 4} C${63 + (index % 6) * 1.6} ${30 + Math.floor(index / 6) * 4} ${67 + (index % 6) * 1.6} ${30 + Math.floor(index / 6) * 4} ${66 + (index % 6) * 1.6} ${27 + Math.floor(index / 6) * 4}`}
          />
        ))}
      </g>
    </svg>
  );
}

function CodexMap({ onSwitchView }) {
  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('全部區域');
  const [factionFilter, setFactionFilter] = useState('全部勢力');
  const [selectedId, setSelectedId] = useState('shire');
  const [showRoute, setShowRoute] = useState(true);

  const normalizedQuery = normalizeText(query);
  const routeIds = useMemo(() => new Set(journeyRoute), []);

  const filteredLocations = useMemo(
    () =>
      locations.filter((location) => {
        const regionMatch = regionFilter === '全部區域' || location.region === regionFilter;
        const factionMatch = factionFilter === '全部勢力' || location.faction === factionFilter;
        return regionMatch && factionMatch && locationMatches(location, normalizedQuery);
      }),
    [factionFilter, normalizedQuery, regionFilter],
  );

  const filteredIds = useMemo(
    () => new Set(filteredLocations.map((location) => location.id)),
    [filteredLocations],
  );

  const selectedLocation = locations.find((location) => location.id === selectedId) ?? locations[0];
  const routePoints = journeyRoute
    .map((id) => locations.find((location) => location.id === id))
    .filter(Boolean)
    .map((location) => `${location.x},${location.y}`)
    .join(' ');

  const resetFilters = () => {
    setQuery('');
    setRegionFilter('全部區域');
    setFactionFilter('全部勢力');
  };

  return (
    <main className="app-shell">
      <section className="hero-band">
        <div className="title-block">
          <p className="eyebrow">Middle-earth Field Codex</p>
          <h1>中土白皮書</h1>
          <p>
            以羊皮紙、皮革裝幀與古地圖墨線重構魔戒遠征中的關鍵地點，追蹤地理、歷史與戰略脈絡。
          </p>
        </div>
        <div className="summary-strip" aria-label="地圖摘要">
          <div>
            <strong>{locations.length}</strong>
            <span>主要地標</span>
          </div>
          <div>
            <strong>{regions.length}</strong>
            <span>區域分類</span>
          </div>
          <div>
            <strong>{journeyRoute.length}</strong>
            <span>遠征節點</span>
          </div>
        </div>
        <button className="codex-switch" type="button" onClick={onSwitchView}>
          回到沉浸地圖
        </button>
      </section>

      <section className="tool-band" aria-label="地圖工具列">
        <label className="search-box">
          <Search size={18} />
          <input
            type="search"
            placeholder="搜尋地名、人物、事件..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label className="select-wrap">
          <Filter size={17} />
          <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
            {allRegions.map((region) => (
              <option value={region} key={region}>
                {region}
              </option>
            ))}
          </select>
        </label>

        <label className="select-wrap">
          <Shield size={17} />
          <select value={factionFilter} onChange={(event) => setFactionFilter(event.target.value)}>
            {allFactions.map((faction) => (
              <option value={faction} key={faction}>
                {faction}
              </option>
            ))}
          </select>
        </label>

        <button
          className={`toggle-button ${showRoute ? 'active' : ''}`}
          type="button"
          onClick={() => setShowRoute((current) => !current)}
        >
          <Route size={18} />
          <span>{showRoute ? '遠征路線開啟' : '遠征路線關閉'}</span>
        </button>

        <button className="text-button" type="button" onClick={resetFilters}>
          重置篩選
        </button>
      </section>

      <section className="atlas-layout">
        <div className="map-panel">
          <div className="map-frame">
            <div className="map-canvas" role="img" aria-label="中土世界互動式地圖">
              <MapTexture />
              <svg className="route-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {showRoute && <polyline points={routePoints} />}
              </svg>

              <span className="region-label label-eriador">Eriador</span>
              <span className="region-label label-rhovanion">Rhovanion</span>
              <span className="region-label label-rohan">Rohan</span>
              <span className="region-label label-gondor">Gondor</span>
              <span className="region-label label-mordor">Mordor</span>

              {locations.map((location) => {
                const isSelected = selectedLocation.id === location.id;
                const isFiltered = filteredIds.has(location.id);
                const onRoute = routeIds.has(location.id);

                return (
                  <button
                    className={`map-marker ${factionClass[location.faction]} ${isSelected ? 'selected' : ''} ${!isFiltered ? 'muted' : ''} ${onRoute ? 'on-route' : ''}`}
                    type="button"
                    key={location.id}
                    style={{ left: `${location.x}%`, top: `${location.y}%` }}
                    onClick={() => setSelectedId(location.id)}
                    aria-label={`${location.zhName} ${location.enName}`}
                  >
                    <span className="marker-pin">
                      <MapPin size={16} />
                    </span>
                    <span className="marker-label">{location.zhName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="map-footer">
            <p>
              顯示 <strong>{filteredLocations.length}</strong> / {locations.length} 個地標
            </p>
            <div className="legend" aria-label="勢力圖例">
              {factions.map((faction) => (
                <span key={faction}>
                  <i className={factionClass[faction]} />
                  {faction}
                </span>
              ))}
            </div>
          </div>
        </div>

        <DetailPanel location={selectedLocation} onClear={() => setSelectedId('shire')} />
      </section>
    </main>
  );
}

export default CodexMap;
