import React, { useState } from 'react';
import { Sparkles, Copy, Check, RotateCcw, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './AiAssist.css';

/**
 * "Write with AI" — asks the ai-assist function for drafts and lets the
 * person drop one into their form.
 *   task:      caption | product_description | shop_bio | tagline | outreach | reply | campaign
 *   getInput:  () => ({ ...fields })            (read at click time)
 *   getImage:  () => ({ imageUrl } | { imageBase64, imageType }) | null   (optional)
 *   onUse:     (text) => void                    (optional; otherwise copy only)
 */
const AiAssist = ({ task, getInput, getImage, onUse, label = 'Write with AI', compact = false }) => {
  const [state, setState] = useState('idle'); // idle | loading | done
  const [options, setOptions] = useState([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(-1);

  const run = async () => {
    setState('loading'); setError('');
    try {
      const image = getImage ? await getImage() : null;
      const { data, error: fnErr } = await supabase.functions.invoke('ai-assist', {
        body: { task, input: getInput ? getInput() : {}, ...(image || {}) },
      });
      if (fnErr) {
        let msg = 'AI writing isn’t available right now.';
        try { const ctx = await fnErr.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* keep default */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setOptions(data.options || []);
      setState('done');
    } catch (e) {
      setError(e.message);
      setState('idle');
    }
  };

  const copy = async (text, i) => {
    await navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(-1), 1400);
  };

  return (
    <div className={`ai ${compact ? 'ai--compact' : ''}`}>
      {state !== 'done' && (
        <button type="button" className="ai__btn" onClick={run} disabled={state === 'loading'}>
          {state === 'loading' ? <Loader2 size={15} className="ai__spin" /> : <Sparkles size={15} />}
          {state === 'loading' ? 'Writing…' : label}
        </button>
      )}
      {error && <p className="ai__err">{error}</p>}
      {state === 'done' && (
        <div className="ai__panel">
          <div className="ai__head">
            <span><Sparkles size={14} /> AI drafts — edit freely</span>
            <div>
              <button type="button" onClick={run} aria-label="Write new drafts"><RotateCcw size={14} /></button>
              <button type="button" onClick={() => setState('idle')} aria-label="Close drafts"><X size={14} /></button>
            </div>
          </div>
          {options.map((o, i) => (
            <div className="ai__opt" key={i}>
              <p>{o}</p>
              <div>
                {onUse && <button type="button" className="ai__use" onClick={() => { onUse(o); setState('idle'); }}>Use this</button>}
                <button type="button" onClick={() => copy(o, i)}>{copied === i ? <Check size={14} /> : <Copy size={14} />} Copy</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AiAssist;
