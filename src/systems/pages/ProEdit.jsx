import React, { useState } from 'react';
import { Scissors, ListVideo } from 'lucide-react';
import ProEditPanel from '../../features/pro-edit/ProEditPanel';
import ClipFinder from '../../features/pro-edit/ClipFinder';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { id: 'clips', label: 'Clip finder', Icon: Scissors },
  { id: 'queue', label: 'Edit queue', Icon: ListVideo },
];

// Systems → DaVinci: the clip finder (long footage → several clips) and Iris's edit queue.
const ProEdit = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('clips');
  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">DaVinci</p>
        <h1>Long footage in, finished clips out</h1>
        <p className="sys-muted">Pick the moments, a look and music for each clip. Iris builds every edit in DaVinci Resolve from LumenCommand, then the finished clips come back here.</p>
      </header>
      <div className="sys-seg" role="tablist" aria-label="DaVinci">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
            <t.Icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'clips'
        ? <ClipFinder userId={user?.id} onSent={() => setTab('queue')} />
        : <ProEditPanel userId={user?.id} operatorView />}
    </div>
  );
};

export default ProEdit;
