import { useState } from 'react';
import AdventureMap from './components/AdventureMap.jsx';
import CodexMap from './components/CodexMap.jsx';

function App() {
  const [view, setView] = useState('adventure');

  if (view === 'codex') {
    return <CodexMap onSwitchView={() => setView('adventure')} />;
  }

  return <AdventureMap onSwitchView={() => setView('codex')} />;
}

export default App;
