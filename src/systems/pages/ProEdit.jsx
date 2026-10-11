import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Scissors, ListVideo, PauseCircle, ArrowRight } from 'lucide-react';
import ProEditPanel from '../../features/pro-edit/ProEditPanel';
import ClipFinder from '../../features/pro-edit/ClipFinder';
import DesktopOnly from '../../components/DesktopOnly';
import { useAuth } from '../../context/AuthContext';
import { isPhone } from '../../lib/device';
import { DAVINCI_ON } from '../../lib/features';

const TABS = [
  { id: 'clips', label: 'Clip finder', Icon: Scissors },
  { id: 'queue', label: 'Edit queue', Icon: ListVideo },
];

// Systems → DaVinci: the clip finder (long footage → several clips) and Iris's edit queue.
// Phones open on the queue (checking and downloading finished edits works anywhere); the
// finder itself reads hours of video on the device, so it waits for a computer.
const ProEdit = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState(() => (isPhone() ? 'queue' : 'clips'));

  if (!DAVINCI_ON) {
    return (
      <div className="sys-page">
        <header className="sys-page__head">
          <p className="sys-eyebrow">DaVinci</p>
          <h1>DaVinci is paused for now</h1>
          <p className="sys-muted">The clip finder and the Iris edit queue come back when the DaVinci bridge is switched on. Nothing here is lost: queued edits and finished clips stay where they are.</p>
        </header>
        <div className="sys-card sys-paused">
          <span className="sys-paused__icon"><PauseCircle size={22} /></span>
          <p>In the meantime, Clip Studio turns raw footage into captioned reels on a computer, and Photo Studio styles product photos on any device.</p>
          <div className="sys-chips">
            <Link to="/systems/clips" className="sys-chip">Clip Studio <ArrowRight size={13} /></Link>
            <Link to="/systems/photos" className="sys-chip">Photo Studio <ArrowRight size={13} /></Link>
            <Link to="/systems" className="sys-chip">Overview <ArrowRight size={13} /></Link>
          </div>
        </div>
      </div>
    );
  }

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
      {tab === 'clips' ? (
        <DesktopOnly
          title="The clip finder"
          what="Scans long raw footage for the best moments by sound, speech and motion, then sends each clip to Iris with its own look and music."
          why="It reads hours of video on the device itself. The edit queue next to it works fine on a phone."
          instead={[{ to: '/systems/pro-edit', label: 'Check the edit queue and download finished clips' }]}
        >
          <ClipFinder userId={user?.id} onSent={() => setTab('queue')} />
        </DesktopOnly>
      ) : <ProEditPanel userId={user?.id} operatorView />}
    </div>
  );
};

export default ProEdit;
