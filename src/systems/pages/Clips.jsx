import React from 'react';
import ClipStudio from '../../features/clip-studio/ClipStudio';
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
        <p className="sys-eyebrow">Clips</p>
        <h1>Clip Studio</h1>
        <p className="sys-muted">Drop in raw footage — it cuts the dead air, adds transitions, a look and captions.</p>
      </header>
      <ClipStudio onSave={save} saveLabel="Save to Social drafts" />
    </div>
  );
};

export default Clips;
