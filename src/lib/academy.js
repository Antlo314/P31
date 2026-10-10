import { supabase } from './supabase';

export const CONTACT_EMAIL = 'members@thep31collective.org';

export const money = (cents) => (cents == null ? '—' : `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0 })}`);

export const BILLING = {
  week: { label: 'Weekly', per: 'week' },
  month: { label: 'Monthly', per: 'month' },
  six_months: { label: 'Every 6 months', per: '6 months' },
  one_time: { label: 'Pay as you go', per: null },
};

export const fileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const fmtDate = (d, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-US', opts) : '';
export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

// Classroom files live in the private "academy" bucket: academy/<slug>/files/… or
// academy/<slug>/submissions/<user-id>/…  Links expire after a few minutes.
export async function openFile(path, download = true) {
  const { data, error } = await supabase.storage.from('academy').createSignedUrl(path, 300, download ? { download: true } : undefined);
  if (error) throw error;
  window.open(data.signedUrl, '_blank', 'noopener');
}

const safeName = (name) => name.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-90);

export async function uploadAcademyFile(slug, folder, file) {
  const path = `${slug}/${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from('academy').upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  return { file_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size };
}

// YouTube / Vimeo / Loom links become embeds; anything else opens as a link.
export function videoEmbed(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith('youtube.com')) {
      const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'vimeo.com') return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean)[0]}`;
    if (host.endsWith('loom.com')) return url.replace('/share/', '/embed/');
  } catch { /* not a URL */ }
  return null;
}

export function downloadIcs({ title, starts_at, duration_minutes = 60, join_url, description }) {
  const start = new Date(starts_at);
  const end = new Date(start.getTime() + duration_minutes * 60000);
  const f = (x) => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (t = '') => String(t).replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//P31 Collective//EN', 'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@p31market.com`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${esc(title)}`, join_url ? `LOCATION:${esc(join_url)}` : '', description ? `DESCRIPTION:${esc(description)}` : '',
    'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })),
    download: `${title.toLowerCase().replace(/\W+/g, '-').slice(0, 40) || 'session'}.ics`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Daily verse for the faith classroom — King James Version, quoted exactly.
export const DAILY_VERSES = [
  ['Proverbs 31:25', 'Strength and honour are her clothing; and she shall rejoice in time to come.'],
  ['Proverbs 3:5–6', 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.'],
  ['Philippians 4:13', 'I can do all things through Christ which strengtheneth me.'],
  ['Jeremiah 29:11', 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.'],
  ['Isaiah 40:31', 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.'],
  ['Psalm 46:5', 'God is in the midst of her; she shall not be moved: God shall help her, and that right early.'],
  ['Proverbs 16:3', 'Commit thy works unto the LORD, and thy thoughts shall be established.'],
  ['Proverbs 18:16', "A man's gift maketh room for him, and bringeth him before great men."],
  ['Habakkuk 2:3', 'For the vision is yet for an appointed time, but at the end it shall speak, and not lie: though it tarry, wait for it; because it will surely come, it will not tarry.'],
  ['Joshua 1:9', 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.'],
  ['Psalm 37:4', 'Delight thyself also in the LORD; and he shall give thee the desires of thine heart.'],
  ['Romans 8:28', 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.'],
  ['2 Timothy 1:7', 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.'],
  ['Matthew 6:33', 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.'],
  ['Psalm 119:105', 'Thy word is a lamp unto my feet, and a light unto my path.'],
  ['Isaiah 41:10', 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.'],
  ['Galatians 6:9', 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.'],
  ['Proverbs 31:26', 'She openeth her mouth with wisdom; and in her tongue is the law of kindness.'],
  ['Lamentations 3:22–23', "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness."],
  ['Psalm 46:10', 'Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.'],
  ['Proverbs 31:30', 'Favour is deceitful, and beauty is vain: but a woman that feareth the LORD, she shall be praised.'],
  ['Ecclesiastes 3:1', 'To every thing there is a season, and a time to every purpose under the heaven:'],
];
export const verseOfTheDay = (date = new Date()) => {
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return DAILY_VERSES[dayNumber % DAILY_VERSES.length];
};

// "Join P31 Collective": the membership application lives at /join on thep31collective.org.
// The original Google Form stays linked from that page as a fallback.
export const JOIN_PATH = '/join';
export const JOIN_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfBZkXVjzeqjq_h5k0Np3ueFZbiYzp19ettlL5CF5uBHYjBTw/viewform?pli=1';
