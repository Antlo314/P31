import React, { Suspense, lazy, useState } from 'react';
import { Clapperboard, ImagePlus } from 'lucide-react';

const ClipStudio = lazy(() => import('../clip-studio/ClipStudio'));
const PhotoStudio = lazy(() => import('../photo-studio/PhotoStudio'));

/** Curator creative tools: auto-edited clips and product photos. */
const StudioTab = ({ onUsePhoto, brandLogo }) => {
  const [tool, setTool] = useState('photo');

  return (
    <div className="dashboard-view">
      <header className="dashboard-header">
        <div>
          <span className="section-kicker">Creative Studio</span>
          <h1 className="font-headline">Make it scroll-stopping</h1>
          <p className="text-muted">Studio-quality product photos and auto-edited clips, made right on your phone.</p>
        </div>
      </header>

      <div className="studio-switch" role="tablist">
        <button role="tab" aria-selected={tool === 'photo'} className={tool === 'photo' ? 'is-on' : ''} onClick={() => setTool('photo')}>
          <ImagePlus size={18} /> Photo Studio
        </button>
        <button role="tab" aria-selected={tool === 'clip'} className={tool === 'clip' ? 'is-on' : ''} onClick={() => setTool('clip')}>
          <Clapperboard size={18} /> Clip Studio
        </button>
      </div>

      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        {tool === 'photo'
          ? <PhotoStudio onSave={onUsePhoto} saveLabel="Add as new product" />
          : <ClipStudio brandLogo={brandLogo} />}
      </Suspense>
    </div>
  );
};

export default StudioTab;
