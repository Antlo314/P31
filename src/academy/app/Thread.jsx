import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, MessageCircle, Paperclip, X, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, openFile, uploadAcademyFile } from '../../lib/academy';
import { useAcademy, useRows, useRealtime, write } from './data';
import { DashEmpty } from '../../apps/DashShell';

/** One private thread between a student and the program's mentors (with file attachments). */
const Thread = ({ programId, studentId, meId, mentorView = false, emptyText }) => {
  const { program, viewAs } = useAcademy();
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const { data: messages, reload } = useRows(
    () => supabase.from('academy_messages').select('id, sender_id, body, created_at, read_at, attachment_path, attachment_name')
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
    const body = text.trim() || (file ? `Shared a file: ${file.name}` : '');
    if (!body || !programId) return;
    setSending(true); setError('');
    let attachment = {};
    if (file) {
      try {
        const meta = await uploadAcademyFile(program.slug, `messages/${studentId}`, file);
        attachment = { attachment_path: meta.file_path, attachment_name: meta.file_name };
      } catch (err) {
        setSending(false);
        return setError(`Couldn’t upload the file: ${err.message}`);
      }
    }
    const { error: err } = await write(supabase.from('academy_messages').insert({ program_id: programId, student_id: studentId, sender_id: meId, body, ...attachment }));
    setSending(false);
    if (err) return setError(err);
    setText(''); setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    reload();
  };

  return (
    <div className="ds-card">
      {messages.length ? (
        <div className="ds-thread" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`ds-msg ${m.sender_id === meId ? 'is-mine' : ''}`}>
              {m.body}
              {m.attachment_path && (
                <button type="button" className="cl-attach" onClick={() => openFile(m.attachment_path)}><FileText size={15} /> {m.attachment_name || 'Attachment'}</button>
              )}
              <small>{m.sender_id === meId ? 'You' : mentorView ? 'Student' : 'Your mentor'} · {fmtDateTime(m.created_at)}{m.sender_id === meId && m.read_at ? ' · Seen' : ''}</small>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      ) : (
        <DashEmpty Icon={MessageCircle} title="No messages yet">{emptyText}</DashEmpty>
      )}
      {file && (
        <div className="cl-file-chip"><FileText size={15} /> {file.name}
          <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} aria-label="Remove file"><X size={14} /></button>
        </div>
      )}
      {viewAs ? <p className="ds-muted">Read-only while you’re seeing their dashboard — send messages from the mentor console.</p> : (
      <form className="ds-compose" onSubmit={send}>
        <label className="k-btn k-btn--ghost k-btn--icon cl-clip" aria-label="Attach a file">
          <Paperclip size={18} />
          <input ref={fileRef} type="file" hidden onChange={(e) => setFile(e.target.files[0] || null)} />
        </label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={mentorView ? 'Write to your student…' : 'Write to your mentor…'} rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e); }} aria-label="Message" />
        <button className="k-btn k-btn--plum k-btn--icon" disabled={sending || (!text.trim() && !file)} aria-label="Send"><Send size={18} /></button>
      </form>)}
      {error && <p className="k-error">{error}</p>}
    </div>
  );
};

export default Thread;
