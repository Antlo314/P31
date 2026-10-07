import React, { useState } from 'react';
import ClipStudio from '../features/clip-studio/ClipStudio';
import PhotoStudio from '../features/photo-studio/PhotoStudio';

// Dev-only harness (never in production builds): exercise the studios
// without signing in. Put sample files in public/__lab/ (git-ignored):
// talking.mp4, multishot.mp4 and product.png — or use the studios' own pickers.
const asFile = async (url, name, type) => new File([await fetch(url).then((r) => r.blob())], name, { type });

const Lab = () => {
  const [clipFiles, setClipFiles] = useState(null);
  const [photo, setPhoto] = useState(null);

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16, maxWidth: 900, margin: '0 auto', background: '#0d0616', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button id="lab-load-clips" onClick={async () => setClipFiles([await asFile('/__lab/talking.mp4', 'talking.mp4', 'video/mp4'), await asFile('/__lab/multishot.mp4', 'multishot.mp4', 'video/mp4')])}>Load sample clips</button>
        <button id="lab-load-photo" onClick={async () => setPhoto(await asFile('/__lab/product.png', 'product.png', 'image/png'))}>Load sample photo</button>
      </div>
      <ClipStudio initialFiles={clipFiles} onSave={async () => {}} />
      <PhotoStudio initialFile={photo} onSave={async () => {}} />
    </div>
  );
};

export default Lab;
