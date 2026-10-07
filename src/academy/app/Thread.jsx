import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDateTime } from '../../lib/academy';
import { useRows, useRealtime, write } from './data';
import { DashEmpty } from '../../apps/DashShell';

/** One private thread between a student and the program's mentors. */
const Thread = ({ programId, studentId, meId, mentorView = false, emptyText }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const { data: messages, reload } = useRows(
    () => supabase.from('academy_messages').select('id, sender_id, body, created_at, read_at')
      .eq('program_id', programId).eq('student_id', studentId).order('created_at', { ascending: true }).limit(300),
    [programId, studentId],
  );
  const onChange = useCallback(() => reload(), [reload]);
  useRealtime('academy_messages', 'student_id', studentId, onChange);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  // Mark the other side's messages as read.
  useEffect(() => {
    const unread = messages.filter((m) => !m.read_at && m.sender_id !== meId).map((m) => m.id);
    if (unread.length) supabase.from('academy_messages').update({ read_at: new Date().toISOString() }).in('id', unread).then(() => {});
  }, [messages, meId]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !programId) return;
    setSending(true); setError('');
    const { error: err } = await write(supabase.from('academy_messages').insert({ program_id: programId, student_id: studentId, sender_id: meId, body }));
    setSending(false);
    if (err) return setError(err);
    setText('');
    reload();
  };

  return (
    <div className="ds-card">
      {messages.length ? (
        <div className="ds-thread" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`ds-msg ${m.sender_id === meId ? 'is-mine' : ''}`}>
              {m.body}
              <small>{m.sender_id === meId ? 'You' : mentorView ? 'Student' : 'Your mentor'} · {fmtDateTime(m.created_at)}</small>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      ) : (
        <DashEmpty Icon={MessageCircle} title="No messages yet">{emptyText}</DashEmpty>
      )}
      <form className="ds-compose" onSubmit={send}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={mentorView ? 'Write to your student…' : 'Write to your mentor…'} rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e); }} aria-label="Message" />
        <button className="k-btn k-btn--plum k-btn--icon" disabled={sending || !text.trim()} aria-label="Send"><Send size={18} /></button>
      </form>
      {error && <p className="k-error">{error}</p>}
    </div>
  );
};

export default Thread;
