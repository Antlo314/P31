import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

/** Today: the morning's Daily Word from The Gathering, with a way into its discussion. Hidden until v39 is in. */
const TodaysWord = () => {
  const [word, setWord] = useState(null);
  useEffect(() => {
    let on = true;
    (async () => {
      const { data: ch } = await supabase.from('chat_channels').select('id').eq('slug', 'daily-word').maybeSingle();
      if (!ch) return;
      const { data } = await supabase.from('chat_messages').select('id, body, meta, reply_count').eq('channel_id', ch.id).eq('kind', 'scripture')
        .order('created_at', { ascending: false }).limit(1);
      if (on && data?.[0]?.meta?.text) setWord(data[0]);
    })().catch(() => {});
    return () => { on = false; };
  }, []);
  if (!word) return null;
  return (
    <Link to="/gather/daily-word" className="td2-word">
      <span className="td2-word__eyebrow"><BookOpen size={13} /> Daily Word · The Gathering</span>
      <blockquote>“{word.meta.text}”</blockquote>
      <span className="td2-word__ref">{word.meta.ref}</span>
      <span className="td2-word__go"><MessageCircle size={14} /> {word.reply_count ? `${word.reply_count} in the discussion` : 'Start the discussion'}</span>
    </Link>
  );
};

export default TodaysWord;
