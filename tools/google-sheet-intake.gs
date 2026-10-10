// P31 Collective: website applications → this Google Sheet ("Form Responses 1").
// Each application from thep31collective.org/join fills the row right after the last person,
// in the same columns as the Google Form rows, shaded light purple.
// Setup: Extensions → Apps Script, paste this, Save, Deploy → Manage deployments → pencil →
// Version: New version → Deploy. TOKEN must match JOIN_SHEET_TOKEN in Supabase.
const TOKEN = 'p31-QcUlkPNjapeMxFmynLVi5qXH2toOva8L';
const SHEET_NAME = '';           // the tab to fill; '' = the first tab
const WEBSITE_COLOR = '#E9DAFB'; // shading for website rows; '' for none

// Short headings a sheet might use for the same question.
const ALIASES = {
  'first and last name': ['name', 'full name'],
  'name of your business or ministry': ['business', 'business name', 'business or ministry', 'ministry'],
  'email address': ['email', 'e mail'],
  'phone number': ['phone', 'cell', 'mobile'],
  'city state': ['city', 'location'],
  'birthday month day': ['birthday', 'birth date', 'date of birth'],
  'social media handle s': ['social media', 'socials', 'instagram', 'social media handles'],
};
// Answers that identify a person: used to find the last filled-in row.
const IDENTITY = ['first and last name', 'email address'];

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Which answer belongs under this heading. Google Form headings can carry a description
// before or after the question, so a heading that contains the full question also counts.
function matchKey(heading, keys) {
  const h = norm(heading);
  if (!h) return null;
  if (h === 'timestamp') return 'Timestamp';
  return keys.find((k) => norm(k) === h)
    || keys.find((k) => (ALIASES[norm(k)] || []).indexOf(h) !== -1)
    || keys.find((k) => norm(k).split(' ').length >= 3 && (' ' + h + ' ').indexOf(' ' + norm(k) + ' ') !== -1)
    || (/\bagree/.test(h) && keys.indexOf('Agreement') !== -1 ? 'Agreement' : null);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.token !== TOKEN) return reply({ ok: false, error: 'token' });
    const row = body.row || {};
    const keys = Object.keys(row);
    lock.waitLock(20000);

    const book = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = SHEET_NAME ? book.getSheetByName(SHEET_NAME) : book.getSheets()[0];
    if (!sheet) return reply({ ok: false, error: 'no tab named ' + SHEET_NAME });
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, keys.length).setValues([keys]);

    // Every column whose heading matches an answer gets it (both "Email Address" columns, too).
    const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
    const cells = []; // [column number, value, key]
    headers.forEach((heading, i) => {
      const k = matchKey(heading, keys);
      if (!k) return;
      cells.push([i + 1, k === 'Timestamp' ? new Date() : row[k], k]);
    });

    // The row right after the last person (by name and email), so a color key, checkboxes
    // or formatting further down never push new people to the bottom.
    const who = cells.filter((c) => IDENTITY.indexOf(norm(c[2])) !== -1).map((c) => c[0]);
    const target = nextRow(sheet, who.length ? who : cells.map((c) => c[0]));
    cells.forEach((c) => sheet.getRange(target, c[0]).setValue(c[1]));
    if (WEBSITE_COLOR) sheet.getRange(target, 1, 1, headers.length).setBackground(WEBSITE_COLOR);
    return reply({ ok: true, row: target, filled: cells.length });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) { /* not held */ }
  }
}

function nextRow(sheet, cols) {
  const last = sheet.getLastRow();
  if (last < 2 || !cols.length) return Math.max(2, last + 1);
  const first = Math.min.apply(null, cols);
  const width = Math.max.apply(null, cols) - first + 1;
  const data = sheet.getRange(2, first, last - 1, width).getDisplayValues();
  for (let r = data.length - 1; r >= 0; r--) {
    if (cols.some((c) => String(data[r][c - first]).trim() !== '')) return r + 3;
  }
  return 2;
}

// Open the web app URL in a browser to check it's live.
function doGet() {
  return reply({ ok: true, ready: true });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
