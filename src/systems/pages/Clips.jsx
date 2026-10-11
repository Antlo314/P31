import React from 'react';
import ClipStudio from '../../features/clip-studio/ClipStudio';
import DesktopOnly from '../../components/DesktopOnly';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

// Saved clips land in private team storage and show up as a draft in Social,
// ready to caption and schedule.
const Clips = () => {
  const { user } = useAuth();

  const save = async (blob, meta) => {
    const path = `${user.id}/clips/${Date.now()}-${meta.name}`;
    const { error } = await supabase.storage.from('studio').upload(path, blob, { contentType: meta.type });
    if (error) throw error;
    await supabase.from('social_posts').insert({
      caption: meta.title || '',
      media_urls: [path],
      platforms: meta.aspect === '16:9' ? ['facebook'] : ['instagram', 'tiktok'],
      status: 'draft',
      notes: `Clip Studio · ${meta.style} · ${Math.round(meta.duration)}s`,
    });
  };

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Create</p>
        <h1>Clip Studio</h1>
        <p className="sys-muted">Drop in raw footage — it cuts the dead air, adds transitions, a look and captions.</p>
      </header>
      <DesktopOnly
        title="Clip Studio"
        what="Cuts raw footage into a captioned reel with a look, music and the P31 mark, then saves it to Social drafts."
        instead={[{ to: '/systems/photos', label: 'Style a product photo in Photo Studio' }, { to: '/systems/social', label: 'Caption and schedule a saved clip' }]}
      >
        <ClipStudio onSave={save} saveLabel="Save to Social drafts" />
      </DesktopOnly>
    </div>
  );
};

export default Clips;
