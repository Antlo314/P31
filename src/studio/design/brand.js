// The P31 look for the Design studio: page sizes, colour styles drawn from the brand palette
// (Thistle, Dark Purple, Amethyst, Olive, Gold, Cal Poly Green) and the CEO's own Canva quote
// card (lilac, royal purple, olive script), the handles, and the sign-up links posts point to.

export const SIZES = {
  post: { w: 1080, h: 1350, label: 'Post 4:5', short: 'Post', note: 'Instagram and Facebook feed' },
  square: { w: 1080, h: 1080, label: 'Square 1:1', short: 'Square', note: 'Feed, carousels' },
  story: { w: 1080, h: 1920, label: 'Story / Reel 9:16', short: 'Story 9:16', note: 'Stories, Reels, Shorts' },
};

// bg: page colour (bg2 makes it a soft gradient), line: pattern strokes, ink: headline,
// accent: the script handle and highlights, soft: smaller text, mark: the highlighter behind *words*.
export const STYLES = [
  { key: 'lilac', name: 'Lilac', bg: '#CEAEDF', line: '#AF9EAC', ink: '#742D9B', accent: '#687733', soft: '#5B2A73', mark: '#F2CE4D' },
  { key: 'plum', name: 'Plum night', bg: '#3A1C36', line: '#57324F', ink: '#E3D0EA', accent: '#D9A93A', soft: '#CDB5D6', mark: '#9B71B2', dark: true },
  { key: 'olive', name: 'Olive', bg: '#6C6D11', line: '#83842F', ink: '#FFF8E1', accent: '#F2CE4D', soft: '#F1EBC8', mark: '#D9A93A', dark: true },
  { key: 'thistle', name: 'Thistle', bg: '#E3D0EA', line: '#CBB4D3', ink: '#3A1C36', accent: '#9B71B2', soft: '#5E3B59', mark: '#F2CE4D' },
  { key: 'gold', name: 'Gold', bg: '#D9A93A', line: '#C49228', ink: '#3A1C36', accent: '#FFF4D6', soft: '#4A2A10', mark: '#FFF4D6' },
  { key: 'green', name: 'Cal Poly green', bg: '#374126', line: '#4C5836', ink: '#E3D0EA', accent: '#D9A93A', soft: '#D7DCC4', mark: '#6C6D11', dark: true },
  { key: 'amethyst', name: 'Amethyst', bg: '#9B71B2', line: '#8A61A0', ink: '#FFFFFF', accent: '#F2CE4D', soft: '#F3EAF6', mark: '#742D9B', dark: true },
  { key: 'ivory', name: 'Ivory', bg: '#F6EFE3', line: '#E2D5C1', ink: '#3A1C36', accent: '#6C6D11', soft: '#5E4A3A', mark: '#E3D0EA' },
  { key: 'royal', name: 'Royal', bg: '#742D9B', line: '#853FAB', ink: '#F3EAF6', accent: '#F2CE4D', soft: '#E3D0EA', mark: '#9B71B2', dark: true },
  { key: 'sage', name: 'Sage', bg: '#C9CDA0', line: '#B3B888', ink: '#374126', accent: '#742D9B', soft: '#4C5836', mark: '#F6EFE3' },
  { key: 'blush', name: 'Blush thistle', bg: '#F0E2F2', bg2: '#DCC3E6', line: '#D3BDDC', ink: '#742D9B', accent: '#6C6D11', soft: '#5B2A73', mark: '#F2CE4D' },
  { key: 'dusk', name: 'Dusk', bg: '#4C2546', bg2: '#2A1327', line: '#61385A', ink: '#F2CE4D', accent: '#E3D0EA', soft: '#E3D0EA', mark: '#742D9B', dark: true },
];
export const styleOf = (key) => STYLES.find((s) => s.key === key) || STYLES[0];

/** Every brand swatch, for the colour pickers. */
export const SWATCHES = ['#742D9B', '#3A1C36', '#9B71B2', '#CEAEDF', '#E3D0EA', '#F3EAF6', '#6C6D11', '#687733', '#374126', '#C9CDA0', '#D9A93A', '#F2CE4D', '#FFF4D6', '#F6EFE3', '#FFFFFF', '#1E0F1C'];

export const HANDLES = { market: '@Proverbs31Market', collective: '@the.p31collective' };

export const LINKS = {
  curator: { url: 'https://www.p31market.com/apply', short: 'p31market.com/apply' },
  mentorship: { url: 'https://www.thep31collective.org/join', short: 'thep31collective.org/join' },
  market: { url: 'https://www.p31market.com', short: 'p31market.com' },
};
