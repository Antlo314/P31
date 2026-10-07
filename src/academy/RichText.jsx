import React from 'react';

// A small, safe formatter for mentor-written text (no HTML is ever injected):
//   # Heading  ## Subheading   - bullet   1. numbered   **bold**  *italic*  [text](https://…)
// Blank lines start new paragraphs; bare https:// links become links.
const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)|https?:\/\/[^\s<]+)/g;

function inline(text, keyBase) {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
    const md = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (md) return <a key={key} href={md[2]} target="_blank" rel="noopener noreferrer">{md[1]}</a>;
    if (/^https?:\/\//.test(part)) return <a key={key} href={part} target="_blank" rel="noopener noreferrer">{part.replace(/^https?:\/\/(www\.)?/, '')}</a>;
    return part;
  });
}

const RichText = ({ text, className = 'rt' }) => {
  if (!text) return null;
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };
  text.replace(/\r/g, '').split('\n').forEach((raw, n) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) { flush(); list = { type, items: [] }; }
      list.items.push((bullet || numbered)[1]);
      return;
    }
    flush();
    if (!line.trim()) return blocks.push({ type: 'gap' });
    if (line.startsWith('## ')) return blocks.push({ type: 'h4', text: line.slice(3) });
    if (line.startsWith('# ')) return blocks.push({ type: 'h3', text: line.slice(2) });
    const prev = blocks[blocks.length - 1];
    if (prev && prev.type === 'p') prev.text += `\n${line}`;
    else blocks.push({ type: 'p', text: line, n });
  });
  flush();

  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.type === 'gap') return null;
        if (b.type === 'h3') return <h3 key={i}>{inline(b.text, i)}</h3>;
        if (b.type === 'h4') return <h4 key={i}>{inline(b.text, i)}</h4>;
        if (b.type === 'ul' || b.type === 'ol') {
          const Tag = b.type;
          return <Tag key={i}>{b.items.map((t, j) => <li key={j}>{inline(t, `${i}-${j}`)}</li>)}</Tag>;
        }
        return <p key={i}>{b.text.split('\n').map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{inline(l, `${i}-${j}`)}</React.Fragment>)}</p>;
      })}
    </div>
  );
};

export default RichText;
