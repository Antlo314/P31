import React from 'react';
import PhotoStudio from '../../features/photo-studio/PhotoStudio';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const Photos = () => {
  const { user } = useAuth();

  const save = async (blob, meta) => {
    const path = `${user.id}/photos/${Date.now()}-${meta.name}`;
    const { error } = await supabase.storage.from('studio').upload(path, blob, { contentType: blob.type });
    if (error) throw error;
    await supabase.from('social_posts').insert({
      caption: '', media_urls: [path], platforms: ['instagram', 'facebook'], status: 'draft', notes: `Photo Studio · ${meta.stage}`,
    });
  };

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Photos</p>
        <h1>Photo Studio</h1>
        <p className="sys-muted">Remove backgrounds, stage products on a backdrop, add a look, and frame for every channel.</p>
      </header>
      <PhotoStudio onSave={save} saveLabel="Save to Social drafts" batchSave />
    </div>
  );
};

export default Photos;
