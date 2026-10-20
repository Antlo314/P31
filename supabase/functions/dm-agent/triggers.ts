// Carla's canned replies: the owner's keyword templates for each brand, and the Marketplace's
// "Tell me more" flow (ask for an email, then thank them and let the team follow up).
// Pure functions only (no Deno, Supabase or network) so every rule here can be unit-tested.
// index.ts decides what to do with the answer: send the DM, post the public reply, record a lead.

export type Site = 'market' | 'collective';
export type Surface = 'dm' | 'comment';

export type Template = {
  key: string;
  label: string;        // what the persona calls it
  keywords: string[];   // the owner's keywords, matched as whole words
  dm: string;           // the direct message (or the private reply to a comment)
  comment: string;      // Instagram/Facebook public reply, used only after the private reply went out
  commentNoDm: string;  // Instagram/Facebook public reply when no private reply could be sent: carries the link
  tiktok: string;       // TikTok public reply: TikTok has no private replies, so it carries the link and never promises a DM
};

export type Pick = Omit<Template, 'label' | 'keywords'> & {
  kind: 'email' | 'info' | 'template';
  sendDm: boolean;      // send `dm` privately first (a DM thread, or an Instagram/Facebook comment)
  email?: string;       // the address they gave (kind 'email')
};

// ── Reading what people wrote ──

/** Curly quotes to straight, NFKC, lower case, single spaces. */
export function normalize(text: string) {
  return String(text || '')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u02BC\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const EMAIL = /[a-z0-9_%+-][a-z0-9._%+-]*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}/i;
const EMAILS = new RegExp(EMAIL.source, 'gi');

/** The first email address in a message, lower case, or null. */
export function findEmail(text: string) {
  const m = String(text || '').normalize('NFKC').match(EMAIL);
  return m ? m[0].toLowerCase() : null;
}

/** The words of a message once emails, @mentions, #hashtags, emojis and punctuation are gone. */
function bareWords(text: string) {
  return normalize(text)
    .replace(EMAILS, ' ')
    .replace(/(^|\s)[@#][\p{L}\p{N}_.]+/gu, ' ')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\u200d\ufe0f\u20e3]/gu, ' ')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && w !== "'");
}

/** A keyword on its own ("VENDOR", "Vendor 🙌", "EVENT please"): three words at most and no question. */
export function keywordOnly(text: string) {
  if (normalize(text).includes('?')) return false;
  return bareWords(text).length <= 3;
}

// The only words that may sit around an email for it to count as "just the email".
const EMAIL_FILLER = new Set([
  'my', 'email', 'e', 'mail', 'address', 'is', 'its', "it's", 'here', 'heres', "here's", 'it', 'you', 'go', 'can', 'reach', 'me', 'at',
  'use', 'this', 'the', 'sure', 'yes', 'yeah', 'yep', 'ok', 'okay', 'of', 'course', 'thanks', 'thank', 'please', 'hi', 'hey', 'hello',
]);

/**
 * A message that is just an email address, with at most a few plain words around it ("jane@x.com",
 * "Sure! my email is jane@x.com", "here you go: jane@x.com"). Anything else ("my order never came,
 * jane@x.com", "refund please jane@x.com") is a real message for the model and the team.
 */
export function littleMoreThanEmail(text: string) {
  if (!findEmail(text) || normalize(text).includes('?')) return false;
  const rest = bareWords(text);
  return rest.length <= 6 && rest.every((w) => EMAIL_FILLER.has(w));
}

// Silent skip only for profanity, slurs and direct insults, censored spellings included ("f***", "sh!t").
// A blunt complaint ("is this a scam?", "ugly sweater", "fake leather") is not rude: it reaches the model,
// which hands complaints to the team. "garden hoe", "hoe-down" and "idiot-proof" are not insults either.
const RUDE = /\b(?:bitch(?:es|y|ing)?|(?<!garden )hoes?(?!-?down)|sluts?|dumbass(?:es)?|bullsh+[i*!1]+t+|stfu|assholes?|idiots?(?!-proof)|sh+[i*!1]+t+(?:s|ty|ter|head|heads|hole|show)?)\b|(?:\b|mother)f+[u*]+[c*]+[k*]+|\bf\*+(?:ing|in')/;

export function isRude(text: string) {
  return RUDE.test(normalize(text).replace(EMAILS, ' '));
}

// ── The Marketplace "Tell me more" flow ──

export const INFO_ASK = 'Thank you for reaching out! We’d love to share more details. Please provide your email address so our team can send you additional information.';
export const EMAIL_THANKS = 'Thank you for providing your email! Our team will send additional details directly to your inbox within 24–48 hours.\n\nWe look forward to connecting with you!\n\n— P31 Marketplace Team';
// How each is recognised in a thread (a person on the team may have typed it slightly differently).
const ASKED = 'please provide your email address';
const THANKED = 'thank you for providing your email';

const INFO = /\b(?:tell me more|more info(?:rmation)?|(?:i'm|im|i am) interested|speaking opportunit(?:y|ies))\b/;
const SPEAKER = /\bspeakers?\b/;

/** "Tell me more", "more info(rmation)", "I'm interested", "speaker(s)", "speaking opportunity/ies", anywhere. */
export function isInfoRequest(text: string) {
  const t = normalize(text);
  return INFO.test(t) || SPEAKER.test(t);
}

/**
 * The same on a public comment, except that a lone "speaker" only counts nearly on its own (one other word
 * at most) or in a question ("Speaker 🙋🏾‍♀️", "Speaker here!", "Do you need speakers?"): "The speaker was
 * amazing!" is praise and "my bluetooth speaker" is not about us, so neither gets a DM asking for an email.
 */
export function isInfoComment(text: string) {
  const t = normalize(text);
  return INFO.test(t) || (SPEAKER.test(t) && (t.includes('?') || bareWords(text).length <= 2));
}

export const INFO_TEMPLATE: Template = {
  key: 'info',
  label: 'More information or speaking opportunities',
  keywords: ['tell me more', 'more information', 'I’m interested', 'speaker', 'speaking opportunity'],
  dm: INFO_ASK,
  comment: 'Thank you for reaching out! We just sent you a DM.',
  commentNoDm: 'Thank you for reaching out! Send us a DM with your email address and our team will share more details.',
  tiktok: 'Thank you for reaching out! We’d love to share more details. Send us a message with your email address and our team will send you additional information.',
};

// ── The owner's keyword templates ──

const MARKET_SITE = 'https://www.p31market.com/';
const MARKET_EVENTS = 'https://linktr.ee/p31marketplaceandcollective';
const STOREFRONT = 'https://www.p31market.com/storefront';
const JOIN = 'https://www.thep31collective.org/join';
const GATHERINGS = 'https://www.thep31collective.org/#upcoming'; // the Upcoming list on the Collective home
const INTRO_CALL = 'https://calendly.com/nebamentorship/neba-mentorship-intro-call'; // src/lib/calendly.js

export const MARKET_TEMPLATES: Template[] = [
  {
    key: 'vendor',
    label: 'Vendor & curator opportunities',
    keywords: ['VENDOR', 'CURATOR', 'SELL', 'EXHIBIT'],
    dm: `Thank you for your interest in P31 Marketplace! We’re creating opportunities for entrepreneurs, creatives, and business owners to showcase their gifts, connect, and grow. Visit our website to explore upcoming vendor and curator opportunities!\n\n${MARKET_SITE}`,
    comment: 'Your gifts deserve room to grow! Check your DMs for more information!',
    commentNoDm: `Your gifts deserve room to grow! Explore upcoming vendor and curator opportunities at ${MARKET_SITE}`,
    tiktok: `Your gifts deserve room to grow! Explore upcoming vendor and curator opportunities at ${MARKET_SITE}`,
  },
  {
    key: 'storefront',
    label: 'Virtual storefront registration',
    keywords: ['STOREFRONT', 'VIRTUAL', 'ONLINE STORE', 'SHOP OWNER'],
    dm: `Thank you for your interest in becoming a P31 Marketplace virtual storefront owner! We’re creating a space where entrepreneurs and business owners can showcase their products, expand their visibility, and connect with a growing community of shoppers. Ready to bring your business into the marketplace? Visit our website to learn more and register your storefront!\n\n${STOREFRONT}`,
    comment: 'Your business deserves a place in the marketplace! Check your DMs to learn how to open your virtual storefront!',
    commentNoDm: `Your business deserves a place in the marketplace! Learn how to open your virtual storefront at ${STOREFRONT}`,
    tiktok: `Your business deserves a place in the marketplace! Learn how to open your virtual storefront at ${STOREFRONT}`,
  },
  {
    key: 'event',
    label: 'Marketplace events & tickets',
    keywords: ['EVENT', 'MARKETPLACE', 'TICKETS', 'ATTEND'],
    dm: `You’re invited to experience P31 Marketplace! Join us for an atmosphere of entrepreneurship, faith, fellowship, and meaningful connections. Explore our upcoming events and secure your spot!\n\n${MARKET_EVENTS}`,
    comment: 'We’d love to see you there! Check your DMs for event details and registration!',
    commentNoDm: `We’d love to see you there! Find event details and registration at ${MARKET_EVENTS}`,
    tiktok: `We’d love to see you there! Find event details and registration at ${MARKET_EVENTS}`,
  },
];

export const COLLECTIVE_TEMPLATES: Template[] = [
  {
    key: 'join',
    label: 'Community membership',
    keywords: ['COMMUNITY', 'JOIN', 'SISTERHOOD'],
    dm: `Thank you for your interest in P31 Collective! We’re building a community rooted in faith, fellowship, purpose, and business. Click below to learn more and become a member!\n\n${JOIN}`,
    comment: 'We would love to welcome you! Check your DMs for details on joining our community!',
    commentNoDm: `We would love to welcome you! Learn more and become a member at ${JOIN}`,
    tiktok: `We would love to welcome you! Learn more and become a member at ${JOIN}`,
  },
  {
    key: 'gathering',
    label: 'Community events & gatherings',
    keywords: ['EVENT', 'RSVP', 'PRAYER WALK', 'GATHERING'],
    dm: `We’re excited that you’re interested in joining us! P31 Collective offers opportunities to connect, grow in faith, and build meaningful relationships. Explore our upcoming gatherings and reserve your spot!\n\n${GATHERINGS}`,
    comment: 'Check your DMs for details on our upcoming event details!',
    commentNoDm: `We’d love to have you! Explore our upcoming gatherings and reserve your spot at ${GATHERINGS}`,
    tiktok: `We’d love to have you! Explore our upcoming gatherings and reserve your spot at ${GATHERINGS}`,
  },
  {
    key: 'mentorship',
    label: 'Private mentorship & business coaching',
    keywords: ['MENTORSHIP', 'MENTOR', 'BUSINESS COACHING', 'COACHING'],
    dm: `Thank you for your interest in private mentorship or business coaching with Melanie JC through P31 Collective by NEBA! Whether you’re seeking spiritual guidance, clarity in your purpose, or strategic business development, your first step is scheduling an introductory call.\n\n${INTRO_CALL}`,
    comment: 'Your next level begins with intentional guidance! Check your DMs for the next step.',
    commentNoDm: `Your next level begins with intentional guidance! Your first step is an introductory call: ${INTRO_CALL}`,
    tiktok: `Your next level begins with intentional guidance! Your first step is an introductory call: ${INTRO_CALL}`,
  },
];

export const templatesFor = (site: Site) => (site === 'collective' ? COLLECTIVE_TEMPLATES : MARKET_TEMPLATES);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = (t: Template) => new RegExp(`\\b(?:${t.keywords.map((k) => escapeRe(k.toLowerCase()).replace(/ /g, '\\s+')).join('|')})\\b`);

/** The first of a brand's templates whose keyword is in the text (emails never count). */
export function matchTemplate(site: Site, text: string) {
  const t = normalize(text).replace(EMAILS, ' ');
  return templatesFor(site).find((tpl) => pattern(tpl).test(t)) || null;
}

// ── Links already sent ──
export const links = (s: string) => (s.match(/https?:\/\/[^\s)]+/g) || []).map((u) => u.replace(/[.,!?]+$/, '').replace(/\/$/, '').toLowerCase());
/** A canned reply is only sent if its link has not already gone to this person. */
export const alreadySentLink = (template: string, sent: string[]) => links(template).some((l) => sent.some((m) => links(m).includes(l)));

/** Instagram and Facebook can DM the person who commented (one private reply per comment); TikTok cannot. */
export const canPrivateReply = (platform: string) => platform === 'instagram' || platform === 'facebook';

/** The public reply under a comment, once we know whether the private reply went out. */
export function publicReply(pick: Pick, platform: string, dmSent: boolean) {
  if (platform === 'tiktok') return pick.tiktok;
  return dmSent ? pick.comment : pick.commentNoDm;
}

const asPick = (kind: Pick['kind'], t: Template, sendDm: boolean): Pick => {
  const { label: _label, keywords: _keywords, ...copy } = t;
  return { kind, sendDm, ...copy };
};

/**
 * Which canned reply applies, if any (null = the model answers). Precedence:
 *   Market DM:       email (after the ask, on its own, or with an info request) > info request (ask not sent yet)
 *                    > keyword template (first turn) > model
 *   Market comment:  info request (with no email in it) > keyword template > model
 *   Collective:      keyword template > model (no info-request flow on the Collective)
 * Keyword templates need the keyword on its own (keywordOnly), and in a DM their link must not have gone out already.
 * A comment that already carries an email never gets the email ask: the model answers without repeating it and
 * hands it to the team. `text` is the newest message(s) from the person; `sentTexts` what we already sent (DMs only).
 */
export function pickTrigger({ site, surface, platform, text, firstTurn = false, sentTexts = [] }: {
  site: Site; surface: Surface; platform: string; text: string; firstTurn?: boolean; sentTexts?: string[];
}): Pick | null {
  const sendDm = surface === 'dm' || canPrivateReply(platform);
  if (site === 'market') {
    if (surface === 'dm') {
      const asked = sentTexts.some((s) => normalize(s).includes(ASKED));
      const thanked = sentTexts.some((s) => normalize(s).includes(THANKED));
      const email = findEmail(text);
      // An info request that already carries the email ("I'm interested! jane@x.com") is thanked, never asked again.
      if (email && !thanked && (asked || littleMoreThanEmail(text) || isInfoRequest(text))) {
        return { kind: 'email', key: 'email', sendDm: true, dm: EMAIL_THANKS, comment: '', commentNoDm: '', tiktok: '', email };
      }
      if (isInfoRequest(text) && !asked && !thanked) return asPick('info', INFO_TEMPLATE, true);
    } else if (isInfoComment(text) && !findEmail(text)) {
      return asPick('info', INFO_TEMPLATE, sendDm);
    }
  }
  if (surface === 'dm' && !firstTurn) return null;
  if (!keywordOnly(text)) return null;
  const t = matchTemplate(site, text);
  if (!t || (surface === 'dm' && alreadySentLink(t.dm, sentTexts))) return null;
  return asPick('template', t, sendDm);
}
