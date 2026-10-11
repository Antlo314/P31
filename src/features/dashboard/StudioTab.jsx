import React, { Suspense, lazy, useState } from 'react';
import { Clapperboard, ImagePlus } from 'lucide-react';
import DesktopOnly, { DesktopTag } from '../../components/DesktopOnly';
import { useIsPhone } from '../../lib/device';

const ClipStudio = lazy(() => import('../clip-studio/ClipStudio'));
const PhotoStudio = lazy(() => import('../photo-studio/PhotoStudio'));

/** Curator creative tools: product photos anywhere; auto-edited clips on a computer. */
const StudioTab = ({ onUsePhoto, brandLogo }) => {
  const [tool, setTool] = useState('photo');
  const phone = useIsPhone();

  return (
    <div className="dashboard-view">
      <header className="dashboard-header">
        <div>
          <span className="section-kicker">Creative Studio</span>
          <h1 className="font-headline">Make it scroll-stopping</h1>
          <p className="text-muted">Studio-quality product photos right on your phone, and auto-edited clips on your computer.</p>
        </div>
      </header>

      <div className="studio-switch" role="tablist">
        <button role="tab" aria-selected={tool === 'photo'} className={tool === 'photo' ? 'is-on' : ''} onClick={() => setTool('photo')}>
          <ImagePlus size={18} /> Photo Studio
        </button>
        <button role="tab" aria-selected={tool === 'clip'} className={tool === 'clip' ? 'is-on' : ''} onClick={() => setTool('clip')}>
          <Clapperboard size={18} /> Clip Studio {phone && <DesktopTag />}
        </button>
      </div>

      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        {tool === 'photo'
          ? <PhotoStudio onSave={onUsePhoto} saveLabel="Add as new product" />
          : (
            <DesktopOnly
              title="Clip Studio"
              what="Turns raw phone footage into a captioned reel with a look, music and your logo."
              instead={[{ to: '/dashboard/studio', label: 'Style a product photo in Photo Studio' }, { to: '/dashboard/marketing', label: 'Make a promo image in Marketing' }]}
            >
              <ClipStudio brandLogo={brandLogo} />
            </DesktopOnly>
          )}
      </Suspense>
    </div>
  );
};

export default StudioTab;
